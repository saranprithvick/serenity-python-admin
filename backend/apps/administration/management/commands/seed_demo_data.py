from django.core.management.base import BaseCommand

from apps.administration.models import Permission, Role, UserRole
from apps.administration.services import PermissionService, UserRoleService
from apps.authentication.services import AuthService
from apps.practitioners.repositories import PractitionerRepository
from apps.tenancy.models import Tenant
from apps.tenancy.services import TenantService

_perm_service = PermissionService()
_auth_service = AuthService()
_role_service = UserRoleService()
_practitioner_repo = PractitionerRepository()
_tenant_service = TenantService()


class Command(BaseCommand):
    help = 'Seed OrthoMed demo data: permissions, tenants, roles, users, and practitioners.'

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
        superadmin = self._seed_superadmin()
        users = self._seed_users(tenant1, tenant2)
        self._seed_practitioners(tenant1, tenant2)

        self._print_summary()

    # ------------------------------------------------------------------
    # Flush
    # ------------------------------------------------------------------

    def _flush(self):
        self.stdout.write('Flushing existing data...')
        from apps.practitioners.models import Practitioner
        UserRole.objects.all().delete()
        Practitioner.objects.all().delete()
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
            user = _auth_service.create_user(
                email='superadmin@orthomed.com',
                username='superadmin',
                password='superadmin123',
                tenant=None,
                is_superuser=True,
                is_staff=True,
            )
        else:
            user = User.objects.get(email='superadmin@orthomed.com')
        return user

    # ------------------------------------------------------------------
    # Tenant users
    # ------------------------------------------------------------------

    def _seed_users(self, tenant1, tenant2):
        specs = [
            # (email, username, password, tenant, role_name)
            ('testadmin1@citygeneral.com', 'testadmin1', 'testadmin123', tenant1, 'Tenant Admin'),
            ('testuser1@citygeneral.com',  'testuser1',  'testuser123',  tenant1, 'Staff'),
            ('testuser2@citygeneral.com',  'testuser2',  'testuser123',  tenant1, 'Staff'),
            ('testadmin2@metroortho.com',  'testadmin2', 'testadmin123', tenant2, 'Tenant Admin'),
            ('testuser3@metroortho.com',   'testuser3',  'testuser123',  tenant2, 'Staff'),
        ]
        created = []
        for email, username, password, tenant, role_name in specs:
            user = self._get_or_create_user(email, username, password, tenant)
            self._assign_role(user, role_name, tenant)
            created.append(user)
        return created

    def _get_or_create_user(self, email, username, password, tenant):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if not User.objects.filter(email=email).exists():
            return _auth_service.create_user(
                email=email,
                username=username,
                password=password,
                tenant=tenant,
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
    # Practitioners
    # ------------------------------------------------------------------

    def _seed_practitioners(self, tenant1, tenant2):
        practitioner_specs = [
            # Tenant 1 — City General Hospital
            {
                'tenant': tenant1,
                'first_name': 'Test', 'last_name': 'Practitioner1',
                'specialisation': 'Orthopaedic Surgeon',
                'email': 'practitioner1@citygeneral.com',
                'phone': '+44 7700 900001',
                'city': 'London', 'country': 'UK',
                'is_active': True,
            },
            {
                'tenant': tenant1,
                'first_name': 'Test', 'last_name': 'Practitioner2',
                'specialisation': 'Physiotherapist',
                'email': 'practitioner2@citygeneral.com',
                'phone': '+44 7700 900002',
                'city': 'London', 'country': 'UK',
                'is_active': True,
            },
            {
                'tenant': tenant1,
                'first_name': 'Test', 'last_name': 'Practitioner3',
                'specialisation': 'Sports Medicine Specialist',
                'email': 'practitioner3@citygeneral.com',
                'phone': '+44 7700 900003',
                'city': 'Manchester', 'country': 'UK',
                'is_active': True,
            },
            {
                'tenant': tenant1,
                'first_name': 'Test', 'last_name': 'Practitioner4',
                'specialisation': 'Orthopaedic Surgeon',
                'email': 'practitioner4@citygeneral.com',
                'phone': '+44 7700 900004',
                'city': 'London', 'country': 'UK',
                'is_active': False,
            },
            # Tenant 2 — Metro Orthopaedic Clinic
            {
                'tenant': tenant2,
                'first_name': 'Test', 'last_name': 'Practitioner5',
                'specialisation': 'Physiotherapist',
                'email': 'practitioner5@metroortho.com',
                'phone': '+44 7700 900005',
                'city': 'Manchester', 'country': 'UK',
                'is_active': True,
            },
            {
                'tenant': tenant2,
                'first_name': 'Test', 'last_name': 'Practitioner6',
                'specialisation': 'Orthopaedic Surgeon',
                'email': 'practitioner6@metroortho.com',
                'phone': '+44 7700 900006',
                'city': 'Birmingham', 'country': 'UK',
                'is_active': True,
            },
        ]

        from apps.practitioners.models import Practitioner
        for spec in practitioner_specs:
            tenant = spec.pop('tenant')
            email = spec['email']
            if not Practitioner.objects.filter(email=email).exists():
                _practitioner_repo.create(tenant=tenant, **spec)
            spec['tenant'] = tenant  # restore for idempotency

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def _print_summary(self):
        from django.contrib.auth import get_user_model
        from apps.practitioners.models import Practitioner

        User = get_user_model()
        perm_count = Permission.objects.count()
        tenant_count = Tenant.objects.count()
        superuser_count = User.objects.filter(is_superuser=True).count()
        regular_user_count = User.objects.filter(is_superuser=False).count()
        role_count = Role.objects.count()
        practitioner_count = Practitioner.objects.count()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== OrthoMed Demo Data Seeded ==='))
        self.stdout.write(f'Permissions:  {perm_count:>4}')
        self.stdout.write(f'Tenants:      {tenant_count:>4}')
        self.stdout.write(f'Users:        {regular_user_count:>4} (+ {superuser_count} superadmin)')
        self.stdout.write(f'Roles:        {role_count:>4} (2 per tenant)')
        self.stdout.write(f'Practitioners:{practitioner_count:>4}')
        self.stdout.write('')
        self.stdout.write('Login credentials:')
        self.stdout.write('  superadmin@orthomed.com      / superadmin123')
        self.stdout.write('  testadmin1@citygeneral.com   / testadmin123')
        self.stdout.write('  testuser1@citygeneral.com    / testuser123')
        self.stdout.write('  testuser2@citygeneral.com    / testuser123')
        self.stdout.write('  testadmin2@metroortho.com    / testadmin123')
        self.stdout.write('  testuser3@metroortho.com     / testuser123')
