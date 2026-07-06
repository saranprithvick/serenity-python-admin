from .models import Practitioner


class PractitionerRepository:
    def get_all(self, is_superuser=False, tenant_id=None):
        if is_superuser:
            return Practitioner.objects.all()
        if tenant_id is not None:
            return Practitioner.objects.filter(tenant_id=tenant_id)
        return Practitioner.objects.none()

    def get_by_id(self, practitioner_id, tenant_id=None, is_superuser=False):
        if is_superuser:
            return Practitioner.objects.filter(pk=practitioner_id).first()
        if tenant_id is not None:
            return Practitioner.objects.filter(pk=practitioner_id, tenant_id=tenant_id).first()
        return None

    def get_by_email(self, email):
        return Practitioner.objects.filter(email=email).first()

    def get_all_for_tenant(self, tenant_id):
        return Practitioner.objects.filter(tenant_id=tenant_id)

    def create_practitioner(self, email, username, password, tenant=None, **extra_fields):
        return Practitioner.objects.create_user(
            email=email,
            username=username,
            password=password,
            tenant=tenant,
            **extra_fields,
        )

    def update_practitioner(self, practitioner_id, tenant_id=None, is_superuser=False, **fields):
        practitioner = self.get_by_id(practitioner_id, tenant_id=tenant_id, is_superuser=is_superuser)
        if practitioner is None:
            return None
        for attr, value in fields.items():
            setattr(practitioner, attr, value)
        practitioner.save()
        return practitioner

    def deactivate_practitioner(self, practitioner_id, tenant_id=None, is_superuser=False):
        practitioner = self.get_by_id(practitioner_id, tenant_id=tenant_id, is_superuser=is_superuser)
        if practitioner is None:
            return False
        practitioner.is_active = False
        practitioner.save()
        return True
