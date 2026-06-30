"""
Day 4 Verification Suite
========================
Covers: TenantMiddleware integration (full login → API flow),
        TenantAwareManager isolation, cross-tenant 404 enforcement,
        superuser tenant guard, and end-to-end regression confirming
        that all Day 3 operations work via request.tenant.

Run with:
    python manage.py test apps.verification.day04_tests --verbosity=2
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.tenancy.models import Tenant
from apps.authentication.repositories import UserRepository
from apps.administration.models import Permission, Role, UserRole
from apps.administration.repositories import (
    PermissionRepository,
    RoleRepository,
    UserRoleRepository,
)
from apps.administration.services import PermissionService

User = get_user_model()

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _tenant(slug, name, active=True):
    return Tenant.objects.create(slug=slug, name=name, is_active=active)


def _user(tenant, email, password='pass1234'):
    return UserRepository().create_user(
        email=email,
        username=email.split('@')[0],
        password=password,
        tenant=tenant,
    )


def _grant_role_permissions(tenant, role_name, permission_keys):
    """Create a role with the given permissions; return the role."""
    role = RoleRepository().create(role_name, tenant)
    for key in permission_keys:
        RoleRepository().add_permission(role, PermissionRepository().get_by_key(key))
    return role


# ============================================================================
# Group 1 — Middleware Integration
# ============================================================================

class MiddlewareIntegrationTests(TestCase):
    """Verifies that TenantMiddleware correctly resolves request.tenant
    across the full login → authenticated API call cycle."""

    def setUp(self):
        self.client = APIClient()
        PermissionService().seed_default_permissions()

        self.tenant_a = _tenant('mw-a', 'Middleware A')
        self.tenant_b = _tenant('mw-b', 'Middleware B')

        # Regular user in tenant_a with RoleView so they can hit /roles/
        self.user = _user(self.tenant_a, 'user@mwtest.com')
        viewer_role = _grant_role_permissions(
            self.tenant_a, 'Viewer', ['Administration:RoleView']
        )
        UserRoleRepository().assign_role(self.user, viewer_role)

        # One role per tenant to prove scoping
        self.role_a = RoleRepository().create('TenantARole', self.tenant_a)
        self.role_b = RoleRepository().create('TenantBRole', self.tenant_b)

        # User whose tenant is inactive — should be blocked after auth
        self.inactive_tenant = _tenant('mw-inactive', 'Inactive Tenant', active=False)
        self.inactive_user = _user(self.inactive_tenant, 'inactive@mwtest.com')

    def test_real_login_roles_list_is_scoped_to_user_tenant(self):
        """Full cycle: POST /login/ creates a session; GET /roles/ then uses
        that session so TenantMiddleware sets request.tenant = tenant_a, and
        only tenant_a roles appear in the response."""
        resp = self.client.post(
            '/api/auth/login/',
            {'email': 'user@mwtest.com', 'password': 'pass1234'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)

        roles_resp = self.client.get('/api/administration/roles/')
        self.assertEqual(roles_resp.status_code, 200)
        names = [r['name'] for r in roles_resp.data['results']]
        self.assertIn('TenantARole', names)
        self.assertNotIn('TenantBRole', names)

    def test_force_login_roles_list_is_scoped_to_user_tenant(self):
        """force_login also traverses the full middleware stack; subsequent
        requests carry the session cookie, so TenantMiddleware correctly
        derives request.tenant from the authenticated user."""
        self.client.force_login(self.user)

        roles_resp = self.client.get('/api/administration/roles/')
        self.assertEqual(roles_resp.status_code, 200)
        names = [r['name'] for r in roles_resp.data['results']]
        self.assertIn('TenantARole', names)
        self.assertNotIn('TenantBRole', names)

    def test_inactive_tenant_blocked_by_middleware(self):
        """Middleware short-circuits with 403 when the user's tenant is
        inactive — the view is never reached."""
        self.client.force_login(self.inactive_user)

        resp = self.client.get('/api/administration/roles/')
        self.assertEqual(resp.status_code, 403)

    def test_anonymous_request_is_denied_before_reaching_view(self):
        """No session → middleware allows the request through (anonymous path)
        but DRF's IsAuthenticated rejects it with 401/403."""
        resp = self.client.get('/api/administration/roles/')
        self.assertIn(resp.status_code, [401, 403])

    def test_superuser_has_no_tenant_context_empty_roles_list(self):
        """Middleware sets request.tenant = None for superusers.
        The queryset therefore returns nothing — even when roles exist."""
        superuser = User.objects.create_superuser(
            email='super@mwtest.com', username='supermwtest', password='pass1234'
        )
        self.client.force_login(superuser)

        resp = self.client.get('/api/administration/roles/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 0)


# ============================================================================
# Group 2 — TenantAwareManager Isolation
# ============================================================================

class TenantAwareManagerTests(TestCase):
    """Verifies TenantAwareManager.for_tenant() and for_tenant_id()
    return correctly isolated querysets."""

    def setUp(self):
        self.tenant_a = _tenant('mgr-a', 'Manager A')
        self.tenant_b = _tenant('mgr-b', 'Manager B')
        self.role_a1 = RoleRepository().create('A-Admin', self.tenant_a)
        self.role_a2 = RoleRepository().create('A-Viewer', self.tenant_a)
        self.role_b1 = RoleRepository().create('B-Admin', self.tenant_b)

    def test_for_tenant_returns_own_tenant_records(self):
        qs = Role.objects.for_tenant(self.tenant_a)
        self.assertIn(self.role_a1, qs)
        self.assertIn(self.role_a2, qs)
        self.assertEqual(qs.count(), 2)

    def test_for_tenant_excludes_other_tenant_records(self):
        qs = Role.objects.for_tenant(self.tenant_a)
        self.assertNotIn(self.role_b1, qs)

    def test_for_tenant_none_returns_empty_queryset(self):
        qs = Role.objects.for_tenant(None)
        self.assertEqual(qs.count(), 0)

    def test_for_tenant_id_returns_own_tenant_records(self):
        qs = Role.objects.for_tenant_id(self.tenant_b.id)
        self.assertIn(self.role_b1, qs)
        self.assertEqual(qs.count(), 1)

    def test_for_tenant_id_excludes_other_tenant_records(self):
        qs = Role.objects.for_tenant_id(self.tenant_b.id)
        self.assertNotIn(self.role_a1, qs)
        self.assertNotIn(self.role_a2, qs)

    def test_for_tenant_id_none_returns_empty_queryset(self):
        qs = Role.objects.for_tenant_id(None)
        self.assertEqual(qs.count(), 0)


# ============================================================================
# Group 3 — Cross-Tenant 404 Enforcement
# ============================================================================

class CrossTenantAccessTests(TestCase):
    """Verifies that retrieve, update, and delete on a role owned by another
    tenant each return 404 — not 403 — so no information about the resource's
    existence is leaked to the caller."""

    def setUp(self):
        self.client = APIClient()
        PermissionService().seed_default_permissions()

        self.tenant_a = _tenant('cross-a', 'Cross A')
        self.tenant_b = _tenant('cross-b', 'Cross B')

        self.user_a = _user(self.tenant_a, 'user@crossa.com')
        admin_role = _grant_role_permissions(
            self.tenant_a,
            'AdminA',
            [
                'Administration:RoleView',
                'Administration:RoleCreate',
                'Administration:RoleUpdate',
                'Administration:RoleDelete',
            ],
        )
        UserRoleRepository().assign_role(self.user_a, admin_role)

        # This role belongs to tenant_b — user_a must never reach it
        self.role_b = RoleRepository().create('SecretRole', self.tenant_b)

        self.client.force_login(self.user_a)

    def test_retrieve_role_from_other_tenant_returns_404(self):
        resp = self.client.get(f'/api/administration/roles/{self.role_b.id}/')
        self.assertEqual(resp.status_code, 404)

    def test_update_role_from_other_tenant_returns_404(self):
        resp = self.client.patch(
            f'/api/administration/roles/{self.role_b.id}/',
            {'name': 'Hijacked'},
            format='json',
        )
        self.assertEqual(resp.status_code, 404)

    def test_delete_role_from_other_tenant_returns_404(self):
        resp = self.client.delete(f'/api/administration/roles/{self.role_b.id}/')
        self.assertEqual(resp.status_code, 404)


# ============================================================================
# Group 4 — Superuser Tenant Guard
# ============================================================================

class SuperuserTenantGuardTests(TestCase):
    """Verifies the guard in RoleViewSet.create that rejects superusers who
    have no tenant context (request.tenant is None)."""

    def setUp(self):
        self.client = APIClient()
        PermissionService().seed_default_permissions()
        # Superuser with no tenant FK — operates across tenants
        self.superuser = User.objects.create_superuser(
            email='super@guard.com', username='superguard', password='pass1234'
        )
        self.client.force_login(self.superuser)

    def test_create_role_without_tenant_returns_400(self):
        resp = self.client.post(
            '/api/administration/roles/',
            {'name': 'ShouldFail'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Superuser must specify a tenant', resp.data['detail'])

    def test_superuser_roles_list_is_empty_when_no_tenant(self):
        """Even with roles existing in various tenants, a superuser without
        tenant context sees an empty list (request.tenant is None)."""
        tenant = _tenant('guard-tenant', 'Guard Tenant')
        RoleRepository().create('SomeRole', tenant)

        resp = self.client.get('/api/administration/roles/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 0)


# ============================================================================
# Group 5 — End-to-End Regression
# ============================================================================

class EndToEndRegressionTests(TestCase):
    """Full regression confirming that all Day 3 operations — login, list
    roles, create role, assign permission, assign user-role — continue to
    work correctly now that views derive tenant context from request.tenant
    rather than request.user.tenant_id."""

    def setUp(self):
        self.client = APIClient()
        self.tenant = _tenant('e2e', 'E2E Tenant')
        PermissionService().seed_default_permissions()

        self.admin = _user(self.tenant, 'admin@e2e.com')
        admin_role = _grant_role_permissions(
            self.tenant,
            'E2EAdmin',
            [
                'Administration:RoleView',
                'Administration:RoleCreate',
                'Administration:RoleUpdate',
                'Administration:RoleDelete',
                'Administration:UserView',
                'Administration:UserUpdate',
            ],
        )
        UserRoleRepository().assign_role(self.admin, admin_role)

        self.other_user = _user(self.tenant, 'other@e2e.com')

    def _login(self):
        resp = self.client.post(
            '/api/auth/login/',
            {'email': 'admin@e2e.com', 'password': 'pass1234'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)

    def test_login_and_list_roles_via_request_tenant(self):
        """After real login the roles list is driven by request.tenant —
        own-tenant roles appear, nothing more."""
        self._login()

        resp = self.client.get('/api/administration/roles/')
        self.assertEqual(resp.status_code, 200)
        names = [r['name'] for r in resp.data['results']]
        self.assertIn('E2EAdmin', names)

    def test_create_role_tenant_comes_from_request_tenant(self):
        """POST /roles/ sets the new role's tenant from request.tenant,
        not from a request body field."""
        self._login()

        resp = self.client.post(
            '/api/administration/roles/',
            {'name': 'CreatedRole', 'description': 'via request.tenant'},
            format='json',
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['name'], 'CreatedRole')
        self.assertEqual(resp.data['tenant_id'], self.tenant.id)

    def test_assign_permission_to_role_and_retrieve(self):
        """Create a role via the API, assign a permission to it, then
        retrieve it and confirm the permission is present in the response."""
        self._login()

        create_resp = self.client.post(
            '/api/administration/roles/',
            {'name': 'WithPerm'},
            format='json',
        )
        self.assertEqual(create_resp.status_code, 201)
        role_id = create_resp.data['id']

        perm = PermissionRepository().get_by_key('Customer:View')
        assign_resp = self.client.post(
            f'/api/administration/roles/{role_id}/assign_permission/',
            {'permission_id': perm.id},
            format='json',
        )
        self.assertEqual(assign_resp.status_code, 200)

        retrieve_resp = self.client.get(f'/api/administration/roles/{role_id}/')
        self.assertEqual(retrieve_resp.status_code, 200)
        keys = [p['key'] for p in retrieve_resp.data['permissions']]
        self.assertIn('Customer:View', keys)

    def test_assign_user_role_validated_against_request_tenant(self):
        """POST /user-roles/assign/ uses request.tenant to ensure the role
        being assigned belongs to the caller's tenant."""
        self._login()

        create_resp = self.client.post(
            '/api/administration/roles/',
            {'name': 'AssigneeRole'},
            format='json',
        )
        self.assertEqual(create_resp.status_code, 201)
        role_id = create_resp.data['id']

        resp = self.client.post(
            '/api/administration/user-roles/assign/',
            {'user_id': self.other_user.id, 'role_id': role_id},
            format='json',
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(
            UserRole.objects.filter(user=self.other_user, role_id=role_id).exists()
        )
