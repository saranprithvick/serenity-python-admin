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


# ---------------------------------------------------------------------------
# TenantMiddleware tests
# ---------------------------------------------------------------------------

from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.test import RequestFactory

from .middleware import TenantMiddleware


def _ok_response(request):
    return HttpResponse('OK', status=200)


class TenantMiddlewareTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = TenantMiddleware(_ok_response)
        self.active_tenant = Tenant.objects.create(name='Acme MW', slug='acme-mw')
        self.inactive_tenant = Tenant.objects.create(
            name='Inactive MW', slug='inactive-mw', is_active=False
        )
        User = get_user_model()
        self.superuser = User.objects.create_superuser(
            email='su@example.com', username='superuser', password='pass1234'
        )
        self.tenant_user = User.objects.create_user(
            email='tenant@example.com', username='tenantuser', password='pass1234',
            tenant=self.active_tenant,
        )
        self.no_tenant_user = User.objects.create_user(
            email='notenant@example.com', username='notenantuser', password='pass1234',
        )
        self.inactive_tenant_user = User.objects.create_user(
            email='inactive@example.com', username='inactiveuser', password='pass1234',
            tenant=self.inactive_tenant,
        )

    def test_anonymous_request_tenant_is_none(self):
        request = self.factory.get('/')
        request.user = AnonymousUser()
        response = self.middleware(request)
        self.assertIsNone(request.tenant)
        self.assertEqual(response.status_code, 200)

    def test_superuser_request_tenant_is_none(self):
        request = self.factory.get('/')
        request.user = self.superuser
        response = self.middleware(request)
        self.assertIsNone(request.tenant)
        self.assertEqual(response.status_code, 200)

    def test_regular_user_request_tenant_is_set_correctly(self):
        request = self.factory.get('/')
        request.user = self.tenant_user
        self.middleware(request)
        self.assertEqual(request.tenant, self.active_tenant)

    def test_user_with_no_tenant_returns_403(self):
        request = self.factory.get('/')
        request.user = self.no_tenant_user
        response = self.middleware(request)
        self.assertEqual(response.status_code, 403)

    def test_user_with_inactive_tenant_returns_403(self):
        request = self.factory.get('/')
        request.user = self.inactive_tenant_user
        response = self.middleware(request)
        self.assertEqual(response.status_code, 403)

    def test_user_with_active_tenant_request_succeeds(self):
        request = self.factory.get('/')
        request.user = self.tenant_user
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.active_tenant)


# ---------------------------------------------------------------------------
# TenantAwareManager tests
# ---------------------------------------------------------------------------

from apps.administration.models import Role


class TenantAwareManagerTest(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name='Acme Mgr', slug='acme-mgr')
        self.tenant_b = Tenant.objects.create(name='Globex Mgr', slug='globex-mgr')
        self.role_a1 = Role.objects.create(tenant=self.tenant_a, name='Admin')
        self.role_a2 = Role.objects.create(tenant=self.tenant_a, name='Viewer')
        self.role_b1 = Role.objects.create(tenant=self.tenant_b, name='Admin')

    def test_for_tenant_returns_only_matching_records(self):
        qs = Role.objects.for_tenant(self.tenant_a)
        self.assertIn(self.role_a1, qs)
        self.assertIn(self.role_a2, qs)
        self.assertNotIn(self.role_b1, qs)

    def test_for_tenant_none_returns_empty_queryset(self):
        qs = Role.objects.for_tenant(None)
        self.assertEqual(qs.count(), 0)

    def test_for_tenant_id_returns_only_matching_records(self):
        qs = Role.objects.for_tenant_id(self.tenant_b.id)
        self.assertIn(self.role_b1, qs)
        self.assertNotIn(self.role_a1, qs)

    def test_for_tenant_id_none_returns_empty_queryset(self):
        qs = Role.objects.for_tenant_id(None)
        self.assertEqual(qs.count(), 0)

    def test_for_tenant_excludes_other_tenant_records(self):
        qs = Role.objects.for_tenant(self.tenant_a)
        self.assertNotIn(self.role_b1, qs)
        self.assertEqual(qs.count(), 2)
