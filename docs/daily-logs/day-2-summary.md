# Day 2 Summary — Tenancy & Authentication Modules

**Date:** 2026-06-25  
**Commit:** `2f0b07e — Tenancy and Authentication modules completed`

---

## What was built today

Two complete Django apps were wired up end-to-end:

1. **`apps/tenancy/`** — The foundation that every other module depends on. Defines what a "tenant" is and provides the base class that makes models tenant-aware.
2. **`apps/authentication/`** — Custom user accounts, session-based login/logout, and a "who am I?" endpoint.

---

## apps/tenancy/ — The Multi-Tenancy Foundation

Think of a "tenant" like a company account in a SaaS product. All of Acme Corp's data lives in one tenant; Globex Corp's data lives in another. They must never see each other's records.

### `models.py`

**`Tenant`** — The company record itself.
- Stores a `name` (e.g. "Acme Corp") and a unique `slug` (e.g. `"acme"`) used to look it up by URL or subdomain later.
- Has an `is_active` flag to soft-disable a tenant without deleting their data.

**`TenantAwareModel`** — A reusable abstract base class (it has no database table of its own).
- Any model that inherits from it automatically gets a `tenant` foreign key column pointing to the `Tenant` table.
- The `%(class)s_set` related name is a Django trick so that when multiple models inherit it, their reverse accessors don't clash (e.g. `tenant.user_set` vs `tenant.customer_set`).
- *Why abstract?* Because we want the `tenant` FK baked into every future model (Customers, Orders, etc.) without copy-pasting the field each time.

### `repositories.py` — `TenantRepository`

This is the only place in the codebase that's allowed to talk to the database for tenant data. Think of it as a dedicated filing clerk: you ask it for a tenant, it goes to the DB and comes back with the answer.

| Method | What it does |
|--------|-------------|
| `get_by_id(id)` | Look up a tenant by its numeric ID |
| `get_by_slug(slug)` | Look up by URL-friendly slug (e.g. `"acme"`) |
| `get_all_active()` | Return only tenants with `is_active=True` |
| `create(name, slug)` | Create a new tenant row |

All queries use `.filter(...).first()` rather than `.get(...)` so they return `None` instead of crashing when a record isn't found.

### `services.py` — `TenantService`

The service layer sits between the views and the repository. It's where business logic would live — right now it's thin because tenants have simple rules, but this is where things like "validate slug format" or "check tenant limits" would go later.

The service takes an optional `repository` argument in its constructor. This is called **dependency injection** — it means tests can swap in a fake repository without touching a real database.

### `serializers.py` — `TenantSerializer`

A DRF serializer converts a `Tenant` model instance into a Python dictionary (then JSON). All fields are `read_only` because the API only exposes tenants for reading, not editing.

### `views.py` — `TenantViewSet`

A DRF `ReadOnlyModelViewSet` provides two endpoints automatically:
- `GET /api/tenants/` → list all active tenants
- `GET /api/tenants/<id>/` → retrieve one tenant

The view never touches the ORM directly — it asks the service for data, which asks the repository. This keeps the layers clean.

### `urls.py`

Uses DRF's `DefaultRouter` to auto-generate the list/retrieve URL patterns from the `TenantViewSet`. Registered under `api/` in the root URL config.

### `tests.py`

Four test classes covering every layer:

- **`TenantModelTest`** — Checks that a tenant saves correctly and that duplicate slugs are rejected at the database level.
- **`TenantRepositoryTest`** — Tests each repository method: hit, miss, inactive filtering, creation.
- **`TenantServiceTest`** — Uses a `FakeRepository` (a hand-written stand-in) to prove the service only calls the repository and doesn't do its own DB queries.
- **`TenantAPITest`** — End-to-end HTTP tests: unauthenticated requests get a 401/403; authenticated requests get a 200.

---

## apps/authentication/ — User Accounts & Sessions

### `models.py` — `User` and `UserManager`

Django comes with a built-in `User` model, but we replaced it with our own because we needed:
1. **Email as the login field** instead of username (set via `USERNAME_FIELD = 'email'`).
2. **A `tenant` foreign key** so every user belongs to a company. Superusers have `tenant=null` because they're platform-level accounts, not tied to any one company.

**`UserManager`** is the factory class Django uses when you call `User.objects.create_user(...)`. We had to write our own because we changed the login field to email.

`AUTH_USER_MODEL = 'authentication.User'` in `settings.py` tells Django to use our custom model everywhere (admin, sessions, permissions) instead of the built-in one.

### `repositories.py` — `UserRepository`

Same pattern as the tenancy repository — all user DB queries live here and nowhere else.

| Method | What it does |
|--------|-------------|
| `get_by_id(id)` | Find a user by numeric PK |
| `get_by_email(email)` | Find a user by their email address |
| `get_all_for_tenant(tenant_id)` | Return only users that belong to the given tenant |
| `create_user(...)` | Create a new user, delegating to `UserManager` |

`get_all_for_tenant` is the key isolation method — it's what prevents Tenant A's admin from ever seeing Tenant B's users.

### `services.py` — `AuthService`

This is where the login/logout logic lives.

**`authenticate_user(email, password, request)`**
1. Calls Django's built-in `authenticate()` which checks the email+password against the database.
2. If `authenticate()` returns `None`, it checks whether the account exists but is inactive — that gives a more helpful error message than a generic "invalid credentials".
3. On success, calls `login(request, user)` which writes the user's ID into the server-side session (a row in the `django_session` table). The browser gets a cookie with just a random session key — the real user data stays on the server.

**`logout_user(request)`** — calls Django's `logout()` which deletes the session from the database and clears the cookie.

**`get_current_user(request)`** — returns the logged-in user, or `None` if the request is anonymous.

### `serializers.py`

Two serializers:
- **`LoginSerializer`** — validates the incoming `{email, password}` payload. The password field is `write_only` so it's never echoed back in a response.
- **`UserSerializer`** — shapes the user object that gets returned after login or from the `/me/` endpoint. Deliberately excludes `password`, `is_staff`, `is_superuser` — only safe, read-only fields go to the client.

### `views.py` — Three API views

| View | Endpoint | Method | What it does |
|------|----------|--------|-------------|
| `LoginView` | `/api/auth/login/` | POST | Validates credentials, creates session, returns user data |
| `LogoutView` | `/api/auth/logout/` | POST | Destroys session, returns 204 No Content |
| `MeView` | `/api/auth/me/` | GET | Returns the currently logged-in user's data |

`LoginView` has `AllowAny` permission so unauthenticated users can reach it. The other two require `IsAuthenticated`.

Each view is deliberately thin: it validates input with a serializer, hands off to `auth_service`, and formats the response. No business logic lives here.

### `urls.py`

Three explicit `path()` entries (no router needed since these aren't a standard resource list/detail).

### `tests.py`

Five test classes:

- **`AuthModelTest`** — Tests the custom User model: creation, superuser flags, `__str__`, email uniqueness, empty-email rejection.
- **`UserRepositoryTest`** — Tests all repository methods including the critical `get_all_for_tenant` isolation method.
- **`AuthServiceTest`** — Tests the service in isolation: valid login creates a session entry, wrong password raises `ValueError`, inactive account raises a distinct `ValueError`, logout clears the session. Uses `RequestFactory` with `SessionMiddleware` to simulate a real HTTP request without starting the server.
- **`AuthAPITest`** — End-to-end HTTP tests for all three endpoints and their error paths.
- **`TenantIsolationTest`** — Explicitly tests cross-tenant data leakage: creates users in Tenant A and Tenant B, then verifies the repository never returns the wrong tenant's users.

---

## Settings & URL wiring (`config/`)

**`settings.py` changes:**
- Added `apps.tenancy` and `apps.authentication` to `INSTALLED_APPS`
- Set `AUTH_USER_MODEL = 'authentication.User'`
- Added session cookie settings (`SESSION_COOKIE_AGE`, `SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE`)
- Added the full `REST_FRAMEWORK` block: session auth by default, `IsAuthenticated` as the default permission class, pagination at 25 per page

**`urls.py` changes:**
- `api/` → routes to tenancy URLs (tenants list/detail)
- `api/auth/` → routes to auth URLs (login/logout/me)

---

## How it all fits together

Here's what happens when a user logs in for the first time:

1. The React frontend sends a POST request to `/api/auth/login/` with `{"email": "alice@acme.com", "password": "secret"}`.
2. Django's URL router matches `api/auth/` and passes control to `authentication/urls.py`, which points to `LoginView`.
3. `LoginView` feeds the request body through `LoginSerializer`. If `email` or `password` is missing, it immediately returns a 400 error.
4. The validated email and password are passed to `auth_service.authenticate_user(...)`.
5. `AuthService` calls Django's built-in `authenticate()`, which internally asks the database (via `UserManager`) to find the user by email and check the password hash.
6. If credentials are valid, `AuthService` calls `login(request, user)`. Django writes a new row to the `django_session` table keyed by a random session ID, and sets a `sessionid` cookie on the response.
7. `LoginView` serializes the `User` object with `UserSerializer` (safe fields only — no password) and returns a 200 response with the user's data.

From this point on, every subsequent request from the browser automatically sends the `sessionid` cookie. Django's `SessionAuthentication` (configured in `REST_FRAMEWORK`) reads that cookie, looks up the session in the database, and attaches the corresponding `User` to `request.user`. The `MeView` then just reads `request.user` directly.

When the user logs out, `LogoutView` calls `auth_service.logout_user(request)`, which deletes the session row from the database. The next request with the old cookie finds nothing and gets a 401.

---

## Files created

| File | Layer |
|------|-------|
| `backend/apps/tenancy/models.py` | Models |
| `backend/apps/tenancy/repositories.py` | Repository |
| `backend/apps/tenancy/services.py` | Service |
| `backend/apps/tenancy/serializers.py` | Serializer |
| `backend/apps/tenancy/views.py` | View |
| `backend/apps/tenancy/urls.py` | URLs |
| `backend/apps/tenancy/tests.py` | Tests |
| `backend/apps/tenancy/migrations/0001_initial.py` | Migration |
| `backend/apps/tenancy/migrations/0002_alter_tenant_options.py` | Migration |
| `backend/apps/authentication/models.py` | Models |
| `backend/apps/authentication/repositories.py` | Repository |
| `backend/apps/authentication/services.py` | Service |
| `backend/apps/authentication/serializers.py` | Serializer |
| `backend/apps/authentication/views.py` | View |
| `backend/apps/authentication/urls.py` | URLs |
| `backend/apps/authentication/tests.py` | Tests |
| `backend/apps/authentication/migrations/0001_initial.py` | Migration |
| `backend/config/settings.py` | Config |
| `backend/config/urls.py` | Config |
