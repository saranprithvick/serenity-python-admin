from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.db.utils import IntegrityError
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient, APITestCase

from apps.administration.models import Permission, Role
from apps.administration.repositories import RoleRepository, UserRoleRepository
from apps.tenancy.models import Tenant

from .repositories import PractitionerRepository
from .services import AuthService

Practitioner = get_user_model()


def build_request(method='post', path='/'):
    request = getattr(RequestFactory(), method)(path)
    SessionMiddleware(lambda r: None).process_request(request)
    request.session.save()
    return request


# ---------------------------------------------------------------------------
# PractitionerModelTest
# ---------------------------------------------------------------------------

class PractitionerModelTest(TestCase):
    def test_create_practitioner_with_email_and_password(self):
        p = Practitioner.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )
        self.assertEqual(p.email, 'user@example.com')
        self.assertTrue(p.check_password('pass1234'))
        self.assertTrue(p.is_active)
        self.assertFalse(p.is_staff)
        self.assertFalse(p.is_superuser)

    def test_create_superuser(self):
        admin = Practitioner.objects.create_superuser(
            email='admin@example.com', username='admin', password='pass1234'
        )
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

    def test_practitioner_str_returns_email(self):
        p = Practitioner.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )
        self.assertEqual(str(p), 'user@example.com')

    def test_practitioner_requires_email(self):
        with self.assertRaises(ValueError):
            Practitioner.objects.create_user(
                email='', username='user', password='pass1234'
            )

    def test_duplicate_email_raises_error(self):
        Practitioner.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )
        with self.assertRaises(IntegrityError):
            Practitioner.objects.create_user(
                email='user@example.com', username='other', password='pass1234'
            )


# ---------------------------------------------------------------------------
# PractitionerRepositoryTest
# ---------------------------------------------------------------------------

class PractitionerRepositoryTest(TestCase):
    def setUp(self):
        self.repository = PractitionerRepository()
        self.tenant = Tenant.objects.create(name='Acme', slug='acme')
        self.practitioner = self.repository.create_practitioner(
            email='user@example.com',
            username='user',
            password='pass1234',
            tenant=self.tenant,
        )

    def test_get_by_email_found(self):
        self.assertEqual(self.repository.get_by_email('user@example.com'), self.practitioner)

    def test_get_by_email_not_found(self):
        self.assertIsNone(self.repository.get_by_email('nobody@example.com'))

    def test_get_by_id_found(self):
        self.assertEqual(
            self.repository.get_by_id(self.practitioner.id, tenant_id=self.tenant.id),
            self.practitioner,
        )

    def test_get_by_id_not_found(self):
        self.assertIsNone(self.repository.get_by_id(99999))

    def test_get_all_for_tenant_returns_only_tenant_practitioners(self):
        other_tenant = Tenant.objects.create(name='Globex', slug='globex')
        self.repository.create_practitioner(
            email='other@example.com',
            username='other',
            password='pass1234',
            tenant=other_tenant,
        )
        practitioners = self.repository.get_all_for_tenant(self.tenant.id)
        self.assertEqual(list(practitioners), [self.practitioner])

    def test_create_practitioner(self):
        created = self.repository.create_practitioner(
            email='new@example.com', username='new', password='pass1234'
        )
        self.assertEqual(created.email, 'new@example.com')
        self.assertTrue(created.check_password('pass1234'))
        self.assertTrue(Practitioner.objects.filter(email='new@example.com').exists())


# ---------------------------------------------------------------------------
# AuthServiceTest
# ---------------------------------------------------------------------------

class AuthServiceTest(TestCase):
    def setUp(self):
        self.service = AuthService()
        self.practitioner = Practitioner.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )

    def test_authenticate_valid_credentials_creates_session(self):
        request = build_request()
        result = self.service.authenticate_practitioner(
            'user@example.com', 'pass1234', request
        )
        self.assertEqual(result, self.practitioner)
        self.assertIn('_auth_user_id', request.session)

    def test_authenticate_invalid_password_raises_error(self):
        request = build_request()
        with self.assertRaises(ValueError) as ctx:
            self.service.authenticate_practitioner('user@example.com', 'wrong', request)
        self.assertEqual(str(ctx.exception), 'Invalid credentials')

    def test_authenticate_inactive_practitioner_raises_error(self):
        self.practitioner.is_active = False
        self.practitioner.save()
        request = build_request()
        with self.assertRaises(ValueError) as ctx:
            self.service.authenticate_practitioner('user@example.com', 'pass1234', request)
        self.assertEqual(str(ctx.exception), 'Account is inactive')

    def test_logout_clears_session(self):
        request = build_request()
        self.service.authenticate_practitioner('user@example.com', 'pass1234', request)
        self.assertIn('_auth_user_id', request.session)
        self.service.logout_practitioner(request)
        self.assertNotIn('_auth_user_id', request.session)

    def test_get_current_practitioner_authenticated(self):
        request = build_request('get')
        request.user = self.practitioner
        self.assertEqual(self.service.get_current_practitioner(request), self.practitioner)

    def test_get_current_practitioner_anonymous(self):
        request = build_request('get')
        request.user = AnonymousUser()
        self.assertIsNone(self.service.get_current_practitioner(request))


# ---------------------------------------------------------------------------
# AuthAPITest
# ---------------------------------------------------------------------------

class AuthAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.practitioner = Practitioner.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )

    def test_login_success_returns_200_and_practitioner_data(self):
        response = self.client.post(
            '/api/practitioners/auth/login/',
            {'email': 'user@example.com', 'password': 'pass1234'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], 'user@example.com')
        self.assertNotIn('password', response.data)

    def test_login_invalid_credentials_returns_401(self):
        response = self.client.post(
            '/api/practitioners/auth/login/',
            {'email': 'user@example.com', 'password': 'wrong'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['error'], 'Invalid credentials')

    def test_login_missing_fields_returns_400(self):
        response = self.client.post(
            '/api/practitioners/auth/login/', {'email': 'user@example.com'}, format='json'
        )
        self.assertEqual(response.status_code, 400)

    def test_logout_authenticated_returns_204(self):
        self.client.force_authenticate(user=self.practitioner)
        response = self.client.post('/api/practitioners/auth/logout/')
        self.assertEqual(response.status_code, 204)

    def test_logout_unauthenticated_returns_401(self):
        response = self.client.post('/api/practitioners/auth/logout/')
        self.assertIn(response.status_code, (401, 403))

    def test_me_authenticated_returns_practitioner(self):
        self.client.force_authenticate(user=self.practitioner)
        response = self.client.get('/api/practitioners/auth/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], 'user@example.com')

    def test_me_unauthenticated_returns_401(self):
        response = self.client.get('/api/practitioners/auth/me/')
        self.assertIn(response.status_code, (401, 403))


# ---------------------------------------------------------------------------
# TenantIsolationTest
# ---------------------------------------------------------------------------

class TenantIsolationTest(TestCase):
    def setUp(self):
        self.repository = PractitionerRepository()
        self.tenant_a = Tenant.objects.create(name='Tenant A', slug='tenant-a')
        self.tenant_b = Tenant.objects.create(name='Tenant B', slug='tenant-b')
        self.prac_a = self.repository.create_practitioner(
            email='a@example.com', username='a', password='pass1234', tenant=self.tenant_a,
        )
        self.prac_b = self.repository.create_practitioner(
            email='b@example.com', username='b', password='pass1234', tenant=self.tenant_b,
        )

    def test_get_all_for_tenant_a_excludes_tenant_b(self):
        practitioners = self.repository.get_all_for_tenant(self.tenant_a.id)
        self.assertIn(self.prac_a, practitioners)
        self.assertNotIn(self.prac_b, practitioners)

    def test_get_all_for_tenant_b_excludes_tenant_a(self):
        practitioners = self.repository.get_all_for_tenant(self.tenant_b.id)
        self.assertIn(self.prac_b, practitioners)
        self.assertNotIn(self.prac_a, practitioners)


# ---------------------------------------------------------------------------
# PractitionerManagementAPITest
# ---------------------------------------------------------------------------

def _grant_permissions(user, tenant, permission_keys):
    role_repo = RoleRepository()
    ur_repo = UserRoleRepository()
    role = role_repo.create(f'role_{user.pk}', tenant)
    for key in permission_keys:
        role_repo.add_permission(role, Permission.objects.get(key=key))
    ur_repo.assign_role(user, role)


class PractitionerManagementAPITest(APITestCase):
    def setUp(self):
        Permission.get_or_create_defaults()

        self.tenant_a = Tenant.objects.create(name='Mgmt A', slug='mgmt-prac-a')
        self.tenant_b = Tenant.objects.create(name='Mgmt B', slug='mgmt-prac-b')

        self.admin = Practitioner.objects.create_user(
            email='admin@mgmt.com', username='adminmgmt',
            password='pass1234', tenant=self.tenant_a,
        )
        _grant_permissions(self.admin, self.tenant_a, [
            'Administration:UserView',
            'Administration:UserCreate',
            'Administration:UserUpdate',
            'Administration:UserDelete',
        ])

        self.prac_a = Practitioner.objects.create_user(
            email='praca@mgmt.com', username='praca',
            password='pass1234', tenant=self.tenant_a,
        )
        self.prac_b = Practitioner.objects.create_user(
            email='pracb@mgmt.com', username='pracb',
            password='pass1234', tenant=self.tenant_b,
        )

        self.client.force_login(self.admin)

    def test_list_returns_only_tenant_practitioners(self):
        response = self.client.get('/api/practitioners/')
        self.assertEqual(response.status_code, 200)
        emails = [u['email'] for u in response.data['results']]
        self.assertIn('admin@mgmt.com', emails)
        self.assertIn('praca@mgmt.com', emails)
        self.assertNotIn('pracb@mgmt.com', emails)

    def test_list_unauthenticated_returns_401(self):
        self.client.logout()
        response = self.client.get('/api/practitioners/')
        self.assertIn(response.status_code, [401, 403])

    def test_retrieve_own_tenant_returns_200(self):
        response = self.client.get(f'/api/practitioners/{self.prac_a.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], 'praca@mgmt.com')

    def test_retrieve_different_tenant_returns_404(self):
        response = self.client.get(f'/api/practitioners/{self.prac_b.id}/')
        self.assertEqual(response.status_code, 404)

    def test_create_practitioner_success(self):
        response = self.client.post(
            '/api/practitioners/',
            {
                'email': 'newprac@mgmt.com',
                'username': 'newprac',
                'password': 'pass1234',
                'first_name': 'New',
                'last_name': 'Practitioner',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['email'], 'newprac@mgmt.com')
        new_prac = Practitioner.objects.get(email='newprac@mgmt.com')
        self.assertEqual(new_prac.tenant, self.tenant_a)
        self.assertTrue(new_prac.check_password('pass1234'))

    def test_create_duplicate_email_returns_400(self):
        response = self.client.post(
            '/api/practitioners/',
            {
                'email': 'praca@mgmt.com',
                'username': 'praca_dup',
                'password': 'pass1234',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_update_practitioner_success(self):
        response = self.client.patch(
            f'/api/practitioners/{self.prac_a.id}/',
            {'first_name': 'Updated'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['first_name'], 'Updated')
        self.prac_a.refresh_from_db()
        self.assertEqual(self.prac_a.first_name, 'Updated')

    def test_destroy_practitioner_soft_deletes(self):
        response = self.client.delete(f'/api/practitioners/{self.prac_a.id}/')
        self.assertEqual(response.status_code, 204)
        self.prac_a.refresh_from_db()
        self.assertFalse(self.prac_a.is_active)

    def test_cannot_deactivate_self(self):
        response = self.client.delete(f'/api/practitioners/{self.admin.id}/')
        self.assertEqual(response.status_code, 400)
        self.assertIn('deactivate your own account', response.data['detail'])


# ---------------------------------------------------------------------------
# SuperuserElevationTest
# ---------------------------------------------------------------------------

class SuperuserElevationTest(APITestCase):
    def setUp(self):
        Permission.get_or_create_defaults()

        self.tenant_1 = Tenant.objects.create(name='Tenant 1', slug='elev-pt1')
        self.tenant_2 = Tenant.objects.create(name='Tenant 2', slug='elev-pt2')

        self.prac_1 = Practitioner.objects.create_user(
            email='testprac1@tenant1.com', username='testprac1',
            password='pass1234', tenant=self.tenant_1,
        )
        self.prac_2 = Practitioner.objects.create_user(
            email='testprac2@tenant2.com', username='testprac2',
            password='pass1234', tenant=self.tenant_2,
        )
        self.superuser = Practitioner.objects.create_superuser(
            email='superadmin@orthomed.com', username='superadmin',
            password='pass1234',
        )
        _grant_permissions(self.prac_1, self.tenant_1, ['Administration:UserView'])

    def test_superuser_sees_all_practitioners_across_tenants(self):
        self.client.force_login(self.superuser)
        response = self.client.get('/api/practitioners/')
        self.assertEqual(response.status_code, 200)
        emails = [u['email'] for u in response.data['results']]
        self.assertIn('testprac1@tenant1.com', emails)
        self.assertIn('testprac2@tenant2.com', emails)

    def test_superuser_sees_all_roles_across_tenants(self):
        from apps.administration.services import RoleService
        RoleRepository().create('Role1', self.tenant_1)
        RoleRepository().create('Role2', self.tenant_2)
        roles = RoleService().get_all_roles()
        names = list(roles.values_list('name', flat=True))
        self.assertIn('Role1', names)
        self.assertIn('Role2', names)

    def test_regular_practitioner_still_isolated(self):
        self.client.force_login(self.prac_1)
        response = self.client.get('/api/practitioners/')
        self.assertEqual(response.status_code, 200)
        emails = [u['email'] for u in response.data['results']]
        self.assertIn('testprac1@tenant1.com', emails)
        self.assertNotIn('testprac2@tenant2.com', emails)

    def test_superuser_can_create_practitioner_with_tenant_id(self):
        self.client.force_login(self.superuser)
        response = self.client.post(
            '/api/practitioners/',
            {
                'email': 'newsuper@tenant1.com',
                'username': 'newsuperprac',
                'password': 'pass1234',
                'tenant_id': self.tenant_1.id,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        new_prac = Practitioner.objects.get(email='newsuper@tenant1.com')
        self.assertEqual(new_prac.tenant, self.tenant_1)

    def test_superuser_create_without_tenant_id_returns_400(self):
        self.client.force_login(self.superuser)
        response = self.client.post(
            '/api/practitioners/',
            {'email': 'notenant@test.com', 'username': 'notenant', 'password': 'pass1234'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_dashboard_stats_superuser_returns_all_counts(self):
        self.client.force_login(self.superuser)
        response = self.client.get('/api/practitioners/auth/dashboard-stats/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('total_users', response.data)
        self.assertIn('total_tenants', response.data)
        self.assertIn('total_roles', response.data)
        self.assertIn('total_patients', response.data)
        self.assertGreaterEqual(response.data['total_users'], 3)
        self.assertGreaterEqual(response.data['total_tenants'], 2)

    def test_dashboard_stats_regular_user_returns_tenant_counts(self):
        self.client.force_login(self.prac_1)
        response = self.client.get('/api/practitioners/auth/dashboard-stats/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_tenants'], 1)
        self.assertGreaterEqual(response.data['total_users'], 1)
