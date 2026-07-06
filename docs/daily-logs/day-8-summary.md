# Day 8 Summary — Naming Rename + Model Changes

**Date:** 2026-07-06  
**Branch:** feature/day-08-naming-rename  
**Focus:** Rename login users from `authentication.User` → `practitioners.Practitioner`, rename domain records from `practitioners.Practitioner` → `patients.Patient`, add `user_type` and `specialisation` fields, expand the permission set to 13 healthcare permissions, seed 4 healthcare roles per tenant, update all verification tests, and migrate the entire frontend to the new URLs and page names.

---

## What Was Built Today

Day 8 was the largest structural change of the project. The original naming (authentication app for users, practitioners app for domain records) turned out to be misleading — the people who *log in* to the system are the hospital staff (practitioners), and the records they *manage* are patients. So everything was renamed to match reality.

This was not just a search-and-replace. It required:
- Moving the Django custom user model to a completely new app
- Changing `AUTH_USER_MODEL` in settings (which Django treats as a foundational setting that can't be changed once migrations exist without rebuilding from scratch)
- Creating an entirely new `patients` app for the domain records
- Updating 13 permission keys, 4 healthcare roles, and the seed data script
- Updating all frontend pages, routes, API URLs, and labels
- Rebuilding the verification test suite to match the new names

---

## Files Modified or Created

---

### `backend/config/settings.py`

**What it is:** The central Django configuration file. Every app, database setting, and important system-wide constant lives here.

**Key change:** `AUTH_USER_MODEL = 'practitioners.Practitioner'`

This one line tells Django "when something says `User`, it means the `Practitioner` model in the `practitioners` app." Django uses this setting everywhere — login, sessions, foreign keys, and the admin panel. Changing it is a big deal because all existing migrations that reference the user model have to be rebuilt.

**Why this approach:** Django requires you to set `AUTH_USER_MODEL` before creating any migrations. Since we were rebuilding from scratch (dropping and recreating the database), this was the right moment.

**Also changed:** `INSTALLED_APPS` — removed `apps.authentication`, added `apps.practitioners` and `apps.patients`.

---

### `backend/config/urls.py`

**What it is:** The master URL routing file. Every incoming HTTP request gets matched here first, then forwarded to the right app's URL file.

**Before:**
```
/api/auth/...      → authentication app
/api/practitioners/ → practitioners app (domain records)
```

**After:**
```
/api/practitioners/auth/...  → practitioners app (login)
/api/practitioners/          → practitioners app (staff management)
/api/patients/               → patients app (domain records)
/api/administration/         → administration app
/api/tenants/                → tenancy app
```

**Why this matters:** The URL structure is the public API contract. All frontend code, tests, and external tools must use these paths.

---

### `backend/apps/practitioners/` — **Completely new app**

This replaces the old `apps/authentication/` app. It owns the custom Django user model that clinic staff use to log in.

#### `models.py`

**What it is:** Defines the `Practitioner` model — the user who logs in to the system.

**The `PractitionerManager` class** is a "factory" for creating practitioners. Think of it as the official way to build a new user record. It has two methods:
- `create_user(email, username, password, ...)` — creates a regular login account
- `create_superuser(email, username, password, ...)` — creates a platform administrator account with all permissions bypassed

**The `Practitioner` class** is the user model itself. Key fields:
- `email` — the login identifier (not username — Django's default)
- `tenant` — which hospital/clinic this person belongs to
- `user_type` — either `tenant_admin` (runs the clinic's admin panel) or `staff` (a nurse, doctor, etc.)
- `specialisation` — free text, e.g. "Orthopaedic Surgeon" or "Physiotherapist"
- `is_superuser` — platform-wide administrator, created only via management command

**How it connects:** `AUTH_USER_MODEL` points Django at this class. The `UserRole` model in administration references this via `settings.AUTH_USER_MODEL`. The `TenantMiddleware` reads `request.user.tenant` to set `request.tenant`.

#### `repositories.py`

**What it is:** The only place in the codebase allowed to talk directly to the `Practitioner` database table.

**`PractitionerRepository`** has five methods:
- `get_all(is_superuser, tenant_id)` — list all practitioners, filtered by tenant unless superuser
- `get_by_id(id, tenant_id, is_superuser)` — find one practitioner, return None if not found or wrong tenant
- `get_by_email(email)` — look up by email address (used during login)
- `get_all_for_tenant(tenant_id)` — all practitioners in one tenant
- `create_practitioner(email, username, password, tenant, ...)` — calls the model manager to create a new user
- `update_practitioner(id, tenant_id, ...)` — update fields on an existing practitioner
- `deactivate_practitioner(id, tenant_id, ...)` — soft-delete: sets `is_active = False`

**Why a repository?** The rule in this project is: views call services, services call repositories, repositories call the ORM. This keeps database queries in one place so they're easy to test and change.

#### `services.py`

**What it is:** The business logic layer for authentication and practitioner management.

**`AuthService`** is the main class. Think of it as the "receptionist" that handles all login-related requests. Key methods:

- `authenticate_practitioner(email, password, request)` — checks credentials using Django's authentication system, then creates a server-side session. Raises `ValueError` for bad passwords or inactive accounts.
- `logout_practitioner(request)` — destroys the session.
- `get_current_practitioner(request)` — returns the logged-in user, or None.
- `get_practitioners(request)` — returns all practitioners the caller is allowed to see. Superusers see all tenants; regular users see only their own.
- `create_practitioner_for_request(request, email, username, password, tenant_id, ...)` — creates a new practitioner, resolving the correct tenant (from `request.tenant` for regular users, from `tenant_id` for superusers).
- `get_dashboard_stats(request)` — aggregates counts (total users, tenants, roles, patients) for the dashboard KPI cards.
- `get_dashboard_chart_data(request)` — builds the chart data: patients by specialisation, monthly registrations, recent patients, recent activity.

**Why methods like `authenticate_user` also exist:** These are backward-compatibility aliases for older code that still uses the old naming. They call the real methods.

#### `serializers.py`

**What it is:** Data translators — they convert Python objects to JSON (for API responses) and validate JSON coming in from the frontend.

**`PractitionerSerializer`** — used for API responses. Converts a Practitioner object to a dictionary. Includes a new `role_name` field (computed, not stored): it looks up the practitioner's first role assignment and returns the role name, or `null` if no role assigned.

**`CreatePractitionerSerializer`** — validates incoming data when creating a new practitioner. Fields: email, username, first/last name, password, tenant_id, user_type, specialisation. Includes a `role_id` field (write-only — used during creation to assign a role, not stored on the model).

**`UpdatePractitionerSerializer`** — validates updates: first/last name, is_active, user_type, specialisation.

**`LoginSerializer`** — just email and password, used by the login endpoint.

#### `views.py`

**What it is:** The HTTP layer. It receives requests, calls services, and returns responses.

**`LoginView`** — handles `POST /api/practitioners/auth/login/`. Validates credentials via `AuthService`, returns practitioner data as JSON with a session cookie.

**`LogoutView`** — handles `POST /api/practitioners/auth/logout/`. Destroys the session. Returns 204 (No Content).

**`MeView`** — handles `GET /api/practitioners/auth/me/`. Returns the currently logged-in user's data. Used by the frontend to restore login state on page refresh.

**`DashboardStatsView`** and **`DashboardChartDataView`** — return aggregate data for the dashboard page.

**`PractitionerViewSet`** — handles the full CRUD lifecycle for staff management (`/api/practitioners/`):
- GET `/api/practitioners/` — list staff (tenant-filtered)
- POST `/api/practitioners/` — create new staff member
- GET `/api/practitioners/{id}/` — retrieve one
- PUT/PATCH `/api/practitioners/{id}/` — update
- DELETE `/api/practitioners/{id}/` — soft-deactivate

Each action requires a specific permission: `Administration:UserView`, `Administration:UserCreate`, etc.

#### `urls.py`

**What it is:** The app-level URL routing. Uses Django REST Framework's `DefaultRouter` to automatically generate CRUD URLs from the viewset.

```
/api/practitioners/                → list/create staff
/api/practitioners/{id}/           → retrieve/update/deactivate
/api/practitioners/auth/login/     → login
/api/practitioners/auth/logout/    → logout
/api/practitioners/auth/me/        → current user
/api/practitioners/auth/dashboard-stats/       → KPI data
/api/practitioners/auth/dashboard-chart-data/  → chart data
```

---

### `backend/apps/patients/` — **New app**

This is the domain records app. A "patient" in this system is the clinical record for someone receiving treatment — not a login user.

#### `models.py`

**What it is:** The `Patient` model — a record for a person being treated.

Inherits from `TenantAwareModel`, which automatically adds a `tenant` ForeignKey and a custom manager that filters by tenant. Key fields:
- `first_name`, `last_name` — required
- `email`, `phone`, `city`, `country`, `address` — optional contact details
- `specialisation` — the treatment area (e.g. "Orthopaedic", "Physiotherapy")
- `is_active` — soft delete flag
- `notes` — free text clinical notes
- `created_at`, `updated_at` — auto timestamps

The `full_name` property combines first and last name for display.

**Analogy:** If `Practitioner` is the doctor's employee badge, `Patient` is the patient's folder in the filing cabinet.

#### `repositories.py`

**`PatientRepository`** — all database queries for patients:
- `get_all(is_superuser, tenant)` — list patients, filtered by tenant
- `get_by_id(id, tenant, is_superuser)` — find one, 404 if wrong tenant
- `create(tenant, first_name, last_name, ...)` — create new patient record
- `update(id, tenant, ...)` — update fields
- `deactivate(id, tenant, ...)` — soft delete

#### `services.py`

**`PatientService`** — business logic for patient records:
- `get_patients(request)` — returns all patients the caller can see
- `get_patient(id, request)` — single patient
- `create_patient(request, first_name, last_name, tenant_id, ...)` — creates patient; superusers must specify `tenant_id`
- `update_patient(id, request, ...)` — updates fields
- `deactivate_patient(id, request)` — soft delete

#### `serializers.py`

**`PatientSerializer`** — full patient data including the computed `full_name`.

**`CreatePatientSerializer`** — validates incoming create requests. Required: first_name, last_name. Optional: all contact fields, specialisation, notes, tenant_id (superuser only).

**`UpdatePatientSerializer`** — validates update requests. All fields optional.

#### `views.py`

**`PatientViewSet`** — handles CRUD at `/api/patients/`. Uses a `_PERM_MAP` dictionary to pick the right permission key for each action:
- `Patient:View` for list/retrieve
- `Patient:Create` for create
- `Patient:Update` for update
- `Patient:Delete` for destroy (soft delete — returns 200 with the updated record, not 204)

---

### `backend/apps/administration/` — **Updated**

#### `models.py`

**`Permission.get_or_create_defaults()`** — now seeds 13 permissions (previously 12):

| Module | Actions |
|---|---|
| Administration | UserView, UserCreate, UserUpdate, UserDelete |
| Administration | RoleView, RoleCreate, RoleUpdate, RoleDelete |
| Patient | View, Create, Update, Delete, ViewOwn |

The old `Practitioner:*` keys are gone. `Patient:ViewOwn` is new — intended for future use where a staff member can see only the patients they're personally assigned to.

**`DEFAULT_ROLE_PERMISSIONS`** — defines which permissions each role gets by default:
- `Tenant Admin` → all 13
- `Doctor`, `Nurse`, `Caretaker` → empty (admin assigns dynamically)

#### `services.py`

**`PermissionService.seed_default_roles(tenant)`** — creates the 4 healthcare roles for a tenant with descriptions and assigns the correct permissions. Called once per tenant during setup.

**`RoleService.get_roles(request)`** — **fixed bug**: was returning an empty queryset for superusers. Now calls `get_all(is_superuser=True)` which returns all roles across all tenants.

**`RoleService.get_all_roles()`** — explicit cross-tenant role access for service-layer operations.

#### `serializers.py`

**`RoleSerializer`** — added `tenant_name = CharField(source='tenant.name', read_only=True)` so the frontend can display the tenant name next to each role without making a separate API call.

#### `management/commands/seed_demo_data.py`

**What it is:** A Django management command (`python manage.py seed_demo_data`) that populates the database with realistic demo data for the OrthoMed scenario.

**What it creates:**
- 13 permissions
- 2 tenants: City General Hospital, Metro Orthopaedic Clinic
- 8 roles: 4 healthcare roles × 2 tenants
- 1 superadmin: `superadmin@orthomed.com`
- 5 tenant practitioners: 2 admins (one per tenant) + 2 doctors + 1 nurse, each with correct `user_type`, `specialisation`, and role assignment
- 6 patients: 4 at City General, 2 at Metro Orthopaedic

The `_seed_practitioners()` method is the key addition — it now handles `user_type` and `specialisation` fields, and calls `_assign_role()` to link each practitioner to their healthcare role.

---

### `backend/apps/verification/` — **Updated + New**

#### `day02_day03_tests.py` (updated)

Fixed for the rename:
- `PractitionerRepository().create_user()` → `create_practitioner()`
- All `/api/auth/login/` → `/api/practitioners/auth/login/`
- All `'Practitioner:View'` etc. → `'Patient:View'`
- Permission count 12 → 13

#### `day04_tests.py` (updated)

Same URL and method name fixes, plus:
- `test_superuser_has_no_tenant_context_empty_roles_list` renamed to `test_superuser_sees_all_roles_across_tenants` and assertion changed from `count == 0` to `count > 0`. This reflects the Day 8 fix to `RoleService.get_roles()`.
- Same change to `test_superuser_roles_list_is_empty_when_no_tenant`.

#### `day06_tests.py` (rewritten)

The biggest rewrite — the entire domain-record section changed from `Practitioner` to `Patient`:
- Added `from apps.patients.models import Patient`
- All `/api/auth/users/` → `/api/practitioners/` (staff management)
- All `/api/auth/dashboard-stats/` → `/api/practitioners/auth/dashboard-stats/`
- All `/api/practitioners/` (domain records) → `/api/patients/`
- All `Practitioner.objects.create(...)` → `Patient.objects.create(...)`
- All `'Practitioner:*'` permission keys → `'Patient:*'`
- Classes renamed: `PractitionerCRUDTests` → `PatientCRUDTests`, etc.

#### `day08_tests.py` (new file)

Four groups of new tests to verify Day 8 specifically:

**Group 1 — Rename Verification (6 tests)**
- Confirms `AUTH_USER_MODEL == 'practitioners.Practitioner'`
- Confirms `Practitioner._meta.db_table == 'practitioners_practitioner'`
- Confirms `Patient._meta.db_table == 'patients_patient'`
- Confirms the old `apps/authentication` package is gone
- Confirms `/api/practitioners/auth/login/` returns 200
- Confirms `/api/patients/` requires authentication

**Group 2 — user_type Field (5 tests)**
- Practitioner without user_type has `null`
- `tenant_admin` and `staff` values are stored and retrieved correctly
- Specialisation is optional
- `user_type` appears in the API response

**Group 3 — Healthcare Permissions (8 tests)**
- Exactly 13 permissions after seed
- `Patient:ViewOwn` exists
- Old `Practitioner:*` keys do not exist
- 4 roles per tenant after seed
- Tenant Admin has all 13 permissions
- Doctor, Nurse, Caretaker start with 0 permissions

**Group 4 — Dynamic Permission Allocation (5 tests)**
- Doctor, Nurse, Caretaker start empty (3 tests)
- Tenant Admin can assign `Patient:View` to Doctor via the API
- Tenant Admin can revoke that permission — verified atomically

**Final count: 251 tests (146 app + 105 verification), all passing.**

---

### `frontend/src/` — **Updated pages and routing**

#### `api/axios.js`

Updated the 401 interceptor exclusion list to use the new URL paths:
- `'/api/practitioners/auth/me/'`
- `'/api/practitioners/auth/login/'`

Without this, the axios interceptor would redirect to the login page when `/me/` legitimately returns 401 (not logged in yet).

#### `context/AuthContext.jsx`

Updated the three API calls inside the auth context:
- Login: `POST /api/practitioners/auth/login/`
- Load user: `GET /api/practitioners/auth/me/`
- Logout: `POST /api/practitioners/auth/logout/`

The superuser permission shortcut (`if (userData.is_superuser) setPermissions(['*'])`) was already correct.

#### `components/layout/AppLayout.jsx`

Updated the sidebar navigation and page title lookup:
- "Users" → "Staff" (linking to `/administration/users`)
- "Practitioners" → "Patients" (linking to `/patients`)
- Dashboard API URL: `/api/practitioners/auth/dashboard-chart-data/`

#### `pages/administration/PractitionersStaffPage.jsx` (new file)

The staff management page — replaces the old `UsersPage.jsx`. Manages Practitioners (login users) via `/api/practitioners/`.

Key features:
- Lists all staff members in a DataGrid with columns: ID, [Tenant], Email, Username, User Type (chip), Specialisation, Status, Date Joined, Actions
- User Type chips: purple for `tenant_admin`, blue for `staff`
- TenantFilter visible only to superadmin
- Add Staff Member modal with fields: Email, Username, First/Last Name, User Type, Specialisation, Password; Tenant selector for superadmin
- Edit modal: First/Last Name + Active toggle
- Soft-deactivate with confirmation dialog
- Permission-gated actions: Create requires `Administration:UserCreate`, Edit requires `Administration:UserUpdate`, Deactivate requires `Administration:UserDelete`

#### `pages/patients/PatientsPage.jsx` (new file)

The patient records page — replaces the old `PractitionersPage.jsx`. Manages Patients (domain records) via `/api/patients/`.

Key features:
- DataGrid with columns: ID, [Tenant], Patient Name, Email, Condition/Treatment (specialisation), Status, Created, Actions
- Add Patient modal with fields: First/Last Name, Email, Phone, Condition/Treatment, City, Country, Notes
- Edit and soft-deactivate
- Permission-gated on `Patient:Create/Update/Delete`

#### `pages/administration/RolesPage.jsx` (updated)

- Added `tenant_name` column (only visible to superadmin)
- `TenantFilter show={isSuperuser}` — previously hardcoded to `false`
- Client-side filter: `roles.filter(r => r.tenant_id === selectedTenant)`

#### `pages/dashboard/DashboardPage.jsx` (updated)

- KPI card "Total Practitioners" → "Total Patients", uses `total_patients` key
- Chart: `patients_by_specialisation` (was `practitioners_by_specialisation`)
- Recent section: "Recent Patients", links to `/patients`
- Quick actions: "Add Patient" → `/patients`, "Add Staff Member" → `/administration/users`
- All API URLs updated to `/api/practitioners/auth/...`

#### `App.tsx` (updated)

```typescript
// Removed:
<Route path="/practitioners" element={<PractitionersPage />} />

// Added:
<Route path="/administration/users" element={<PractitionersStaffPage />} />
<Route path="/patients" element={<PatientsPage />} />
```

---

## How It All Fits Together

### Request flow — logging in

1. The React frontend POSTs `{ email, password }` to `/api/practitioners/auth/login/`
2. `LoginView` in `practitioners/views.py` receives it
3. It calls `AuthService.authenticate_practitioner()` which calls Django's `authenticate()` function
4. Django's authenticate checks the password against the `Practitioner` model (because `AUTH_USER_MODEL = 'practitioners.Practitioner'`)
5. On success, `login(request, practitioner)` creates a server-side session
6. `LoginView` returns the serialized practitioner data (with `role_name` now included)
7. `AuthContext` in React saves this, sets permissions, and the app unlocks

### Request flow — loading patients

1. A logged-in staff member navigates to `/patients` in the browser
2. `PatientsPage.jsx` mounts, calls `GET /api/patients/`
3. `TenantMiddleware` runs first — it reads the session, finds the logged-in `Practitioner`, and attaches `request.tenant = practitioner.tenant`
4. `PatientViewSet.get_permissions()` checks the action is `list`, requires `Patient:View`
5. `HasPermission('Patient:View')` checks `UserRole → Role → RolePermission → Permission` chain for the user
6. If permitted, `PatientService.get_patients()` calls `PatientRepository.get_all(tenant=request.tenant)`
7. `PatientRepository` runs `Patient.objects.for_tenant(tenant)` — the custom `TenantAwareModel` manager filters by `tenant_id`
8. The results are serialized with `PatientSerializer` and returned as paginated JSON
9. The React `DataGrid` renders the rows

### Request flow — creating a practitioner with a role (partially complete)

*Note: The role assignment feature was started at the end of Day 8 and will be completed in Day 9.*

The `CreatePractitionerSerializer` was updated to include a `role_id` write-only field, and `PractitionerSerializer` was updated to compute and return `role_name`. The service and view changes to wire up atomic role assignment are pending.

---

## Key Design Decisions

### Why two separate apps for login users vs. domain records?

The login model (`Practitioner`) is special — Django treats it as a system-level model because `AUTH_USER_MODEL` points to it. Mixing it with business domain records (`Patient`) would create circular dependencies and make the code confusing. Keeping them separate mirrors the Serenity framework pattern and keeps each app's responsibility clear.

### Why is `AUTH_USER_MODEL` in `practitioners` not `administration`?

The administration app manages *roles and permissions*. The practitioners app manages *who can log in*. These are different concerns. Putting the user model in administration would mean the authentication layer depends on the permission layer, which is backwards.

### Why does `Practitioner` not inherit from `TenantAwareModel`?

`TenantAwareModel` uses a custom manager that filters by tenant. But the Django authentication system needs to look up users by email *across all tenants* (the login flow doesn't know which tenant the user belongs to until after authentication). Using `TenantAwareModel` would break login. So `Practitioner` has its own `tenant` ForeignKey without the automatic filter.

### Why are Doctor/Nurse/Caretaker roles empty by default?

Every hospital has different workflows. A nurse at City General might need full patient access; a nurse at Metro Orthopaedic might only need read access. Making roles empty-by-default gives each Tenant Admin complete control over what their staff can do, without any hidden defaults.

### Why does `Patient:ViewOwn` exist if it's not used yet?

It was seeded now as part of the canonical 13-permission set. Day 9 will implement the logic — when a practitioner has only `Patient:ViewOwn` (not `Patient:View`), they can only see patients they've been explicitly assigned to. Having the permission in the database now means the Day 9 changes won't need a migration.
