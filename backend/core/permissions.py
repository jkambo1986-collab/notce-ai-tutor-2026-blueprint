from rest_framework import permissions

class IsPaidUser(permissions.BasePermission):
    """
    Allows access only to users who have paid for the service.
    Trial users are excluded from these specific premium features.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        try:
            profile = request.user.userprofile
            return profile.is_paid
        except AttributeError:
            return False
