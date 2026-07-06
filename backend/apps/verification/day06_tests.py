"""
Day 6 Verification Suite
========================
Covers: Superuser elevation (staff, dashboard, create), Patient CRUD,
        Patient tenant isolation, Patient permission checks,
        and full regression of Day 2–4 verification suites.

Note on roles elevation (updated Day 8):
  Since Day 8, GET /api/administration/roles/ returns ALL roles for a superuser
  (get_roles() passes is_superuser=True).  The service-layer test below uses
  get_all_roles() for explicit cross-tenant role access.

  Staff (login-users / Practitioners) are managed via /api/practitioners/.
  Domain records (Patients) are managed via /api/patients/.

Run with:
    python manage.py test apps.verification.day06_tests --verbosity=2
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.tenancy.models import Tenant
from apps.practitioners.repositories import PractitionerRepository
from apps.administration.repositories import (
    PermissionRepository,
    RoleRepository,
    UserRoleRepository,
)
from apps.administration.services import PermissionService, RoleService
from apps.patients.models import Patient

User = get_user_model()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _tenant(slug, name):
    return Tenant.objects.create(slug=slug, name=name)


def _user(tenant, email, password='pass1234'):
    return PractitionerRepository().create_practitioner(
        email=email,
        username=email.split('@')[0],
        password=password,
        tenant=tenant,
    )


def _superuser(email='super@d6test.com', password='pass1234'):
    return User.objects.create_superuser(
        email=email,
        username=email.split('@')[0],
        password=password,
    )


def _grant_permissions(tenant, role_name, permission_keys):
    """Create a role with the given permissions and assign it; return role."""
    role = RoleRepository().create(role_name, tenant)
    for key in permission_keys:
        perm = PermissionRepository().get_by_key(key)
        if perm:
            RoleRepository().add_permission(role, perm)
    return role


# ============================================================================
# Group 1 — Superuser Elevation
# ============================================================================

class SuperuserElevationTests(TestCase):
    """Verifies that is_superuser=True grants cross-tenant visibility on staff
    and the dashboard, and that regular users remain strictly isolated."""

    def setUp(self):
        self.client = APIClient()
        PermissionService().seed_default_permissions()

        self.tenant1 = _tenant('elev-t1', 'Elevation Tenant 1')
        self.tenant2 = _tenant('elev-t2', 'Elevation Tenant 2')

        self.user1 = _user(self.tenant1, 'testuser1@tenant1.com')
        self.user2 = _user(self.tenant2, 'testuser2@tenant2.com')

        # user1 needs UserView to reach /api/practitioners/ without 403
        viewer_role = _grant_permissions(
            self.tenant1, 'ElevUserViewer', ['Administration:UserView']
        )
        UserRoleRepository().assign_role(self.user1, viewer_role)

        self.superuser = _superuser('superadmin@orthomed.com')

        # Two roles in separate tenants — used by the service-layer test
        self.role1 = RoleRepository().create('ElevRole1', self.tenant1)
        self.role2 = RoleRepository().create('ElevRole2', self.tenant2)

    # ---- staff endpoint --------------------------------------------------------

    def test_superuser_sees_users_from_all_tenants(self):
        self.client.force_login(self.superuser)
        resp = self.client.get('/api/practitioners/')
        self.assertEqual(resp.status_code, 200)
        emails = [u['email'] for u in (resp.data.get('results') or resp.data)]
        self.assertIn('testuser1@tenant1.com', emails)
        self.assertIn('testuser2@tenant2.com', emails)

    def test_regular_user_cannot_see_other_tenant_users(self):
        self.client.force_login(self.user1)
        resp = self.client.get('/api/practitioners/')
        self.assertEqual(resp.status_code, 200)
        emails = [u['email'] for u in (resp.data.get('results') or resp.data)]
        self.assertNotIn('testuser2@tenant2.com', emails)

    # ---- roles (service-layer) -------------------------------------------------

    def test_superuser_sees_roles_from_all_tenants(self):
        """RoleService.get_all_roles() returns every role across all tenants."""
        roles = RoleService().get_all_roles()
        names = list(roles.values_list('name', flat=True))
        self.assertIn('ElevRole1', names)
        self.assertIn('ElevRole2', names)

    # ---- create staff ----------------------------------------------------------

    def test_superuser_creates_user_with_tenant_id(self):
        self.client.force_login(self.superuser)
        resp = self.client.post('/api/practitioners/', {
            'email': 'newuser@tenant1.com',
            'username': 'newusert1',
            'password': 'pass1234',
            'tenant_id': self.tenant1.id,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['tenant_id'], self.tenant1.id)

    def test_superuser_creates_user_without_tenant_id(self):
        self.client.force_login(self.superuser)
        resp = self.client.post('/api/practitioners/', {
            'email': 'notenant@example.com',
            'username': 'notenant',
            'password': 'pass1234',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    # ---- dashboard stats -------------------------------------------------------

    def test_dashboard_stats_superuser(self):
        """Superuser stats include all tenants → total_tenants > 1."""
        self.client.force_login(self.superuser)
        resp = self.client.get('/api/practitioners/auth/dashboard-stats/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('total_tenants', resp.data)
        self.assertGreater(resp.data['total_tenants'], 1)

    def test_dashboard_stats_regular_user(self):
        """Regular user stats are scoped to their tenant → total_tenants == 1."""
        self.client.force_login(self.user1)
        resp = self.client.get('/api/practitioners/auth/dashboard-stats/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total_tenants'], 1)


# ============================================================================
# Group 2 — Patient CRUD
# ============================================================================

class PatientCRUDTests(TestCase):
    """End-to-end HTTP tests for Patient create / list / retrieve /
    update / deactivate using a tenant user with full Patient:* permissions."""

    def setUp(self):
        self.client = APIClient()
        PermissionService().seed_default_permissions()

        self.tenant = _tenant('pat-crud', 'Patient CRUD Tenant')
        self.user = _user(self.tenant, 'testuser1@tenant1.com')

        pat_role = _grant_permissions(self.tenant, 'PatAdmin', [
            'Patient:View',
            'Patient:Create',
            'Patient:Update',
            'Patient:Delete',
        ])
        UserRoleRepository().assign_role(self.user, pat_role)
        self.client.force_login(self.user)

    def test_create_patient(self):
        resp = self.client.post('/api/patients/', {
            'first_name': 'Jane',
            'last_name': 'Smith',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['first_name'], 'Jane')
        self.assertEqual(resp.data['last_name'], 'Smith')
        self.assertEqual(resp.data['tenant_id'], self.tenant.id)

    def test_list_patients(self):
        Patient.objects.create(
            tenant=self.tenant, first_name='Alice', last_name='Jones'
        )
        resp = self.client.get('/api/patients/')
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get('results') or resp.data
        self.assertGreaterEqual(len(results), 1)

    def test_retrieve_patient(self):
        pat = Patient.objects.create(
            tenant=self.tenant, first_name='Bob', last_name='Brown'
        )
        resp = self.client.get(f'/api/patients/{pat.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['id'], pat.id)
        self.assertEqual(resp.data['first_name'], 'Bob')

    def test_update_patient(self):
        pat = Patient.objects.create(
            tenant=self.tenant, first_name='Carol', last_name='White'
        )
        resp = self.client.put(f'/api/patients/{pat.id}/', {
            'first_name': 'Carol',
            'last_name': 'Black',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['last_name'], 'Black')

    def test_deactivate_patient_returns_200(self):
        pat = Patient.objects.create(
            tenant=self.tenant, first_name='Dave', last_name='Green'
        )
        resp = self.client.delete(f'/api/patients/{pat.id}/')
        self.assertEqual(resp.status_code, 200)

    def test_deactivated_patient_is_inactive(self):
        pat = Patient.objects.create(
            tenant=self.tenant, first_name='Eve', last_name='Blue'
        )
        self.client.delete(f'/api/patients/{pat.id}/')
        pat.refresh_from_db()
        self.assertFalse(pat.is_active)


# ============================================================================
# Group 3 — Patient Tenant Isolation
# ============================================================================

class PatientTenantIsolationTests(TestCase):
    """Verifies that patients are strictly isolated by tenant and that
    superusers can see all patients across tenants."""

    def setUp(self):
        self.client = APIClient()
        PermissionService().seed_default_permissions()

        self.tenant1 = _tenant('iso-pat-1', 'Isolation Pat 1')
        self.tenant2 = _tenant('iso-pat-2', 'Isolation Pat 2')

        self.user1 = _user(self.tenant1, 'user1@iso.com')
        role1 = _grant_permissions(
            self.tenant1, 'PatViewer1',
            ['Patient:View', 'Patient:Create'],
        )
        UserRoleRepository().assign_role(self.user1, role1)

        self.user2 = _user(self.tenant2, 'user2@iso.com')
        role2 = _grant_permissions(self.tenant2, 'PatViewer2', ['Patient:View'])
        UserRoleRepository().assign_role(self.user2, role2)

        self.pat1 = Patient.objects.create(
            tenant=self.tenant1, first_name='Tenant1', last_name='Pat'
        )
        self.pat2 = Patient.objects.create(
            tenant=self.tenant2, first_name='Tenant2', last_name='Pat'
        )
        self.superuser = _superuser('super@iso.com')

    def test_tenant1_patients_not_visible_to_tenant2(self):
        self.client.force_login(self.user2)
        resp = self.client.get('/api/patients/')
        self.assertEqual(resp.status_code, 200)
        ids = [p['id'] for p in (resp.data.get('results') or resp.data)]
        self.assertNotIn(self.pat1.id, ids)

    def test_tenant2_patients_not_visible_to_tenant1(self):
        self.client.force_login(self.user1)
        resp = self.client.get('/api/patients/')
        self.assertEqual(resp.status_code, 200)
        ids = [p['id'] for p in (resp.data.get('results') or resp.data)]
        self.assertNotIn(self.pat2.id, ids)

    def test_superuser_sees_all_patients(self):
        self.client.force_login(self.superuser)
        resp = self.client.get('/api/patients/')
        self.assertEqual(resp.status_code, 200)
        ids = [p['id'] for p in (resp.data.get('results') or resp.data)]
        self.assertIn(self.pat1.id, ids)
        self.assertIn(self.pat2.id, ids)

    def test_retrieve_wrong_tenant_patient_returns_404(self):
        """user1 (tenant1) tries to retrieve a patient owned by tenant2."""
        self.client.force_login(self.user1)
        resp = self.client.get(f'/api/patients/{self.pat2.id}/')
        self.assertEqual(resp.status_code, 404)

    def test_create_patient_as_superuser_with_tenant_id(self):
        self.client.force_login(self.superuser)
        resp = self.client.post('/api/patients/', {
            'first_name': 'Super',
            'last_name': 'Created',
            'tenant_id': self.tenant1.id,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['tenant_id'], self.tenant1.id)

    def test_create_patient_as_superuser_without_tenant_id_returns_400(self):
        self.client.force_login(self.superuser)
        resp = self.client.post('/api/patients/', {
            'first_name': 'Super',
            'last_name': 'NoTenant',
        }, format='json')
        self.assertEqual(resp.status_code, 400)


# ============================================================================
# Group 4 — Permission Checks
# ============================================================================

class PatientPermissionTests(TestCase):
    """Verifies that each Patient:* permission key gates the correct
    endpoint — a user with no permissions receives 403 on every action."""

    def setUp(self):
        self.client = APIClient()
        PermissionService().seed_default_permissions()

        self.tenant = _tenant('perm-pat', 'Permission Pat Tenant')
        # user with NO role / NO permissions
        self.user_none = _user(self.tenant, 'none@perm.com')
        # pre-existing patient for update / delete tests
        self.pat = Patient.objects.create(
            tenant=self.tenant, first_name='Test', last_name='Pat'
        )

    def test_list_patients_without_permission_returns_403(self):
        self.client.force_login(self.user_none)
        resp = self.client.get('/api/patients/')
        self.assertEqual(resp.status_code, 403)

    def test_create_patient_without_permission_returns_403(self):
        self.client.force_login(self.user_none)
        resp = self.client.post('/api/patients/', {
            'first_name': 'Should',
            'last_name': 'Fail',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_update_patient_without_permission_returns_403(self):
        self.client.force_login(self.user_none)
        resp = self.client.put(f'/api/patients/{self.pat.id}/', {
            'first_name': 'Should',
            'last_name': 'Fail',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_delete_patient_without_permission_returns_403(self):
        self.client.force_login(self.user_none)
        resp = self.client.delete(f'/api/patients/{self.pat.id}/')
        self.assertEqual(resp.status_code, 403)
