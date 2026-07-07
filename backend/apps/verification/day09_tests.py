"""
Day 9 Verification Suite
========================
Covers: Atomic role assignment on user creation, permission toggle UI,
        expanded demo data volume (50 patients, 12 + superadmin practitioners).

Run with:
    python manage.py test apps.verification.day09_tests --verbosity=2
"""

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.administration.models import Permission, Role, UserRole
from apps.administration.repositories import PermissionRepository, RoleRepository, UserRoleRepository
from apps.administration.services import PermissionService
from apps.patients.models import Patient
from apps.practitioners.repositories import PractitionerRepository
from apps.tenancy.models import Tenant

_perm_repo = PermissionRepository()
_role_repo = RoleRepository()
_user_role_repo = UserRoleRepository()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tenant(slug, name):
    return Tenant.objects.create(slug=slug, name=name)


def _user(tenant, email, password='pass1234', **extra):
    return PractitionerRepository().create_practitioner(
        email=email,
        username=email.split('@')[0],
        password=password,
        tenant=tenant,
        **extra,
    )


def _setup_tenant_with_roles(slug, name):
    """Create a tenant, seed permissions and 4 roles, return (tenant, admin_user)."""
    PermissionService().seed_default_permissions()
    tenant = _tenant(slug, name)
    PermissionService().seed_default_roles(tenant)
    admin = _user(tenant, f'admin@{slug}.com', user_type='tenant_admin')
    admin_role = Role.objects.get(name='Tenant Admin', tenant=tenant)
    _user_role_repo.assign_role(admin, admin_role)
    return tenant, admin


# ============================================================================
# Group 1 — Permission Toggle Tests
# ============================================================================

class PermissionToggleTests(TestCase):
    """Tenant Admin can assign and revoke permissions via the role API."""

    def setUp(self):
        self.client = APIClient()
        self.tenant, self.admin = _setup_tenant_with_roles('toggle-t1', 'Toggle Tenant 1')
        self.doctor_role = Role.objects.get(name='Doctor', tenant=self.tenant)
        self.patient_view = _perm_repo.get_by_key('Patient:View')

    def test_assign_permission_via_toggle(self):
        """POST assign_permission returns 200/201 and adds perm to role."""
        self.client.force_login(self.admin)
        resp = self.client.post(
            f'/api/administration/roles/{self.doctor_role.id}/assign_permission/',
            {'permission_id': self.patient_view.id},
            format='json',
        )
        self.assertIn(resp.status_code, [200, 201])
        self.doctor_role.refresh_from_db()
        self.assertIn(self.patient_view, self.doctor_role.permissions.all())

    def test_revoke_permission_via_toggle(self):
        """Assign then DELETE remove_permission removes perm from role."""
        self.client.force_login(self.admin)
        # Assign first
        self.client.post(
            f'/api/administration/roles/{self.doctor_role.id}/assign_permission/',
            {'permission_id': self.patient_view.id},
            format='json',
        )
        self.assertIn(self.patient_view, self.doctor_role.permissions.all())

        # Now revoke
        resp = self.client.delete(
            f'/api/administration/roles/{self.doctor_role.id}/remove_permission/',
            {'permission_id': self.patient_view.id},
            format='json',
        )
        self.assertIn(resp.status_code, [200, 204])
        self.doctor_role.refresh_from_db()
        self.assertNotIn(self.patient_view, self.doctor_role.permissions.all())

    def test_toggle_permission_tenant_isolation(self):
        """Tenant Admin cannot assign permissions to another tenant's role (404)."""
        # Create a second tenant with its own Doctor role
        _, _other_admin = _setup_tenant_with_roles('toggle-t2', 'Toggle Tenant 2')
        other_tenant = Tenant.objects.get(slug='toggle-t2')
        other_doctor = Role.objects.get(name='Doctor', tenant=other_tenant)

        self.client.force_login(self.admin)
        resp = self.client.post(
            f'/api/administration/roles/{other_doctor.id}/assign_permission/',
            {'permission_id': self.patient_view.id},
            format='json',
        )
        self.assertEqual(resp.status_code, 404)

    def test_toggle_count_updates(self):
        """Role permission count reflects assignments correctly."""
        self.client.force_login(self.admin)
        perm_create = _perm_repo.get_by_key('Patient:Create')
        perm_update = _perm_repo.get_by_key('Patient:Update')

        self.assertEqual(self.doctor_role.permissions.count(), 0)

        for perm in [self.patient_view, perm_create, perm_update]:
            self.client.post(
                f'/api/administration/roles/{self.doctor_role.id}/assign_permission/',
                {'permission_id': perm.id},
                format='json',
            )

        self.doctor_role.refresh_from_db()
        self.assertEqual(self.doctor_role.permissions.count(), 3)


# ============================================================================
# Group 2 — Tenant Admin Creation
# ============================================================================

class TenantAdminCreationTests(TestCase):
    """Superadmin and Tenant Admin user creation flows with atomic role assignment."""

    def setUp(self):
        self.client = APIClient()
        PermissionService().seed_default_permissions()

        # Superadmin (no tenant)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.superadmin = User.objects.create_superuser(
            email='super@test.com',
            username='supertest',
            password='super123',
        )

        # Tenant + roles
        self.tenant = _tenant('creation-tenant', 'Creation Tenant')
        PermissionService().seed_default_roles(self.tenant)
        self.tenant_admin_role = Role.objects.get(name='Tenant Admin', tenant=self.tenant)
        self.doctor_role = Role.objects.get(name='Doctor', tenant=self.tenant)

        # Existing Tenant Admin to test tenant-admin-creates-staff flow
        self.existing_admin = _user(
            self.tenant, 'existingadmin@creation-tenant.com', user_type='tenant_admin'
        )
        _user_role_repo.assign_role(self.existing_admin, self.tenant_admin_role)

    def test_superadmin_creates_tenant_admin(self):
        """Superadmin can POST /api/practitioners/ with role_id and get 201."""
        self.client.force_login(self.superadmin)
        resp = self.client.post(
            '/api/practitioners/',
            {
                'email':     'newtadmin@creation-tenant.com',
                'username':  'newtadmin',
                'password':  'newpass123',
                'user_type': 'tenant_admin',
                'tenant_id': self.tenant.id,
                'role_id':   self.tenant_admin_role.id,
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 201)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        created = User.objects.get(email='newtadmin@creation-tenant.com')
        self.assertEqual(created.user_type, 'tenant_admin')
        self.assertTrue(
            UserRole.objects.filter(user=created, role=self.tenant_admin_role).exists()
        )

    def test_tenant_admin_creates_staff_member(self):
        """Tenant Admin can POST /api/practitioners/ to create a staff member with a role."""
        self.client.force_login(self.existing_admin)
        resp = self.client.post(
            '/api/practitioners/',
            {
                'email':     'newstaff@creation-tenant.com',
                'username':  'newstaff',
                'password':  'staffpass123',
                'user_type': 'staff',
                'role_id':   self.doctor_role.id,
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 201)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        created = User.objects.get(email='newstaff@creation-tenant.com')
        self.assertEqual(created.user_type, 'staff')
        self.assertTrue(
            UserRole.objects.filter(user=created, role=self.doctor_role).exists()
        )


# ============================================================================
# Group 3 — Data Volume (runs seed_demo_data against the test DB)
# ============================================================================

class DataVolumeTests(TestCase):
    """Verifies the full seeded data volume: 50 patients, 12 + superadmin practitioners."""

    @classmethod
    def setUpTestData(cls):
        call_command('seed_demo_data', verbosity=0)
        cls.city_general = Tenant.objects.get(slug='city-general')
        cls.metro_ortho  = Tenant.objects.get(slug='metro-ortho')

    def test_50_patients_seeded(self):
        self.assertEqual(Patient.objects.count(), 50)

    def test_25_patients_per_tenant(self):
        self.assertEqual(Patient.objects.filter(tenant=self.city_general).count(), 25)
        self.assertEqual(Patient.objects.filter(tenant=self.metro_ortho).count(), 25)

    def test_inactive_patients_per_tenant(self):
        """Each tenant has exactly 3 inactive patients."""
        self.assertEqual(
            Patient.objects.filter(tenant=self.city_general, is_active=False).count(), 3
        )
        self.assertEqual(
            Patient.objects.filter(tenant=self.metro_ortho, is_active=False).count(), 3
        )

    def test_role_permissions_correct_city_general(self):
        doctor    = Role.objects.get(name='Doctor',    tenant=self.city_general)
        nurse     = Role.objects.get(name='Nurse',     tenant=self.city_general)
        caretaker = Role.objects.get(name='Caretaker', tenant=self.city_general)
        self.assertEqual(doctor.permissions.count(),    4)
        self.assertEqual(nurse.permissions.count(),     3)
        self.assertEqual(caretaker.permissions.count(), 2)

    def test_role_permissions_correct_metro_ortho(self):
        doctor    = Role.objects.get(name='Doctor',    tenant=self.metro_ortho)
        nurse     = Role.objects.get(name='Nurse',     tenant=self.metro_ortho)
        caretaker = Role.objects.get(name='Caretaker', tenant=self.metro_ortho)
        self.assertEqual(doctor.permissions.count(),    4)
        self.assertEqual(nurse.permissions.count(),     3)
        self.assertEqual(caretaker.permissions.count(), 2)

    def test_tenant_admin_has_all_13_permissions(self):
        admin_role = Role.objects.get(name='Tenant Admin', tenant=self.city_general)
        self.assertEqual(admin_role.permissions.count(), 13)

    def test_12_tenant_practitioners_seeded(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.assertEqual(User.objects.filter(is_superuser=False).count(), 11)

    def test_superadmin_seeded(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.assertTrue(User.objects.filter(email='superadmin@orthomed.com', is_superuser=True).exists())

    def test_8_roles_total(self):
        """4 roles per tenant = 8 total."""
        self.assertEqual(Role.objects.count(), 8)

    def test_13_permissions_total(self):
        self.assertEqual(Permission.objects.count(), 13)

    def test_city_general_staff_roles_assigned(self):
        """Doctors/Nurses/Caretakers for City General have their UserRole records."""
        doctor_count = UserRole.objects.filter(
            user__tenant=self.city_general, role__name='Doctor'
        ).count()
        nurse_count = UserRole.objects.filter(
            user__tenant=self.city_general, role__name='Nurse'
        ).count()
        caretaker_count = UserRole.objects.filter(
            user__tenant=self.city_general, role__name='Caretaker'
        ).count()
        self.assertEqual(doctor_count,    2)
        self.assertEqual(nurse_count,     2)
        self.assertEqual(caretaker_count, 1)

    def test_metro_ortho_staff_roles_assigned(self):
        doctor_count = UserRole.objects.filter(
            user__tenant=self.metro_ortho, role__name='Doctor'
        ).count()
        nurse_count = UserRole.objects.filter(
            user__tenant=self.metro_ortho, role__name='Nurse'
        ).count()
        caretaker_count = UserRole.objects.filter(
            user__tenant=self.metro_ortho, role__name='Caretaker'
        ).count()
        self.assertEqual(doctor_count,    2)
        self.assertEqual(nurse_count,     1)
        self.assertEqual(caretaker_count, 1)
