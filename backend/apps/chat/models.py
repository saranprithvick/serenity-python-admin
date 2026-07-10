from django.conf import settings
from django.db import models


class PatientMessage(models.Model):
    id = models.AutoField(primary_key=True)
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.CASCADE,
    )
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_messages',
    )
    subject = models.CharField(max_length=200)
    message = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    email_sent_to = models.CharField(max_length=255)
    is_delivered = models.BooleanField(default=False)
    delivery_error = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f"Message to {self.patient} from {self.sent_by} at {self.sent_at}"
