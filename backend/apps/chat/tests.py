from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.administration.models import Permission
from apps.administration.repositories import RoleRepository, UserRoleRepository
from apps.patients.models import Patient
from apps.tenancy.models import Tenant

from .models import PatientMessage
from .repositories import PatientMessageRepository
from .services import PatientMessageService

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_tenant(slug, name=None):
    return Tenant.objects.create(slug=slug, name=name or slug)


def make_user(tenant, email, password='pass'):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], password=password, tenant=tenant
    )


def make_patient(tenant, first_name='Test', last_name='Patient', email='patient@example.com'):
    return Patient.objects.create(
        tenant=tenant, first_name=first_name, last_name=last_name, email=email
    )


def make_message(tenant, patient, sent_by, subject='Hello', message='Body text'):
    return PatientMessage.objects.create(
        tenant=tenant,
        patient=patient,
        sent_by=sent_by,
        subject=subject,
        message=message,
        email_sent_to=patient.email or 'fallback@example.com',
    )


def _grant_permissions(user, tenant, *permission_keys):
    role = RoleRepository().create(f'Role-{user.id}', tenant)
    for key in permission_keys:
        RoleRepository().add_permission(role, Permission.objects.get(key=key))
    UserRoleRepository().assign_role(user, role)
    return role


def _make_request(user, tenant=None):
    request = MagicMock()
    request.user = user
    request.tenant = tenant
    return request


# ---------------------------------------------------------------------------
# PatientMessageModelTest
# ---------------------------------------------------------------------------

class PatientMessageModelTest(TestCase):
    def setUp(self):
        self.tenant = make_tenant('model-chat')
        self.user = make_user(self.tenant, 'doctor@model-chat.com')
        self.patient = make_patient(self.tenant)

    def test_create_message(self):
        msg = make_message(self.tenant, self.patient, self.user)
        self.assertEqual(msg.patient, self.patient)
        self.assertEqual(msg.sent_by, self.user)
        self.assertEqual(msg.subject, 'Hello')
        self.assertFalse(msg.is_delivered)
        self.assertIsNone(msg.delivery_error)

    def test_message_str_representation(self):
        msg = make_message(self.tenant, self.patient, self.user)
        self.assertIn(str(self.patient), str(msg))
        self.assertIn(str(self.user), str(msg))

    def test_ordering_by_sent_at_desc(self):
        msg1 = make_message(self.tenant, self.patient, self.user, subject='First')
        msg2 = make_message(self.tenant, self.patient, self.user, subject='Second')
        messages = list(PatientMessage.objects.filter(tenant=self.tenant))
        self.assertEqual(messages[0].id, msg2.id)
        self.assertEqual(messages[1].id, msg1.id)


# ---------------------------------------------------------------------------
# PatientMessageServiceTest
# ---------------------------------------------------------------------------

class PatientMessageServiceTest(TestCase):
    def setUp(self):
        self.tenant = make_tenant('svc-chat')
        self.user = make_user(self.tenant, 'doctor@svc-chat.com')
        self.patient = make_patient(self.tenant, email='patient@svc-chat.com')
        self.patient_no_email = make_patient(
            self.tenant, first_name='No', last_name='Email', email=None
        )
        self.service = PatientMessageService()
        self.patient_no_email.email = None
        self.patient_no_email.save()

    @patch('apps.chat.services.send_mail')
    def test_send_message_creates_db_record(self, mock_send_mail):
        mock_send_mail.return_value = None
        request = _make_request(self.user, self.tenant)
        msg = self.service.send_message(request, self.patient.id, 'Subject', 'Body')
        self.assertIsNotNone(msg.id)
        self.assertEqual(msg.patient, self.patient)
        self.assertEqual(msg.sent_by, self.user)
        self.assertEqual(msg.subject, 'Subject')
        self.assertEqual(msg.email_sent_to, self.patient.email)

    def test_send_message_patient_not_found_raises(self):
        request = _make_request(self.user, self.tenant)
        with self.assertRaises(ValueError) as ctx:
            self.service.send_message(request, 999999, 'Subject', 'Body')
        self.assertIn('Patient not found', str(ctx.exception))

    def test_send_message_no_email_raises(self):
        request = _make_request(self.user, self.tenant)
        with self.assertRaises(ValueError) as ctx:
            self.service.send_message(request, self.patient_no_email.id, 'Subject', 'Body')
        self.assertIn('no email address', str(ctx.exception))

    @patch('apps.chat.services.send_mail')
    def test_send_message_marks_delivered_on_success(self, mock_send_mail):
        mock_send_mail.return_value = None
        request = _make_request(self.user, self.tenant)
        msg = self.service.send_message(request, self.patient.id, 'Subject', 'Body')
        self.assertTrue(msg.is_delivered)
        self.assertIsNone(msg.delivery_error)
        db_msg = PatientMessage.objects.get(id=msg.id)
        self.assertTrue(db_msg.is_delivered)

    @patch('apps.chat.services.send_mail')
    def test_send_message_marks_failed_on_error(self, mock_send_mail):
        mock_send_mail.side_effect = Exception('SMTP connection failed')
        request = _make_request(self.user, self.tenant)
        msg = self.service.send_message(request, self.patient.id, 'Subject', 'Body')
        self.assertFalse(msg.is_delivered)
        self.assertIsNotNone(msg.delivery_error)
        self.assertIn('SMTP', msg.delivery_error)
        db_msg = PatientMessage.objects.get(id=msg.id)
        self.assertIsNotNone(db_msg.delivery_error)


# ---------------------------------------------------------------------------
# PatientMessageAPITest
# ---------------------------------------------------------------------------

class PatientMessageAPITest(APITestCase):
    def setUp(self):
        self.tenant = make_tenant('api-chat')
        Permission.get_or_create_defaults()
        self.user = make_user(self.tenant, 'doctor@api-chat.com')
        _grant_permissions(self.user, self.tenant, 'Patient:View', 'Patient:SendMessage')
        self.patient = make_patient(self.tenant, email='apipatient@example.com')
        self.client.force_login(self.user)

    def test_list_messages_authenticated_200(self):
        make_message(self.tenant, self.patient, self.user)
        response = self.client.get(f'/api/chat/patients/{self.patient.id}/messages/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 1)

    def test_list_messages_unauthenticated_401(self):
        self.client.logout()
        response = self.client.get(f'/api/chat/patients/{self.patient.id}/messages/')
        self.assertIn(response.status_code, [401, 403])

    @patch('apps.chat.services.send_mail')
    def test_send_message_success_201(self, mock_send_mail):
        mock_send_mail.return_value = None
        response = self.client.post(
            f'/api/chat/patients/{self.patient.id}/send-message/',
            {'subject': 'Test Subject', 'message': 'Test message body'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['subject'], 'Test Subject')
        self.assertTrue(response.data['is_delivered'])

    def test_send_message_no_permission_403(self):
        no_perm_user = make_user(self.tenant, 'noperm@api-chat.com')
        self.client.force_login(no_perm_user)
        response = self.client.post(
            f'/api/chat/patients/{self.patient.id}/send-message/',
            {'subject': 'Test', 'message': 'Body'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_send_message_patient_no_email_400(self):
        patient_no_email = Patient.objects.create(
            tenant=self.tenant,
            first_name='No',
            last_name='Email',
        )
        response = self.client.post(
            f'/api/chat/patients/{patient_no_email.id}/send-message/',
            {'subject': 'Test', 'message': 'Body'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data['error'].lower())

    def test_send_message_patient_not_found_404(self):
        response = self.client.post(
            '/api/chat/patients/999999/send-message/',
            {'subject': 'Test', 'message': 'Body'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Patient not found', response.data['error'])

    def test_tenant_isolation_messages(self):
        tenant_b = make_tenant('api-chat-b')
        user_b = make_user(tenant_b, 'doctor@api-chat-b.com')
        patient_b = make_patient(tenant_b, email='b_patient@example.com')
        make_message(tenant_b, patient_b, user_b, subject='B message')

        make_message(self.tenant, self.patient, self.user, subject='A message')

        response = self.client.get(f'/api/chat/patients/{self.patient.id}/messages/')
        self.assertEqual(response.status_code, 200)
        subjects = [m['subject'] for m in response.data]
        self.assertIn('A message', subjects)
        self.assertNotIn('B message', subjects)

        response_b = self.client.get(f'/api/chat/patients/{patient_b.id}/messages/')
        self.assertEqual(response_b.status_code, 200)
        self.assertEqual(response_b.data, [])
