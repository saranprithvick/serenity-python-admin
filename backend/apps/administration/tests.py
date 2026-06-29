from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.tenancy.models import Tenant
from .models import Permission, Role, RolePermission, UserRole
from .repositories import PermissionRepository, RoleRepository, UserRoleRepository
from .permissions import HasPermission
from .services import UserRoleService

User = get_user_model()


def make_tenant(slug='test-tenant', name='Test Tenant'):
    return Tenant.objects.create(slug=slug, name=name)


def make_user(tenant, email='user@example.com', password='pass'):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], password=password, tenant=tenant
    )


def make_permission(module='Customer', action='View'):
    key = f'{module}:{action}'
    return Permission.objects.create(key=key, module=module, action=action)


# ---------------------------------------------------------------------------
# PermissionModelTest
# ---------------------------------------------------------------------------

class PermissionModelTest(TestCase):
    def test_permission_key_format(self):
        p = make_permission('Customer', 'View')
        self.assertIn(':', p.key)

    def test_permission_key_unique(self):
        make_permission('Customer', 'View')
        from django.db import IntegrityError
        with self.assertRaises(Exception):
            make_permission('Customer', 'View')

    def test_get_or_create_defaults_creates_all_permissions(self):
        Permission.get_or_create_defaults()
        expected_keys = [
            'Administration:UserView', 'Administration:UserCreate',
            'Administration:UserUpdate', 'Administration:UserDelete',
            'Administration:RoleView', 'Administration:RoleCreate',
            'Administration:RoleUpdate', 'Administration:RoleDelete',
            'Customer:View', 'Customer:Create',
            'Customer:Update', 'Customer:Delete',
        ]
        for key in expected_keys:
            self.assertTrue(
                Permission.objects.filter(key=key).exists(),
                f'Missing default permission: {key}',
            )

    def test_get_or_create_defaults_is_idempotent(self):
        Permission.get_or_create_defaults()
        Permission.get_or_create_defaults()
        self.assertEqual(Permission.objects.count(), 12)


# ---------------------------------------------------------------------------
# RoleModelTest
# ---------------------------------------------------------------------------

class RoleModelTest(TestCase):
    def setUp(self):
        self.tenant = make_tenant()

    def test_create_role_for_tenant(self):
        role = Role.objects.create(name='Admin', tenant=self.tenant)
        self.assertEqual(role.tenant, self.tenant)
        self.assertEqual(role.name, 'Admin')

    def test_role_name_unique_per_tenant(self):
        Role.objects.create(name='Admin', tenant=self.tenant)
        from django.db import IntegrityError
        with self.assertRaises(Exception):
            Role.objects.create(name='Admin', tenant=self.tenant)

    def test_same_role_name_allowed_in_different_tenants(self):
        tenant2 = make_tenant(slug='tenant-2', name='Tenant 2')
        Role.objects.create(name='Admin', tenant=self.tenant)
        role2 = Role.objects.create(name='Admin', tenant=tenant2)
        self.assertEqual(role2.name, 'Admin')


# ---------------------------------------------------------------------------
# RoleRepositoryTest
# ---------------------------------------------------------------------------

class RoleRepositoryTest(TestCase):
    def setUp(self):
        self.tenant_a = make_tenant(slug='tenant-a', name='Tenant A')
        self.tenant_b = make_tenant(slug='tenant-b', name='Tenant B')
        self.repo = RoleRepository()
        self.perm_repo = PermissionRepository()
        self.role_a = self.repo.create('Editors', self.tenant_a)
        self.role_b = self.repo.create('Editors', self.tenant_b)

    def test_get_by_id_correct_tenant(self):
        found = self.repo.get_by_id(self.role_a.id, self.tenant_a.id)
        self.assertEqual(found, self.role_a)

    def test_get_by_id_wrong_tenant_returns_none(self):
        found = self.repo.get_by_id(self.role_a.id, self.tenant_b.id)
        self.assertIsNone(found)

    def test_get_all_for_tenant_isolation(self):
        qs = self.repo.get_all_for_tenant(self.tenant_a.id)
        self.assertIn(self.role_a, qs)
        self.assertNotIn(self.role_b, qs)

    def test_add_permission_to_role(self):
        perm = make_permission('Customer', 'View')
        rp = self.repo.add_permission(self.role_a, perm)
        self.assertIsInstance(rp, RolePermission)
        self.assertIn(perm, self.role_a.permissions.all())

    def test_remove_permission_from_role(self):
        perm = make_permission('Customer', 'View')
        self.repo.add_permission(self.role_a, perm)
        self.repo.remove_permission(self.role_a, perm)
        self.assertNotIn(perm, self.role_a.permissions.all())

    def test_get_permissions_for_role(self):
        perm1 = make_permission('Customer', 'View')
        perm2 = make_permission('Customer', 'Create')
        self.repo.add_permission(self.role_a, perm1)
        self.repo.add_permission(self.role_a, perm2)
        perms = self.repo.get_permissions_for_role(self.role_a.id)
        self.assertIn(perm1, perms)
        self.assertIn(perm2, perms)


# ---------------------------------------------------------------------------
# UserRoleRepositoryTest
# ---------------------------------------------------------------------------

class UserRoleRepositoryTest(TestCase):
    def setUp(self):
        self.tenant = make_tenant()
        self.user = make_user(self.tenant, 'alice@example.com')
        self.role_repo = RoleRepository()
        self.repo = UserRoleRepository()
        self.role1 = self.role_repo.create('Role1', self.tenant)
        self.role2 = self.role_repo.create('Role2', self.tenant)
        self.perm1 = make_permission('Customer', 'View')
        self.perm2 = make_permission('Customer', 'Create')
        self.role_repo.add_permission(self.role1, self.perm1)
        self.role_repo.add_permission(self.role2, self.perm2)

    def test_assign_role_to_user(self):
        ur = self.repo.assign_role(self.user, self.role1)
        self.assertIsInstance(ur, UserRole)
        self.assertEqual(ur.user, self.user)
        self.assertEqual(ur.role, self.role1)

    def test_get_roles_for_user(self):
        self.repo.assign_role(self.user, self.role1)
        self.repo.assign_role(self.user, self.role2)
        roles = self.repo.get_roles_for_user(self.user.id)
        self.assertIn(self.role1, roles)
        self.assertIn(self.role2, roles)

    def test_get_permissions_for_user_flattens_all_roles(self):
        self.repo.assign_role(self.user, self.role1)
        self.repo.assign_role(self.user, self.role2)
        perms = self.repo.get_permissions_for_user(self.user.id)
        self.assertIn(self.perm1, perms)
        self.assertIn(self.perm2, perms)

    def test_user_has_permission_true(self):
        self.repo.assign_role(self.user, self.role1)
        result = self.repo.user_has_permission(self.user.id, 'Customer:View')
        self.assertTrue(result)

    def test_user_has_permission_false(self):
        result = self.repo.user_has_permission(self.user.id, 'Customer:Delete')
        self.assertFalse(result)

    def test_user_has_permission_checks_across_multiple_roles(self):
        self.repo.assign_role(self.user, self.role1)
        self.repo.assign_role(self.user, self.role2)
        self.assertTrue(self.repo.user_has_permission(self.user.id, 'Customer:View'))
        self.assertTrue(self.repo.user_has_permission(self.user.id, 'Customer:Create'))


# ---------------------------------------------------------------------------
# HasPermissionTest
# ---------------------------------------------------------------------------

class HasPermissionTest(TestCase):
    def setUp(self):
        self.tenant = make_tenant()
        self.user = make_user(self.tenant, 'bob@example.com')
        self.role_repo = RoleRepository()
        self.user_role_repo = UserRoleRepository()
        self.perm = make_permission('Customer', 'View')
        self.role = self.role_repo.create('Viewers', self.tenant)
        self.role_repo.add_permission(self.role, self.perm)

    def _make_request(self, user):
        request = MagicMock()
        request.user = user
        return request

    def test_unauthenticated_user_denied(self):
        anon = MagicMock()
        anon.is_authenticated = False
        request = self._make_request(anon)
        checker = HasPermission('Customer:View')
        self.assertFalse(checker.has_permission(request, None))

    def test_superuser_always_allowed(self):
        superuser = User.objects.create_superuser(
            email='super@example.com', username='super', password='pass'
        )
        request = self._make_request(superuser)
        checker = HasPermission('Customer:Delete')
        self.assertTrue(checker.has_permission(request, None))

    def test_user_with_permission_allowed(self):
        self.user_role_repo.assign_role(self.user, self.role)
        request = self._make_request(self.user)
        checker = HasPermission('Customer:View')
        self.assertTrue(checker.has_permission(request, None))

    def test_user_without_permission_denied(self):
        request = self._make_request(self.user)
        checker = HasPermission('Customer:View')
        self.assertFalse(checker.has_permission(request, None))

    def test_permission_key_format_checked_exactly(self):
        self.user_role_repo.assign_role(self.user, self.role)
        request = self._make_request(self.user)
        checker = HasPermission('customer:view')  # wrong case
        self.assertFalse(checker.has_permission(request, None))


# ---------------------------------------------------------------------------
# TenantIsolationTest
# ---------------------------------------------------------------------------

class TenantIsolationTest(TestCase):
    def setUp(self):
        self.tenant_a = make_tenant(slug='iso-a', name='Iso A')
        self.tenant_b = make_tenant(slug='iso-b', name='Iso B')
        self.user_a = make_user(self.tenant_a, 'usera@example.com')
        self.role_repo = RoleRepository()
        self.role_a = self.role_repo.create('AdminA', self.tenant_a)

    def test_role_from_tenant_a_not_visible_to_tenant_b(self):
        found = self.role_repo.get_by_id(self.role_a.id, self.tenant_b.id)
        self.assertIsNone(found)

    def test_user_cannot_be_assigned_role_from_different_tenant(self):
        service = UserRoleService()
        with self.assertRaises(ValueError):
            service.assign_role_to_user(self.user_a.id, self.role_a.id, self.tenant_b.id)


# ---------------------------------------------------------------------------
# PermissionAPITest
# ---------------------------------------------------------------------------

class PermissionAPITest(APITestCase):
    def setUp(self):
        self.tenant = make_tenant(slug='api-perm', name='API Perm')
        self.superuser = User.objects.create_superuser(
            email='super_perm@test.com', username='superperm', password='pass',
        )
        Permission.get_or_create_defaults()

    def test_list_permissions_authenticated_returns_200(self):
        self.client.force_login(self.superuser)
        response = self.client.get('/api/administration/permissions/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        self.assertEqual(response.data['count'], 12)

    def test_list_permissions_unauthenticated_returns_401(self):
        # SessionAuthentication has no WWW-Authenticate header, so DRF
        # downgrades NotAuthenticated from 401 → 403. Both mean "denied".
        response = self.client.get('/api/administration/permissions/')
        self.assertIn(response.status_code, [401, 403])

    def test_retrieve_permission_by_id(self):
        self.client.force_login(self.superuser)
        perm = Permission.objects.get(key='Customer:View')
        response = self.client.get(f'/api/administration/permissions/{perm.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], perm.id)
        self.assertEqual(response.data['key'], 'Customer:View')


# ---------------------------------------------------------------------------
# RoleAPITest
# ---------------------------------------------------------------------------

class RoleAPITest(APITestCase):
    def setUp(self):
        self.tenant_a = make_tenant(slug='api-role-a', name='Role A')
        self.tenant_b = make_tenant(slug='api-role-b', name='Role B')
        self.superuser = User.objects.create_superuser(
            email='super_role@test.com', username='superrole', password='pass',
            tenant=self.tenant_a,
        )
        self.client.force_login(self.superuser)
        Permission.get_or_create_defaults()

    def test_list_roles_returns_only_tenant_roles(self):
        RoleRepository().create('RoleA', self.tenant_a)
        RoleRepository().create('RoleB', self.tenant_b)
        response = self.client.get('/api/administration/roles/')
        self.assertEqual(response.status_code, 200)
        names = [r['name'] for r in response.data['results']]
        self.assertIn('RoleA', names)
        self.assertNotIn('RoleB', names)

    def test_create_role_success(self):
        response = self.client.post(
            '/api/administration/roles/',
            {'name': 'Manager', 'description': 'Tenant manager role'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name'], 'Manager')
        self.assertEqual(response.data['tenant_id'], self.tenant_a.id)

    def test_create_role_without_permission_returns_403(self):
        no_perm_user = make_user(self.tenant_a, 'noperm_role@test.com')
        self.client.force_login(no_perm_user)
        response = self.client.post(
            '/api/administration/roles/',
            {'name': 'ShouldFail'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_retrieve_role_includes_permissions(self):
        role = RoleRepository().create('WithPerms', self.tenant_a)
        perm = Permission.objects.get(key='Customer:View')
        RoleRepository().add_permission(role, perm)
        response = self.client.get(f'/api/administration/roles/{role.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('permissions', response.data)
        self.assertEqual(len(response.data['permissions']), 1)
        self.assertEqual(response.data['permissions'][0]['key'], 'Customer:View')

    def test_assign_permission_to_role(self):
        role = RoleRepository().create('AssignPerm', self.tenant_a)
        perm = Permission.objects.get(key='Customer:View')
        response = self.client.post(
            f'/api/administration/roles/{role.id}/assign_permission/',
            {'permission_id': perm.id},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn(perm, role.permissions.all())

    def test_remove_permission_from_role(self):
        role = RoleRepository().create('RemovePerm', self.tenant_a)
        perm = Permission.objects.get(key='Customer:View')
        RoleRepository().add_permission(role, perm)
        response = self.client.delete(
            f'/api/administration/roles/{role.id}/remove_permission/',
            {'permission_id': perm.id},
            format='json',
        )
        self.assertEqual(response.status_code, 204)
        self.assertNotIn(perm, role.permissions.all())


# ---------------------------------------------------------------------------
# UserRoleAPITest
# ---------------------------------------------------------------------------

class UserRoleAPITest(APITestCase):
    def setUp(self):
        self.tenant_a = make_tenant(slug='api-ur-a', name='UR A')
        self.tenant_b = make_tenant(slug='api-ur-b', name='UR B')
        self.superuser = User.objects.create_superuser(
            email='super_ur@test.com', username='superur', password='pass',
            tenant=self.tenant_a,
        )
        self.target_user = make_user(self.tenant_a, 'target_ur@test.com')
        self.role_a = RoleRepository().create('URRoleA', self.tenant_a)
        self.role_b = RoleRepository().create('URRoleB', self.tenant_b)
        self.client.force_login(self.superuser)

    def test_assign_role_to_user_success(self):
        response = self.client.post(
            '/api/administration/user-roles/assign/',
            {'user_id': self.target_user.id, 'role_id': self.role_a.id},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            UserRole.objects.filter(user=self.target_user, role=self.role_a).exists()
        )

    def test_assign_role_from_different_tenant_fails(self):
        response = self.client.post(
            '/api/administration/user-roles/assign/',
            {'user_id': self.target_user.id, 'role_id': self.role_b.id},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_remove_role_from_user(self):
        UserRoleRepository().assign_role(self.target_user, self.role_a)
        response = self.client.delete(
            '/api/administration/user-roles/remove/',
            {'user_id': self.target_user.id, 'role_id': self.role_a.id},
            format='json',
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            UserRole.objects.filter(user=self.target_user, role=self.role_a).exists()
        )

    def test_get_user_roles(self):
        UserRoleRepository().assign_role(self.target_user, self.role_a)
        response = self.client.get(
            f'/api/administration/user-roles/{self.target_user.id}/roles/'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'URRoleA')

    def test_get_user_permissions_flattened(self):
        perm = Permission.objects.create(key='Customer:View', module='Customer', action='View')
        RoleRepository().add_permission(self.role_a, perm)
        UserRoleRepository().assign_role(self.target_user, self.role_a)
        response = self.client.get(
            f'/api/administration/user-roles/{self.target_user.id}/permissions/'
        )
        self.assertEqual(response.status_code, 200)
        keys = [p['key'] for p in response.data]
        self.assertIn('Customer:View', keys)
