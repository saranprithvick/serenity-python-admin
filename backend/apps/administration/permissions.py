from rest_framework.permissions import BasePermission

from .repositories import UserRoleRepository

_user_role_repo = UserRoleRepository()


class HasPermission(BasePermission):
    """DRF permission class parameterised by a string key.

    Usage: permission_classes = [IsAuthenticated, HasPermission('Customer:View')]

    DRF calls permission() on each entry in permission_classes to get an
    instance. When the entry is already an instance (HasPermission('…')),
    __call__ returns self so that pattern still works.
    """

    def __init__(self, permission_key):
        self.permission_key = permission_key

    def __call__(self):
        return self

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return _user_role_repo.user_has_permission(request.user.id, self.permission_key)
