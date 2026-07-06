from django.core.management.base import BaseCommand

from apps.administration.models import Permission, Role, UserRole
from apps.administration.services import PermissionService, UserRoleService
from apps.patients.repositories import PatientRepository
from apps.practitioners.services import AuthService
from apps.tenancy.models import Tenant
from apps.tenancy.services import TenantService

_perm_service = PermissionService()
_auth_service = AuthService()
_role_service = UserRoleService()
_patient_repo = PatientRepository()
_tenant_service = TenantService()


class Command(BaseCommand):
    help = 'Seed OrthoMed demo data: permissions, tenants, roles, practitioners, and patients.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Wipe all app data before seeding.',
        )

    def handle(self, *args, **options):
        if options['flush']:
            self._flush()

        self._seed_permissions()
        tenant1, tenant2 = self._seed_tenants()
        self._seed_roles(tenant1, tenant2)
        self._seed_superadmin()
        self._seed_practitioners(tenant1, tenant2)
        self._seed_patients(tenant1, tenant2)

        self._print_summary()

    # ------------------------------------------------------------------
    # Flush
    # ------------------------------------------------------------------

    def _flush(self):
        self.stdout.write('Flushing existing data...')
        from apps.patients.models import Patient
        UserRole.objects.all().delete()
        Patient.objects.all().delete()
        Role.objects.all().delete()
        Permission.objects.all().delete()
        from django.contrib.auth import get_user_model
        get_user_model().objects.all().delete()
        Tenant.objects.all().delete()
        self.stdout.write(self.style.WARNING('  All app data cleared.'))

    # ------------------------------------------------------------------
    # Permissions
    # ------------------------------------------------------------------

    def _seed_permissions(self):
        _perm_service.seed_default_permissions()

    # ------------------------------------------------------------------
    # Tenants
    # ------------------------------------------------------------------

    def _seed_tenants(self):
        tenant1, _ = Tenant.objects.get_or_create(
            slug='city-general',
            defaults={'name': 'City General Hospital'},
        )
        tenant2, _ = Tenant.objects.get_or_create(
            slug='metro-ortho',
            defaults={'name': 'Metro Orthopaedic Clinic'},
        )
        return tenant1, tenant2

    # ------------------------------------------------------------------
    # Roles
    # ------------------------------------------------------------------

    def _seed_roles(self, tenant1, tenant2):
        _perm_service.seed_default_roles(tenant1)
        _perm_service.seed_default_roles(tenant2)

    # ------------------------------------------------------------------
    # Superadmin
    # ------------------------------------------------------------------

    def _seed_superadmin(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if not User.objects.filter(email='superadmin@orthomed.com').exists():
            _auth_service.create_practitioner(
                email='superadmin@orthomed.com',
                username='superadmin',
                password='superadmin123',
                tenant=None,
                is_superuser=True,
                is_staff=True,
            )
        return User.objects.get(email='superadmin@orthomed.com')

    # ------------------------------------------------------------------
    # Tenant practitioners (login users)
    # ------------------------------------------------------------------

    def _seed_practitioners(self, tenant1, tenant2):
        specs = [
            # (email, username, password, tenant, user_type, specialisation, role_name)
            ('testadmin1@citygeneral.com', 'testadmin1', 'testadmin123', tenant1, 'tenant_admin', None,                  'Tenant Admin'),
            ('testuser1@citygeneral.com',  'testuser1',  'testuser123',  tenant1, 'staff',        'Orthopaedic Surgeon', 'Doctor'),
            ('testuser2@citygeneral.com',  'testuser2',  'testuser123',  tenant1, 'staff',        None,                  'Nurse'),
            ('testadmin2@metroortho.com',  'testadmin2', 'testadmin123', tenant2, 'tenant_admin', None,                  'Tenant Admin'),
            ('testuser3@metroortho.com',   'testuser3',  'testuser123',  tenant2, 'staff',        'Physiotherapist',     'Doctor'),
        ]
        for email, username, password, tenant, user_type, specialisation, role_name in specs:
            user = self._get_or_create_practitioner(
                email, username, password, tenant, user_type, specialisation
            )
            self._assign_role(user, role_name, tenant)

    def _get_or_create_practitioner(self, email, username, password, tenant,
                                    user_type=None, specialisation=None):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if not User.objects.filter(email=email).exists():
            return _auth_service.create_practitioner(
                email=email,
                username=username,
                password=password,
                tenant=tenant,
                user_type=user_type,
                specialisation=specialisation,
            )
        return User.objects.get(email=email)

    def _assign_role(self, user, role_name, tenant):
        try:
            role = Role.objects.get(name=role_name, tenant=tenant)
        except Role.DoesNotExist:
            return
        if not UserRole.objects.filter(user=user, role=role).exists():
            _role_service.assign_role_to_user(user.id, role.id, tenant.id)

    # ------------------------------------------------------------------
    # Patients (domain records)
    # ------------------------------------------------------------------

    def _seed_patients(self, tenant1, tenant2):
        from apps.patients.models import Patient
        patient_specs = [
            # Tenant 1 — City General Hospital
            {
                'tenant': tenant1,
                'first_name': 'Test', 'last_name': 'Patient1',
                'specialisation': 'Orthopaedic',
                'email': 'patient1@citygeneral.com',
                'phone': '+44 7700 900001',
                'city': 'London', 'country': 'UK',
                'is_active': True,
            },
            {
                'tenant': tenant1,
                'first_name': 'Test', 'last_name': 'Patient2',
                'specialisation': 'Physiotherapy',
                'email': 'patient2@citygeneral.com',
                'phone': '+44 7700 900002',
                'city': 'London', 'country': 'UK',
                'is_active': True,
            },
            {
                'tenant': tenant1,
                'first_name': 'Test', 'last_name': 'Patient3',
                'specialisation': 'Sports Medicine',
                'email': 'patient3@citygeneral.com',
                'phone': '+44 7700 900003',
                'city': 'Manchester', 'country': 'UK',
                'is_active': True,
            },
            {
                'tenant': tenant1,
                'first_name': 'Test', 'last_name': 'Patient4',
                'specialisation': 'Orthopaedic',
                'email': 'patient4@citygeneral.com',
                'phone': '+44 7700 900004',
                'city': 'London', 'country': 'UK',
                'is_active': False,
            },
            # Tenant 2 — Metro Orthopaedic Clinic
            {
                'tenant': tenant2,
                'first_name': 'Test', 'last_name': 'Patient5',
                'specialisation': 'Physiotherapy',
                'email': 'patient5@metroortho.com',
                'phone': '+44 7700 900005',
                'city': 'Manchester', 'country': 'UK',
                'is_active': True,
            },
            {
                'tenant': tenant2,
                'first_name': 'Test', 'last_name': 'Patient6',
                'specialisation': 'Orthopaedic',
                'email': 'patient6@metroortho.com',
                'phone': '+44 7700 900006',
                'city': 'Birmingham', 'country': 'UK',
                'is_active': True,
            },
        ]

        for spec in patient_specs:
            tenant = spec.pop('tenant')
            email = spec['email']
            if not Patient.objects.filter(email=email).exists():
                _patient_repo.create(tenant=tenant, **spec)
            spec['tenant'] = tenant

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def _print_summary(self):
        from django.contrib.auth import get_user_model
        from apps.patients.models import Patient

        User = get_user_model()
        perm_count = Permission.objects.count()
        tenant_count = Tenant.objects.count()
        superuser_count = User.objects.filter(is_superuser=True).count()
        regular_user_count = User.objects.filter(is_superuser=False).count()
        role_count = Role.objects.count()
        patient_count = Patient.objects.count()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== OrthoMed Demo Data Seeded ==='))
        self.stdout.write(f'Permissions:  {perm_count:>4}')
        self.stdout.write(f'Tenants:      {tenant_count:>4}')
        self.stdout.write(f'Practitioners:{regular_user_count:>4} (+ {superuser_count} superadmin)')
        self.stdout.write(f'Roles:        {role_count:>4} (4 per tenant)')
        self.stdout.write(f'Patients:     {patient_count:>4}')
        self.stdout.write('')
        self.stdout.write('Login credentials:')
        self.stdout.write('  superadmin@orthomed.com        / superadmin123  (superadmin)')
        self.stdout.write('  testadmin1@citygeneral.com     / testadmin123   (Tenant Admin)')
        self.stdout.write('  testuser1@citygeneral.com      / testuser123    (Doctor — Orthopaedic Surgeon)')
        self.stdout.write('  testuser2@citygeneral.com      / testuser123    (Nurse)')
        self.stdout.write('  testadmin2@metroortho.com      / testadmin123   (Tenant Admin)')
        self.stdout.write('  testuser3@metroortho.com       / testuser123    (Doctor — Physiotherapist)')
