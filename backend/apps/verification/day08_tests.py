"""
Day 8 Verification Suite
========================
Covers: AUTH_USER_MODEL rename (users→practitioners, practitioners→patients),
        user_type and specialisation fields, 13 healthcare permissions,
        4 healthcare roles with correct default permission allocations,
        and dynamic permission assignment/revocation via the API.

Run with:
    python manage.py test apps.verification.day08_tests --verbosity=2
"""
import importlib.util

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.tenancy.models import Tenant
from apps.practitioners.repositories import PractitionerRepository
from apps.patients.models import Patient
from apps.administration.models import Permission, Role, RolePermission
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

def _tenant(slug, name):
    return Tenant.objects.create(slug=slug, name=name)


def _user(tenant, email, password='pass1234', **extra_fields):
    return PractitionerRepository().create_practitioner(
        email=email,
        username=email.split('@')[0],
        password=password,
        tenant=tenant,
        **extra_fields,
    )


def _grant_permissions(tenant, role_name, permission_keys):
    role = RoleRepository().create(role_name, tenant)
    for key in permission_keys:
        perm = PermissionRepository().get_by_key(key)
        if perm:
            RoleRepository().add_permission(role, perm)
    return role


# ============================================================================
# Group 1 — Rename Verification
# ============================================================================

class RenameVerificationTests(TestCase):
    """Confirms AUTH_USER_MODEL, db_table names, and endpoint URLs are all
    updated to reflect the Day 8 rename."""

    def setUp(self):
        self.client = APIClient()
        self.tenant = _tenant('rename-verify', 'Rename Verify Tenant')
        PermissionService().seed_default_permissions()

    def test_auth_user_model_is_practitioner(self):
        self.assertEqual(settings.AUTH_USER_MODEL, 'practitioners.Practitioner')

    def test_practitioner_model_db_table(self):
        from apps.practitioners.models import Practitioner
        self.assertEqual(Practitioner._meta.db_table, 'practitioners_practitioner')

    def test_patient_model_db_table(self):
        self.assertEqual(Patient._meta.db_table, 'patients_patient')

    def test_old_authentication_app_does_not_exist(self):
        """apps/authentication/ was removed; find_spec returns None."""
        spec = importlib.util.find_spec('apps.authentication')
        self.assertIsNone(spec)

    def test_login_endpoint_works(self):
        """POST /api/practitioners/auth/login/ returns 200 for valid credentials."""
        _user(self.tenant, 'rename@verify.com', password='pass1234')
        resp = self.client.post(
            '/api/practitioners/auth/login/',
            {'email': 'rename@verify.com', 'password': 'pass1234'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)

    def test_patients_endpoint_requires_auth(self):
        """GET /api/patients/ returns 401/403 when unauthenticated."""
        resp = self.client.get('/api/patients/')
        self.assertIn(resp.status_code, [401, 403])


# ============================================================================
# Group 2 — user_type Field
# ============================================================================

class UserTypeFieldTests(TestCase):
    """Verifies the user_type and specialisation fields on the Practitioner model."""

    def setUp(self):
        self.client = APIClient()
        self.tenant = _tenant('user-type', 'User Type Tenant')
        PermissionService().seed_default_permissions()

    def test_user_type_default_is_none(self):
        """Creating a practitioner without user_type leaves it null."""
        user = _user(self.tenant, 'default@ut.com')
        self.assertIsNone(user.user_type)

    def test_tenant_admin_user_type(self):
        """user_type='tenant_admin' is stored and retrieved correctly."""
        user = _user(self.tenant, 'admin@ut.com', user_type='tenant_admin')
        user.refresh_from_db()
        self.assertEqual(user.user_type, 'tenant_admin')

    def test_staff_user_type(self):
        """user_type='staff' is stored and retrieved correctly."""
        user = _user(self.tenant, 'staff@ut.com', user_type='staff')
        user.refresh_from_db()
        self.assertEqual(user.user_type, 'staff')

    def test_specialisation_field_optional(self):
        """Creating a practitioner without specialisation does not raise."""
        user = _user(self.tenant, 'nospec@ut.com')
        self.assertIsNone(user.specialisation)

    def test_user_type_appears_in_api_response(self):
        """GET /api/practitioners/ returns user_type in each result row."""
        admin_user = _user(self.tenant, 'typeapi@ut.com', user_type='tenant_admin')
        role = _grant_permissions(self.tenant, 'UTAdmin', ['Administration:UserView'])
        UserRoleRepository().assign_role(admin_user, role)
        self.client.force_login(admin_user)
        resp = self.client.get('/api/practitioners/')
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get('results') or resp.data
        self.assertTrue(len(results) > 0)
        self.assertIn('user_type', results[0])


# ============================================================================
# Group 3 — Healthcare Permissions
# ============================================================================

class HealthcarePermissionsTests(TestCase):
    """Verifies the full 13-permission set and the 4 healthcare roles."""

    def setUp(self):
        self.tenant = _tenant('hc-perms', 'Healthcare Perms Tenant')
        PermissionService().seed_default_permissions()
        PermissionService().seed_default_roles(self.tenant)

    def test_13_permissions_exist(self):
        self.assertEqual(Permission.objects.count(), 13)

    def test_patient_view_own_permission_exists(self):
        perm = PermissionRepository().get_by_key('Patient:ViewOwn')
        self.assertIsNotNone(perm)

    def test_no_old_practitioner_permissions_exist(self):
        """Old Practitioner:* keys must not exist — replaced by Patient:*."""
        old_keys = ['Practitioner:View', 'Practitioner:Create',
                    'Practitioner:Update', 'Practitioner:Delete']
        for key in old_keys:
            self.assertFalse(
                Permission.objects.filter(key=key).exists(),
                msg=f'Old permission key {key!r} should not exist',
            )

    def test_4_healthcare_roles_seeded(self):
        names = set(Role.objects.filter(tenant=self.tenant).values_list('name', flat=True))
        self.assertEqual(names, {'Tenant Admin', 'Doctor', 'Nurse', 'Caretaker'})

    def test_tenant_admin_has_all_13_permissions(self):
        admin_role = Role.objects.get(name='Tenant Admin', tenant=self.tenant)
        self.assertEqual(admin_role.permissions.count(), 13)

    def test_doctor_role_has_no_default_permissions(self):
        doctor_role = Role.objects.get(name='Doctor', tenant=self.tenant)
        self.assertEqual(doctor_role.permissions.count(), 0)

    def test_nurse_role_has_no_default_permissions(self):
        nurse_role = Role.objects.get(name='Nurse', tenant=self.tenant)
        self.assertEqual(nurse_role.permissions.count(), 0)

    def test_caretaker_role_has_no_default_permissions(self):
        caretaker_role = Role.objects.get(name='Caretaker', tenant=self.tenant)
        self.assertEqual(caretaker_role.permissions.count(), 0)


# ============================================================================
# Group 4 — Dynamic Permission Allocation
# ============================================================================

class DynamicPermissionAllocationTests(TestCase):
    """Verifies that a Tenant Admin can assign and revoke permissions from
    staff roles (Doctor, Nurse, Caretaker) via the administration API."""

    def setUp(self):
        self.client = APIClient()
        PermissionService().seed_default_permissions()

        self.tenant = _tenant('dyn-perm', 'Dynamic Permission Tenant')

        # Seed all 4 healthcare roles (Tenant Admin gets all 13 perms)
        PermissionService().seed_default_roles(self.tenant)

        # Create a tenant admin user and assign the Tenant Admin role
        self.admin = _user(self.tenant, 'admin@dynperm.com', user_type='tenant_admin')
        admin_role = Role.objects.get(name='Tenant Admin', tenant=self.tenant)
        UserRoleRepository().assign_role(self.admin, admin_role)

        # Doctor role starts empty
        self.doctor_role = Role.objects.get(name='Doctor', tenant=self.tenant)
        self.patient_view_perm = PermissionRepository().get_by_key('Patient:View')

    def test_doctor_starts_with_no_permissions(self):
        self.assertEqual(self.doctor_role.permissions.count(), 0)

    def test_nurse_starts_with_no_permissions(self):
        nurse_role = Role.objects.get(name='Nurse', tenant=self.tenant)
        self.assertEqual(nurse_role.permissions.count(), 0)

    def test_caretaker_starts_with_no_permissions(self):
        caretaker_role = Role.objects.get(name='Caretaker', tenant=self.tenant)
        self.assertEqual(caretaker_role.permissions.count(), 0)

    def test_tenant_admin_can_assign_permission_to_doctor(self):
        """Tenant Admin assigns Patient:View to Doctor via the API."""
        self.client.force_login(self.admin)
        resp = self.client.post(
            f'/api/administration/roles/{self.doctor_role.id}/assign_permission/',
            {'permission_id': self.patient_view_perm.id},
            format='json',
        )
        self.assertIn(resp.status_code, [200, 201])
        self.doctor_role.refresh_from_db()
        self.assertIn(self.patient_view_perm, self.doctor_role.permissions.all())

    def test_tenant_admin_can_revoke_permission_from_doctor(self):
        """Tenant Admin can remove a previously-assigned permission from Doctor."""
        # First assign
        self.client.force_login(self.admin)
        self.client.post(
            f'/api/administration/roles/{self.doctor_role.id}/assign_permission/',
            {'permission_id': self.patient_view_perm.id},
            format='json',
        )
        self.doctor_role.refresh_from_db()
        self.assertIn(self.patient_view_perm, self.doctor_role.permissions.all())

        # Then revoke
        resp = self.client.delete(
            f'/api/administration/roles/{self.doctor_role.id}/remove_permission/',
            {'permission_id': self.patient_view_perm.id},
            format='json',
        )
        self.assertIn(resp.status_code, [200, 204])
        self.doctor_role.refresh_from_db()
        self.assertNotIn(self.patient_view_perm, self.doctor_role.permissions.all())
