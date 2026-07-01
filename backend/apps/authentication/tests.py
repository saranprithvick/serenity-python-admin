from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.db.utils import IntegrityError
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

from apps.tenancy.models import Tenant

from .repositories import UserRepository
from .services import AuthService

User = get_user_model()


def build_request(method='post', path='/'):
    """A bare request carrying a working session, for service-layer tests."""
    request = getattr(RequestFactory(), method)(path)
    SessionMiddleware(lambda r: None).process_request(request)
    request.session.save()
    return request


class AuthModelTest(TestCase):
    def test_create_user_with_email_and_password(self):
        user = User.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )
        self.assertEqual(user.email, 'user@example.com')
        self.assertTrue(user.check_password('pass1234'))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_superuser(self):
        admin = User.objects.create_superuser(
            email='admin@example.com', username='admin', password='pass1234'
        )
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

    def test_user_str_returns_email(self):
        user = User.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )
        self.assertEqual(str(user), 'user@example.com')

    def test_user_requires_email(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(
                email='', username='user', password='pass1234'
            )

    def test_duplicate_email_raises_error(self):
        User.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                email='user@example.com', username='other', password='pass1234'
            )


class UserRepositoryTest(TestCase):
    def setUp(self):
        self.repository = UserRepository()
        self.tenant = Tenant.objects.create(name='Acme', slug='acme')
        self.user = self.repository.create_user(
            email='user@example.com',
            username='user',
            password='pass1234',
            tenant=self.tenant,
        )

    def test_get_by_email_found(self):
        self.assertEqual(self.repository.get_by_email('user@example.com'), self.user)

    def test_get_by_email_not_found(self):
        self.assertIsNone(self.repository.get_by_email('nobody@example.com'))

    def test_get_by_id_found(self):
        self.assertEqual(self.repository.get_by_id(self.user.id), self.user)

    def test_get_by_id_not_found(self):
        self.assertIsNone(self.repository.get_by_id(99999))

    def test_get_all_for_tenant_returns_only_tenant_users(self):
        other_tenant = Tenant.objects.create(name='Globex', slug='globex')
        self.repository.create_user(
            email='other@example.com',
            username='other',
            password='pass1234',
            tenant=other_tenant,
        )
        users = self.repository.get_all_for_tenant(self.tenant.id)
        self.assertEqual(list(users), [self.user])

    def test_create_user(self):
        created = self.repository.create_user(
            email='new@example.com', username='new', password='pass1234'
        )
        self.assertEqual(created.email, 'new@example.com')
        self.assertTrue(created.check_password('pass1234'))
        self.assertTrue(User.objects.filter(email='new@example.com').exists())


class AuthServiceTest(TestCase):
    def setUp(self):
        self.service = AuthService()
        self.user = User.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )

    def test_authenticate_valid_credentials_creates_session(self):
        request = build_request()
        result = self.service.authenticate_user(
            'user@example.com', 'pass1234', request
        )
        self.assertEqual(result, self.user)
        self.assertIn('_auth_user_id', request.session)

    def test_authenticate_invalid_password_raises_error(self):
        request = build_request()
        with self.assertRaises(ValueError) as ctx:
            self.service.authenticate_user('user@example.com', 'wrong', request)
        self.assertEqual(str(ctx.exception), 'Invalid credentials')

    def test_authenticate_inactive_user_raises_error(self):
        self.user.is_active = False
        self.user.save()
        request = build_request()
        with self.assertRaises(ValueError) as ctx:
            self.service.authenticate_user('user@example.com', 'pass1234', request)
        self.assertEqual(str(ctx.exception), 'Account is inactive')

    def test_logout_clears_session(self):
        request = build_request()
        self.service.authenticate_user('user@example.com', 'pass1234', request)
        self.assertIn('_auth_user_id', request.session)
        self.service.logout_user(request)
        self.assertNotIn('_auth_user_id', request.session)

    def test_get_current_user_authenticated(self):
        request = build_request('get')
        request.user = self.user
        self.assertEqual(self.service.get_current_user(request), self.user)

    def test_get_current_user_anonymous(self):
        request = build_request('get')
        request.user = AnonymousUser()
        self.assertIsNone(self.service.get_current_user(request))


class AuthAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='user@example.com', username='user', password='pass1234'
        )

    def test_login_success_returns_200_and_user_data(self):
        response = self.client.post(
            '/api/auth/login/',
            {'email': 'user@example.com', 'password': 'pass1234'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], 'user@example.com')
        self.assertNotIn('password', response.data)

    def test_login_invalid_credentials_returns_401(self):
        response = self.client.post(
            '/api/auth/login/',
            {'email': 'user@example.com', 'password': 'wrong'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['error'], 'Invalid credentials')

    def test_login_missing_fields_returns_400(self):
        response = self.client.post(
            '/api/auth/login/', {'email': 'user@example.com'}, format='json'
        )
        self.assertEqual(response.status_code, 400)

    def test_logout_authenticated_returns_204(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/auth/logout/')
        self.assertEqual(response.status_code, 204)

    def test_logout_unauthenticated_returns_401(self):
        response = self.client.post('/api/auth/logout/')
        self.assertIn(response.status_code, (401, 403))

    def test_me_authenticated_returns_user(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], 'user@example.com')

    def test_me_unauthenticated_returns_401(self):
        response = self.client.get('/api/auth/me/')
        self.assertIn(response.status_code, (401, 403))


class TenantIsolationTest(TestCase):
    def setUp(self):
        self.repository = UserRepository()
        self.tenant_a = Tenant.objects.create(name='Tenant A', slug='tenant-a')
        self.tenant_b = Tenant.objects.create(name='Tenant B', slug='tenant-b')
        self.user_a = self.repository.create_user(
            email='a@example.com',
            username='a',
            password='pass1234',
            tenant=self.tenant_a,
        )
        self.user_b = self.repository.create_user(
            email='b@example.com',
            username='b',
            password='pass1234',
            tenant=self.tenant_b,
        )

    def test_get_all_for_tenant_a_excludes_tenant_b_users(self):
        users = self.repository.get_all_for_tenant(self.tenant_a.id)
        self.assertIn(self.user_a, users)
        self.assertNotIn(self.user_b, users)

    def test_get_all_for_tenant_b_excludes_tenant_a_users(self):
        users = self.repository.get_all_for_tenant(self.tenant_b.id)
        self.assertIn(self.user_b, users)
        self.assertNotIn(self.user_a, users)


# ---------------------------------------------------------------------------
# UserManagementAPITest
# ---------------------------------------------------------------------------

from rest_framework.test import APITestCase
from apps.administration.models import Permission, Role
from apps.administration.repositories import RoleRepository, UserRoleRepository


def _grant_user_permissions(user, tenant, permission_keys):
    role_repo = RoleRepository()
    ur_repo = UserRoleRepository()
    role = role_repo.create(f'role_{user.pk}', tenant)
    for key in permission_keys:
        role_repo.add_permission(role, Permission.objects.get(key=key))
    ur_repo.assign_role(user, role)


class UserManagementAPITest(APITestCase):
    def setUp(self):
        Permission.get_or_create_defaults()

        self.tenant_a = Tenant.objects.create(name='Mgmt A', slug='mgmt-a')
        self.tenant_b = Tenant.objects.create(name='Mgmt B', slug='mgmt-b')

        self.admin = User.objects.create_user(
            email='admin@mgmt.com', username='adminmgmt',
            password='pass1234', tenant=self.tenant_a,
        )
        _grant_user_permissions(self.admin, self.tenant_a, [
            'Administration:UserView',
            'Administration:UserCreate',
            'Administration:UserUpdate',
            'Administration:UserDelete',
        ])

        self.user_a = User.objects.create_user(
            email='usera@mgmt.com', username='usera',
            password='pass1234', tenant=self.tenant_a,
        )
        self.user_b = User.objects.create_user(
            email='userb@mgmt.com', username='userb',
            password='pass1234', tenant=self.tenant_b,
        )

        self.client.force_login(self.admin)

    def test_list_users_returns_only_tenant_users(self):
        response = self.client.get('/api/auth/users/')
        self.assertEqual(response.status_code, 200)
        emails = [u['email'] for u in response.data['results']]
        self.assertIn('admin@mgmt.com', emails)
        self.assertIn('usera@mgmt.com', emails)
        self.assertNotIn('userb@mgmt.com', emails)

    def test_list_users_unauthenticated_returns_401(self):
        self.client.logout()
        response = self.client.get('/api/auth/users/')
        self.assertIn(response.status_code, [401, 403])

    def test_retrieve_user_own_tenant_returns_200(self):
        response = self.client.get(f'/api/auth/users/{self.user_a.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], 'usera@mgmt.com')

    def test_retrieve_user_different_tenant_returns_404(self):
        response = self.client.get(f'/api/auth/users/{self.user_b.id}/')
        self.assertEqual(response.status_code, 404)

    def test_create_user_success(self):
        response = self.client.post(
            '/api/auth/users/',
            {
                'email': 'newuser@mgmt.com',
                'username': 'newuser',
                'password': 'pass1234',
                'first_name': 'New',
                'last_name': 'User',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['email'], 'newuser@mgmt.com')
        new_user = User.objects.get(email='newuser@mgmt.com')
        self.assertEqual(new_user.tenant, self.tenant_a)
        self.assertTrue(new_user.check_password('pass1234'))

    def test_create_user_duplicate_email_returns_400(self):
        response = self.client.post(
            '/api/auth/users/',
            {
                'email': 'usera@mgmt.com',
                'username': 'usera_dup',
                'password': 'pass1234',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_update_user_success(self):
        response = self.client.patch(
            f'/api/auth/users/{self.user_a.id}/',
            {'first_name': 'Updated'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['first_name'], 'Updated')
        self.user_a.refresh_from_db()
        self.assertEqual(self.user_a.first_name, 'Updated')

    def test_destroy_user_soft_deletes(self):
        response = self.client.delete(f'/api/auth/users/{self.user_a.id}/')
        self.assertEqual(response.status_code, 204)
        self.user_a.refresh_from_db()
        self.assertFalse(self.user_a.is_active)

    def test_cannot_deactivate_self(self):
        response = self.client.delete(f'/api/auth/users/{self.admin.id}/')
        self.assertEqual(response.status_code, 400)
        self.assertIn('deactivate your own account', response.data['detail'])
