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

    def get_users_for_tenant(self, tenant_id):
        return self.repository.get_all_for_tenant(tenant_id)

    def get_user(self, user_id, tenant_id):
        return self.repository.get_by_id_for_tenant(user_id, tenant_id)

    def update_user(self, user_id, tenant_id, **fields):
        return self.repository.update_user(user_id, tenant_id, **fields)

    def deactivate_user(self, user_id, tenant_id):
        return self.repository.deactivate_user(user_id, tenant_id)

    def create_user(self, email, username, password, tenant=None, **extra_fields):
        return self.repository.create_user(
            email=email,
            username=username,
            password=password,
            tenant=tenant,
            **extra_fields,
        )
