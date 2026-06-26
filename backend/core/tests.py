"""
Tests for B2B multi-tenancy + RBAC.

Focus areas:
  * Entitlement inheritance: an org seat license grants premium to members.
  * Tenant isolation: a user cannot see or act on an org they don't belong to.
  * RBAC: only admins/owners can manage members; owner role is owner-gated.
  * Invites & seats: redemption respects seat limits and activates membership.

These are the first automated tests in the repo; run with:
    DEBUG=True python manage.py test core
"""
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (
    Organization, OrgMembership, OrgInvite, OrgRole, MembershipStatus, UserProfile,
    CaseStudy, Question, UserAnswer, MockStudySession, ReviewItem,
)
from .entitlements import user_has_premium, active_org_for


def make_user(username, email=None, **profile_kwargs):
    user = User.objects.create_user(username=username, email=email or f"{username}@example.com", password="pw12345!")
    UserProfile.objects.get_or_create(user=user, defaults=profile_kwargs)
    if profile_kwargs:
        UserProfile.objects.filter(user=user).update(**profile_kwargs)
    return user


def make_org(slug, *, seats=5, active=True, expires=None):
    return Organization.objects.create(
        name=slug.title(), slug=slug, seats_total=seats,
        license_active=active, license_expires_at=expires,
    )


class EntitlementInheritanceTests(APITestCase):
    def test_active_org_license_grants_premium(self):
        org = make_org("alpha", active=True)
        student = make_user("stud1")
        OrgMembership.objects.create(organization=org, user=student, role=OrgRole.MEMBER, status=MembershipStatus.ACTIVE)
        self.assertTrue(user_has_premium(student))
        self.assertEqual(active_org_for(student), org)

    def test_inactive_license_does_not_grant_premium(self):
        org = make_org("beta", active=False)
        student = make_user("stud2")
        OrgMembership.objects.create(organization=org, user=student, role=OrgRole.MEMBER, status=MembershipStatus.ACTIVE)
        self.assertFalse(user_has_premium(student))

    def test_expired_license_does_not_grant_premium(self):
        org = make_org("gamma", active=True, expires=timezone.now() - timezone.timedelta(days=1))
        student = make_user("stud3")
        OrgMembership.objects.create(organization=org, user=student, role=OrgRole.MEMBER, status=MembershipStatus.ACTIVE)
        self.assertFalse(user_has_premium(student))

    def test_removed_member_loses_premium(self):
        org = make_org("delta", active=True)
        student = make_user("stud4")
        OrgMembership.objects.create(organization=org, user=student, role=OrgRole.MEMBER, status=MembershipStatus.REMOVED)
        self.assertFalse(user_has_premium(student))


class TenantIsolationTests(APITestCase):
    def setUp(self):
        self.org_a = make_org("school-a")
        self.org_b = make_org("school-b")
        self.admin_a = make_user("admin_a")
        self.admin_b = make_user("admin_b")
        OrgMembership.objects.create(organization=self.org_a, user=self.admin_a, role=OrgRole.ADMIN, status=MembershipStatus.ACTIVE)
        OrgMembership.objects.create(organization=self.org_b, user=self.admin_b, role=OrgRole.ADMIN, status=MembershipStatus.ACTIVE)

    def test_list_only_returns_own_orgs(self):
        self.client.force_authenticate(self.admin_a)
        resp = self.client.get("/api/organizations/")
        self.assertEqual(resp.status_code, 200)
        slugs = {o["slug"] for o in resp.data}
        self.assertEqual(slugs, {"school-a"})

    def test_cannot_retrieve_other_tenant_org(self):
        self.client.force_authenticate(self.admin_a)
        resp = self.client.get(f"/api/organizations/{self.org_b.id}/")
        self.assertEqual(resp.status_code, 404)  # scoped queryset hides it

    def test_cannot_view_other_tenant_members(self):
        self.client.force_authenticate(self.admin_a)
        resp = self.client.get(f"/api/organizations/{self.org_b.id}/members/")
        # Denied either by role check (403) or scoped queryset (404) — both isolate.
        self.assertIn(resp.status_code, (403, 404))

    def test_cannot_invite_into_other_tenant(self):
        self.client.force_authenticate(self.admin_a)
        resp = self.client.post(f"/api/organizations/{self.org_b.id}/invite/", {"email": "x@y.com"})
        self.assertIn(resp.status_code, (403, 404))


class RbacTests(APITestCase):
    def setUp(self):
        self.org = make_org("school-c", seats=3)
        self.owner = make_user("owner_c")
        self.member = make_user("member_c")
        OrgMembership.objects.create(organization=self.org, user=self.owner, role=OrgRole.OWNER, status=MembershipStatus.ACTIVE)
        self.member_m = OrgMembership.objects.create(organization=self.org, user=self.member, role=OrgRole.MEMBER, status=MembershipStatus.ACTIVE)

    def test_member_cannot_invite(self):
        self.client.force_authenticate(self.member)
        resp = self.client.post(f"/api/organizations/{self.org.id}/invite/", {"email": "new@x.com"})
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_invite(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.post(f"/api/organizations/{self.org.id}/invite/", {"email": "new@x.com", "role": "member"})
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(OrgInvite.objects.filter(organization=self.org, email="new@x.com").exists())

    def test_admin_cannot_grant_owner(self):
        admin = make_user("admin_c")
        OrgMembership.objects.create(organization=self.org, user=admin, role=OrgRole.ADMIN, status=MembershipStatus.ACTIVE)
        self.client.force_authenticate(admin)
        resp = self.client.post(f"/api/organizations/{self.org.id}/set_role/",
                                {"user_id": self.member.id, "role": "owner"})
        self.assertEqual(resp.status_code, 403)

    def test_owner_can_promote_to_admin(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.post(f"/api/organizations/{self.org.id}/set_role/",
                                {"user_id": self.member.id, "role": "admin"})
        self.assertEqual(resp.status_code, 200)
        self.member_m.refresh_from_db()
        self.assertEqual(self.member_m.role, OrgRole.ADMIN)


class InviteRedemptionTests(APITestCase):
    def test_accept_invite_activates_membership_and_premium(self):
        org = make_org("school-d", seats=2, active=True)
        owner = make_user("owner_d")
        OrgMembership.objects.create(organization=org, user=owner, role=OrgRole.OWNER, status=MembershipStatus.ACTIVE)
        invitee = make_user("invitee_d")
        invite = OrgInvite.objects.create(
            organization=org, email=invitee.email, role=OrgRole.MEMBER,
            token="tok-123", expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.assertFalse(user_has_premium(invitee))

        self.client.force_authenticate(invitee)
        resp = self.client.post("/api/organizations/accept_invite/", {"token": "tok-123"})
        self.assertEqual(resp.status_code, 201)
        invite.refresh_from_db()
        self.assertIsNotNone(invite.accepted_at)
        self.assertTrue(OrgMembership.objects.filter(organization=org, user=invitee, status=MembershipStatus.ACTIVE).exists())
        self.assertTrue(user_has_premium(invitee))

    def test_accept_invite_rejected_when_no_seats(self):
        org = make_org("school-e", seats=1, active=True)
        owner = make_user("owner_e")
        OrgMembership.objects.create(organization=org, user=owner, role=OrgRole.OWNER, status=MembershipStatus.ACTIVE)  # fills the 1 seat
        invitee = make_user("invitee_e")
        OrgInvite.objects.create(
            organization=org, email=invitee.email, role=OrgRole.MEMBER,
            token="tok-456", expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.client.force_authenticate(invitee)
        resp = self.client.post("/api/organizations/accept_invite/", {"token": "tok-456"})
        self.assertEqual(resp.status_code, 409)

    def test_invalid_token_rejected(self):
        invitee = make_user("invitee_f")
        self.client.force_authenticate(invitee)
        resp = self.client.post("/api/organizations/accept_invite/", {"token": "nope"})
        self.assertEqual(resp.status_code, 400)


class AnalyticsTests(APITestCase):
    def setUp(self):
        self.org = make_org("school-analytics")
        self.instructor = make_user("instr_a")
        self.s1 = make_user("learner1")
        self.s2 = make_user("learner2")
        OrgMembership.objects.create(organization=self.org, user=self.instructor, role=OrgRole.INSTRUCTOR, status=MembershipStatus.ACTIVE)
        OrgMembership.objects.create(organization=self.org, user=self.s1, role=OrgRole.MEMBER, status=MembershipStatus.ACTIVE)
        OrgMembership.objects.create(organization=self.org, user=self.s2, role=OrgRole.MEMBER, status=MembershipStatus.ACTIVE)
        # Seed case-study answers (org-stamped) for learner1: 2/3 correct.
        case = CaseStudy.objects.create(id="c-an", title="t", vignette="v", setting="s")
        q = Question.objects.create(id="c-an-q1", case_study=case, stem="?", domain="OT_EXP", correct_label="A", correct_rationale="r")
        for label, ok in [("A", True), ("A", True), ("B", False)]:
            UserAnswer.objects.create(user=self.s1, question=q, selected_label=label, confidence="MED", is_correct=ok, organization=self.org)
        # Seed a mock session (org-stamped) for learner2: 1/2 correct.
        MockStudySession.objects.create(
            user=self.s2, organization=self.org, domain="OT_EXP", difficulty="Medium",
            total_questions=2, current_question=2, correct_count=1,
            session_history=[{"is_correct": True}, {"is_correct": False}],
        )

    def test_instructor_sees_per_student_and_rollup(self):
        self.client.force_authenticate(self.instructor)
        resp = self.client.get(f"/api/organizations/{self.org.id}/analytics/")
        self.assertEqual(resp.status_code, 200)
        data = resp.data
        self.assertEqual(data["summary"]["members"], 3)
        self.assertEqual(data["summary"]["active_learners"], 2)
        self.assertEqual(data["summary"]["answered"], 5)   # 3 case + 2 mock
        self.assertEqual(data["summary"]["correct"], 3)    # 2 + 1
        by_user = {s["username"]: s for s in data["students"]}
        self.assertEqual(by_user["learner1"]["answered"], 3)
        self.assertEqual(by_user["learner1"]["accuracy"], 67)
        self.assertEqual(by_user["learner2"]["answered"], 2)
        self.assertEqual(by_user["learner2"]["accuracy"], 50)

    def test_plain_member_cannot_view_analytics(self):
        self.client.force_authenticate(self.s1)
        resp = self.client.get(f"/api/organizations/{self.org.id}/analytics/")
        self.assertEqual(resp.status_code, 403)


class OrgStampingTests(APITestCase):
    """Verifies activity created through the real API is stamped with the org FK
    (the basis for all cohort analytics)."""
    def test_answer_submission_is_stamped_with_org(self):
        org = make_org("school-stamp")
        student = make_user("stamp_student")
        OrgMembership.objects.create(organization=org, user=student, role=OrgRole.MEMBER, status=MembershipStatus.ACTIVE)
        case = CaseStudy.objects.create(id="c-st", title="t", vignette="v", setting="s")
        q = Question.objects.create(id="c-st-q1", case_study=case, stem="?", domain="OT_EXP", correct_label="A", correct_rationale="r")

        self.client.force_authenticate(student)
        resp = self.client.post("/api/answers/", {"question": q.id, "selected_label": "A", "confidence": "HIGH"})
        self.assertEqual(resp.status_code, 201)
        answer = UserAnswer.objects.get(user=student, question=q)
        self.assertEqual(answer.organization_id, org.id)
        self.assertTrue(answer.is_correct)

    def test_b2c_answer_has_no_org(self):
        student = make_user("solo_student")
        case = CaseStudy.objects.create(id="c-solo", title="t", vignette="v", setting="s")
        q = Question.objects.create(id="c-solo-q1", case_study=case, stem="?", domain="OT_EXP", correct_label="A", correct_rationale="r")
        self.client.force_authenticate(student)
        resp = self.client.post("/api/answers/", {"question": q.id, "selected_label": "B", "confidence": "LOW"})
        self.assertEqual(resp.status_code, 201)
        answer = UserAnswer.objects.get(user=student, question=q)
        self.assertIsNone(answer.organization_id)


class SrsTests(APITestCase):
    """Spaced-repetition: weak items enter the schedule, become due, and are
    rescheduled out of the queue once remembered."""
    def setUp(self):
        self.user = make_user("srs_user")
        case = CaseStudy.objects.create(id="c-srs", title="t", vignette="v", setting="s")
        self.q = Question.objects.create(id="c-srs-q1", case_study=case, stem="Why?", domain="OT_EXP", correct_label="A", correct_rationale="because")
        # A wrong answer makes this a weak item.
        UserAnswer.objects.create(user=self.user, question=self.q, selected_label="B", confidence="MED", is_correct=False)
        self.client.force_authenticate(self.user)

    def test_weak_item_becomes_due_and_reschedules(self):
        # First load: the weak item is discovered and due now.
        resp = self.client.get("/api/review-queue/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
        key = resp.data["items"][0]["key"]
        self.assertEqual(key, f"case:{self.q.id}")

        # Grade it "remembered" → it should leave the due queue (scheduled out).
        g = self.client.post("/api/review-queue/", {"item_key": key, "remembered": True}, format="json")
        self.assertEqual(g.status_code, 200)
        self.assertEqual(g.data["box"], 1)
        item = ReviewItem.objects.get(user=self.user, item_key=key)
        self.assertGreater(item.due_at, timezone.now())

        resp2 = self.client.get("/api/review-queue/")
        self.assertEqual(resp2.data["count"], 0)

    def test_forgot_resets_box(self):
        self.client.get("/api/review-queue/")  # discover
        key = f"case:{self.q.id}"
        ReviewItem.objects.filter(user=self.user, item_key=key).update(box=3)
        g = self.client.post("/api/review-queue/", {"item_key": key, "remembered": False}, format="json")
        self.assertEqual(g.status_code, 200)
        self.assertEqual(g.data["box"], 0)
        self.assertEqual(ReviewItem.objects.get(user=self.user, item_key=key).lapses, 1)

    def test_grade_unknown_item_404(self):
        resp = self.client.post("/api/review-queue/", {"item_key": "case:nope", "remembered": True}, format="json")
        self.assertEqual(resp.status_code, 404)


class CohortAssignmentTests(APITestCase):
    def setUp(self):
        self.org = make_org("school-assign")
        self.instructor = make_user("assign_instr")
        self.student = make_user("assign_student")
        OrgMembership.objects.create(organization=self.org, user=self.instructor, role=OrgRole.INSTRUCTOR, status=MembershipStatus.ACTIVE)
        OrgMembership.objects.create(organization=self.org, user=self.student, role=OrgRole.MEMBER, status=MembershipStatus.ACTIVE)

    def test_instructor_creates_student_reads(self):
        self.client.force_authenticate(self.instructor)
        c = self.client.post(f"/api/organizations/{self.org.id}/assignments/",
                             {"title": "Drill PROF_RESP", "domain": "PROF_RESP", "target_questions": 25}, format="json")
        self.assertEqual(c.status_code, 201)

        # Student sees it via the no-org-id endpoint.
        self.client.force_authenticate(self.student)
        mine = self.client.get("/api/organizations/my_assignments/")
        self.assertEqual(mine.status_code, 200)
        self.assertEqual(len(mine.data), 1)
        self.assertEqual(mine.data[0]["title"], "Drill PROF_RESP")

    def test_student_cannot_create(self):
        self.client.force_authenticate(self.student)
        c = self.client.post(f"/api/organizations/{self.org.id}/assignments/",
                             {"title": "x", "target_questions": 5}, format="json")
        self.assertEqual(c.status_code, 403)

    def test_b2c_user_has_no_assignments(self):
        solo = make_user("assign_solo")
        self.client.force_authenticate(solo)
        resp = self.client.get("/api/organizations/my_assignments/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])
