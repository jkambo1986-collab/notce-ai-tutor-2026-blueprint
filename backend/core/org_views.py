"""
B2B organization (tenant) API: membership management, invitations, and RBAC.

Endpoints (mounted under /api/organizations/ by core/urls.py):
  * GET    organizations/                  -> orgs the caller belongs to (staff: all)
  * GET    organizations/{id}/             -> one org (seat/license state + my_role)
  * GET    organizations/{id}/members/     -> roster              (instructor+)
  * GET    organizations/{id}/pending_invites/ -> open invites    (admin+)
  * POST   organizations/{id}/invite/      -> invite by email     (admin+)
  * POST   organizations/{id}/set_role/    -> change a member role (admin+)
  * POST   organizations/{id}/remove_member/ -> soft-remove member (admin+)
  * POST   organizations/accept_invite/    -> redeem an invite token (any auth user)

Tenant isolation: the queryset is always scoped to the caller's memberships, and
the role-gated actions resolve the caller's role *within the targeted org* via the
permission classes in core/permissions.py. There is no cross-tenant access.
"""
import os
import uuid
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from django.db.models import Count, Q

from .models import (
    Organization, OrgMembership, OrgInvite, OrgRole, MembershipStatus,
    UserAnswer, MockStudySession, CohortAssignment,
)
from .serializers import (
    OrganizationSerializer, OrgMembershipSerializer, OrgInviteSerializer,
    CohortAssignmentSerializer,
)
from .permissions import IsOrgAdmin, IsOrgInstructor, IsOrgMember
from .entitlements import active_org_for

logger = logging.getLogger(__name__)

INVITE_TTL_DAYS = 14
ASSIGNABLE_ROLES = {OrgRole.ADMIN, OrgRole.INSTRUCTOR, OrgRole.MEMBER}  # owner is granted only by an owner


def _caller_membership(request, org):
    return org.memberships.filter(user=request.user, status=MembershipStatus.ACTIVE).first()


class OrganizationViewSet(viewsets.ReadOnlyModelViewSet):
    """Read + custom-action API for organizations the caller can see."""
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Organization.objects.all()
        # Scope to orgs where the caller is an active member — the tenant boundary.
        return Organization.objects.filter(
            memberships__user=user, memberships__status=MembershipStatus.ACTIVE
        ).distinct()

    # --- Roster (instructor/admin/owner) ---
    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsOrgInstructor])
    def members(self, request, pk=None):
        org = self.get_object()
        qs = org.memberships.exclude(status=MembershipStatus.REMOVED).select_related('user').order_by('user__username')
        return Response(OrgMembershipSerializer(qs, many=True).data)

    # --- Cohort analytics (instructor/admin/owner) ---
    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsOrgInstructor])
    def analytics(self, request, pk=None):
        """Per-student + org-rollup performance for this tenant.

        All activity is scoped by the denormalized ``organization`` FK on
        UserAnswer / MockStudySession, so it reflects work done *as a member of
        this org* and never leaks another tenant's data. Case-study answers
        (UserAnswer) and mock/exam answers (MockStudySession.session_history) are
        combined into one accuracy figure per student.
        """
        org = self.get_object()

        # Case-study answers, aggregated per user in the DB.
        case_rows = (UserAnswer.objects.filter(organization=org)
                     .values('user_id')
                     .annotate(total=Count('id'), correct=Count('id', filter=Q(is_correct=True))))
        case_by_user = {r['user_id']: r for r in case_rows}

        # Mock/exam answers live in JSON history; accumulate in Python.
        mock_by_user = {}
        for uid, history in MockStudySession.objects.filter(organization=org).values_list('user_id', 'session_history'):
            agg = mock_by_user.setdefault(uid, {'total': 0, 'correct': 0})
            for item in (history or []):
                agg['total'] += 1
                if item.get('is_correct'):
                    agg['correct'] += 1

        students = []
        roll_total = roll_correct = active_learners = 0
        members = (org.memberships.filter(status=MembershipStatus.ACTIVE)
                   .select_related('user').order_by('user__username'))
        for m in members:
            uid = m.user_id
            c = case_by_user.get(uid, {'total': 0, 'correct': 0})
            k = mock_by_user.get(uid, {'total': 0, 'correct': 0})
            total = c['total'] + k['total']
            correct = c['correct'] + k['correct']
            accuracy = round(100 * correct / total) if total else None
            if total:
                active_learners += 1
            roll_total += total
            roll_correct += correct
            students.append({
                'user_id': uid,
                'username': m.user.username,
                'email': m.user.email,
                'role': m.role,
                'answered': total,
                'correct': correct,
                'accuracy': accuracy,
            })

        return Response({
            'organization': {'id': org.id, 'name': org.name, 'slug': org.slug},
            'summary': {
                'members': len(students),
                'active_learners': active_learners,
                'answered': roll_total,
                'correct': roll_correct,
                'accuracy': round(100 * roll_correct / roll_total) if roll_total else None,
            },
            'students': students,
        })

    # --- Cohort assignments (instructors set targets; members read them) ---
    @action(detail=True, methods=['get', 'post'], permission_classes=[permissions.IsAuthenticated, IsOrgMember])
    def assignments(self, request, pk=None):
        """GET: active assignments for this org (any member). POST: create one
        (instructor/admin/owner only)."""
        org = self.get_object()
        if request.method.lower() == 'post':
            m = _caller_membership(request, org)
            if not (request.user.is_staff or (m and m.can_view_analytics)):
                return Response({'error': 'instructor access required'}, status=403)
            serializer = CohortAssignmentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            obj = serializer.save(organization=org, created_by=request.user)
            return Response(CohortAssignmentSerializer(obj).data, status=201)

        qs = org.assignments.filter(is_active=True)
        return Response(CohortAssignmentSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'], url_path=r'assignments/(?P<assignment_id>\d+)/archive',
            permission_classes=[permissions.IsAuthenticated, IsOrgInstructor])
    def archive_assignment(self, request, pk=None, assignment_id=None):
        """Deactivate an assignment (instructor/admin/owner)."""
        org = self.get_object()
        updated = org.assignments.filter(id=assignment_id).update(is_active=False)
        if not updated:
            return Response({'error': 'assignment not found'}, status=404)
        return Response({'status': 'archived', 'id': assignment_id})

    # --- Invites ---
    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsOrgAdmin])
    def pending_invites(self, request, pk=None):
        org = self.get_object()
        qs = org.invites.filter(accepted_at__isnull=True).order_by('-created_at')
        return Response(OrgInviteSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsOrgAdmin])
    def invite(self, request, pk=None):
        """Invite a student/instructor by email. Body: {email, role?}."""
        org = self.get_object()
        email = (request.data.get('email') or '').strip().lower()
        role = request.data.get('role') or OrgRole.MEMBER
        if not email:
            return Response({'error': 'email required'}, status=400)
        if role not in ASSIGNABLE_ROLES:
            return Response({'error': f'role must be one of {sorted(ASSIGNABLE_ROLES)}'}, status=400)

        # Don't over-provision: block new invites once seats are full. (Existing
        # members / already-invited emails can be re-sent without a seat check.)
        already_member = org.memberships.filter(user__email__iexact=email, status=MembershipStatus.ACTIVE).exists()
        existing_invite = org.invites.filter(email=email).first()
        if not already_member and not existing_invite and org.seats_total and org.seats_available <= 0:
            return Response({'error': 'No seats available. Increase seats_total or remove a member.'}, status=409)

        token = uuid.uuid4().hex
        expires = timezone.now() + timezone.timedelta(days=INVITE_TTL_DAYS)
        invite, _ = OrgInvite.objects.update_or_create(
            organization=org, email=email,
            defaults={
                'role': role, 'token': token, 'invited_by': request.user,
                'expires_at': expires, 'accepted_at': None,
            },
        )

        # Best-effort email; a send failure must not fail the invite creation.
        accept_link = f"{settings.FRONTEND_URL}/accept-invite?token={token}"
        try:
            send_mail(
                subject=f"You're invited to {org.name} on NOTCE AI Tutor",
                message=(
                    f"You've been invited to join {org.name} as a {role}.\n\n"
                    f"Accept your invitation: {accept_link}\n\n"
                    f"This link expires in {INVITE_TTL_DAYS} days."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:  # noqa: BLE001 - email is best-effort
            logger.error(f"Failed to send org invite to {email}: {e}")

        return Response(OrgInviteSerializer(invite).data, status=201)

    # --- Role management ---
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsOrgAdmin])
    def set_role(self, request, pk=None):
        """Change a member's role. Body: {user_id, role}. Only an owner may
        grant or revoke the owner role."""
        org = self.get_object()
        user_id = request.data.get('user_id')
        role = request.data.get('role')
        if not user_id or not role:
            return Response({'error': 'user_id and role required'}, status=400)
        if role not in dict(OrgRole.choices):
            return Response({'error': 'invalid role'}, status=400)

        caller = _caller_membership(request, org)
        caller_is_owner = bool(request.user.is_staff or (caller and caller.role == OrgRole.OWNER))
        # Granting/removing OWNER is owner-only (or platform staff).
        target = org.memberships.filter(user_id=user_id).first()
        if not target:
            return Response({'error': 'member not found'}, status=404)
        if (role == OrgRole.OWNER or target.role == OrgRole.OWNER) and not caller_is_owner:
            return Response({'error': 'only an owner can change owner role'}, status=403)
        # Don't allow demoting the last owner (would orphan the org).
        if target.role == OrgRole.OWNER and role != OrgRole.OWNER:
            owners = org.memberships.filter(role=OrgRole.OWNER, status=MembershipStatus.ACTIVE).count()
            if owners <= 1:
                return Response({'error': 'cannot demote the last owner'}, status=409)

        target.role = role
        target.save(update_fields=['role'])
        return Response(OrgMembershipSerializer(target).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsOrgAdmin])
    def remove_member(self, request, pk=None):
        """Soft-remove a member (frees their seat). Body: {user_id}."""
        org = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required'}, status=400)
        target = org.memberships.filter(user_id=user_id).first()
        if not target:
            return Response({'error': 'member not found'}, status=404)
        # Protect the last owner from removal.
        if target.role == OrgRole.OWNER:
            owners = org.memberships.filter(role=OrgRole.OWNER, status=MembershipStatus.ACTIVE).count()
            if owners <= 1:
                return Response({'error': 'cannot remove the last owner'}, status=409)
        target.status = MembershipStatus.REMOVED
        target.save(update_fields=['status'])
        return Response({'status': 'removed', 'user_id': user_id})

    # --- Billing: buy/extend seats (owner/admin) ---
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsOrgAdmin])
    def checkout_seats(self, request, pk=None):
        """Start a Stripe checkout for N seats. Body: {seats, success_url?, cancel_url?}.

        Gated by the PAYMENTS_ENABLED kill-switch (same as individual checkout).
        While payments are off, seats are granted manually via Django admin.
        """
        if os.environ.get('PAYMENTS_ENABLED', 'false').lower() != 'true':
            return Response(
                {'error': 'Payments are temporarily unavailable.', 'payments_disabled': True},
                status=503,
            )
        org = self.get_object()
        seats = request.data.get('seats')
        success_url = request.data.get('success_url', f"{settings.FRONTEND_URL}/org/billing/success")
        cancel_url = request.data.get('cancel_url', f"{settings.FRONTEND_URL}/org/billing/cancel")
        from .stripe_service import create_org_seat_checkout
        try:
            session = create_org_seat_checkout(org, request.user, seats, success_url, cancel_url)
            return Response({'sessionId': session.id, 'url': session.url})
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:  # noqa: BLE001
            logger.exception("Org seat checkout failed for %s", org.slug)
            return Response({'error': str(e)}, status=500)

    # --- Student-facing: my org's active assignments (no org id needed) ---
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_assignments(self, request):
        """Active assignments for the caller's primary org (empty for B2C users)."""
        org = active_org_for(request.user)
        if not org:
            return Response([])
        qs = org.assignments.filter(is_active=True)
        return Response(CohortAssignmentSerializer(qs, many=True).data)

    # --- Invite redemption (any authenticated user holding the token) ---
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def accept_invite(self, request):
        """Redeem an invite token for the current user. Body: {token}.

        Runs in a transaction with a row lock on the organization so concurrent
        redemptions of the last seat can't over-allocate (the seat check and the
        membership write are serialized per-org).
        """
        token = (request.data.get('token') or '').strip()
        if not token:
            return Response({'error': 'token required'}, status=400)

        invite = OrgInvite.objects.filter(token=token).select_related('organization').first()
        if not invite or not invite.is_pending:
            return Response({'error': 'invalid or expired invitation'}, status=400)

        try:
            with transaction.atomic():
                # Lock the org row: a second concurrent accept waits here until the
                # first commits, then re-reads seats_used and sees the new count.
                org = Organization.objects.select_for_update().get(pk=invite.organization_id)
                existing = org.memberships.filter(user=request.user).first()

                if existing and existing.status == MembershipStatus.ACTIVE:
                    invite.accepted_at = timezone.now()
                    invite.save(update_fields=['accepted_at'])
                    return Response(OrganizationSerializer(org, context={'request': request}).data)

                # Seat check for genuinely new active members (re-evaluated under lock).
                if not existing and org.seats_total and org.seats_available <= 0:
                    return Response({'error': 'No seats available in this organization.'}, status=409)

                if existing:
                    existing.status = MembershipStatus.ACTIVE
                    existing.role = invite.role
                    existing.save(update_fields=['status', 'role'])
                else:
                    OrgMembership.objects.create(
                        organization=org, user=request.user,
                        role=invite.role, status=MembershipStatus.ACTIVE,
                    )
                invite.accepted_at = timezone.now()
                invite.save(update_fields=['accepted_at'])
        except Organization.DoesNotExist:
            return Response({'error': 'organization no longer exists'}, status=404)

        return Response(OrganizationSerializer(org, context={'request': request}).data, status=201)
