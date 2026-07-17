from django.test import TestCase
from rest_framework.test import APIClient
from apps.tenancy.models import Tenant
from apps.practitioners.models import Practitioner
from apps.patients.models import Patient
from apps.administration.models import (
    Role, Permission, RolePermission, UserRole
)
from apps.chat.models import PatientChatMessage
from apps.chat.repositories import PatientChatRepository
from apps.chat.services import PatientChatService


class PatientChatMessageModelTest(TestCase):

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant'
        )
        self.doctor = Practitioner.objects.create_user(
            email='doctor@test.com',
            username='doctor',
            password='pass123',
            tenant=self.tenant
        )
        self.patient = Patient.objects.create(
            tenant=self.tenant,
            first_name='Test',
            last_name='Patient'
        )

    def test_create_message(self):
        msg = PatientChatMessage.objects.create(
            tenant=self.tenant,
            patient=self.patient,
            sent_by=self.doctor,
            message='Test message'
        )
        self.assertEqual(msg.message, 'Test message')
        self.assertEqual(msg.sent_by, self.doctor)
        self.assertEqual(msg.patient, self.patient)

    def test_message_ordering_newest_last(self):
        PatientChatMessage.objects.create(
            tenant=self.tenant,
            patient=self.patient,
            sent_by=self.doctor,
            message='First message'
        )
        PatientChatMessage.objects.create(
            tenant=self.tenant,
            patient=self.patient,
            sent_by=self.doctor,
            message='Second message'
        )
        messages = PatientChatMessage.objects.filter(
            patient=self.patient
        )
        self.assertEqual(
            messages.first().message,
            'First message'
        )

    def test_message_str(self):
        msg = PatientChatMessage.objects.create(
            tenant=self.tenant,
            patient=self.patient,
            sent_by=self.doctor,
            message='Hello'
        )
        self.assertIn('doctor@test.com', str(msg))

    def test_is_read_default_false(self):
        msg = PatientChatMessage.objects.create(
            tenant=self.tenant,
            patient=self.patient,
            sent_by=self.doctor,
            message='Hello'
        )
        self.assertFalse(msg.is_read)


class PatientChatRepositoryTest(TestCase):

    def setUp(self):
        self.tenant1 = Tenant.objects.create(
            name='Tenant 1', slug='tenant-1')
        self.tenant2 = Tenant.objects.create(
            name='Tenant 2', slug='tenant-2')
        self.doctor = Practitioner.objects.create_user(
            email='doctor@tenant1.com',
            username='doctor1',
            password='pass123',
            tenant=self.tenant1
        )
        self.patient1 = Patient.objects.create(
            tenant=self.tenant1,
            first_name='Test',
            last_name='Patient1'
        )
        self.patient2 = Patient.objects.create(
            tenant=self.tenant2,
            first_name='Test',
            last_name='Patient2'
        )
        self.repo = PatientChatRepository()

    def test_create_message(self):
        msg = self.repo.create(
            tenant=self.tenant1,
            patient=self.patient1,
            sent_by=self.doctor,
            message='Hello from repo'
        )
        self.assertEqual(msg.message, 'Hello from repo')
        self.assertFalse(msg.is_read)

    def test_get_messages_for_patient(self):
        self.repo.create(
            tenant=self.tenant1,
            patient=self.patient1,
            sent_by=self.doctor,
            message='Message 1'
        )
        self.repo.create(
            tenant=self.tenant1,
            patient=self.patient1,
            sent_by=self.doctor,
            message='Message 2'
        )
        messages = self.repo.get_messages_for_patient(
            patient_id=self.patient1.id,
            tenant_id=self.tenant1.id
        )
        self.assertEqual(messages.count(), 2)

    def test_tenant_isolation(self):
        self.repo.create(
            tenant=self.tenant1,
            patient=self.patient1,
            sent_by=self.doctor,
            message='Tenant 1 message'
        )
        messages = self.repo.get_messages_for_patient(
            patient_id=self.patient2.id,
            tenant_id=self.tenant2.id
        )
        self.assertEqual(messages.count(), 0)

    def test_superuser_can_see_all_messages(self):
        self.repo.create(
            tenant=self.tenant1,
            patient=self.patient1,
            sent_by=self.doctor,
            message='Tenant 1 message'
        )
        messages = self.repo.get_messages_for_patient(
            patient_id=self.patient1.id,
            is_superuser=True
        )
        self.assertEqual(messages.count(), 1)

    def test_mark_read(self):
        msg = self.repo.create(
            tenant=self.tenant1,
            patient=self.patient1,
            sent_by=self.doctor,
            message='Unread message'
        )
        self.assertFalse(msg.is_read)
        self.repo.mark_read(
            patient_id=self.patient1.id,
            user_id=self.doctor.id + 1
        )
        msg.refresh_from_db()
        self.assertTrue(msg.is_read)

    def test_get_unread_count(self):
        other_doctor = Practitioner.objects.create_user(
            email='other@tenant1.com',
            username='other',
            password='pass123',
            tenant=self.tenant1
        )
        self.repo.create(
            tenant=self.tenant1,
            patient=self.patient1,
            sent_by=other_doctor,
            message='Unread'
        )
        count = self.repo.get_unread_count(
            patient_id=self.patient1.id,
            user_id=self.doctor.id
        )
        self.assertEqual(count, 1)


class PatientChatAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant-chat'
        )
        self.doctor = Practitioner.objects.create_user(
            email='chatdoctor@test.com',
            username='chatdoctor',
            password='pass123',
            tenant=self.tenant
        )
        self.patient = Patient.objects.create(
            tenant=self.tenant,
            first_name='Chat',
            last_name='Patient'
        )

        # Give doctor Patient:View permission
        from apps.administration.services import (
            PermissionService)
        PermissionService().seed_default_permissions()

        role = Role.objects.create(
            name='Chat Doctor',
            tenant=self.tenant
        )
        perm = Permission.objects.get(
            key='Patient:View')
        RolePermission.objects.create(
            role=role, permission=perm)
        UserRole.objects.create(
            user=self.doctor, role=role)

    def test_list_messages_authenticated(self):
        self.client.force_login(self.doctor)
        res = self.client.get(
            f'/api/chat/patients/'
            f'{self.patient.id}/messages/'
        )
        self.assertEqual(res.status_code, 200)

    def test_list_messages_unauthenticated(self):
        res = self.client.get(
            f'/api/chat/patients/'
            f'{self.patient.id}/messages/'
        )
        self.assertIn(res.status_code, [401, 403])

    def test_list_messages_empty(self):
        self.client.force_login(self.doctor)
        res = self.client.get(
            f'/api/chat/patients/'
            f'{self.patient.id}/messages/'
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

    def test_list_messages_with_data(self):
        PatientChatMessage.objects.create(
            tenant=self.tenant,
            patient=self.patient,
            sent_by=self.doctor,
            message='Test chat message'
        )
        self.client.force_login(self.doctor)
        res = self.client.get(
            f'/api/chat/patients/'
            f'{self.patient.id}/messages/'
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(
            res.data[0]['message'],
            'Test chat message'
        )

    def test_tenant_isolation_api(self):
        other_tenant = Tenant.objects.create(
            name='Other Tenant',
            slug='other-tenant-chat'
        )
        other_patient = Patient.objects.create(
            tenant=other_tenant,
            first_name='Other',
            last_name='Patient'
        )
        PatientChatMessage.objects.create(
            tenant=other_tenant,
            patient=other_patient,
            sent_by=self.doctor,
            message='Other tenant message'
        )
        self.client.force_login(self.doctor)
        res = self.client.get(
            f'/api/chat/patients/'
            f'{other_patient.id}/messages/'
        )
        self.assertIn(
            res.status_code, [200, 403, 404])
        if res.status_code == 200:
            self.assertEqual(len(res.data), 0)

    def test_message_response_fields(self):
        PatientChatMessage.objects.create(
            tenant=self.tenant,
            patient=self.patient,
            sent_by=self.doctor,
            message='Field test'
        )
        self.client.force_login(self.doctor)
        res = self.client.get(
            f'/api/chat/patients/'
            f'{self.patient.id}/messages/'
        )
        self.assertEqual(res.status_code, 200)
        msg = res.data[0]
        self.assertIn('id', msg)
        self.assertIn('message', msg)
        self.assertIn('sent_by_name', msg)
        self.assertIn('sent_by_initials', msg)
        self.assertIn('sent_at', msg)
        self.assertIn('is_read', msg)
