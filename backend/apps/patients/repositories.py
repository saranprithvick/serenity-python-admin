from .models import Patient


class PatientRepository:
    def get_all(self, is_superuser=False, tenant=None):
        if is_superuser:
            return Patient.objects.all()
        if tenant:
            return Patient.objects.for_tenant(tenant)
        return Patient.objects.none()

    def get_by_id(self, patient_id, tenant=None, is_superuser=False):
        if is_superuser:
            return Patient.objects.filter(id=patient_id).first()
        if tenant:
            return Patient.objects.for_tenant(tenant).filter(id=patient_id).first()
        return None

    def create(self, tenant, first_name, last_name, **optional_fields):
        return Patient.objects.create(
            tenant=tenant,
            first_name=first_name,
            last_name=last_name,
            **optional_fields,
        )

    def update(self, patient_id, tenant=None, is_superuser=False, **fields):
        patient = self.get_by_id(patient_id, tenant=tenant, is_superuser=is_superuser)
        if patient is None:
            return None
        for key, value in fields.items():
            setattr(patient, key, value)
        patient.save()
        return patient

    def deactivate(self, patient_id, tenant=None, is_superuser=False):
        patient = self.get_by_id(patient_id, tenant=tenant, is_superuser=is_superuser)
        if patient is None:
            return False
        patient.is_active = False
        patient.save()
        return True
