"""
Premium-entitlement resolution.

Central place that answers "does this user have premium access?" — used by the
DRF permission classes and anywhere else that gates premium features.

A user is entitled to premium if ANY of the following holds:
  * their own ``UserProfile.is_paid`` (B2C paid),
  * their own active free trial (``UserProfile.is_trial_active``),
  * they are an active member of an Organization whose seat license is active
    and unexpired (B2B inherited entitlement).

Keeping this logic in one module avoids drift between the per-user Stripe path
and the org seat-license path.
"""
from django.db.models import Q
from django.utils import timezone

from .models import Organization, OrgMembership, MembershipStatus


def active_org_for(user):
    """Return the user's primary active Organization, or None.

    "Primary" = the most-recently-joined active membership's org. Used both to
    stamp the tenant FK on new activity rows and to resolve the org an
    admin/instructor is acting within.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    membership = (
        OrgMembership.objects
        .filter(user=user, status=MembershipStatus.ACTIVE)
        .select_related('organization')
        .order_by('-joined_at')
        .first()
    )
    return membership.organization if membership else None


def user_has_org_license(user):
    """True if the user is an active member of an org with a live seat license."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    now = timezone.now()
    return (
        Organization.objects
        .filter(
            memberships__user=user,
            memberships__status=MembershipStatus.ACTIVE,
            license_active=True,
        )
        .filter(Q(license_expires_at__isnull=True) | Q(license_expires_at__gte=now))
        .exists()
    )


def user_has_premium(user):
    """Unified premium check: individual paid/trial OR inherited org seat license."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    try:
        profile = user.userprofile
    except Exception:
        profile = None
    if profile and (profile.is_paid or profile.is_trial_active):
        return True
    return user_has_org_license(user)
