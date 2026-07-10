from django.core.mail import send_mail
from django.utils import timezone

from apps.patients.services import PatientService

from .repositories import PatientMessageRepository

_repo = PatientMessageRepository()


def _sender_name(user):
    name = f"{user.first_name} {user.last_name}".strip()
    return name or user.email


class PatientMessageService:
    def get_messages_for_patient(self, patient_id, request):
        if request.user.is_superuser:
            return _repo.get_messages_for_patient(patient_id, is_superuser=True)
        return _repo.get_messages_for_patient(patient_id, tenant_id=request.tenant.id)

    def send_message(self, request, patient_id, subject, message_text):
        patient = PatientService().get_patient(patient_id, request)
        if not patient:
            raise ValueError('Patient not found')

        if not patient.email:
            raise ValueError(
                'This patient has no email address on record. '
                'Please update their contact details first.'
            )

        tenant = request.tenant if request.tenant else patient.tenant
        msg = _repo.create(
            tenant=tenant,
            patient=patient,
            sent_by=request.user,
            subject=subject,
            message=message_text,
            email_sent_to=patient.email,
        )

        try:
            self._send_email(
                patient=patient,
                sent_by=request.user,
                subject=subject,
                message_text=message_text,
                recipient_email=patient.email,
            )
            _repo.mark_delivered(msg.id)
            msg.is_delivered = True
        except Exception as e:
            _repo.mark_failed(msg.id, str(e))
            msg.delivery_error = str(e)

        return msg

    def _send_email(self, patient, sent_by, subject, message_text, recipient_email):
        plain_message = (
            f"Dear {patient.full_name},\n\n"
            f"You have received a message from your healthcare provider at "
            f"{patient.tenant.name}.\n\n"
            f"FROM:    {_sender_name(sent_by)}\n"
            f"DATE:    {timezone.now().strftime('%B %d, %Y at %H:%M')}\n"
            f"SUBJECT: {subject}\n\n"
            f"MESSAGE:\n{message_text}\n\n"
            f"{'─' * 40}\n"
            f"This message was sent via OrthoMed Healthcare Platform.\n"
            f"Please do not reply to this email. Contact your healthcare provider directly.\n"
            f"{'─' * 40}"
        )

        send_mail(
            subject=f'[OrthoMed] {subject}',
            message=plain_message,
            from_email=None,
            recipient_list=[recipient_email],
            fail_silently=False,
            html_message=self._get_html_email(
                patient=patient,
                sent_by=sent_by,
                subject=subject,
                message_text=message_text,
            ),
        )

    def _get_html_email(self, patient, sent_by, subject, message_text):
        sender = _sender_name(sent_by)
        date_str = timezone.now().strftime('%B %d, %Y at %H:%M')
        return f"""<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 20px; }}
    .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
    .header {{ background: #1A202C; padding: 24px 32px; display: flex; align-items: center; }}
    .logo {{ color: #F97316; font-size: 24px; font-weight: 800; }}
    .body {{ padding: 32px; }}
    .greeting {{ font-size: 18px; font-weight: 600; color: #1A202C; margin-bottom: 16px; }}
    .meta-box {{ background: #F8FAFC; border-left: 4px solid #F97316; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; }}
    .meta-row {{ display: flex; margin-bottom: 8px; }}
    .meta-label {{ color: #718096; font-size: 13px; width: 80px; font-weight: 600; }}
    .meta-value {{ color: #1A202C; font-size: 13px; }}
    .message-box {{ background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }}
    .message-label {{ font-size: 12px; font-weight: 600; color: #718096; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }}
    .message-text {{ font-size: 15px; line-height: 1.7; color: #2D3748; white-space: pre-wrap; }}
    .footer {{ background: #F8FAFC; padding: 20px 32px; text-align: center; border-top: 1px solid #E2E8F0; }}
    .footer-text {{ font-size: 12px; color: #9CA3AF; line-height: 1.6; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">&#9672; OrthoMed</div>
    </div>
    <div class="body">
      <div class="greeting">Dear {patient.full_name},</div>
      <p style="color:#718096; font-size:14px; margin-bottom:20px;">
        You have received a message from your healthcare provider at
        <strong>{patient.tenant.name}</strong>.
      </p>
      <div class="meta-box">
        <div class="meta-row">
          <span class="meta-label">From</span>
          <span class="meta-value">{sender}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Date</span>
          <span class="meta-value">{date_str}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Subject</span>
          <span class="meta-value">{subject}</span>
        </div>
      </div>
      <div class="message-box">
        <div class="message-label">Message</div>
        <div class="message-text">{message_text}</div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-text">
        This message was sent via OrthoMed Healthcare Platform.<br>
        Please do not reply to this email. Contact your healthcare provider directly.<br><br>
        &copy; 2026 OrthoMed Platform
      </div>
    </div>
  </div>
</body>
</html>"""
