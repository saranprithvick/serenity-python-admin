from .models import User


class UserRepository:
    """Data-access layer for User. All User ORM queries live here."""

    def get_by_id(self, user_id):
        return User.objects.filter(pk=user_id).first()

    def get_by_email(self, email):
        return User.objects.filter(email=email).first()

    def get_all_for_tenant(self, tenant_id):
        return User.objects.filter(tenant_id=tenant_id)

    def create_user(self, email, username, password, tenant=None, **extra_fields):
        return User.objects.create_user(
            email=email,
            username=username,
            password=password,
            tenant=tenant,
            **extra_fields,
        )
