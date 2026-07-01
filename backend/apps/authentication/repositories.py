from .models import User


class UserRepository:
    """Data-access layer for User. All User ORM queries live here."""

    def get_by_id(self, user_id):
        return User.objects.filter(pk=user_id).first()

    def get_by_email(self, email):
        return User.objects.filter(email=email).first()

    def get_all_for_tenant(self, tenant_id):
        return User.objects.filter(tenant_id=tenant_id)

    def get_by_id_for_tenant(self, user_id, tenant_id):
        return User.objects.filter(pk=user_id, tenant_id=tenant_id).first()

    def create_user(self, email, username, password, tenant=None, **extra_fields):
        return User.objects.create_user(
            email=email,
            username=username,
            password=password,
            tenant=tenant,
            **extra_fields,
        )

    def update_user(self, user_id, tenant_id, **fields):
        user = User.objects.filter(pk=user_id, tenant_id=tenant_id).first()
        if user is None:
            return None
        for attr, value in fields.items():
            setattr(user, attr, value)
        user.save()
        return user

    def deactivate_user(self, user_id, tenant_id):
        user = User.objects.filter(pk=user_id, tenant_id=tenant_id).first()
        if user is None:
            return False
        user.is_active = False
        user.save()
        return True
