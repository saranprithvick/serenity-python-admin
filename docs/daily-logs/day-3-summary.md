# Day 3 Summary — RBAC Module (Roles, Permissions, API)

**Date:** 2026-06-29
**Status:** All tests passing — 78 total (40 unit + 38 verification)

---

## What was built today

Day 3 completed the **Role-Based Access Control (RBAC)** system — the engine
that decides what each user is allowed to do. It was built in two phases:

1. **The data layer** (`models.py`, `repositories.py`, `services.py`, `permissions.py`) —
   the database tables and business logic for roles and permissions.
2. **The API layer** (`serializers.py`, `views.py`, `urls.py`) —
   the HTTP endpoints that let client code manage roles via REST calls.
3. **A verification suite** (`apps/verification/day02_day03_tests.py`) —
   38 end-to-end tests confirming every Day 2 and Day 3 behaviour.

---

## The Big Picture — What Is RBAC?

RBAC stands for *Role-Based Access Control*. Instead of giving each user a
personal list of permissions ("Alice can delete customers, Bob can only view
them"), you create **roles** ("Manager can delete, Viewer can only view") and
then assign users to roles.

Think of it like job titles in a company:
- The **permission** is "approve expense reports".
- The **role** is "Finance Manager".
- The **user** is Alice.
- Alice gets the Finance Manager role → Alice can approve expense reports.

This project uses **string-key permissions** in the format `Module:Action`
(e.g., `Customer:Delete`, `Administration:RoleCreate`). That makes them
easy to read and hard to mix up across modules.

---

## apps/administration/models.py — The Database Tables

Four models were added. Think of each as a table in a spreadsheet.

### `Permission`
A **global** catalogue of things users can do. "Global" means it has no
tenant — every tenant shares the same permission list.

| Field | What it stores |
|-------|---------------|
| `key` | The unique string key, e.g. `Customer:View` |
| `module` | The feature area, e.g. `Customer` |
| `action` | What you can do, e.g. `View` |
| `description` | Human-readable explanation |

**`get_or_create_defaults()`** is a class method (a helper that belongs to
the Permission table itself, not any one row). It seeds 12 standard
permissions on first run — 8 for the Administration module and 4 for
Customer.

### `Role`
A named group that collects permissions together. **Roles are
tenant-scoped** — Acme Corp's "Manager" role is completely separate from
Globex Corp's "Manager" role.

It inherits from `TenantAwareModel` (built on Day 2), which automatically
adds the `tenant` foreign key column and enforces isolation.

The `unique_together = ('tenant', 'name')` constraint means the same name
can exist in different tenants, but not twice within the same tenant.

### `RolePermission`
This is the **join table** between Role and Permission. In database terms it
is a many-to-many relationship: one role can have many permissions, and one
permission can belong to many roles.

Using an explicit join table (rather than Django's auto-generated one) gives
us full control — we can add extra fields to it later if needed.

### `UserRole`
The **join table** between User and Role. Again, explicit — one user can
have many roles simultaneously (e.g., "Manager" + "Auditor"), and one role
can be held by many users.

The `unique_together = ('user', 'role')` constraint prevents the same role
from being assigned to the same user twice.

---

## apps/administration/repositories.py — All Database Queries

Repositories are the only place in the codebase that talks to the database
directly. No view or service is allowed to write `Role.objects.filter(...)`.
All queries are concentrated here so they are easy to find and test.

### `PermissionRepository`
Four simple lookups: by id, by string key, get all, get by module. Used
when you need to find a specific permission to attach to a role.

### `RoleRepository`
- **`get_by_id(role_id, tenant_id)`** — fetches a role only if it belongs
  to the given tenant. This is the key tenant isolation check for roles.
- **`get_all_for_tenant` / `get_active_for_tenant`** — list roles scoped
  to a tenant.
- **`create`** — inserts a new Role row.
- **`add_permission` / `remove_permission`** — link or unlink a Permission
  from a Role via the `RolePermission` join table.
- **`get_permissions_for_role`** — returns all permissions on a role using
  a reverse join through `RolePermission`.

### `UserRoleRepository`
- **`assign_role` / `remove_role`** — add or remove a row in `UserRole`.
- **`get_roles_for_user`** — all roles a user holds.
- **`get_permissions_for_user`** — all permissions across *all* of the
  user's roles, deduplicated (`.distinct()`). This is a three-table JOIN:
  `Permission → RolePermission → Role → UserRole → User`.
- **`user_has_permission(user_id, permission_key)`** — the core gate-check.
  Returns True/False. Does the same three-table JOIN but stops as soon as
  it finds one match (`.exists()`), so it is very efficient.

---

## apps/administration/services.py — Business Logic

Services sit above repositories. They enforce rules that are more complex
than a single query.

### `PermissionService`
Thin wrapper around `PermissionRepository` plus a `seed_default_permissions()`
method that calls `Permission.get_or_create_defaults()`. Used in setup scripts.

### `RoleService`
- **`create_role`** — delegates to the repository.
- **`assign_permission_to_role(role_id, permission_id, tenant_id)`** —
  before linking the permission it checks that the role actually belongs to
  the given tenant. If not, it raises a `ValueError`. This prevents one
  tenant from manipulating another tenant's roles.
- **`remove_permission_from_role`** — same tenant check before removing.
- **`get_role_permissions`** — delegates to the repository after the tenant
  check.

### `UserRoleService`
- **`assign_role_to_user(user_id, role_id, tenant_id)`** — two checks:
  (1) the role must belong to the given tenant; (2) the user must not already
  have the role. Raises `ValueError` for either violation.
- **`remove_role_from_user`** — silent no-op if the role doesn't exist
  (safe to call multiple times).
- **`get_user_roles` / `get_user_permissions`** — delegates to the
  repository.
- **`check_user_permission`** — convenience wrapper around the repository's
  `user_has_permission`.

---

## apps/administration/permissions.py — The DRF Permission Gate

This file contains the custom DRF permission class that every API view uses
to enforce the string-key system.

### `HasPermission`
Think of this as a **bouncer at the door**. Every API endpoint creates one
of these with a specific permission key, and the bouncer decides whether the
incoming request is allowed to enter.

```python
# How it is used in a view:
permission_classes = [IsAuthenticated, HasPermission('Customer:View')]
```

**How the bouncer decides:**
1. If the user is not logged in → **deny**.
2. If the user is a superuser → **always allow** (superusers bypass all
   checks).
3. Otherwise, call `UserRoleRepository.user_has_permission()` and return
   whatever it returns.

**The `__call__` trick:** Django REST Framework normally expects a *class*
in `permission_classes`, not an instance. When it builds the permissions list
it calls `permission()` on each entry to get an instance. Since
`HasPermission('Customer:View')` creates an instance at definition time,
`__call__` returns `self` — so calling an already-created instance just
gives back the same object. DRF gets the instance it expects without error.

---

## apps/administration/serializers.py — Data Shape for the API

Serializers are **translators**: they convert a Django model object into JSON
(for responses) and validate JSON back into clean Python data (for requests).

| Serializer | Purpose |
|-----------|---------|
| `PermissionSerializer` | Read-only; exposes id, key, module, action, description |
| `RoleSerializer` | Read/write role fields; `tenant_id` and `id` are read-only |
| `RoleDetailSerializer` | Extends RoleSerializer; adds a nested `permissions` list |
| `AssignPermissionSerializer` | Input-only; validates a `permission_id` integer exists |
| `UserRoleSerializer` | Input-only; validates `user_id` + `role_id` for assign/remove |

`RoleDetailSerializer` is used only on the single-role endpoint (`retrieve`)
so that listing roles is lightweight (no extra JOIN) while fetching one role
shows the full permission list.

---

## apps/administration/views.py — The HTTP Endpoints

Views receive HTTP requests, call services, and return responses. They
contain no business logic — that is the service's job.

### `PermissionViewSet` (read-only)
Exposes `GET /api/administration/permissions/` and
`GET /api/administration/permissions/<id>/`. Anyone with
`Administration:RoleView` can read the full permission catalogue.

### `RoleViewSet` (full CRUD)
The most involved viewset. Key design decisions:

**Per-action permissions via `get_permissions()`:** Instead of one fixed
`permission_classes` list, a lookup table maps each action name to the
required key. Creating a role requires `Administration:RoleCreate`;
deleting requires `Administration:RoleDelete`; everything else defaults to
`Administration:RoleView`.

**Tenant-scoped queryset:** `get_queryset()` always filters by
`request.user.tenant_id`, so a user from Tenant A can never see Tenant B's
roles — even if they guess the URL.

**Custom `create()`:** Instead of saving through the serializer (which would
require the client to supply `tenant_id`), the view injects the tenant from
the logged-in user automatically. The client just sends `name` and
`description`.

**Extra actions:**
- `POST /roles/<id>/assign_permission/` — attaches a permission to a role.
- `DELETE /roles/<id>/remove_permission/` — detaches one.

Both call `RoleService` which performs the tenant-ownership check before
touching the database.

### `UserRoleViewSet` (plain ViewSet)
Handles user↔role relationships. A plain `ViewSet` (not `ModelViewSet`)
because the endpoints don't map neatly to a single model's CRUD lifecycle.

- `POST /user-roles/assign/` — assign a role to a user (validates tenant).
- `DELETE /user-roles/remove/` — unassign a role from a user.
- `GET /user-roles/<user_id>/roles/` — list all roles a user holds.
- `GET /user-roles/<user_id>/permissions/` — list all permissions a user
  holds (flattened across all their roles).

---

## apps/administration/urls.py — URL Routing

Uses DRF's `DefaultRouter` for the two viewsets that follow standard REST
patterns (permissions and roles). The user-role endpoints are wired manually
because they don't follow the typical `/resource/<pk>/` shape.

```
GET    /api/administration/permissions/          → list all permissions
GET    /api/administration/permissions/<id>/     → single permission
GET    /api/administration/roles/                → list tenant's roles
POST   /api/administration/roles/                → create role
GET    /api/administration/roles/<id>/           → single role + permissions
PUT    /api/administration/roles/<id>/           → update role
DELETE /api/administration/roles/<id>/           → delete role
POST   /api/administration/roles/<id>/assign_permission/   → link permission
DELETE /api/administration/roles/<id>/remove_permission/   → unlink permission
POST   /api/administration/user-roles/assign/    → assign role to user
DELETE /api/administration/user-roles/remove/    → remove role from user
GET    /api/administration/user-roles/<uid>/roles/       → user's roles
GET    /api/administration/user-roles/<uid>/permissions/ → user's permissions
```

---

## apps/administration/migrations/0001_initial.py — The Database Schema

Django's migration system generated this file automatically from `models.py`.
Running `python manage.py migrate` reads this file and creates four tables
in PostgreSQL: `administration_permission`, `administration_role`,
`administration_rolepermission`, and `administration_userrole`.

Dependencies: the migration waits for `tenancy` and `auth` migrations to run
first, because `Role` references `Tenant` and `UserRole` references `User`.

---

## apps/verification/day02_day03_tests.py — The Verification Suite

A standalone test file (not a Django app) that cross-checks everything
built on Days 2 and 3. It contains 38 tests across 6 groups:

| Group | What it checks | Tests |
|-------|---------------|-------|
| 1 — Tenancy | Create, unique slug, str() | 3 |
| 2 — Authentication | User creation, login, logout, /me | 9 |
| 3 — RBAC Models | Permissions, roles, joins | 7 |
| 4 — Permission Checks | user_has_permission, superuser bypass | 5 |
| 5 — API Endpoints | Full HTTP round-trips for all RBAC routes | 10 |
| 6 — Tenant Isolation | Cross-tenant data never leaks | 4 |

All 38 passed on the first run. No application bugs were found during
verification.

---

## config/settings.py and config/urls.py — Wiring Changes

`'apps.administration'` was added to `INSTALLED_APPS` so Django knows to
include the app's models and run its migrations.

`path('api/administration/', include('apps.administration.urls'))` was
added to the root URL config so every administration endpoint is reachable
under the `/api/administration/` prefix.

---

## How It All Fits Together

Here are two real request flows to show how the layers work together.

### Flow 1 — Checking whether a user can view customers

A frontend page loads and asks the backend "can the current user view the
customer list?"

1. The frontend calls `GET /api/customers/` (a future endpoint).
2. DRF checks `permission_classes = [IsAuthenticated, HasPermission('Customer:View')]`.
3. `IsAuthenticated` confirms the user is logged in (session cookie present).
4. `HasPermission('Customer:View')` is asked: does this user have the key
   `Customer:View`?
5. It calls `UserRoleRepository.user_has_permission(user_id, 'Customer:View')`.
6. The repository runs a single database query: *"Does a row exist in the
   Permission table with key='Customer:View' that is linked through
   RolePermission to a Role that is linked through UserRole to this user?"*
7. If yes → the query returns True → request is allowed → the view runs.
8. If no → False → DRF returns 403 Forbidden.

### Flow 2 — An admin assigns a permission to a role via the API

An admin opens the admin panel and clicks "Add Customer:View permission to
the Manager role."

1. The frontend sends `POST /api/administration/roles/5/assign_permission/`
   with body `{"permission_id": 9}`.
2. `RoleViewSet.get_permissions()` checks the action is `assign_permission`
   → requires `Administration:RoleUpdate`.
3. `HasPermission('Administration:RoleUpdate')` queries the DB to confirm
   the logged-in admin actually has that key.
4. `AssignPermissionSerializer` validates the request body: is
   `permission_id` an integer? Does a Permission with id=9 exist?
5. `RoleService.assign_permission_to_role(role_id=5, permission_id=9, tenant_id=4)` is called.
6. The service first calls `RoleRepository.get_by_id(5, tenant_id=4)` to
   confirm role 5 belongs to the admin's tenant. If not → `ValueError` → 400.
7. Then `RoleRepository.add_permission(role, permission)` writes a row to
   the `RolePermission` table.
8. The view returns `{"status": "permission assigned"}` with HTTP 200.
9. From this moment, every user who holds Role 5 gains `Customer:View`
   automatically — no user accounts need to be touched.

---

## Test Counts

| Suite | Tests | Result |
|-------|-------|--------|
| `apps.administration` unit tests | 40 | ✅ All passed |
| `apps.verification` Day 2+3 suite | 38 | ✅ All passed |
| **Total** | **78** | **✅ 0 failures** |

---

## Files Changed / Created Today

| File | Created / Modified |
|------|--------------------|
| `backend/apps/administration/apps.py` | Modified — fixed app name and label |
| `backend/apps/administration/models.py` | Modified — 4 new models |
| `backend/apps/administration/repositories.py` | Modified — 3 repository classes |
| `backend/apps/administration/services.py` | Modified — 3 service classes |
| `backend/apps/administration/permissions.py` | Modified — `HasPermission` class |
| `backend/apps/administration/serializers.py` | Modified — 5 serializers |
| `backend/apps/administration/views.py` | Modified — 3 viewsets |
| `backend/apps/administration/urls.py` | Modified — router + manual paths |
| `backend/apps/administration/tests.py` | Modified — 40 unit tests |
| `backend/apps/administration/migrations/0001_initial.py` | Created — DB schema |
| `backend/apps/verification/__init__.py` | Created — package marker |
| `backend/apps/verification/day02_day03_tests.py` | Created — 38 verification tests |
| `backend/config/settings.py` | Modified — added `apps.administration` |
| `backend/config/urls.py` | Modified — added administration URL prefix |
