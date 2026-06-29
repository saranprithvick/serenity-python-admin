"""
Day 2 + Day 3 Verification Suite
=================================
Covers: Tenancy, Authentication, RBAC Models, RBAC Permission Checks,
        RBAC API Endpoints, Tenant Isolation.

Run with:
    python manage.py test apps.verification.day02_day03_tests --verbosity=2
"""
from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.tenancy.models import Tenant
from apps.authentication.repositories import UserRepository
from apps.administration.models import Permission, Role, RolePermission, UserRole
from apps.administration.repositories import (
    PermissionRepository,
    RoleRepository,
    UserRoleRepository,
)
from apps.administration.services import PermissionService, RoleService, UserRoleService
from apps.administration.permissions import HasPermission

User = get_user_model()

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _tenant(slug, name):
    return Tenant.objects.create(slug=slug, name=name)


def _user(tenant, email, password='pass1234'):
    return UserRepository().create_user(
        email=email,
        username=email.split('@')[0],
        password=password,
        tenant=tenant,
    )


def _superuser(email, password='pass1234', tenant=None):
    u = User.objects.create_superuser(
        email=email, username=email.split('@')[0], password=password
    )
    if tenant is not None:
        u.tenant = tenant
        u.save()
    return u


def _anon_request():
    """A mock request for an unauthenticated user."""
    anon = MagicMock()
    anon.is_authenticated = False
    req = MagicMock()
    req.user = anon
    return req


# ============================================================================
# Group 1 — Tenancy
# ============================================================================

class TenancyTests(TestCase):
    """Verifies that the Tenant model works as expected."""

    def test_create_tenant(self):
        t = Tenant.objects.create(name='Acme Corp', slug='acme-corp')
        self.assertEqual(t.name, 'Acme Corp')
        self.assertEqual(t.slug, 'acme-corp')
        self.assertTrue(t.is_active)

    def test_tenant_slug_unique(self):
        Tenant.objects.create(name='First', slug='duplicate-slug')
        with self.assertRaises(Exception):
            Tenant.objects.create(name='Second', slug='duplicate-slug')

    def test_tenant_str(self):
        t = Tenant.objects.create(name='My Tenant', slug='my-tenant')
        self.assertEqual(str(t), 'My Tenant')


# ============================================================================
# Group 2 — Authentication
# ============================================================================

class AuthenticationTests(TestCase):
    """Verifies User creation, login, logout, and /me endpoint behaviour."""

    def setUp(self):
        self.client = APIClient()
        self.tenant = _tenant('auth-verify', 'Auth Verify Tenant')
        self.user = _user(self.tenant, 'auth@verify.com')

    # ---- model / repository ------------------------------------------------

    def test_create_user_with_email(self):
        u = _user(self.tenant, 'new@verify.com')
        self.assertEqual(u.email, 'new@verify.com')
        self.assertEqual(u.tenant, self.tenant)

    def test_user_password_is_hashed(self):
        from django.contrib.auth.hashers import is_password_usable
        self.assertNotEqual(self.user.password, 'pass1234')
        self.assertTrue(is_password_usable(self.user.password))

    # ---- login endpoint ----------------------------------------------------

    def test_login_valid_credentials(self):
        resp = self.client.post(
            '/api/auth/login/',
            {'email': 'auth@verify.com', 'password': 'pass1234'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['email'], 'auth@verify.com')
        self.assertNotIn('password', resp.data)

    def test_login_invalid_password(self):
        resp = self.client.post(
            '/api/auth/login/',
            {'email': 'auth@verify.com', 'password': 'wrong'},
            format='json',
        )
        self.assertEqual(resp.status_code, 401)

    def test_login_missing_fields(self):
        resp = self.client.post('/api/auth/login/', {}, format='json')
        self.assertEqual(resp.status_code, 400)

    # ---- /me endpoint -------------------------------------------------------

    def test_me_authenticated(self):
        self.client.force_login(self.user)
        resp = self.client.get('/api/auth/me/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['email'], 'auth@verify.com')

    def test_me_unauthenticated(self):
        # DRF + SessionAuthentication-only returns 403 (no WWW-Authenticate
        # header), so we accept either 401 or 403 — both mean "denied".
        resp = self.client.get('/api/auth/me/')
        self.assertIn(resp.status_code, [401, 403])

    # ---- logout ------------------------------------------------------------

    def test_logout(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/auth/logout/')
        self.assertEqual(resp.status_code, 204)

    def test_me_after_logout(self):
        # Establish a real session via the login endpoint
        self.client.post(
            '/api/auth/login/',
            {'email': 'auth@verify.com', 'password': 'pass1234'},
            format='json',
        )
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)
        # Logout clears the server-side session
        self.client.post('/api/auth/logout/')
        # /me must now be denied (session data is gone)
        resp = self.client.get('/api/auth/me/')
        self.assertIn(resp.status_code, [401, 403])


# ============================================================================
# Group 3 — RBAC Models
# ============================================================================

class RBACModelTests(TestCase):
    """Verifies Permission, Role, RolePermission, UserRole model behaviour."""

    def setUp(self):
        self.tenant = _tenant('rbac-model', 'RBAC Model Tenant')
        PermissionService().seed_default_permissions()
        self.role_repo = RoleRepository()
        self.user_role_repo = UserRoleRepository()

    def test_permissions_seeded(self):
        self.assertEqual(Permission.objects.count(), 12)

    def test_permission_key_format(self):
        for p in Permission.objects.all():
            self.assertIn(':', p.key, f'Bad key format: {p.key}')

    def test_create_role(self):
        role = self.role_repo.create('Admin', self.tenant)
        self.assertEqual(role.name, 'Admin')
        self.assertEqual(role.tenant, self.tenant)

    def test_role_name_unique_per_tenant(self):
        self.role_repo.create('Unique', self.tenant)
        with self.assertRaises(Exception):
            self.role_repo.create('Unique', self.tenant)

    def test_same_role_name_different_tenants(self):
        tenant2 = _tenant('rbac-model-2', 'RBAC Model Tenant 2')
        self.role_repo.create('Shared', self.tenant)
        role2 = self.role_repo.create('Shared', tenant2)
        self.assertEqual(role2.name, 'Shared')

    def test_assign_permission_to_role(self):
        role = self.role_repo.create('PermRole', self.tenant)
        perm = PermissionRepository().get_by_key('Customer:View')
        rp = self.role_repo.add_permission(role, perm)
        self.assertIsInstance(rp, RolePermission)
        self.assertIn(perm, role.permissions.all())

    def test_assign_user_to_role(self):
        role = self.role_repo.create('UserRole', self.tenant)
        user = _user(self.tenant, 'roleuser@rbac.com')
        ur = self.user_role_repo.assign_role(user, role)
        self.assertIsInstance(ur, UserRole)
        self.assertEqual(ur.user, user)
        self.assertEqual(ur.role, role)


# ============================================================================
# Group 4 — RBAC Permission Checks
# ============================================================================

class RBACPermissionCheckTests(TestCase):
    """Verifies UserRoleRepository permission checks and HasPermission class."""

    def setUp(self):
        self.tenant = _tenant('rbac-check', 'RBAC Check Tenant')
        PermissionService().seed_default_permissions()
        self.role_repo = RoleRepository()
        self.user_role_repo = UserRoleRepository()
        self.perm_repo = PermissionRepository()

        # Create a role with Customer:View assigned
        self.role = self.role_repo.create('Viewer', self.tenant)
        self.view_perm = self.perm_repo.get_by_key('Customer:View')
        self.role_repo.add_permission(self.role, self.view_perm)

        # Create a regular user and assign the role
        self.user = _user(self.tenant, 'checker@rbac.com')
        self.user_role_repo.assign_role(self.user, self.role)

    def test_user_has_permission_true(self):
        result = self.user_role_repo.user_has_permission(self.user.id, 'Customer:View')
        self.assertTrue(result)

    def test_user_has_permission_false(self):
        result = self.user_role_repo.user_has_permission(self.user.id, 'Customer:Delete')
        self.assertFalse(result)

    def test_superuser_bypasses_permission_check(self):
        superuser = _superuser('super@rbac.com')
        req = MagicMock()
        req.user = superuser
        checker = HasPermission('Customer:View')
        self.assertTrue(checker.has_permission(req, None))

    def test_unauthenticated_user_denied(self):
        checker = HasPermission('Customer:View')
        self.assertFalse(checker.has_permission(_anon_request(), None))

    def test_get_user_permissions_flattened(self):
        # Second role with a different permission
        role2 = self.role_repo.create('Creator', self.tenant)
        create_perm = self.perm_repo.get_by_key('Customer:Create')
        self.role_repo.add_permission(role2, create_perm)
        self.user_role_repo.assign_role(self.user, role2)

        perms = self.user_role_repo.get_permissions_for_user(self.user.id)
        keys = list(perms.values_list('key', flat=True))
        self.assertIn('Customer:View', keys)
        self.assertIn('Customer:Create', keys)


# ============================================================================
# Group 5 — RBAC API Endpoints
# ============================================================================

class RBACAPITests(TestCase):
    """End-to-end HTTP tests for the administration API."""

    def setUp(self):
        self.client = APIClient()
        self.tenant = _tenant('rbac-api', 'RBAC API Tenant')
        PermissionService().seed_default_permissions()

        # Superuser — bypasses HasPermission, has a tenant for queryset scoping
        self.admin = _superuser('admin@rbacapi.com', tenant=self.tenant)

        # Manager user — has Customer:View only, NOT Administration:RoleCreate
        self.manager = _user(self.tenant, 'manager@rbacapi.com')
        mgr_role = RoleRepository().create('ManagerRole', self.tenant)
        cv_perm = PermissionRepository().get_by_key('Customer:View')
        RoleRepository().add_permission(mgr_role, cv_perm)
        UserRoleRepository().assign_role(self.manager, mgr_role)

        # A pre-created role to use in retrieve / assign tests
        self.test_role = RoleRepository().create('TestRole', self.tenant)

    # ---- permissions list --------------------------------------------------

    def test_list_permissions_authenticated(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/administration/permissions/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 12)

    def test_list_permissions_unauthenticated(self):
        # SessionAuthentication only → returns 403 (no WWW-Authenticate header).
        # Both 401 and 403 mean "denied".
        resp = self.client.get('/api/administration/permissions/')
        self.assertIn(resp.status_code, [401, 403])

    # ---- role CRUD ---------------------------------------------------------

    def test_create_role_as_superuser(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            '/api/administration/roles/',
            {'name': 'VerifyRole', 'description': 'Created in verification'},
            format='json',
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['name'], 'VerifyRole')
        self.assertEqual(resp.data['tenant_id'], self.tenant.id)

    def test_list_roles(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/administration/roles/')
        self.assertEqual(resp.status_code, 200)
        names = [r['name'] for r in resp.data['results']]
        self.assertIn('TestRole', names)
        # manager's role is also in this tenant
        self.assertIn('ManagerRole', names)

    def test_retrieve_role_includes_permissions(self):
        perm = PermissionRepository().get_by_key('Customer:View')
        RoleRepository().add_permission(self.test_role, perm)
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f'/api/administration/roles/{self.test_role.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('permissions', resp.data)
        self.assertIsInstance(resp.data['permissions'], list)
        self.assertEqual(len(resp.data['permissions']), 1)
        self.assertEqual(resp.data['permissions'][0]['key'], 'Customer:View')

    def test_assign_permission_to_role_via_api(self):
        perm = PermissionRepository().get_by_key('Customer:Create')
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            f'/api/administration/roles/{self.test_role.id}/assign_permission/',
            {'permission_id': perm.id},
            format='json',
        )
        self.assertIn(resp.status_code, [200, 201])
        self.assertIn(perm, self.test_role.permissions.all())

    def test_create_role_without_permission_returns_403(self):
        # Manager has Customer:View only — no Administration:RoleCreate
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            '/api/administration/roles/',
            {'name': 'ShouldFail'},
            format='json',
        )
        self.assertEqual(resp.status_code, 403)

    # ---- user-role endpoints -----------------------------------------------

    def test_assign_role_to_user_via_api(self):
        self.client.force_authenticate(user=self.admin)
        target = _user(self.tenant, 'target@rbacapi.com')
        resp = self.client.post(
            '/api/administration/user-roles/assign/',
            {'user_id': target.id, 'role_id': self.test_role.id},
            format='json',
        )
        self.assertIn(resp.status_code, [200, 201])
        self.assertTrue(UserRole.objects.filter(user=target, role=self.test_role).exists())

    def test_get_user_roles_via_api(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f'/api/administration/user-roles/{self.manager.id}/roles/')
        self.assertEqual(resp.status_code, 200)
        names = [r['name'] for r in resp.data]
        self.assertIn('ManagerRole', names)

    def test_get_user_permissions_via_api(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f'/api/administration/user-roles/{self.manager.id}/permissions/')
        self.assertEqual(resp.status_code, 200)
        keys = [p['key'] for p in resp.data]
        self.assertIn('Customer:View', keys)


# ============================================================================
# Group 6 — Tenant Isolation
# ============================================================================

class TenantIsolationTests(TestCase):
    """Verifies that data from one tenant is never visible to another."""

    def setUp(self):
        self.client = APIClient()
        self.tenant_a = _tenant('iso-a', 'Isolation Tenant A')
        self.tenant_b = _tenant('iso-b', 'Isolation Tenant B')
        self.user_repo = UserRepository()
        self.role_repo = RoleRepository()

        self.user_a = _user(self.tenant_a, 'a@iso.com')
        self.user_b = _user(self.tenant_b, 'b@iso.com')
        self.role_a = self.role_repo.create('RoleA', self.tenant_a)
        self.role_b = self.role_repo.create('RoleB', self.tenant_b)

    def test_users_isolated_by_tenant(self):
        users_a = list(self.user_repo.get_all_for_tenant(self.tenant_a.id))
        self.assertIn(self.user_a, users_a)
        self.assertNotIn(self.user_b, users_a)

    def test_roles_isolated_by_tenant(self):
        roles_a = list(self.role_repo.get_all_for_tenant(self.tenant_a.id))
        self.assertIn(self.role_a, roles_a)
        self.assertNotIn(self.role_b, roles_a)

    def test_cannot_assign_role_from_different_tenant(self):
        # role_b belongs to tenant_b; assigning it in context of tenant_a must fail
        with self.assertRaises(ValueError):
            UserRoleService().assign_role_to_user(
                user_id=self.user_a.id,
                role_id=self.role_b.id,
                tenant_id=self.tenant_a.id,
            )

    def test_login_does_not_expose_other_tenant_data(self):
        # User A logs in; /me must show tenant_a only
        resp = self.client.post(
            '/api/auth/login/',
            {'email': 'a@iso.com', 'password': 'pass1234'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        resp_me = self.client.get('/api/auth/me/')
        self.assertEqual(resp_me.status_code, 200)
        self.assertEqual(resp_me.data['tenant_id'], self.tenant_a.id)
        self.assertNotEqual(resp_me.data['tenant_id'], self.tenant_b.id)
