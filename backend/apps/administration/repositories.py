from .models import Permission, Role, RolePermission, UserRole


class PermissionRepository:
    def get_by_id(self, permission_id):
        return Permission.objects.filter(id=permission_id).first()

    def get_by_key(self, key):
        return Permission.objects.filter(key=key).first()

    def get_all(self):
        return Permission.objects.all()

    def get_by_module(self, module):
        return Permission.objects.filter(module=module)


class RoleRepository:
    def get_by_id(self, role_id, tenant_id):
        return Role.objects.filter(id=role_id, tenant_id=tenant_id).first()

    def get_all_for_tenant(self, tenant_id):
        return Role.objects.filter(tenant_id=tenant_id)

    def get_active_for_tenant(self, tenant_id):
        return Role.objects.filter(tenant_id=tenant_id, is_active=True)

    def create(self, name, tenant, description=''):
        return Role.objects.create(name=name, tenant=tenant, description=description)

    def add_permission(self, role, permission):
        role_permission, _ = RolePermission.objects.get_or_create(
            role=role, permission=permission
        )
        return role_permission

    def remove_permission(self, role, permission):
        RolePermission.objects.filter(role=role, permission=permission).delete()

    def get_permissions_for_role(self, role_id):
        return Permission.objects.filter(rolepermission__role_id=role_id)


class UserRoleRepository:
    def assign_role(self, user, role):
        user_role, _ = UserRole.objects.get_or_create(user=user, role=role)
        return user_role

    def remove_role(self, user, role):
        UserRole.objects.filter(user=user, role=role).delete()

    def get_roles_for_user(self, user_id):
        return Role.objects.filter(userrole__user_id=user_id)

    def get_permissions_for_user(self, user_id):
        return Permission.objects.filter(
            rolepermission__role__userrole__user_id=user_id
        ).distinct()

    def user_has_permission(self, user_id, permission_key):
        return Permission.objects.filter(
            key=permission_key,
            rolepermission__role__userrole__user_id=user_id,
        ).exists()
