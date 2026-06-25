from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Tenant
from .repositories import TenantRepository
from .services import TenantService


class TenantModelTest(TestCase):
    def test_create_tenant(self):
        tenant = Tenant.objects.create(name='Acme', slug='acme')
        self.assertEqual(tenant.name, 'Acme')
        self.assertEqual(tenant.slug, 'acme')
        self.assertTrue(tenant.is_active)
        self.assertIsNotNone(tenant.created_at)
        self.assertEqual(str(tenant), 'Acme')

    def test_slug_must_be_unique(self):
        Tenant.objects.create(name='Acme', slug='acme')
        with self.assertRaises(IntegrityError):
            Tenant.objects.create(name='Acme Two', slug='acme')


class TenantRepositoryTest(TestCase):
    def setUp(self):
        self.repository = TenantRepository()
        self.tenant = Tenant.objects.create(name='Acme', slug='acme')

    def test_get_by_id_hit(self):
        self.assertEqual(self.repository.get_by_id(self.tenant.id), self.tenant)

    def test_get_by_id_miss(self):
        self.assertIsNone(self.repository.get_by_id(99999))

    def test_get_by_slug_hit(self):
        self.assertEqual(self.repository.get_by_slug('acme'), self.tenant)

    def test_get_by_slug_miss(self):
        self.assertIsNone(self.repository.get_by_slug('does-not-exist'))

    def test_get_all_active_excludes_inactive(self):
        Tenant.objects.create(name='Inactive', slug='inactive', is_active=False)
        active = self.repository.get_all_active()
        self.assertIn(self.tenant, active)
        self.assertEqual(active.count(), 1)

    def test_create(self):
        created = self.repository.create(name='Globex', slug='globex')
        self.assertEqual(created.name, 'Globex')
        self.assertTrue(Tenant.objects.filter(slug='globex').exists())


class FakeRepository:
    """Stand-in repository to prove the service only talks to its repository."""

    def __init__(self):
        self.calls = []
        self.sentinel = object()

    def get_by_id(self, tenant_id):
        self.calls.append(('get_by_id', tenant_id))
        return self.sentinel

    def get_by_slug(self, slug):
        self.calls.append(('get_by_slug', slug))
        return self.sentinel

    def get_all_active(self):
        self.calls.append(('get_all_active',))
        return self.sentinel

    def create(self, name, slug):
        self.calls.append(('create', name, slug))
        return self.sentinel


class TenantServiceTest(TestCase):
    def setUp(self):
        self.repository = FakeRepository()
        self.service = TenantService(repository=self.repository)

    def test_get_tenant_delegates(self):
        result = self.service.get_tenant(5)
        self.assertIs(result, self.repository.sentinel)
        self.assertEqual(self.repository.calls, [('get_by_id', 5)])

    def test_get_tenant_by_slug_delegates(self):
        result = self.service.get_tenant_by_slug('acme')
        self.assertIs(result, self.repository.sentinel)
        self.assertEqual(self.repository.calls, [('get_by_slug', 'acme')])

    def test_get_all_active_tenants_delegates(self):
        result = self.service.get_all_active_tenants()
        self.assertIs(result, self.repository.sentinel)
        self.assertEqual(self.repository.calls, [('get_all_active',)])

    def test_create_tenant_delegates(self):
        result = self.service.create_tenant('Globex', 'globex')
        self.assertIs(result, self.repository.sentinel)
        self.assertEqual(self.repository.calls, [('create', 'Globex', 'globex')])


class TenantAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            email='tester@example.com', username='tester', password='pass1234'
        )
        Tenant.objects.create(name='Acme', slug='acme')

    def test_list_requires_authentication(self):
        response = self.client.get('/api/tenants/')
        self.assertIn(response.status_code, (401, 403))

    def test_list_returns_200_when_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/tenants/')
        self.assertEqual(response.status_code, 200)
