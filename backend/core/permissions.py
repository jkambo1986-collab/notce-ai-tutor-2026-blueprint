"""
DRF permission classes.

Two concerns live here:
  * Entitlement gating (premium access) — now routed through
    ``core.entitlements`` so the per-user Stripe path and the B2B org seat-license
    path stay in sync.
  * RBAC — org-membership-aware permissions used by the B2B admin/instructor API.

The RBAC classes resolve the caller's org from the route (``org_pk``/``pk``) when
present, else from their primary active membership, and verify the caller's role
within *that* org. They never grant cross-tenant access.
"""
from rest_framework import permissions

from .entitlements import user_has_premium, user_has_org_license
from .models import OrgMembership, MembershipStatus, OrgRole


class IsPaidUser(permissions.BasePermission):
    """Full premium access: an individual paid subscription OR an inherited org
    seat license. (Free trial alone is NOT enough — use IsPaidOrTrialUser for
    conversion-driving sampling.)"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        try:
            if request.user.userprofile.is_paid:
                return True
        except AttributeError:
            pass
        return user_has_org_license(request.user)


class IsPaidOrTrialUser(permissions.BasePermission):
    """Paid users, active-trial users, OR org-seat-licensed members. Used for
    premium content (question bank, mock study) where trial users should get a
    taste to drive conversion and org students inherit access."""
    def has_permission(self, request, view):
        return user_has_premium(request.user)


# --- RBAC (B2B org roles) ---

def _membership_for(request, view):
    """Resolve the caller's active membership in the org targeted by this request.

    Org is taken from an ``org_pk``/``organization``/``pk`` kwarg/param when the
    route is org-scoped, otherwise from the caller's primary active membership.
    Returns the OrgMembership or None.
    """
    user = request.user
    if not user or not user.is_authenticated:
        return None

    org_id = (
        view.kwargs.get('org_pk')
        or view.kwargs.get('organization_pk')
        or view.kwargs.get('pk')  # detail routes: /organizations/{pk}/... -> pk is the org id
        or request.data.get('organization')
        or request.query_params.get('organization')
    )
    qs = OrgMembership.objects.filter(user=user, status=MembershipStatus.ACTIVE)
    if org_id:
        return qs.filter(organization_id=org_id).select_related('organization').first()
    return qs.select_related('organization').order_by('-joined_at').first()


class IsOrgMember(permissions.BasePermission):
    """Caller is an active member of the (resolved) organization."""
    def has_permission(self, request, view):
        return _membership_for(request, view) is not None


class IsOrgAdmin(permissions.BasePermission):
    """Caller is owner/admin of the (resolved) organization. Platform staff pass
    unconditionally so support can administer any tenant."""
    def has_permission(self, request, view):
        if request.user and request.user.is_staff:
            return True
        m = _membership_for(request, view)
        return bool(m and m.role in (OrgRole.OWNER, OrgRole.ADMIN))


class IsOrgInstructor(permissions.BasePermission):
    """Caller can view cohort analytics (instructor/admin/owner) of the resolved
    org. Platform staff pass unconditionally."""
    def has_permission(self, request, view):
        if request.user and request.user.is_staff:
            return True
        m = _membership_for(request, view)
        return bool(m and m.role in (OrgRole.OWNER, OrgRole.ADMIN, OrgRole.INSTRUCTOR))
