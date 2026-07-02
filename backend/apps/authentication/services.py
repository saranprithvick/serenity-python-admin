from django.contrib.auth import authenticate, login, logout

from .repositories import UserRepository


class AuthService:
    """Authentication/session business logic. Persistence goes via the repository."""

    def __init__(self, repository=None):
        self.repository = repository or UserRepository()

    def authenticate_user(self, email, password, request):
        user = authenticate(request, username=email, password=password)
        if user is None:
            # Distinguish an inactive account from bad credentials: Django's
            # authenticate() returns None for inactive users, so re-check by email.
            existing = self.repository.get_by_email(email)
            if existing is not None and not existing.is_active:
                raise ValueError('Account is inactive')
            raise ValueError('Invalid credentials')

        if not user.is_active:
            raise ValueError('Account is inactive')

        login(request, user)
        return user

    def logout_user(self, request):
        logout(request)

    def get_current_user(self, request):
        if request.user.is_authenticated:
            return request.user
        return None

    def get_users(self, request):
        if request.user.is_superuser:
            return self.repository.get_all(is_superuser=True)
        return self.repository.get_all(tenant_id=request.tenant.id)

    def get_user(self, user_id, request):
        if request.user.is_superuser:
            return self.repository.get_by_id(user_id, is_superuser=True)
        return self.repository.get_by_id(user_id, tenant_id=request.tenant.id)

    def get_users_for_tenant(self, tenant_id):
        return self.repository.get_all_for_tenant(tenant_id)

    def create_user_for_request(self, request, email, username, password, tenant_id=None, **extra_fields):
        if request.user.is_superuser:
            if not tenant_id:
                raise ValueError('tenant_id is required for superuser operations')
            from apps.tenancy.models import Tenant
            tenant = Tenant.objects.get(id=tenant_id)
        else:
            tenant = request.tenant
        return self.repository.create_user(
            email=email, username=username, password=password, tenant=tenant, **extra_fields
        )

    def update_user(self, user_id, tenant_id=None, is_superuser=False, **fields):
        return self.repository.update_user(user_id, tenant_id=tenant_id, is_superuser=is_superuser, **fields)

    def deactivate_user(self, user_id, tenant_id=None, is_superuser=False):
        return self.repository.deactivate_user(user_id, tenant_id=tenant_id, is_superuser=is_superuser)

    def create_user(self, email, username, password, tenant=None, **extra_fields):
        return self.repository.create_user(
            email=email,
            username=username,
            password=password,
            tenant=tenant,
            **extra_fields,
        )

    def get_dashboard_stats(self, request):
        from apps.tenancy.models import Tenant
        from apps.administration.repositories import RoleRepository
        role_repo = RoleRepository()

        if request.user.is_superuser:
            return {
                'total_users': self.repository.get_all(is_superuser=True).count(),
                'total_tenants': Tenant.objects.count(),
                'total_roles': role_repo.get_all(is_superuser=True).count(),
                'total_practitioners': 0,
            }
        tenant_id = request.tenant.id
        return {
            'total_users': self.repository.get_all(tenant_id=tenant_id).count(),
            'total_tenants': 1,
            'total_roles': role_repo.get_all(tenant_id=tenant_id).count(),
            'total_practitioners': 0,
        }
