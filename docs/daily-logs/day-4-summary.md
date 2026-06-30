# Day 4 Summary — Multi-Tenancy Middleware & Queryset Filtering

**Date:** 2026-06-30
**Branch:** feature/day-03-rbac (Day 4 commits on top)
**Tests added today:** 31 new tests (11 in tenancy, 4 in administration, 16 in verification/day04)
**Combined passing total:** 58 tests (Day 2+3+4 verification: 38 + 20 = 58)

---

## What Was Built

Day 4 added the infrastructure that makes multi-tenancy actually work at runtime. Before today, the codebase had a `Tenant` model and a `tenant` foreign key on users and roles — but nothing that automatically enforced "User A only sees their own tenant's data." Day 4 fills that gap with two pieces: a **middleware** that figures out which tenant a request belongs to, and a **manager** that makes it easy to query only that tenant's rows.

---

## Files Created or Modified

### `backend/apps/tenancy/managers.py` — NEW

**What it is:** A custom Django ORM manager. Think of it as a "smart query helper" that all tenant-scoped models share.

**What it does:**

Django models normally have an `objects` manager that gives you methods like `Model.objects.all()` or `Model.objects.filter(...)`. This file defines a *custom* manager that adds two more methods:

- `for_tenant(tenant_obj)` — takes a Tenant instance, returns only rows belonging to that tenant. If you pass `None`, it returns an empty queryset rather than all rows.
- `for_tenant_id(tenant_id)` — same idea but takes an integer ID instead of an object.

The "return empty when None" behaviour is a deliberate safety net. If something goes wrong upstream and `None` slips through, you get zero results rather than accidentally exposing every tenant's data.

**Why built this way:** Centralising the filter in one place means every part of the codebase uses the same safe pattern. No developer has to remember to add `.filter(tenant=...)` manually — the manager does it for them.

---

### `backend/apps/tenancy/middleware.py` — NEW

**What it is:** A Django middleware class. Middleware is code that runs on every single HTTP request, in order, before the request ever reaches a view.

**What it does:**

Every time a request comes in, `TenantMiddleware.__call__` does this:

1. Sets `request.tenant = None` as the default (safe starting state).
2. If the user is not logged in (anonymous), passes the request through — `request.tenant` stays `None`.
3. If the user is a superuser, passes the request through — `request.tenant` stays `None`. Superusers intentionally operate across all tenants.
4. If the user is logged in but has no tenant FK on their account, returns a 403 error — this is a misconfigured account.
5. If the user's tenant exists but `is_active = False`, returns a 403 error — suspended tenant.
6. Otherwise, sets `request.tenant = request.user.tenant` and passes the request along.

From that point forward, every view can read `request.tenant` and know exactly which tenant the caller belongs to.

**Why it must come after `AuthenticationMiddleware`:** Middleware runs in the order listed in `settings.py`. `AuthenticationMiddleware` is the one that reads the session cookie and sets `request.user`. If `TenantMiddleware` ran first, `request.user` would not exist yet. The ordering is `AuthenticationMiddleware` → `TenantMiddleware` — Django sets the user, then we set the tenant.

**Why built this way:** Putting tenant resolution in middleware means every view gets `request.tenant` for free. No view has to manually look up the tenant — it's already been resolved and validated by the time the view runs.

---

### `backend/apps/tenancy/models.py` — MODIFIED

**What changed:** Two additions:
1. `from .managers import TenantAwareManager` — imports the new manager.
2. `objects = TenantAwareManager()` on the `TenantAwareModel` abstract base class.

**Why this matters:** `TenantAwareModel` is the abstract base that every tenant-scoped model inherits from (e.g., `Role`). By attaching `TenantAwareManager` as `objects` on the abstract base, every subclass automatically inherits the `for_tenant()` and `for_tenant_id()` methods. You define the manager once; all models get it for free.

---

### `backend/config/settings.py` — MODIFIED

**What changed:** One line inserted in the `MIDDLEWARE` list:

```python
'apps.tenancy.middleware.TenantMiddleware',
```

It sits immediately after `'django.contrib.auth.middleware.AuthenticationMiddleware'`.

**Why the position matters:** As described above, `TenantMiddleware` reads `request.user`, which `AuthenticationMiddleware` must set first. The MIDDLEWARE list is Django's execution order for every request.

---

### `backend/apps/administration/repositories.py` — MODIFIED

**What changed:** `RoleRepository` now uses `TenantAwareManager` for all tenant-scoped queries:

- `get_by_id(role_id, tenant_id)` — was `Role.objects.filter(tenant_id=..., id=...).first()`, now `Role.objects.for_tenant_id(tenant_id).get(id=role_id)`.
- `get_all_for_tenant(tenant_id)` — was `Role.objects.filter(tenant_id=...)`, now `Role.objects.for_tenant_id(tenant_id)`.
- `get_active_for_tenant(tenant_id)` — same pattern, chained with `.filter(is_active=True)`.

**Why this matters:** These are the methods the rest of the system uses to read roles. Switching them to `for_tenant_id()` means they now use the safe, centralised filter — and they correctly return empty results when `tenant_id` is `None`.

---

### `backend/apps/administration/views.py` — MODIFIED

**What changed:** Every place that previously referenced `request.user.tenant_id` or `request.user.tenant` was replaced with `request.tenant`. Three concrete changes:

1. **`RoleViewSet.get_queryset`** — now reads `request.tenant.id if request.tenant else None` to build the tenant-scoped queryset.
2. **`RoleViewSet.create`** — now passes `request.tenant` directly to `RoleService().create_role()`. Also added a guard: if the caller is a superuser and `request.tenant is None`, return 400 with a clear message. Superusers have no tenant context, so they cannot create tenant-scoped records without specifying which tenant.
3. **`assign_permission`, `remove_permission`, `UserRoleViewSet.assign`** — all now read `request.tenant.id if request.tenant else None`.

**Why this matters:** Before this change, views were reading tenant identity from the user object directly. That bypassed the middleware's validation logic (inactive tenant check, no-tenant check). Using `request.tenant` means the middleware has already done the validation — the view just uses the result.

---

### `backend/apps/administration/tests.py` — MODIFIED

**What changed:** Two categories of changes:

**Test setup refactoring:** Previously `RoleAPITest` and `UserRoleAPITest` used a superuser + `force_authenticate`. With `TenantMiddleware` in place, `force_authenticate` no longer works for tenant-scoped tests (explained below in the "Key Insight" section). The setup was rewritten to:
- Create a regular user with an explicit admin role
- Grant that role the necessary `Administration:*` permissions
- Use `force_login` instead of `force_authenticate`

**New `TenantMismatchTest` class (4 tests):**
- Cross-tenant retrieve returns 404
- Cross-tenant update (PATCH) returns 404
- Cross-tenant delete returns 404
- Superuser creating a role without tenant context returns 400

---

### `backend/apps/verification/day02_day03_tests.py` — MODIFIED

**What changed:** The `RBACAPITests` class (the verification suite for Day 3's Role/Permission API) was using `force_authenticate` with a superuser. This broke when `TenantMiddleware` was added (same reason as above). Changes:
- Switched from superuser to a regular user with admin permissions
- Changed all 9 `force_authenticate` calls to `force_login`
- The test `test_create_role_as_superuser` now tests with the admin user (the test name is preserved but semantics shifted to a user with admin permissions)

All 38 existing tests continue to pass after this refactoring.

---

### `backend/apps/verification/day04_tests.py` — NEW

**What it is:** A dedicated verification suite for Day 4, with 20 tests organised into 5 groups.

**Group 1 — `MiddlewareIntegrationTests` (5 tests):**
Tests that `TenantMiddleware` correctly resolves `request.tenant` across a full HTTP request cycle. These use `APIClient` with real login and session cookies — not the shortcut `force_authenticate`.
- Real POST to `/api/auth/login/` → then GET `/api/administration/roles/` → proves only tenant A's roles appear.
- Same with `force_login` (which also sets up a real session).
- User with inactive tenant → 403 before view runs.
- Anonymous request → 401/403 from DRF's `IsAuthenticated`.
- Superuser → empty roles list (because `request.tenant` is `None`).

**Group 2 — `TenantAwareManagerTests` (6 tests):**
Direct unit tests of the `TenantAwareManager` methods using the `Role` model.
- `for_tenant()` returns only matching rows.
- `for_tenant()` excludes other tenant's rows.
- `for_tenant(None)` returns empty queryset.
- Same three for `for_tenant_id()`.

**Group 3 — `CrossTenantAccessTests` (3 tests):**
API-level tests proving that a user from Tenant A cannot see, update, or delete a role that belongs to Tenant B. All three return 404 — not 403 — so the existence of the resource is not revealed.

**Group 4 — `SuperuserTenantGuardTests` (2 tests):**
- Superuser POST to create a role returns 400 (no tenant context to assign it to).
- Superuser GET roles returns empty list even when roles exist in other tenants.

**Group 5 — `EndToEndRegressionTests` (4 tests):**
Full regression confirming that all Day 3 operations (login, list roles, create role, assign permission, assign user role) still work correctly now that views use `request.tenant` instead of the old `request.user.tenant_id` fallback.

---

### `backend/apps/tenancy/tests.py` — MODIFIED

**What was added:** Two new test classes appended to the existing tenancy tests:

- **`TenantMiddlewareTest` (6 tests):** Unit tests using Django's `RequestFactory` to build synthetic requests. Tests each branch of the middleware's logic: anonymous → tenant stays None, superuser → tenant stays None, regular user → tenant is set, user with no tenant → 403, user with inactive tenant → 403.

- **`TenantAwareManagerTest` (5 tests):** Unit tests using `Role` as the test model to verify `for_tenant()` and `for_tenant_id()` return and exclude the right rows, and return empty querysets when passed `None`.

---

## Key Insight: Why `force_authenticate` Broke and `force_login` Fixed It

This was the trickiest part of Day 4. Django processes a request through the MIDDLEWARE stack first, then hands it to the view. DRF's `force_authenticate` is a *test shortcut* that skips the normal session-based authentication and instead injects a user directly into the request — but it does this in the view layer, *after* middleware has already run.

Here is the problem:
1. Request arrives.
2. `AuthenticationMiddleware` runs — reads the session cookie — finds nothing — sets `request.user = AnonymousUser`.
3. `TenantMiddleware` runs — sees `AnonymousUser` — sets `request.tenant = None`.
4. View runs — DRF's `force_authenticate` override kicks in and sets `request.user = the_forced_user` — but `request.tenant` is already `None` and is not updated.

So any test using `force_authenticate` would have `request.tenant = None` regardless of the user's actual tenant FK.

`force_login` works differently: it sets up a real Django session (writing to the test database), so when step 2 runs, `AuthenticationMiddleware` reads the session and correctly sets `request.user` to the logged-in user. `TenantMiddleware` then correctly derives `request.tenant` from that user.

**Rule going forward:** Any test that exercises code reading `request.tenant` must use `force_login`, not `force_authenticate`.

---

## How It All Fits Together — The Request Flow

Here is what happens when a logged-in user makes a GET request to `/api/administration/roles/`:

```
Browser / API Client
       |
       | (HTTP GET /api/administration/roles/  +  session cookie)
       ↓
Django MIDDLEWARE STACK
  1. SessionMiddleware       — reads the session cookie, loads session data
  2. AuthenticationMiddleware — looks up the user from the session → sets request.user
  3. TenantMiddleware (NEW) — reads request.user:
       • Is it AnonymousUser?   → request.tenant = None, pass through
       • Is it a superuser?     → request.tenant = None, pass through
       • Does user.tenant exist and is it active?
           Yes → request.tenant = user.tenant (the Tenant object)
           No  → return 403 immediately, request ends here
       ↓
RoleViewSet.get_queryset()
  — reads request.tenant.id
  — calls RoleService().get_roles_for_tenant(tenant_id)
       ↓
  RoleService.get_roles_for_tenant(tenant_id)
  — calls RoleRepository().get_all_for_tenant(tenant_id)
       ↓
  RoleRepository.get_all_for_tenant(tenant_id)
  — calls Role.objects.for_tenant_id(tenant_id)   ← TenantAwareManager
  — generates SQL: SELECT * FROM role WHERE tenant_id = <id>
       ↓
  Queryset returned up the chain → serialized → JSON response
```

A user from Tenant A can never see Tenant B's roles because:
- The middleware sets `request.tenant` to Tenant A.
- `get_queryset()` reads that and passes Tenant A's ID down the chain.
- The SQL query has `WHERE tenant_id = <A's id>`.
- Even if a caller guesses Tenant B's role ID and hits `/roles/<B_role_id>/`, DRF's `get_object()` calls `get_queryset()` first, which is already filtered to Tenant A — so the role isn't found → 404.

This is the Serenity pattern in action: middleware resolves context, the view reads it, the service uses it, the repository enforces it at the database level.
