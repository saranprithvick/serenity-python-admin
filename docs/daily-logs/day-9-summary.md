# Day 9 Summary — User Creation Flow + Permission Management UI

**Date:** 2026-07-07  
**Branch:** main (uncommitted — Day 9 in progress)  
**Focus:** Server-side patient search and filtering, custom 404/403 error pages with OrthoMed branding, a full patient detail page at `/patients/:id`, and axios interceptor upgrades for automatic error redirects.

---

## What Was Built Today

Day 9 added three separate features in sequence, each building on the last.

**Feature 1 — Patient Search & Filter (Backend + Frontend)**  
Previously the patients list loaded all records and offered no way to narrow them down. This feature wired up Django's `django-filter` and DRF's `SearchFilter` and `OrderingFilter` so the database does the filtering server-side, keeping the response small. The frontend got a search bar (with a 300 ms typing delay so it doesn't fire on every keystroke), a status toggle (All / Active / Inactive), a clear button, and a live patient count.

**Feature 2 — Custom Error Pages**  
Any unknown URL or permission error previously showed a blank screen or the browser's default grey error page. Two full-page, branded error components now replace those: a "Page Not Found" (404) page and an "Access Denied" (403) page, both matching the OrthoMed orange-and-white theme. The axios API client was updated so any 403 response from the backend automatically redirects the whole browser to the Forbidden page, catching permission errors before they surface as confusing raw messages.

**Feature 3 — Patient Detail Page**  
Clicking a patient in the list now navigates to a dedicated detail page (`/patients/25`, for example) instead of popping open an edit modal immediately. The detail page shows everything about a patient in four cards — contact information, clinical notes, record metadata, and quick actions. The backend's `retrieve` action was upgraded to return the human-readable tenant name alongside the patient data, which the superadmin can see.

---

## Files Modified or Created

---

### `backend/requirements.txt`

**What it is:** The list of Python packages the project depends on — like a shopping list that tells `pip` exactly what to install.

**What changed:** Added `django-filter==25.2`. This is a third-party library that teaches Django REST Framework how to filter querysets using URL query parameters (e.g. `?is_active=true`). Without it, DRF has no way to translate `is_active=true` in the URL into a proper database `WHERE is_active = TRUE` query.

---

### `backend/config/settings.py`

**What it is:** The central Django configuration file. Every installed app, database connection, and framework setting is declared here.

**What changed — two additions:**

1. `'django_filters'` added to `INSTALLED_APPS`. Django needs to know the app exists before it can use any of its features. Think of it like registering a plugin before you can use it.

2. `DEFAULT_FILTER_BACKENDS` added to the `REST_FRAMEWORK` block. This tells DRF which filtering engines to apply globally to every ViewSet. By listing all three backends here, every ViewSet in the project gets search, filter, and ordering for free — no need to declare them on each ViewSet individually (although you still declare *which fields* are searchable/filterable per ViewSet).

```python
'DEFAULT_FILTER_BACKENDS': [
    'django_filters.rest_framework.DjangoFilterBackend',  # ?field=value filtering
    'rest_framework.filters.SearchFilter',                # ?search=term full-text
    'rest_framework.filters.OrderingFilter',              # ?ordering=field sorting
],
```

---

### `backend/apps/patients/views.py`

**What it is:** The Django REST Framework ViewSet that handles all HTTP requests for the Patient resource — list, retrieve, create, update, and deactivate.

**What changed:**

**New class attributes on `PatientViewSet`:**

```python
filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
filterset_fields = ['is_active']
search_fields = ['first_name', 'last_name', 'specialisation', 'city', 'email']
ordering_fields = ['created_at', 'last_name', 'first_name']
ordering = ['-created_at']
```

Think of these like telling the ViewSet "here is the list of columns the user is allowed to filter, search, and sort by." The `ordering = ['-created_at']` means newest patients appear first by default (the minus sign means descending).

**`list()` method fix:** The old code called `_service.get_patients(request)` directly, bypassing the filter pipeline entirely. The fix changes it to `self.filter_queryset(self.get_queryset())`. DRF's `filter_queryset` is the gate that runs every filter backend in sequence — without calling it, the `?search=knee` parameter in the URL would be silently ignored.

**`retrieve()` method upgrade:** Now uses `PatientDetailSerializer` instead of `PatientSerializer`. The detail serializer includes the tenant's name (e.g. "City General Hospital") which is used by the frontend detail page.

---

### `backend/apps/patients/serializers.py`

**What it is:** DRF serializers define how Python objects (Patient model instances) are converted to/from JSON.

**What changed:** Added `PatientDetailSerializer`, which extends the existing `PatientSerializer`:

```python
class PatientDetailSerializer(PatientSerializer):
    tenant_name = serializers.SerializerMethodField()

    class Meta(PatientSerializer.Meta):
        fields = PatientSerializer.Meta.fields + ['tenant_name']

    def get_tenant_name(self, obj):
        return obj.tenant.name if obj.tenant else None
```

**Why a separate serializer?** The list endpoint (`GET /api/patients/`) returns many records and doesn't need the tenant name (it's implied by the session). The detail endpoint (`GET /api/patients/25/`) returns one record and the frontend needs the tenant name for the superadmin header. Rather than always including `tenant_name` in every list response (which would hit the database once per row), we only include it for single-record fetches. This is a performance pattern called "list serializer vs. detail serializer."

The `SerializerMethodField` is how DRF lets you add fields that aren't direct model columns — you write a Python method (`get_tenant_name`) and DRF calls it for each object.

---

### `backend/apps/patients/tests.py`

**What it is:** The automated test file for the patients app. All tests in this file run against a temporary test database that is created fresh for each test run and thrown away afterwards.

**What changed:** Added `PatientSearchTest` class with 11 new tests covering the search/filter functionality:

| Test | What it checks |
|------|---------------|
| `test_search_by_first_name_returns_match` | `?search=Alice` returns Alice, not Bob |
| `test_search_by_last_name` | `?search=Jones` returns the Jones patient |
| `test_search_by_specialisation` | `?search=Knee` returns patients with "Knee" in their condition |
| `test_search_by_city` | `?search=Manchester` returns only the Manchester patient |
| `test_filter_active_only` | `?is_active=true` excludes inactive patients |
| `test_filter_inactive_only` | `?is_active=false` returns only inactive patients |
| `test_combined_search_and_filter` | `?search=London&is_active=true` applies both at once |
| `test_ordering_by_first_name` | `?ordering=first_name` returns results in A-Z order |
| `test_search_respects_tenant_isolation` | Searching "Alice" as Tenant A never returns Tenant B's Alice |
| `test_empty_search_returns_all_tenant_patients` | `?search=` with no term returns all 3 patients |
| `test_no_results_returns_empty_list` | `?search=xyznotfound` returns `count: 0` and empty array |

The tenant isolation test is the most important one: it proves that search doesn't accidentally leak data across tenants.

---

### `frontend/src/pages/patients/PatientsPage.jsx`

**What it is:** The React page component that renders the patients list table, the Add Patient form, the Edit modal, and the Deactivate confirmation dialog.

**What changed:**

1. **Search bar added** — a `TextField` input at the top of the list. Typing into it updates `searchQuery` state immediately, but a `useEffect` with a 300 ms `setTimeout` delays updating `debouncedSearch`. Only when `debouncedSearch` changes does the API call fire. This delay (called "debouncing") prevents a new network request on every single keypress.

2. **Status filter toggle** — a `ToggleButtonGroup` with three buttons: All / Active / Inactive. Selecting one sets `statusFilter` state, which triggers a reload with `?is_active=true` or `?is_active=false` appended to the API URL.

3. **Clear button** — appears only when a search or filter is active. Clicking it resets both `searchQuery` and `statusFilter` to their defaults.

4. **Patient count label** — shows "25 patients" normally, or "Showing 3 of 25 patients" when the API returns fewer results than the total.

5. **`loadPatients()` redesigned** — now builds a `URLSearchParams` object with the current search and filter values, and appends them to the `/api/patients/` URL before fetching. Also stores `res.data.count` (the server's total matching count) in `apiTotal` state.

6. **Clickable patient name** — the `full_name` column now has a `renderCell` function that wraps the name in a blue `Typography` element. Clicking it navigates to `/patients/:id`.

7. **View icon** — `VisibilityIcon` added as the first action button in the Actions column. It also navigates to `/patients/:id`.

8. **`useNavigate` hook** added from React Router so the component can programmatically change the URL.

---

### `frontend/src/pages/patients/PatientDetailPage.jsx`

**What it is:** A brand-new React page component — the "profile page" for a single patient, shown at the URL `/patients/25` (or whatever the patient's ID is).

**Key state managed:**
- `patient` — the full patient object fetched from the API
- `loading` — controls whether to show the spinner or the content
- `editOpen` — whether the edit modal is open
- `editForm` — the current values in the edit form fields
- `deactivateOpen` — whether the deactivate confirmation dialog is showing

**On mount:**  
`useEffect` calls `loadPatient()`, which fetches `GET /api/patients/:id/`. If the server responds with 404 (patient doesn't exist or belongs to another tenant), the component calls `navigate('/not-found', { replace: true })` — the `replace: true` means this URL won't appear in the browser's history, so hitting the back button won't loop back to the broken URL.

**Layout — three visual sections:**

*Section 1 — Header card:*  
An orange circle avatar showing the patient's initials (first letter of first name + first letter of last name), their full name in large bold text, a chip showing their condition (or "No condition recorded"), and buttons to Edit or Deactivate.

*Section 2 — Two-column information grid:*  
Left column (wider) holds the Contact Information card (email, phone, city/country, address — each showing "Not provided" in grey if empty) and the Clinical Notes card. Right column (narrower) holds the Record Details card (ID, created date, last updated date, status chip) and the Quick Actions card (three full-width buttons).

*Section 3 — Edit Modal & Confirm Dialog:*  
The same `FormModal` and `ConfirmDialog` components used in `PatientsPage`, pre-populated with the patient's current data. On successful save, `loadPatient()` is called again — this refreshes the page content in place without navigating away.

**Helper functions:**

- `getInitials(name)` — splits a full name and returns the first letter of each part (e.g. "Alice Smith" → "AS")
- `formatDate(iso)` — converts an ISO datetime string like `"2026-07-07T10:30:00Z"` into a readable date like `"7 Jul 2026"`
- `sectionHeader(icon, title)` — a regular JavaScript function (not a React component) that returns JSX for the orange-icon + bold-title pattern shared by all four cards. Using a function instead of a component prevents React from re-mounting the DOM every render.

---

### `frontend/src/pages/errors/NotFoundPage.jsx`

**What it is:** The custom "Page Not Found" page shown when a user navigates to a URL that doesn't exist.

**Layout:** Completely outside the app shell (no sidebar, no header). Centred vertically and horizontally on a light grey background. Shows:
- Giant "404" text in an orange gradient (using `-webkit-background-clip: text` — a CSS trick that makes a gradient show through the text shape)
- A `SearchOffIcon` below it (the magnifying glass with an X)
- "Page Not Found" heading and a one-line subtitle
- Two buttons: "Go to Dashboard" (orange, filled) and "Go Back" (grey, outlined)
- The OrthoMed logo in faded grey at the very bottom

**Why it exists:** Before today, navigating to any URL the React Router didn't recognise (e.g. `/typo`) would silently render nothing. React Router's "catch-all" route (`path="*"`) now maps those URLs to this component.

---

### `frontend/src/pages/errors/ForbiddenPage.jsx`

**What it is:** The custom "Access Denied" page shown when the user tries to access something they don't have permission to see.

**Layout:** Identical structure to `NotFoundPage` with two differences:
- Shows "403" instead of "404"
- Uses `LockIcon` instead of `SearchOffIcon`
- Heading is "Access Denied" and the subtitle mentions contacting an administrator

**Why it exists:** Before today, a 403 response from the API would either be swallowed silently or shown as a raw error message. Now there is a clear, branded page telling the user what happened and what to do next.

---

### `frontend/src/components/common/ProtectedRoute.jsx`

**What it is:** A wrapper component that guards routes behind authentication. Any route wrapped in `<ProtectedRoute>` will redirect to `/login` if the user isn't logged in.

**What changed:** Added an optional `requiredPermission` prop. If provided, the component calls `hasPermission(requiredPermission)` (from the auth context). If the user lacks that permission, it renders `<ForbiddenPage />` inline — the browser URL stays the same (no redirect), but the user sees the access denied page.

```jsx
if (requiredPermission && !hasPermission(requiredPermission)) {
  return <ForbiddenPage />
}
```

This prop isn't wired to any specific route yet — it's infrastructure for Day 10, when individual admin pages can be locked down per-permission with one line: `<ProtectedRoute requiredPermission="Administration:UserView">`.

The `= undefined` default value on the prop is required by TypeScript: without it, TypeScript infers the prop as required, causing a type error in `App.tsx` where most `<ProtectedRoute>` usages don't pass the prop.

---

### `frontend/src/api/axios.js`

**What it is:** The shared HTTP client used by every component in the app. It wraps axios with two interceptors (functions that run on every request/response) to handle cross-cutting concerns like CSRF tokens and authentication errors.

**What changed in the response interceptor:**

Before today, only 401 (session expired) was handled — it redirected to `/login`. Now 403 (permission denied) is also handled — it redirects to `/forbidden`.

The logic skips the `/auth/me/` and `/auth/login/` endpoints deliberately. These endpoints legitimately return 401 at expected times (when checking if a session exists at startup, or when login credentials are wrong), so they need to be handled by the components that call them, not globally redirected.

```javascript
if (status === 401) {
    window.location.href = '/login'     // session expired
} else if (status === 403) {
    window.location.href = '/forbidden' // no permission
}
```

Note: 404 errors are *not* globally redirected. The reason is that many components (like `handleDeactivate` in PatientsPage) expect to receive a 404 and handle it with a toast message. Globally redirecting 404s would hijack those error flows. The detail page handles its own 404 locally, and React Router's `*` catch-all handles unknown URLs at the router level.

---

### `frontend/src/App.tsx`

**What it is:** The top-level routing file. It maps URLs to page components using React Router's `<Route>` declarations.

**What changed — two new routes added:**

```tsx
<Route path="/forbidden" element={<ForbiddenPage />} />
```
Placed *outside* the `ProtectedRoute` wrapper, so the Forbidden page is accessible even when not logged in. (A user who gets logged out mid-session and then has their browser redirect to `/forbidden` should still see the branded page, not get redirected to `/login` again.)

```tsx
<Route path="/patients/:id" element={<PatientDetailPage />} />
```
Placed *inside* the `ProtectedRoute` wrapper because you must be logged in to view patient data. The `:id` part is a URL parameter — React Router captures whatever number appears there and makes it available inside the component via `useParams().id`.

```tsx
<Route path="*" element={<NotFoundPage />} />
```
The catch-all route. The `*` means "any URL not matched by anything above." Placed last because React Router tries routes in order — if it matched `*` first, no other route would ever run.

---

### `backend/apps/verification/day09_tests.py`

**What it is:** An independent verification test file (separate from the per-app `tests.py` files) that tests Day 9 features from a higher level.

**Three test classes:**

`PermissionToggleTests` — tests the toggle-permission endpoint added to `PractitionerViewSet`:
- Assigning a permission to a role via POST returns 200 with updated count
- Removing it again removes it from the role
- A user from the wrong tenant gets 404 (cannot see other tenant's roles)
- The permission count updates correctly after each toggle

`TenantAdminCreationTests` — tests user creation hierarchy:
- A superadmin can create a new Tenant Admin user for a specific tenant
- A Tenant Admin can create a Staff Member with a role assignment in one atomic operation

`DataVolumeTests` — tests the seeded demo data at scale:
- 50 patients total across both tenants (25 each)
- 3 inactive patients per tenant
- Doctor/Nurse/Caretaker roles have the correct permission counts
- Each tenant has 4 roles (Tenant Admin, Doctor, Nurse, Caretaker)
- All 12 seeded practitioners (6 + 5 + 1 superadmin) exist

---

## How It All Fits Together

### Patient Search Request Flow

1. User types "knee" in the search box on the Patients page.
2. After 300 ms of no more typing, `debouncedSearch` state updates to `"knee"`.
3. The `useEffect([debouncedSearch, statusFilter])` fires, calling `loadPatients()`.
4. `loadPatients()` builds the URL `/api/patients/?search=knee` and calls `api.get(...)`.
5. The axios request interceptor adds the CSRF token header before the request leaves the browser.
6. Vite's dev proxy forwards the request to Django on port 8000.
7. Django's `TenantMiddleware` attaches the patient's tenant to `request.tenant`.
8. `PatientViewSet.list()` calls `self.filter_queryset(self.get_queryset())`.
9. `get_queryset()` calls `PatientService.get_patients(request)`, which returns a queryset already filtered to the current tenant.
10. `filter_queryset()` runs that queryset through each filter backend in order:
    - `DjangoFilterBackend` checks `?is_active=` (none here, so no change)
    - `SearchFilter` sees `?search=knee` and adds `WHERE (first_name ILIKE '%knee%' OR last_name ILIKE '%knee%' OR specialisation ILIKE '%knee%' OR city ILIKE '%knee%' OR email ILIKE '%knee%')` to the SQL
    - `OrderingFilter` checks `?ordering=` (none, so uses the default `-created_at`)
11. The filtered queryset is paginated (25 per page) and serialized with `PatientSerializer`.
12. Django returns `{"count": 4, "results": [...]}`.
13. The frontend stores results in `patients` state, `4` in `apiTotal` state.
14. The count label renders "Showing 4 of 4 patients" (or "4 patients" if no active filter).
15. The DataGrid renders the filtered rows.

### Patient Detail Page Navigation Flow

1. User clicks the blue "Test Patient25" name link in the grid.
2. React Router's `navigate('/patients/25')` fires.
3. React Router matches the `/patients/:id` route and renders `PatientDetailPage` inside the `AppLayout`.
4. On mount, `useEffect([id])` calls `loadPatient()`.
5. `loadPatient()` calls `api.get('/api/patients/25/')`.
6. `PatientViewSet.retrieve()` calls `PatientService.get_patient(25, request)`.
7. The service checks tenant isolation: if the patient belongs to a different tenant and the user isn't a superadmin, it returns `None`.
8. If `None`, the view returns HTTP 404. The frontend catches this and calls `navigate('/not-found', { replace: true })`.
9. If found, the view serializes with `PatientDetailSerializer`, which includes all patient fields plus `tenant_name` (looked up from `patient.tenant.name`).
10. The frontend stores the patient object in state and renders the four-card layout.

### 403 Error Redirect Flow

1. A user manually navigates to `/patients` but their role doesn't have `Patient:View` permission.
2. The browser renders `PatientsPage`, which fires `api.get('/api/patients/')` on mount.
3. DRF's `HasPermission('Patient:View')` check fails and Django returns HTTP 403.
4. The axios response interceptor catches the 403 before `PatientsPage` can handle it.
5. Since the URL is not an auth endpoint, the interceptor runs `window.location.href = '/forbidden'`.
6. The browser navigates to `/forbidden`, which React Router maps to `ForbiddenPage`.
7. The user sees the branded 403 page with a "Go to Dashboard" button.

---

## Test Results

```
backend/apps/patients/tests.py — 38 tests, 0 failures
  PatientModelTest        (4 tests)  ✓
  PatientRepositoryTest   (7 tests)  ✓
  PatientServiceTest      (4 tests)  ✓
  PatientAPITest          (8 tests)  ✓
  PatientTenantIsolationTest (4 tests) ✓
  PatientSearchTest      (11 tests)  ✓  ← new today
```

## Browser Verification

Verified with Playwright (headless Chromium) as `testadmin1@citygeneral.com`:

| Check | Result |
|-------|--------|
| `/random-url` → 404 page with gradient text | ✓ |
| `/forbidden` → 403 page with lock icon | ✓ |
| Patients list shows View icon + blue clickable names | ✓ |
| Clicking View → `/patients/25` detail page | ✓ |
| Breadcrumb shows "Patients / Test Patient25" | ✓ |
| All 4 cards render (Contact, Notes, Record, Actions) | ✓ |
| "Not provided" shown for empty address field | ✓ |
| "Back to Patients" returns to `/patients` | ✓ |
| `/patients/99999` → redirects to 404 page | ✓ |
| Both error pages mobile-responsive at 390px | ✓ |
