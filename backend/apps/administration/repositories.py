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
    def get_all(self, is_superuser=False, tenant_id=None):
        if is_superuser:
            return Role.objects.all()
        if tenant_id is not None:
            return Role.objects.for_tenant_id(tenant_id)
        return Role.objects.none()

    def get_by_id(self, role_id, tenant_id=None, is_superuser=False):
        if is_superuser:
            return Role.objects.filter(id=role_id).first()
        try:
            return Role.objects.for_tenant_id(tenant_id).get(id=role_id)
        except Role.DoesNotExist:
            return None

    def get_all_for_tenant(self, tenant_id):
        return Role.objects.for_tenant_id(tenant_id)

    def get_active_for_tenant(self, tenant_id):
        return Role.objects.for_tenant_id(tenant_id).filter(is_active=True)

    def create(self, name, tenant, description=''):
        return Role.objects.create(name=name, tenant=tenant, description=description)

    def get_or_create_by_name(self, name, tenant):
        return Role.objects.get_or_create(name=name, tenant=tenant, defaults={'description': ''})

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
