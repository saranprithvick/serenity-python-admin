from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.administration.models import Permission
from apps.administration.repositories import RoleRepository, UserRoleRepository
from apps.tenancy.models import Tenant

from .models import Patient
from .repositories import PatientRepository
from .services import PatientService

User = get_user_model()


def make_tenant(slug='test-pat-tenant', name='Test Pat Tenant'):
    return Tenant.objects.create(slug=slug, name=name)


def make_user(tenant, email='user@pat-example.com', password='pass'):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], password=password, tenant=tenant
    )


def make_patient(tenant, first_name='Test', last_name='Patient', **kwargs):
    return Patient.objects.create(
        tenant=tenant, first_name=first_name, last_name=last_name, **kwargs
    )


def _grant_permissions(user, tenant, *permission_keys):
    role = RoleRepository().create(f'Role-{user.id}', tenant)
    for key in permission_keys:
        RoleRepository().add_permission(role, Permission.objects.get(key=key))
    UserRoleRepository().assign_role(user, role)
    return role


# ---------------------------------------------------------------------------
# PatientModelTest
# ---------------------------------------------------------------------------

class PatientModelTest(TestCase):
    def setUp(self):
        self.tenant = make_tenant(slug='model-pt', name='Model PT')

    def test_create_patient(self):
        p = make_patient(self.tenant, 'Alice', 'Smith', specialisation='Orthopaedic')
        self.assertEqual(p.first_name, 'Alice')
        self.assertEqual(p.last_name, 'Smith')
        self.assertEqual(p.specialisation, 'Orthopaedic')
        self.assertEqual(p.tenant, self.tenant)
        self.assertTrue(p.is_active)

    def test_full_name_property(self):
        p = make_patient(self.tenant, 'Bob', 'Jones')
        self.assertEqual(p.full_name, 'Bob Jones')

    def test_str_returns_full_name(self):
        p = make_patient(self.tenant, 'Carol', 'White')
        self.assertEqual(str(p), 'Carol White')

    def test_soft_delete_sets_inactive(self):
        p = make_patient(self.tenant, 'Dave', 'Brown')
        p.is_active = False
        p.save()
        p.refresh_from_db()
        self.assertFalse(p.is_active)


# ---------------------------------------------------------------------------
# PatientRepositoryTest
# ---------------------------------------------------------------------------

class PatientRepositoryTest(TestCase):
    def setUp(self):
        self.tenant_a = make_tenant(slug='repo-pa', name='Repo PA')
        self.tenant_b = make_tenant(slug='repo-pb', name='Repo PB')
        self.repo = PatientRepository()
        self.p_a = make_patient(self.tenant_a, 'Alice', 'A')
        self.p_b = make_patient(self.tenant_b, 'Bob', 'B')

    def test_get_all_for_tenant(self):
        qs = self.repo.get_all(tenant=self.tenant_a)
        self.assertIn(self.p_a, qs)
        self.assertNotIn(self.p_b, qs)

    def test_get_all_superuser_returns_all_tenants(self):
        qs = self.repo.get_all(is_superuser=True)
        self.assertIn(self.p_a, qs)
        self.assertIn(self.p_b, qs)

    def test_get_by_id_correct_tenant(self):
        found = self.repo.get_by_id(self.p_a.id, tenant=self.tenant_a)
        self.assertEqual(found, self.p_a)

    def test_get_by_id_wrong_tenant_returns_none(self):
        found = self.repo.get_by_id(self.p_a.id, tenant=self.tenant_b)
        self.assertIsNone(found)

    def test_get_by_id_superuser_bypasses_tenant(self):
        found = self.repo.get_by_id(self.p_a.id, is_superuser=True)
        self.assertEqual(found, self.p_a)

    def test_create_patient(self):
        p = self.repo.create(self.tenant_a, 'Eve', 'Test', email='eve@test.com')
        self.assertEqual(p.first_name, 'Eve')
        self.assertEqual(p.email, 'eve@test.com')
        self.assertEqual(p.tenant, self.tenant_a)

    def test_update_patient(self):
        updated = self.repo.update(self.p_a.id, tenant=self.tenant_a, first_name='Updated')
        self.assertIsNotNone(updated)
        self.assertEqual(updated.first_name, 'Updated')

    def test_deactivate_patient(self):
        result = self.repo.deactivate(self.p_a.id, tenant=self.tenant_a)
        self.assertTrue(result)
        self.p_a.refresh_from_db()
        self.assertFalse(self.p_a.is_active)


# ---------------------------------------------------------------------------
# PatientServiceTest
# ---------------------------------------------------------------------------

class PatientServiceTest(TestCase):
    def setUp(self):
        self.tenant = make_tenant(slug='svc-pt', name='Svc PT')
        self.user = make_user(self.tenant, 'svc@pat-test.com')
        self.service = PatientService()

    def _make_request(self, user, tenant=None):
        request = MagicMock()
        request.user = user
        request.tenant = tenant
        return request

    def test_get_patients_regular_user(self):
        tenant2 = make_tenant(slug='svc-pt2', name='Svc PT2')
        p1 = make_patient(self.tenant, 'Alice', 'Smith')
        p2 = make_patient(tenant2, 'Bob', 'Jones')
        request = self._make_request(self.user, self.tenant)
        qs = self.service.get_patients(request)
        self.assertIn(p1, qs)
        self.assertNotIn(p2, qs)

    def test_get_patients_superuser_all_tenants(self):
        tenant2 = make_tenant(slug='svc-pt2-su', name='Svc PT2 SU')
        p1 = make_patient(self.tenant, 'Alice', 'Smith')
        p2 = make_patient(tenant2, 'Bob', 'Jones')
        superuser = User.objects.create_superuser(
            email='super_svc_pat@test.com', username='supersvcpat', password='pass'
        )
        request = self._make_request(superuser, tenant=None)
        qs = self.service.get_patients(request)
        self.assertIn(p1, qs)
        self.assertIn(p2, qs)

    def test_create_for_regular_user_uses_request_tenant(self):
        request = self._make_request(self.user, self.tenant)
        p = self.service.create_patient(request, 'John', 'Doe')
        self.assertEqual(p.tenant, self.tenant)

    def test_create_for_superuser_requires_tenant_id(self):
        superuser = User.objects.create_superuser(
            email='super_svc_pat2@test.com', username='supersvcpat2', password='pass'
        )
        request = self._make_request(superuser, tenant=None)
        with self.assertRaises(ValueError):
            self.service.create_patient(request, 'John', 'Doe', tenant_id=None)


# ---------------------------------------------------------------------------
# PatientAPITest
# ---------------------------------------------------------------------------

class PatientAPITest(APITestCase):
    def setUp(self):
        self.tenant_a = make_tenant(slug='api-pat-a', name='API PAT A')
        self.tenant_b = make_tenant(slug='api-pat-b', name='API PAT B')
        Permission.get_or_create_defaults()

        self.admin_user = make_user(self.tenant_a, 'admin_pat@test.com')
        _grant_permissions(
            self.admin_user, self.tenant_a,
            'Patient:View', 'Patient:Create',
            'Patient:Update', 'Patient:Delete',
        )

        self.patient = make_patient(self.tenant_a, 'Alice', 'Smith')
        self.patient_b = make_patient(self.tenant_b, 'Bob', 'Jones')

        self.client.force_login(self.admin_user)

    def test_list_patients_authenticated(self):
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    def test_list_patients_unauthenticated_returns_401(self):
        self.client.logout()
        response = self.client.get('/api/patients/')
        self.assertIn(response.status_code, [401, 403])

    def test_list_patients_without_permission_returns_403(self):
        no_perm_user = make_user(self.tenant_a, 'noperm_pat@test.com')
        self.client.force_login(no_perm_user)
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, 403)

    def test_create_patient_success(self):
        response = self.client.post(
            '/api/patients/',
            {'first_name': 'New', 'last_name': 'Patient', 'specialisation': 'Physio'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['first_name'], 'New')
        self.assertEqual(response.data['last_name'], 'Patient')
        self.assertEqual(response.data['tenant_id'], self.tenant_a.id)

    def test_retrieve_patient(self):
        response = self.client.get(f'/api/patients/{self.patient.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], self.patient.id)
        self.assertEqual(response.data['first_name'], 'Alice')

    def test_retrieve_wrong_tenant_returns_404(self):
        response = self.client.get(f'/api/patients/{self.patient_b.id}/')
        self.assertEqual(response.status_code, 404)

    def test_update_patient(self):
        response = self.client.patch(
            f'/api/patients/{self.patient.id}/',
            {'first_name': 'UpdatedAlice'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['first_name'], 'UpdatedAlice')

    def test_deactivate_patient_returns_200_with_record(self):
        response = self.client.delete(f'/api/patients/{self.patient.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['is_active'])
        self.assertEqual(response.data['id'], self.patient.id)


# ---------------------------------------------------------------------------
# PatientTenantIsolationTest
# ---------------------------------------------------------------------------

class PatientTenantIsolationTest(APITestCase):
    def setUp(self):
        self.tenant_1 = make_tenant(slug='iso-pat-1', name='Iso PAT 1')
        self.tenant_2 = make_tenant(slug='iso-pat-2', name='Iso PAT 2')
        Permission.get_or_create_defaults()

        self.user_1 = make_user(self.tenant_1, 'user1_pat_iso@test.com')
        _grant_permissions(
            self.user_1, self.tenant_1,
            'Patient:View', 'Patient:Create',
        )

        self.p1 = make_patient(self.tenant_1, 'T1', 'Patient')
        self.p2 = make_patient(self.tenant_2, 'T2', 'Patient')

        self.superuser = User.objects.create_superuser(
            email='super_pat_iso@test.com', username='superpatiso', password='pass'
        )

    def test_tenant1_cannot_see_tenant2_patients(self):
        self.client.force_login(self.user_1)
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, 200)
        ids = [r['id'] for r in response.data['results']]
        self.assertIn(self.p1.id, ids)
        self.assertNotIn(self.p2.id, ids)

    def test_superuser_sees_all_patients(self):
        self.client.force_login(self.superuser)
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, 200)
        ids = [r['id'] for r in response.data['results']]
        self.assertIn(self.p1.id, ids)
        self.assertIn(self.p2.id, ids)

    def test_superuser_must_specify_tenant_on_create(self):
        self.client.force_login(self.superuser)
        response = self.client.post(
            '/api/patients/',
            {'first_name': 'No', 'last_name': 'Tenant'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('tenant_id', response.data['detail'].lower())


# ---------------------------------------------------------------------------
# PatientSearchTest
# ---------------------------------------------------------------------------

class PatientSearchTest(APITestCase):
    """Search, filter, and ordering on PatientViewSet."""

    def setUp(self):
        self.tenant_a = make_tenant(slug='srch-a', name='Search Tenant A')
        self.tenant_b = make_tenant(slug='srch-b', name='Search Tenant B')
        Permission.get_or_create_defaults()

        self.user = make_user(self.tenant_a, 'search_user@test.com')
        _grant_permissions(self.user, self.tenant_a, 'Patient:View')

        self.p_knee = make_patient(
            self.tenant_a, 'Alice', 'Smith',
            specialisation='Knee Replacement', city='London',
        )
        self.p_hip = make_patient(
            self.tenant_a, 'Bob', 'Jones',
            specialisation='Hip Replacement', city='Manchester',
        )
        self.p_physio = make_patient(
            self.tenant_a, 'Charlie', 'Brown',
            specialisation='Physiotherapy', city='London',
            is_active=False,
        )
        # Same first name as p_knee but different tenant — must stay invisible
        self.p_t2 = make_patient(
            self.tenant_b, 'Alice', 'Other',
            specialisation='Knee Replacement', city='London',
        )
        self.client.force_login(self.user)

    def test_search_by_first_name_returns_match(self):
        resp = self.client.get('/api/patients/?search=Alice')
        self.assertEqual(resp.status_code, 200)
        names = [r['full_name'] for r in resp.data['results']]
        self.assertIn('Alice Smith', names)
        self.assertNotIn('Bob Jones', names)

    def test_search_by_last_name(self):
        resp = self.client.get('/api/patients/?search=Jones')
        self.assertEqual(resp.status_code, 200)
        names = [r['full_name'] for r in resp.data['results']]
        self.assertIn('Bob Jones', names)
        self.assertNotIn('Alice Smith', names)

    def test_search_by_specialisation(self):
        resp = self.client.get('/api/patients/?search=Knee')
        self.assertEqual(resp.status_code, 200)
        results = resp.data['results']
        self.assertTrue(len(results) >= 1)
        for r in results:
            self.assertIn('Knee', r['specialisation'])

    def test_search_by_city(self):
        resp = self.client.get('/api/patients/?search=Manchester')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['results']), 1)
        self.assertEqual(resp.data['results'][0]['full_name'], 'Bob Jones')

    def test_filter_active_only(self):
        resp = self.client.get('/api/patients/?is_active=true')
        self.assertEqual(resp.status_code, 200)
        statuses = [r['is_active'] for r in resp.data['results']]
        self.assertTrue(all(statuses))
        self.assertNotIn(self.p_physio.id, [r['id'] for r in resp.data['results']])

    def test_filter_inactive_only(self):
        resp = self.client.get('/api/patients/?is_active=false')
        self.assertEqual(resp.status_code, 200)
        results = resp.data['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.p_physio.id)
        self.assertFalse(results[0]['is_active'])

    def test_combined_search_and_filter(self):
        resp = self.client.get('/api/patients/?search=London&is_active=true')
        self.assertEqual(resp.status_code, 200)
        ids = [r['id'] for r in resp.data['results']]
        self.assertIn(self.p_knee.id, ids)
        self.assertNotIn(self.p_physio.id, ids)  # London but inactive

    def test_ordering_by_first_name(self):
        resp = self.client.get('/api/patients/?ordering=first_name')
        self.assertEqual(resp.status_code, 200)
        names = [r['first_name'] for r in resp.data['results']]
        self.assertEqual(names, sorted(names))

    def test_search_respects_tenant_isolation(self):
        """Alice from tenant_b must not appear in tenant_a's search results."""
        resp = self.client.get('/api/patients/?search=Alice')
        self.assertEqual(resp.status_code, 200)
        ids = [r['id'] for r in resp.data['results']]
        self.assertIn(self.p_knee.id, ids)
        self.assertNotIn(self.p_t2.id, ids)

    def test_empty_search_returns_all_tenant_patients(self):
        resp = self.client.get('/api/patients/?search=')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 3)

    def test_no_results_returns_empty_list(self):
        resp = self.client.get('/api/patients/?search=xyznotfound')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 0)
        self.assertEqual(resp.data['results'], [])
