# Day 5 Summary — Administration UI

**Date:** 2026-07-01  
**Theme:** Full user management API (backend) + complete React admin shell + three live administration screens (frontend)

---

## What was built today

Day 5 had two major parts:

1. **Backend** — A complete CRUD API for managing users, added to the existing `apps/authentication/` module.
2. **Frontend** — The entire React application: the auth shell (login, sessions, routing) plus three real administration screens (Users, Roles, Permissions) replacing the placeholder pages.

---

## Backend files

### `backend/apps/authentication/repositories.py`

**What it is:** The data-access layer for the User model. Think of it as the only place in the codebase that's allowed to talk directly to the database about users.

**New methods added today:**

- `get_by_id_for_tenant(user_id, tenant_id)` — Fetches a single user, but only if they belong to the specified tenant. Returns `None` if the user exists but is in a different tenant. This is the safety check that prevents Tenant A from reading Tenant B's users.
- `update_user(user_id, tenant_id, **fields)` — Looks up the user (tenant-scoped), then sets whatever fields were passed (e.g. `first_name`, `is_active`), and saves. Uses `**fields` (a dictionary of keyword arguments) so the same method handles any combination of changes without needing separate methods for each field.
- `deactivate_user(user_id, tenant_id)` — Sets `is_active = False` and saves. Returns `True` on success, `False` if the user wasn't found. **Never deletes the row** — this is called a "soft delete" and means you can always recover the account or audit who existed.

**Why this pattern:** All queries live here so that if Django ever changes its ORM syntax, or if we swap databases, we only change this one file. Views and services never write `User.objects.filter(...)` directly.

---

### `backend/apps/authentication/services.py`

**What it is:** The business-logic layer. It sits between the views (HTTP layer) and the repository (database layer). Think of it as the manager who knows *what* to do but delegates the actual database work to the repository.

**New methods added today:**

- `get_users_for_tenant(tenant_id)` — Asks the repository for all users belonging to a tenant. Returns the queryset.
- `get_user(user_id, tenant_id)` — Retrieves one specific user, tenant-scoped.
- `update_user(user_id, tenant_id, **fields)` — Passes the field updates down to the repository.
- `deactivate_user(user_id, tenant_id)` — Triggers the soft-delete in the repository.

**Why wrap the repository calls?** Today these are thin wrappers, but the service layer is where business rules live. If we later need "only admins can deactivate managers" logic, it goes here — not in the view, not in the repository.

---

### `backend/apps/authentication/serializers.py`

**What it is:** Translators between JSON (what the browser sends) and Python objects (what Django works with). Also validates incoming data.

**New serializers added today:**

- `CreateUserSerializer` — Used when someone POSTs to create a new user. Accepts `email`, `username`, `first_name`, `last_name`, and `password`. The `password` field is marked `write_only=True` so it never gets sent back in the response. The `validate_email` method checks whether the email already exists globally and raises a readable error (instead of letting the database crash with an IntegrityError). The `create` method calls `AuthService.create_user()` and automatically attaches the current request's tenant so the new user lands in the right tenant.

- `UpdateUserSerializer` — Used for PATCH/PUT on an existing user. Only allows editing `first_name`, `last_name`, and `is_active` (the active flag). Email and username are intentionally excluded — those are identity fields that shouldn't be casually changed.

---

### `backend/apps/authentication/views.py`

**What it is:** The HTTP layer — receives requests, calls services, returns responses. One new class was added alongside the existing `LoginView`, `LogoutView`, and `MeView`.

**New class: `UserViewSet`**

A `ModelViewSet` is a Django REST Framework class that handles all standard CRUD operations (list, retrieve, create, update, destroy) automatically. We customise it in four ways:

- **`get_queryset()`** — Returns only users belonging to `request.tenant`. If there's no tenant (e.g. a superuser without a tenant context), returns an empty queryset. This is the tenant isolation enforcement.

- **`get_serializer_class()`** — Returns the right serializer depending on what action is being performed. Creating a user? Use `CreateUserSerializer`. Updating? Use `UpdateUserSerializer`. Reading? Use the full `UserSerializer`.

- **`get_permissions()`** — Returns different permission checks per action. Listing users requires `Administration:UserView`. Creating requires `Administration:UserCreate`. This is the string-key permission system from Day 3 in action at the view level.

- **`create()`** — Overridden to check that a tenant context exists before creating, then uses the serializer to validate and save.

- **`update()`** — Overridden to use `UpdateUserSerializer` for partial updates, then calls `auth_service.update_user()` explicitly (instead of the serializer's default save) so the update goes through the service → repository chain.

- **`destroy()`** — Overridden to block self-deactivation (you can't lock yourself out), then calls `auth_service.deactivate_user()` which does the soft delete. Returns `204 No Content` on success — the same HTTP status as a real delete so the browser doesn't need to know the difference.

---

### `backend/apps/authentication/urls.py`

**What it is:** URL routing for the authentication module.

**What changed:** A `DefaultRouter` was added. A router is Django REST Framework's way of automatically generating all the URLs a ViewSet needs. Registering `UserViewSet` under the name `'users'` automatically creates:

```
GET    /api/auth/users/       → list all users
POST   /api/auth/users/       → create a user
GET    /api/auth/users/<id>/  → retrieve one user
PUT    /api/auth/users/<id>/  → update a user (full)
PATCH  /api/auth/users/<id>/  → update a user (partial)
DELETE /api/auth/users/<id>/  → deactivate a user
```

No need to write those URL patterns by hand.

---

### `backend/apps/authentication/tests.py`

**What it is:** Automated tests that verify the user management API works correctly and safely.

**New test class: `UserManagementAPITest`**

Uses a helper function `_grant_user_permissions` that creates a Role, attaches permissions to it, and assigns the role to a user. This is how we simulate an authenticated admin with specific permissions in tests.

The 9 test cases cover:

| Test | What it checks |
|------|---------------|
| `test_list_users_returns_only_tenant_users` | Tenant A users appear; Tenant B users don't |
| `test_list_users_unauthenticated_returns_401` | Anonymous requests are blocked |
| `test_retrieve_user_own_tenant_returns_200` | Can fetch a user in your tenant |
| `test_retrieve_user_different_tenant_returns_404` | Cannot fetch a user from another tenant |
| `test_create_user_success` | Created user gets the correct tenant and hashed password |
| `test_create_user_duplicate_email_returns_400` | Duplicate email returns a readable 400, not a 500 crash |
| `test_update_user_success` | PATCH updates the correct field |
| `test_destroy_user_soft_deletes` | DELETE sets `is_active=False`, row still exists |
| `test_cannot_deactivate_self` | Trying to deactivate yourself returns 400 |

**Important note on `force_login` vs `force_authenticate`:** The tests use `self.client.force_login(self.admin)` rather than `force_authenticate`. The reason is that `TenantMiddleware` reads the user from the Django session. `force_login` goes through the session middleware and sets everything up correctly. `force_authenticate` bypasses the session entirely, so `request.tenant` would be `None` and all tenant-scoped queries would return empty results.

---

## Frontend files

### `frontend/src/api/axios.js`

**What it is:** A pre-configured HTTP client that all React components use to talk to the Django backend. Think of it as the "phone" every page uses to call the server.

**Key decisions:**

- **No `baseURL`** — all `/api/*` calls are proxied through the Vite dev server to `127.0.0.1:8000`. This makes all requests "same-origin" from the browser's perspective, which is required for session cookies to work. (If we called Django directly from the browser at a different origin, cookies would be blocked.)

- **CSRF interceptor** — Django's session authentication requires a `X-CSRFToken` header on any request that changes data (POST, PUT, DELETE). Django sets a `csrftoken` cookie when you first visit. The interceptor reads that cookie and adds it as a header automatically. Without this, every mutating request would be rejected with a 403 Forbidden.

- **401 interceptor** — If any API call returns "401 Unauthorized" (session expired), the browser is automatically redirected to `/login`. The `/api/auth/me/` and `/api/auth/login/` endpoints are excluded from this redirect — otherwise, checking if you're logged in would redirect you to login in an infinite loop.

**Why the Vite proxy matters:** Setting `changeOrigin: true` in the proxy would rewrite the `Host` header from `localhost:5173` to `127.0.0.1:8000`. Django's CSRF protection compares the `Origin` header (always `localhost:5173`, set by the browser) against the `Host` header. A mismatch means "possible cross-site attack" and Django blocks the request. By omitting `changeOrigin`, `Host` stays as `localhost:5173` and the comparison passes.

---

### `frontend/src/context/AuthContext.jsx`

**What it is:** A React Context that stores who the current user is and provides login/logout functions to any component in the app. Think of it as a "bulletin board" that the whole app can read.

**How it works:**

- On app start, it immediately calls `GET /api/auth/me/` to check whether there's an active session. If Django returns user data, we're logged in. If it returns 401, we're not.
- The `loading` flag is `true` until this first check completes. `ProtectedRoute` watches this flag and shows a spinner instead of redirecting while the check is in progress — preventing the login page from flashing briefly on page load even when the user is already authenticated.
- `login(email, password)` posts credentials and updates the stored user on success.
- `logout()` posts to `/api/auth/logout/` to destroy the Django session, then redirects to `/login`.

---

### `frontend/src/components/common/ProtectedRoute.jsx`

**What it is:** A gatekeeper component. Wrap any page in it and unauthenticated users are redirected to `/login` before the page renders.

**How it works:** Reads `user` and `loading` from `AuthContext`. While loading: show a spinner. Not logged in: redirect to `/login`. Logged in: render the children (the actual page).

---

### `frontend/src/components/layout/AppLayout.jsx`

**What it is:** The outer shell of every protected page. Renders the dark navy sidebar on the left and the white AppBar across the top. The actual page content appears in the middle via React Router's `<Outlet />` component (a placeholder that gets filled with whichever page is currently active).

**Key features:**
- Navigation links highlight the active route using `NavLink` from React Router.
- The page title in the AppBar updates automatically based on the current URL using a `PAGE_TITLES` lookup map.
- The user's email is shown in the sidebar footer and the AppBar.

---

### `frontend/src/components/common/DataGrid.jsx`

**What it is:** A reusable table component used by all three administration screens. Accepts `rows` (data) and `columns` (column definitions) and handles everything else — search, pagination, loading state, empty state, and an optional Add button.

**Column definitions** follow a simple contract: each column has a `field` (the data key to display), a `headerName` (label), a `width`, and an optional `renderCell` function. If `renderCell` is provided, that function renders the cell however it wants (chips, icon buttons, formatted dates). If not, the raw value from the row is displayed.

**Why not MUI X DataGrid?** `@mui/x-data-grid` (the official MUI data table) is a separate package with its own major version. The project uses `@mui/material` v9, and the X DataGrid's latest compatible version requires careful matching. To avoid the dependency risk, this implementation uses MUI core's `Table`, `TableRow`, `TableCell`, and `TablePagination` components — all already installed, fully compatible, and sufficient for the feature set needed.

---

### `frontend/src/components/common/FormModal.jsx`

**What it is:** A reusable popup dialog for create and edit forms. Accepts children (the form fields) and handles the dialog chrome (title, Save/Cancel buttons, loading state).

**Key behaviour:** While saving (`loading=true`), the Cancel button is disabled and the dialog ignores the Escape key and backdrop click, preventing accidental data loss mid-submit.

---

### `frontend/src/components/common/ConfirmDialog.jsx`

**What it is:** A reusable "Are you sure?" dialog. Used before any destructive action (deactivating a user). Accepts a message, a confirm label, and callbacks for confirm/cancel.

---

### `frontend/src/pages/auth/LoginPage.jsx`

**What it is:** The login screen. A centered card with email and password fields.

**Flow:** Submits to `AuthContext.login()`, which POSTs to `/api/auth/login/`. On success, navigates to `/dashboard`. On failure, shows an inline error alert.

---

### `frontend/src/pages/dashboard/DashboardPage.jsx`

**What it is:** The landing page after login. Shows three stat cards: Total Users, Total Roles, and Permissions (hardcoded at 12).

**How it loads data:** On mount, fires two API calls in parallel (`Promise.all`) — one for users count, one for roles count. If either fails (e.g. missing permission), the card shows a "—" dash instead of crashing.

---

### `frontend/src/pages/administration/UsersPage.jsx`

**What it is:** The User Management screen at `/administration/users`.

**What it does:**

1. On mount, fetches `GET /api/auth/users/` and populates a `DataGrid`.
2. **Add User** — clicking the "+ Add User" button opens a `FormModal` with fields for email, username, first/last name, and password. On submit, POSTs to `/api/auth/users/`. On success, closes the modal, shows a Snackbar toast, and refreshes the grid. Validation errors from Django (duplicate email, etc.) are surfaced in an inline Alert inside the modal.
3. **Edit User** — clicking the pencil icon on any row opens a `FormModal` pre-filled with the user's current first name, last name, and active status. On submit, PUTs to `/api/auth/users/<id>/`.
4. **Deactivate** — clicking the person-off icon opens a `ConfirmDialog`. On confirmation, sends `DELETE /api/auth/users/<id>/`, which soft-deletes the user (sets `is_active = False`). The action column only shows the deactivate button for currently active users.

---

### `frontend/src/pages/administration/RolesPage.jsx`

**What it is:** The Role Management screen at `/administration/roles`.

**What it does:**

1. On mount, fetches both `GET /api/administration/roles/` (for the grid) and `GET /api/administration/permissions/` (for the assign-permission dropdown) in parallel.
2. **Add Role** — a `FormModal` with Name and Description fields, POSTs to `/api/administration/roles/`.
3. **Permissions Drawer** — clicking the lock icon on any row opens a 400px-wide slide-out panel from the right (MUI `Drawer` with `anchor="right"`). The drawer fetches `GET /api/administration/roles/<id>/` which returns the role detail including all assigned permissions. Each permission is listed with a delete button. At the bottom, an autocomplete dropdown shows all permissions NOT yet assigned to this role. Clicking "Assign" POSTs to `/api/administration/roles/<id>/assign_permission/`. Clicking the delete button on a permission sends `DELETE /api/administration/roles/<id>/remove_permission/` with the permission ID in the request body. Both actions refresh the drawer immediately so changes are visible in real time.

---

### `frontend/src/pages/administration/PermissionsPage.jsx`

**What it is:** The read-only Permissions screen at `/administration/permissions`.

**What it does:** Fetches `GET /api/administration/permissions/` and groups the results by their `module` field (e.g. "Administration", "Customer"). Renders one MUI `Accordion` per module. Each accordion panel lists the permissions as rows showing the full key in monospace font, an action chip (View/Create/Update/Delete), and optionally a description. The first panel is open by default.

---

### `frontend/src/App.tsx`

**What it is:** The application's routing table. Maps URL paths to page components.

**Structure:**
```
/           → redirect to /dashboard
/login      → LoginPage (no auth required)
/*          → ProtectedRoute wrapping AppLayout
  /dashboard              → DashboardPage
  /administration/users   → UsersPage  ← new today
  /administration/roles   → RolesPage  ← new today
  /administration/permissions → PermissionsPage  ← new today
  /customers              → placeholder
```

The `ProtectedRoute > AppLayout` nesting means AppLayout (sidebar + AppBar) renders once and the inner page content swaps via `<Outlet />` as the user navigates — no full-page reloads.

---

### `frontend/src/main.tsx`

**What it is:** The application entry point. Renders the root React tree with all providers wrapping the app.

**Provider order:**
```
BrowserRouter         — gives the whole app access to URL routing
  ThemeProvider       — MUI theme (colours, fonts, border-radius)
    CssBaseline       — browser CSS reset
      AuthProvider    — user session state for the whole app
        App           — the route tree
```

Order matters: `AuthProvider` must be inside `BrowserRouter` because it uses React Router's navigate function. `ThemeProvider` must wrap everything that uses MUI components.

---

### `frontend/vite.config.ts`

**What it is:** Configuration for the Vite development server.

**The proxy:** Every request to `/api/*` made from `localhost:5173` (the Vite dev server) is forwarded to `http://127.0.0.1:8000` (Django). The browser sees a same-origin response from `localhost:5173`, so cookies are set and read without CORS restrictions.

**The `changeOrigin` omission:** Deliberately not set. See `axios.js` section above for the full explanation. The short version: leaving it out keeps the `Host` header as `localhost:5173` so Django's CSRF check passes.

---

## How it all fits together

### Request flow: Logging in

1. User visits `http://localhost:5173/`. React Router redirects to `/dashboard`.
2. `ProtectedRoute` checks `AuthContext` — `loading` is true (auth check in progress). Shows a spinner.
3. `AuthContext` fires `GET /api/auth/me/`. Vite proxies this to Django at `127.0.0.1:8000`. No active session → 401.
4. `AuthContext` sets `user = null, loading = false`.
5. `ProtectedRoute` sees `user = null`, redirects to `/login`.
6. User fills in email and password, clicks Sign In.
7. `LoginPage` calls `AuthContext.login('admin@demo.com', 'admin123')`.
8. `AuthContext` POSTs to `/api/auth/login/`. The CSRF interceptor in `axios.js` reads the `csrftoken` cookie Django already set and adds `X-CSRFToken` to the request header.
9. Django's `LoginView` validates credentials via `AuthService.authenticate_user()`, which calls `authenticate()` (Django's built-in) and then `login()` which creates a session and sets `Set-Cookie: sessionid=...`.
10. `AuthContext` stores the returned user object. React Router navigates to `/dashboard`.

### Request flow: Viewing the Users page

1. User clicks "Users" in the sidebar.
2. React Router renders `UsersPage` inside `AppLayout > ProtectedRoute`.
3. `UsersPage.useEffect` fires on mount, calls `GET /api/auth/users/`.
4. The `sessionid` cookie is sent automatically (same-origin). Django's `SessionAuthentication` validates the session and identifies the user.
5. `TenantMiddleware` runs: reads `request.user.tenant`, attaches it as `request.tenant`.
6. `UserViewSet.get_queryset()` calls `auth_service.get_users_for_tenant(request.tenant.id)`, which calls `UserRepository.get_all_for_tenant(tenant_id)` — a filtered queryset that only returns users with the same `tenant_id`.
7. DRF serializes the result, paginates it, returns JSON.
8. `UsersPage` stores the `results` array in state. `DataGrid` renders the table.

### Request flow: Deactivating a user

1. Admin clicks the red person-off icon on a row. `UsersPage` sets `deactivateUser = row`.
2. `ConfirmDialog` renders: "Are you sure you want to deactivate user@example.com?"
3. Admin clicks "Deactivate". `handleDeactivate()` fires.
4. `DELETE /api/auth/users/5/` is sent. The CSRF interceptor adds `X-CSRFToken`.
5. `UserViewSet.destroy()` runs. It checks `instance.pk == request.user.pk` — not a self-deactivation, so it proceeds.
6. `auth_service.deactivate_user(5, tenant.id)` → `UserRepository.deactivate_user(5, tenant.id)` → looks up the user filtered by both `pk` AND `tenant_id` (cross-tenant deactivation is impossible) → sets `is_active = False`, saves.
7. Returns `204 No Content`.
8. `ConfirmDialog` closes. Success toast appears. `loadUsers()` refetches the grid.

### Request flow: Assigning a permission to a role

1. Admin clicks the lock icon on a role row. `RolesPage` fires `GET /api/administration/roles/2/` to fetch the role detail with its current permissions.
2. The right-side Drawer opens showing "Assigned (8)" with each permission listed.
3. Admin picks "Customer:View" from the Assign autocomplete (only unassigned permissions appear in the list — filtered client-side by comparing the full permissions list against the already-assigned ones).
4. Admin clicks "Assign". `POST /api/administration/roles/2/assign_permission/` is sent with body `{"permission_id": 9}`.
5. `RoleViewSet.assign_permission()` calls `RoleService().assign_permission_to_role()`, which verifies the role belongs to the current tenant and adds the permission via the `role.permissions.add()` many-to-many relationship.
6. Returns `200 OK`. The drawer immediately refreshes by re-fetching the role detail. The autocomplete now shows one fewer option (Customer:View is gone from the "unassigned" list).

---

## Issues discovered and resolved during verification

| Issue | Root cause | Fix |
|-------|-----------|-----|
| Roles page showed "No records found" | `admin@demo.com` demo account was missing `Administration:Role*` permissions — only `User*` permissions were granted originally | Django shell: added `RoleCreate/Delete/Update/View` to the `AdminRole` role |
| `<Chip>` inside `ListItemText` secondary caused React hydration warning | MUI renders `secondary` as a `<p>` tag; `Chip` renders as a `<div>`; `<p><div>` is invalid HTML | Moved the action `Chip` into the `primary` slot (renders as a `<span>`) alongside the permission key |
| Playwright selector `.MuiDrawer-root` matched two elements | The app has two `Drawer` components: the permanent sidebar (left) and the permissions slide-out (right) | Changed selector to `.MuiDrawer-anchorRight` which only matches the permissions drawer |
| Session cookies blocked by CORS | Axios had a `baseURL` pointing cross-origin; browsers reject `Set-Cookie` on credentialed cross-origin responses when the server sends `Access-Control-Allow-Origin: *` | Removed `baseURL`, added Vite proxy so all API calls are same-origin |
| Logout returned 403 | Vite proxy `changeOrigin: true` rewrote `Host` header, causing Django CSRF origin mismatch | Removed `changeOrigin` from proxy config |
