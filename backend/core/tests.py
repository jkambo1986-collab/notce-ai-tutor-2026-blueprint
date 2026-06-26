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
