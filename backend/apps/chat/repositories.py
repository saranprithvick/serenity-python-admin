from .models import PatientChatMessage


class PatientChatRepository:

    def get_messages_for_patient(
        self, patient_id,
        tenant_id=None,
        is_superuser=False
    ):
        qs = PatientChatMessage.objects.select_related(
            'sent_by', 'patient', 'tenant'
        )
        if is_superuser:
            return qs.filter(patient_id=patient_id)
        return qs.filter(
            patient_id=patient_id,
            tenant_id=tenant_id
        )

    def create(
        self, tenant, patient,
        sent_by, message
    ):
        return PatientChatMessage.objects.create(
            tenant=tenant,
            patient=patient,
            sent_by=sent_by,
            message=message
        )

    def mark_read(self, patient_id, user_id):
        PatientChatMessage.objects.filter(
            patient_id=patient_id,
            is_read=False
        ).exclude(
            sent_by_id=user_id
        ).update(is_read=True)

    def get_unread_count(
        self, patient_id, user_id
    ):
        return PatientChatMessage.objects.filter(
            patient_id=patient_id,
            is_read=False
        ).exclude(
            sent_by_id=user_id
        ).count()
    
