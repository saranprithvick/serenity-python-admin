from .models import PatientMessage


class PatientMessageRepository:
    def get_messages_for_patient(self, patient_id, tenant_id=None, is_superuser=False):
        if is_superuser:
            return PatientMessage.objects.filter(patient_id=patient_id).order_by('-sent_at')
        return PatientMessage.objects.filter(
            patient_id=patient_id,
            tenant_id=tenant_id,
        ).order_by('-sent_at')

    def get_by_id(self, message_id, tenant_id=None, is_superuser=False):
        if is_superuser:
            return PatientMessage.objects.filter(id=message_id).first()
        return PatientMessage.objects.filter(id=message_id, tenant_id=tenant_id).first()

    def create(self, tenant, patient, sent_by, subject, message, email_sent_to):
        return PatientMessage.objects.create(
            tenant=tenant,
            patient=patient,
            sent_by=sent_by,
            subject=subject,
            message=message,
            email_sent_to=email_sent_to,
            is_delivered=False,
        )

    def mark_delivered(self, message_id):
        PatientMessage.objects.filter(id=message_id).update(is_delivered=True)

    def mark_failed(self, message_id, error):
        PatientMessage.objects.filter(id=message_id).update(delivery_error=error)
