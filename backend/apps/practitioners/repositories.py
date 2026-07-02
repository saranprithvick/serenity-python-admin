from .models import Practitioner


class PractitionerRepository:
    def get_all(self, is_superuser=False, tenant=None):
        if is_superuser:
            return Practitioner.objects.all()
        if tenant:
            return Practitioner.objects.for_tenant(tenant)
        return Practitioner.objects.none()

    def get_by_id(self, practitioner_id, tenant=None, is_superuser=False):
        if is_superuser:
            return Practitioner.objects.filter(id=practitioner_id).first()
        if tenant:
            return Practitioner.objects.for_tenant(tenant).filter(id=practitioner_id).first()
        return None

    def create(self, tenant, first_name, last_name, **optional_fields):
        return Practitioner.objects.create(
            tenant=tenant,
            first_name=first_name,
            last_name=last_name,
            **optional_fields,
        )

    def update(self, practitioner_id, tenant=None, is_superuser=False, **fields):
        practitioner = self.get_by_id(practitioner_id, tenant=tenant, is_superuser=is_superuser)
        if practitioner is None:
            return None
        for key, value in fields.items():
            setattr(practitioner, key, value)
        practitioner.save()
        return practitioner

    def deactivate(self, practitioner_id, tenant=None, is_superuser=False):
        practitioner = self.get_by_id(practitioner_id, tenant=tenant, is_superuser=is_superuser)
        if practitioner is None:
            return False
        practitioner.is_active = False
        practitioner.save()
        return True
