# Day 6 Summary — Practitioners, Superuser Elevation, Permission-Aware UI

**Date:** 2026-07-02  
**Status:** Complete  
**Tests:** 138 app unit tests + 81 verification tests — all pass

---

## What Was Built

Day 6 had five major workstreams:

1. **Practitioners backend module** — model, repository, service, serializers, views, permissions, URLs
2. **Dashboard stats API** — real counts wired to the frontend
3. **Permission-aware React frontend** — UI buttons hidden based on what the user can actually do
4. **Default role seeding** — management command to populate Tenant Admin and Staff roles with correct permissions
5. **Day 6 verification test suite** — 23 new tests covering all of the above

---

## Backend Changes

### `apps/practitioners/models.py`

The `Practitioner` model represents a healthcare provider belonging to a tenant. It inherits from `TenantAwareModel` (just like every other data model in this project), which automatically adds a `tenant` foreign key and a custom manager that only returns records belonging to the current tenant.

Fields: first name, last name, email, phone, specialisation, city, country, address, notes, is_active. The `full_name` property concatenates first and last name so the API can return it as a single read-only computed field.

Think of `TenantAwareModel` as a filter built into the model itself — you almost can't accidentally return data from the wrong tenant because the manager handles it.

### `apps/practitioners/repositories.py`

`PractitionerRepository` handles all database queries. It follows the same pattern used throughout the project:

- `get_all(is_superuser, tenant)` — if superuser, return everything; if a tenant is provided, return only that tenant's records; otherwise return nothing
- `get_by_id(id, tenant, is_superuser)` — same superuser/tenant branching, returns `None` if not found
- `create(tenant, first_name, last_name, **optional_fields)` — create a new record
- `update(id, ...)` — fetch then field-by-field update via `setattr`
- `deactivate(id, ...)` — sets `is_active = False` rather than deleting

The `is_superuser` flag in every method is explicit: you have to pass `is_superuser=True` to bypass tenant filtering. You can't accidentally get cross-tenant data.

### `apps/practitioners/services.py`

`PractitionerService` sits between the views and the repository. It decides *which* arguments to pass to the repository based on whether the request comes from a superuser:

- Regular user → always passes `tenant=request.tenant`
- Superuser → passes `is_superuser=True` (cross-tenant visibility)
- `create_practitioner` for superuser → requires a `tenant_id` in the request body; raises `ValueError` if missing (which becomes a 400 response)

This is where the business rule "superuser must specify a tenant when creating" lives. The view just calls the service; if the service raises an error, the view returns 400.

### `apps/practitioners/serializers.py`

Three serializers, each for a different purpose:

- `PractitionerSerializer` — used for reading (list, retrieve, responses after create/update). Includes computed `full_name` as read-only.
- `CreatePractitionerSerializer` — used for POST. First name and last name are required. `tenant_id` is optional (superusers provide it; regular users don't need to).
- `UpdatePractitionerSerializer` — used for PUT/PATCH. All fields optional so partial updates work.

Separating read and write serializers is intentional: the write serializers can enforce required fields and validation without polluting the read serializer with those constraints.

### `apps/practitioners/views.py`

`PractitionerViewSet` wires each CRUD action to its permission key using a dictionary:

```
list/retrieve → Practitioner:View
create        → Practitioner:Create
update        → Practitioner:Update
destroy       → Practitioner:Delete
```

`get_permissions()` dynamically returns the right `HasPermission` class per action. This means a user who only has `Practitioner:View` can list and retrieve but will get a 403 if they try to POST.

The `destroy` action deactivates rather than deletes, and returns the updated practitioner object (with `is_active: false`) so the frontend has the final state without a second API call.

### `apps/practitioners/permissions.py`

Named aliases for the four permission classes, e.g. `PractitionerViewPermission = HasPermission('Practitioner:View')`. Not required by the architecture but makes imports readable and prevents typos in the permission key strings.

### `apps/authentication/serializers.py`

Added `is_superuser` as a read-only field to `UserSerializer`. This is what lets the frontend know whether the logged-in user is a platform superadmin. Without this field, `user.is_superuser` would be `undefined` in React and every superuser check in the frontend would silently fail.

### `apps/authentication/services.py` and `views.py`

The `DashboardStatsView` was added (or updated to be real). It calls `auth_service.get_dashboard_stats(request)` which returns counts scoped by tenant for regular users, or platform-wide for superusers. This powers the four stat cards on the dashboard.

### `apps/administration/models.py`

Added `DEFAULT_ROLE_PERMISSIONS` — a module-level dictionary that maps role names to their default permission key lists:

```python
{
    'Tenant Admin': [12 permissions — all Administration:* and Practitioner:*],
    'Staff': ['Practitioner:View'],
}
```

Keeping this as a constant in `models.py` means it's the single source of truth for what roles should look like. The seeding logic reads from this constant rather than having the permission lists scattered across multiple files.

### `apps/administration/repositories.py`

Added `get_or_create_by_name(name, tenant)` to `RoleRepository`. Returns a `(role, created)` tuple — creates the role if it doesn't exist, returns the existing one if it does. This makes the seeding logic safely re-runnable.

### `apps/administration/services.py`

**`PermissionService.seed_default_roles(tenant)`** — for a given tenant, creates the default roles and assigns all their permissions. Safe to call multiple times because it uses `get_or_create` everywhere. The flow:

1. Ensure all permission records exist
2. For each role in `DEFAULT_ROLE_PERMISSIONS`: get-or-create the role
3. For each permission key in that role's list: look up the permission object and add it to the role

**`RoleService.get_all_roles()`** — returns every role across all tenants. Explicitly for superuser use. The standard `get_roles(request)` method intentionally returns empty for superusers (preserving a Day 4 API isolation contract); `get_all_roles()` is the "I know what I'm doing" cross-tenant accessor.

### `apps/administration/management/commands/seed_tenant_roles.py`

A management command for fixing existing tenants that predate the seeding logic:

```bash
python manage.py seed_tenant_roles              # all tenants
python manage.py seed_tenant_roles --tenant-id 3  # one specific tenant
```

Iterates the selected tenants and calls `PermissionService().seed_default_roles(tenant)` for each. Prints a confirmation line per tenant.

### `apps/verification/day06_tests.py`

23 tests in four groups:

**Group 1 — SuperuserElevationTests:** verifies the superuser can see users from all tenants, that regular users cannot see cross-tenant users, that superuser can create users (with tenant_id) or gets 400 (without), and that dashboard stats respect scope.

**Group 2 — PractitionerCRUDTests:** full end-to-end HTTP tests for create, list, retrieve, update, and deactivate — using a tenant user who has all four `Practitioner:*` permissions.

**Group 3 — PractitionerTenantIsolationTests:** two-tenant setup that verifies each tenant's practitioners are invisible to the other, superuser sees both, and fetching another tenant's practitioner by ID returns 404.

**Group 4 — PractitionerPermissionTests:** a user with zero permissions gets 403 on every endpoint.

---

## Frontend Changes

### `src/context/AuthContext.jsx`

The most impactful frontend change of the day. AuthContext now loads permissions immediately after login and on every page refresh.

The flow:
1. Page loads → `checkAuth()` hits `/api/auth/me/` → gets user object
2. `loadPermissions(userData)` is called:
   - If superuser → `permissions = ['*']` (wildcard, can do everything)
   - If regular user → fetches `/api/administration/user-roles/<id>/permissions/` → maps to key strings
3. `hasPermission('Practitioner:Create')` returns `true` if permissions includes `'*'` or the exact string

On logout: permissions are cleared to `[]`.

The `permissions` array and `hasPermission` function are both exported from context, so any component in the tree can call `useAuth()` and check a permission in one line.

### `src/pages/dashboard/DashboardPage.jsx`

Replaced static placeholder cards with a real API call to `GET /api/auth/dashboard-stats/`. Shows MUI Skeleton loading shapes while the request is in-flight. Four cards: Total Users, Total Tenants, Total Roles, Practitioners — each with an appropriate icon.

### `src/pages/practitioners/PractitionersPage.jsx` (new file)

A full CRUD management screen following the same DataGrid + modal pattern used in UsersPage and RolesPage:

- DataGrid with columns: ID, Full Name, Specialisation, City, Country, Email, Phone, Active status, Actions
- For superusers: an extra Tenant column is injected after ID, and the Add modal shows a Tenant dropdown
- Add and Edit modals using `FormModal`
- Deactivate confirmation using `ConfirmDialog`
- All destructive buttons are gated: the Add button only appears if the user has `Practitioner:Create`; Edit requires `Practitioner:Update`; Deactivate requires `Practitioner:Delete`

### `src/pages/administration/UsersPage.jsx`

Two superuser additions:
- A "Tenant" column in the grid, injected after the ID column only when `is_superuser === true`
- A Tenant selector in the Add User modal, only rendered for superusers

Permission gating applied to all action buttons.

### `src/pages/administration/RolesPage.jsx`

Added `hasPermission` from AuthContext. The Add Role button only renders if the user has `Administration:RoleCreate`. The "assign permission" UI section only renders if the user has `Administration:RoleUpdate`.

### `src/components/layout/AppLayout.jsx`

Changed the Practitioners sidebar icon from a generic briefcase (`BusinessIcon`) to a medical bag (`MedicalServicesIcon`) — more contextually appropriate for a healthcare practitioners module.

### `src/App.tsx`

Replaced the Practitioners placeholder component with the real `PractitionersPage` import and route.

---

## How It All Fits Together

### Practitioner CRUD request flow

```
User fills Add Practitioner form → POST /api/practitioners/
  → TenantMiddleware attaches request.tenant
  → PractitionerViewSet.create()
  → get_permissions() returns HasPermission('Practitioner:Create')
  → HasPermission checks UserRole → RolePermission → Permission table
  → If 403: stops here
  → CreatePractitionerSerializer validates first_name, last_name, tenant_id
  → PractitionerService.create_practitioner(request, ...)
      → Superuser? Requires tenant_id, looks up Tenant object
      → Regular user? Uses request.tenant
      → PractitionerRepository.create(tenant, first_name, last_name, **extra)
  → PractitionerSerializer(practitioner).data → HTTP 201
```

### Permission-aware UI flow

```
User opens browser → React app loads
  → AuthProvider mounts → checkAuth() hits /api/auth/me/
  → loadPermissions(user):
      → Superuser? permissions = ['*']
      → Regular user? GET /api/administration/user-roles/<id>/permissions/
        → returns list of Permission objects with key field
        → permissions = ['Practitioner:View', 'Administration:UserCreate', ...]
  → Components call hasPermission('Practitioner:Create')
  → onAdd prop is undefined if permission missing → DataGrid hides Add button
```

### Tenant seeding flow

```
New tenant created → run:
  python manage.py seed_tenant_roles --tenant-id <id>
  → Command calls PermissionService().seed_default_roles(tenant)
  → seed_default_permissions() — ensures all 12 Permission records exist
  → For 'Tenant Admin': get_or_create role → assign all 12 permission keys
  → For 'Staff': get_or_create role → assign Practitioner:View
  → Idempotent: safe to re-run, won't create duplicates
```

---

## Test Results

```
python manage.py test apps.verification.day02_day03_tests \
                      apps.verification.day04_tests \
                      apps.verification.day06_tests --verbosity=2

Ran 81 tests in ~27s   OK

python manage.py test
Ran 138 tests in ~37s  OK
```

| Suite | Tests | Result |
|---|---|---|
| day02_day03_tests | 38 | All pass |
| day04_tests | 20 | All pass |
| day06_tests | 23 | All pass |
| App unit tests | 138 | All pass |

---

## Notable Architectural Decisions

**Day 4 vs Day 6 API contract tension.** Day 4 documented that `GET /api/administration/roles/` returns an empty list for superusers (no tenant context = no roles visible at the API level). Day 6 needed superuser elevation for roles. Resolution: the standard list API preserves the Day 4 contract, while `RoleService.get_all_roles()` provides an explicit cross-tenant accessor. The Day 6 verification test for superuser role visibility tests at the service layer, not the API layer — the docstring in that test explains why.

**Soft delete for practitioners.** The `destroy` endpoint sets `is_active = False` rather than deleting the row. This preserves history and allows practitioners to be reactivated later. The response returns the updated practitioner object (HTTP 200, not 204) so the frontend gets the final state without a second request.

**Separating three serializer classes.** Using one serializer for reads and separate ones for create and update avoids the awkward `required=False` hacks that accumulate when one serializer tries to serve all three use cases. Each serializer only knows what it needs to know.
