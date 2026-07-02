from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.administration.models import Permission
from apps.administration.repositories import RoleRepository, UserRoleRepository
from apps.tenancy.models import Tenant

from .models import Practitioner
from .repositories import PractitionerRepository
from .services import PractitionerService

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_tenant(slug='test-p-tenant', name='Test P Tenant'):
    return Tenant.objects.create(slug=slug, name=name)


def make_user(tenant, email='user@p-example.com', password='pass'):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], password=password, tenant=tenant
    )


def make_practitioner(tenant, first_name='Test', last_name='Practitioner', **kwargs):
    return Practitioner.objects.create(
        tenant=tenant, first_name=first_name, last_name=last_name, **kwargs
    )


def _grant_permissions(user, tenant, *permission_keys):
    role = RoleRepository().create(f'Role-{user.id}', tenant)
    for key in permission_keys:
        RoleRepository().add_permission(role, Permission.objects.get(key=key))
    UserRoleRepository().assign_role(user, role)
    return role


# ---------------------------------------------------------------------------
# PractitionerModelTest
# ---------------------------------------------------------------------------

class PractitionerModelTest(TestCase):
    def setUp(self):
        self.tenant = make_tenant(slug='model-t', name='Model T')

    def test_create_practitioner(self):
        p = make_practitioner(self.tenant, 'Alice', 'Smith', specialisation='Surgeon')
        self.assertEqual(p.first_name, 'Alice')
        self.assertEqual(p.last_name, 'Smith')
        self.assertEqual(p.specialisation, 'Surgeon')
        self.assertEqual(p.tenant, self.tenant)
        self.assertTrue(p.is_active)

    def test_full_name_property(self):
        p = make_practitioner(self.tenant, 'Bob', 'Jones')
        self.assertEqual(p.full_name, 'Bob Jones')

    def test_str_returns_full_name(self):
        p = make_practitioner(self.tenant, 'Carol', 'White')
        self.assertEqual(str(p), 'Carol White')

    def test_soft_delete_sets_inactive(self):
        p = make_practitioner(self.tenant, 'Dave', 'Brown')
        p.is_active = False
        p.save()
        p.refresh_from_db()
        self.assertFalse(p.is_active)


# ---------------------------------------------------------------------------
# PractitionerRepositoryTest
# ---------------------------------------------------------------------------

class PractitionerRepositoryTest(TestCase):
    def setUp(self):
        self.tenant_a = make_tenant(slug='repo-a', name='Repo A')
        self.tenant_b = make_tenant(slug='repo-b', name='Repo B')
        self.repo = PractitionerRepository()
        self.p_a = make_practitioner(self.tenant_a, 'Alice', 'A')
        self.p_b = make_practitioner(self.tenant_b, 'Bob', 'B')

    def test_get_all_for_tenant(self):
        qs = self.repo.get_all(tenant=self.tenant_a)
        self.assertIn(self.p_a, qs)
        self.assertNotIn(self.p_b, qs)

    def test_get_all_superuser_returns_all_tenants(self):
        qs = self.repo.get_all(is_superuser=True)
        self.assertIn(self.p_a, qs)
        self.assertIn(self.p_b, qs)

    def test_get_by_id_correct_tenant(self):
        found = self.repo.get_by_id(self.p_a.id, tenant=self.tenant_a)
        self.assertEqual(found, self.p_a)

    def test_get_by_id_wrong_tenant_returns_none(self):
        found = self.repo.get_by_id(self.p_a.id, tenant=self.tenant_b)
        self.assertIsNone(found)

    def test_get_by_id_superuser_bypasses_tenant(self):
        found = self.repo.get_by_id(self.p_a.id, is_superuser=True)
        self.assertEqual(found, self.p_a)

    def test_create_practitioner(self):
        p = self.repo.create(self.tenant_a, 'Eve', 'Test', email='eve@test.com')
        self.assertEqual(p.first_name, 'Eve')
        self.assertEqual(p.email, 'eve@test.com')
        self.assertEqual(p.tenant, self.tenant_a)

    def test_update_practitioner(self):
        updated = self.repo.update(self.p_a.id, tenant=self.tenant_a, first_name='Updated')
        self.assertIsNotNone(updated)
        self.assertEqual(updated.first_name, 'Updated')

    def test_deactivate_practitioner(self):
        result = self.repo.deactivate(self.p_a.id, tenant=self.tenant_a)
        self.assertTrue(result)
        self.p_a.refresh_from_db()
        self.assertFalse(self.p_a.is_active)


# ---------------------------------------------------------------------------
# PractitionerServiceTest
# ---------------------------------------------------------------------------

class PractitionerServiceTest(TestCase):
    def setUp(self):
        self.tenant = make_tenant(slug='svc-t', name='Svc T')
        self.user = make_user(self.tenant, 'svc@test.com')
        self.service = PractitionerService()

    def _make_request(self, user, tenant=None):
        request = MagicMock()
        request.user = user
        request.tenant = tenant
        return request

    def test_get_practitioners_regular_user(self):
        tenant2 = make_tenant(slug='svc-t2', name='Svc T2')
        p1 = make_practitioner(self.tenant, 'Alice', 'Smith')
        p2 = make_practitioner(tenant2, 'Bob', 'Jones')
        request = self._make_request(self.user, self.tenant)
        qs = self.service.get_practitioners(request)
        self.assertIn(p1, qs)
        self.assertNotIn(p2, qs)

    def test_get_practitioners_superuser_all_tenants(self):
        tenant2 = make_tenant(slug='svc-t2-su', name='Svc T2 SU')
        p1 = make_practitioner(self.tenant, 'Alice', 'Smith')
        p2 = make_practitioner(tenant2, 'Bob', 'Jones')
        superuser = User.objects.create_superuser(
            email='super_svc@test.com', username='supersvc', password='pass'
        )
        request = self._make_request(superuser, tenant=None)
        qs = self.service.get_practitioners(request)
        self.assertIn(p1, qs)
        self.assertIn(p2, qs)

    def test_create_for_regular_user_uses_request_tenant(self):
        request = self._make_request(self.user, self.tenant)
        p = self.service.create_practitioner(request, 'John', 'Doe')
        self.assertEqual(p.tenant, self.tenant)

    def test_create_for_superuser_requires_tenant_id(self):
        superuser = User.objects.create_superuser(
            email='super_svc2@test.com', username='supersvc2', password='pass'
        )
        request = self._make_request(superuser, tenant=None)
        with self.assertRaises(ValueError):
            self.service.create_practitioner(request, 'John', 'Doe', tenant_id=None)


# ---------------------------------------------------------------------------
# PractitionerAPITest
# ---------------------------------------------------------------------------

class PractitionerAPITest(APITestCase):
    def setUp(self):
        self.tenant_a = make_tenant(slug='api-p-a', name='API P A')
        self.tenant_b = make_tenant(slug='api-p-b', name='API P B')
        Permission.get_or_create_defaults()

        self.admin_user = make_user(self.tenant_a, 'admin_p@test.com')
        _grant_permissions(
            self.admin_user, self.tenant_a,
            'Practitioner:View', 'Practitioner:Create',
            'Practitioner:Update', 'Practitioner:Delete',
        )

        self.practitioner = make_practitioner(self.tenant_a, 'Alice', 'Smith')
        self.practitioner_b = make_practitioner(self.tenant_b, 'Bob', 'Jones')

        self.client.force_login(self.admin_user)

    def test_list_practitioners_authenticated(self):
        response = self.client.get('/api/practitioners/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    def test_list_practitioners_unauthenticated_returns_401(self):
        self.client.logout()
        response = self.client.get('/api/practitioners/')
        self.assertIn(response.status_code, [401, 403])

    def test_list_practitioners_without_permission_returns_403(self):
        no_perm_user = make_user(self.tenant_a, 'noperm_p@test.com')
        self.client.force_login(no_perm_user)
        response = self.client.get('/api/practitioners/')
        self.assertEqual(response.status_code, 403)

    def test_create_practitioner_success(self):
        response = self.client.post(
            '/api/practitioners/',
            {'first_name': 'New', 'last_name': 'Doc', 'specialisation': 'Physio'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['first_name'], 'New')
        self.assertEqual(response.data['last_name'], 'Doc')
        self.assertEqual(response.data['tenant_id'], self.tenant_a.id)

    def test_retrieve_practitioner(self):
        response = self.client.get(f'/api/practitioners/{self.practitioner.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], self.practitioner.id)
        self.assertEqual(response.data['first_name'], 'Alice')

    def test_retrieve_wrong_tenant_returns_404(self):
        response = self.client.get(f'/api/practitioners/{self.practitioner_b.id}/')
        self.assertEqual(response.status_code, 404)

    def test_update_practitioner(self):
        response = self.client.patch(
            f'/api/practitioners/{self.practitioner.id}/',
            {'first_name': 'UpdatedAlice'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['first_name'], 'UpdatedAlice')

    def test_deactivate_practitioner_returns_200_with_record(self):
        response = self.client.delete(f'/api/practitioners/{self.practitioner.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['is_active'])
        self.assertEqual(response.data['id'], self.practitioner.id)


# ---------------------------------------------------------------------------
# PractitionerTenantIsolationTest
# ---------------------------------------------------------------------------

class PractitionerTenantIsolationTest(APITestCase):
    def setUp(self):
        self.tenant_1 = make_tenant(slug='iso-p-1', name='Iso P 1')
        self.tenant_2 = make_tenant(slug='iso-p-2', name='Iso P 2')
        Permission.get_or_create_defaults()

        self.user_1 = make_user(self.tenant_1, 'user1_iso@test.com')
        _grant_permissions(
            self.user_1, self.tenant_1,
            'Practitioner:View', 'Practitioner:Create',
        )

        self.p1 = make_practitioner(self.tenant_1, 'T1', 'Doc')
        self.p2 = make_practitioner(self.tenant_2, 'T2', 'Doc')

        self.superuser = User.objects.create_superuser(
            email='super_iso@test.com', username='superiso', password='pass'
        )

    def test_tenant1_cannot_see_tenant2_practitioners(self):
        self.client.force_login(self.user_1)
        response = self.client.get('/api/practitioners/')
        self.assertEqual(response.status_code, 200)
        ids = [r['id'] for r in response.data['results']]
        self.assertIn(self.p1.id, ids)
        self.assertNotIn(self.p2.id, ids)

    def test_superuser_sees_all_practitioners(self):
        self.client.force_login(self.superuser)
        response = self.client.get('/api/practitioners/')
        self.assertEqual(response.status_code, 200)
        ids = [r['id'] for r in response.data['results']]
        self.assertIn(self.p1.id, ids)
        self.assertIn(self.p2.id, ids)

    def test_superuser_must_specify_tenant_on_create(self):
        self.client.force_login(self.superuser)
        response = self.client.post(
            '/api/practitioners/',
            {'first_name': 'No', 'last_name': 'Tenant'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('tenant_id', response.data['detail'].lower())
