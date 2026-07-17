from .repositories import PatientChatRepository
from apps.patients.models import Patient

_repo = PatientChatRepository()


class PatientChatService:

    def get_messages(self, patient_id, request):
        is_su = request.user.is_superuser
        tenant_id = (
            request.tenant.id
            if request.tenant else None
        )
        return _repo.get_messages_for_patient(
            patient_id=patient_id,
            tenant_id=tenant_id,
            is_superuser=is_su
        )

    def save_message(
        self, patient_id,
        sent_by, message_text, request
    ):
        is_su = request.user.is_superuser
        tenant_id = (
            request.tenant.id
            if request.tenant else None
        )

        # Get patient with tenant isolation
        if is_su:
            patient = Patient.objects.filter(
                id=patient_id
            ).first()
        else:
            patient = Patient.objects.filter(
                id=patient_id,
                tenant_id=tenant_id
            ).first()

        if not patient:
            raise ValueError('Patient not found')

        tenant = (
            request.tenant
            if request.tenant
            else patient.tenant
        )

        return _repo.create(
            tenant=tenant,
            patient=patient,
            sent_by=sent_by,
            message=message_text
        )

    def mark_read(self, patient_id, user_id):
        _repo.mark_read(patient_id, user_id)

    def get_unread_count(
        self, patient_id, user_id
    ):
        return _repo.get_unread_count(
            patient_id, user_id
        )