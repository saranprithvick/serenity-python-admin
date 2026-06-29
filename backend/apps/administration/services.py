from django.contrib.auth import get_user_model

from .models import Permission
from .repositories import PermissionRepository, RoleRepository, UserRoleRepository

_perm_repo = PermissionRepository()
_role_repo = RoleRepository()
_user_role_repo = UserRoleRepository()

User = get_user_model()


class PermissionService:
    def get_all_permissions(self):
        return _perm_repo.get_all()

    def get_permissions_by_module(self, module):
        return _perm_repo.get_by_module(module)

    def seed_default_permissions(self):
        Permission.get_or_create_defaults()


class RoleService:
    def get_roles_for_tenant(self, tenant_id):
        return _role_repo.get_all_for_tenant(tenant_id)

    def get_role(self, role_id, tenant_id):
        return _role_repo.get_by_id(role_id, tenant_id)

    def create_role(self, name, tenant, description=''):
        return _role_repo.create(name=name, tenant=tenant, description=description)

    def assign_permission_to_role(self, role_id, permission_id, tenant_id):
        role = _role_repo.get_by_id(role_id, tenant_id)
        if role is None:
            raise ValueError(f'Role {role_id} not found in tenant {tenant_id}')
        permission = _perm_repo.get_by_id(permission_id)
        return _role_repo.add_permission(role, permission)

    def remove_permission_from_role(self, role_id, permission_id, tenant_id):
        role = _role_repo.get_by_id(role_id, tenant_id)
        if role is None:
            raise ValueError(f'Role {role_id} not found in tenant {tenant_id}')
        permission = _perm_repo.get_by_id(permission_id)
        _role_repo.remove_permission(role, permission)

    def get_role_permissions(self, role_id, tenant_id):
        role = _role_repo.get_by_id(role_id, tenant_id)
        if role is None:
            raise ValueError(f'Role {role_id} not found in tenant {tenant_id}')
        return _role_repo.get_permissions_for_role(role_id)


class UserRoleService:
    def assign_role_to_user(self, user_id, role_id, tenant_id):
        role = _role_repo.get_by_id(role_id, tenant_id)
        if role is None:
            raise ValueError(f'Role {role_id} not found in tenant {tenant_id}')
        user = User.objects.get(id=user_id)
        from .models import UserRole
        if UserRole.objects.filter(user=user, role=role).exists():
            raise ValueError(f'User {user_id} already has role {role_id}')
        return _user_role_repo.assign_role(user, role)

    def remove_role_from_user(self, user_id, role_id):
        from .models import Role
        user = User.objects.get(id=user_id)
        try:
            role = Role.objects.get(id=role_id)
        except Role.DoesNotExist:
            return
        _user_role_repo.remove_role(user, role)

    def get_user_roles(self, user_id):
        return _user_role_repo.get_roles_for_user(user_id)

    def get_user_permissions(self, user_id):
        return _user_role_repo.get_permissions_for_user(user_id)

    def check_user_permission(self, user_id, permission_key):
        return _user_role_repo.user_has_permission(user_id, permission_key)
