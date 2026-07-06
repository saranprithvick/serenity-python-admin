from apps.tenancy.models import Tenant

from .repositories import PatientRepository

_repo = PatientRepository()


class PatientService:
    def get_patients(self, request):
        if request.user.is_superuser:
            return _repo.get_all(is_superuser=True)
        return _repo.get_all(tenant=request.tenant)

    def get_patient(self, patient_id, request):
        if request.user.is_superuser:
            return _repo.get_by_id(patient_id, is_superuser=True)
        return _repo.get_by_id(patient_id, tenant=request.tenant)

    def create_patient(self, request, first_name, last_name, tenant_id=None, **fields):
        if request.user.is_superuser:
            if tenant_id is None:
                raise ValueError('Superuser must provide tenant_id when creating a patient')
            tenant = Tenant.objects.get(id=tenant_id)
        else:
            tenant = request.tenant
        return _repo.create(tenant=tenant, first_name=first_name, last_name=last_name, **fields)

    def update_patient(self, patient_id, request, **fields):
        if request.user.is_superuser:
            return _repo.update(patient_id, is_superuser=True, **fields)
        return _repo.update(patient_id, tenant=request.tenant, **fields)

    def deactivate_patient(self, patient_id, request):
        if request.user.is_superuser:
            return _repo.deactivate(patient_id, is_superuser=True)
        return _repo.deactivate(patient_id, tenant=request.tenant)
