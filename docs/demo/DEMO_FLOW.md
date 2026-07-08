# OrthoMed — Demo Flow Script

**Target duration:** 12–15 minutes  
**Audience:** Technical mentor / assessor

---

## Before You Start — Setup Checklist

Run these commands in order before opening the browser. Do not skip `flush` — it guarantees a clean, reproducible starting state.

```bash
# Terminal 1 — Backend
source .venv/bin/activate
cd backend
python manage.py flush --no-input
python manage.py migrate
python manage.py seed_demo_data      # prints a credential summary when done
python manage.py runserver

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** in Chrome or Firefox.

Open **DevTools → Network tab** (filter: `Fetch/XHR`) — keep this visible when demonstrating API calls.

**Expected post-seed state:**
| Entity | Count |
|---|---|
| Tenants | 2 (City General Hospital, Metro Orthopaedic Clinic) |
| Practitioners | 12 (1 superadmin + 6 City General + 5 Metro Ortho) |
| Roles | 8 (Tenant Admin, Doctor, Nurse, Caretaker × 2 tenants) |
| Permissions | 13 (`Module:Action` keys) |
| Patients | 50 (25 per tenant, 22 active + 3 inactive each) |

---

## Demo Script

---

### Part 1 — Platform Overview (2 min)

**Login:** `superadmin@orthomed.com` / `superadmin123`

After login lands on the Dashboard. Narrate:

> "This is the platform superadmin — the only account that exists outside any tenant. It can see everything across the whole platform."

**Point at the KPI cards:**
- **12** total practitioners
- **2** tenants
- **50** patients (44 active, 6 inactive)

> "These counts are live — they're computed at query time and scoped by the requesting user's role. The same endpoint returns different numbers depending on who calls it."

**Point at the bar chart** (patient registrations over time) and the right-hand activity feed.

**Navigate to Staff:**

> "Staff grid shows all 11 practitioners across both hospitals. Notice the Tenant column."

- Point out rows from `citygeneral.com` and `metroortho.com` side-by-side
- Use the **tenant filter dropdown** → select **City General Hospital**

> "Filter applied entirely on the frontend — the API already returned all rows the superadmin is allowed to see, and the grid client-filters from there."

---

### Part 2 — Tenant Isolation at the API Level (1 min)

Still on the Staff grid with City General filter active. Click on any request in the **Network tab**.

> "Every API response you see is already tenant-filtered at the database level — not in the view, not in the serialiser, in the Repository layer where the ORM query runs. There's no way to forget the filter because it's baked into `TenantAwareModel.objects`."

Show the `/api/practitioners/` response in the Network tab:
- All `tenant_id` values in the response are the same integer

> "If I were logged in as a City General user, the query would add `WHERE tenant_id = 1` before touching the database. Metro Ortho data never leaves the server."

---

### Part 3 — Tenant Management (2 min)

Still as superadmin, on the Staff page:

**Create a new Tenant Admin:**
- Click **Add Tenant Admin**
- Fill in:
  - Tenant: **City General Hospital**
  - Email: `newadmin@citygeneral.com`
  - Username: `newadmin`
  - First name: `New`, Last name: `Admin`
  - Password: `newadmin123`
- Submit

> "Watch the grid — the new row appears with a purple Tenant Admin chip and a role already assigned. Role assignment is atomic with user creation — it's a single service call, not two separate actions."

Point at the `role_id` in the Network response body.

**Navigate to Roles:**

> "Eight roles — four per tenant. Same names, completely separate permission sets. City General's Doctor role and Metro Ortho's Doctor role are independent rows — one tenant's admin can't accidentally change the other's."

Use the **tenant filter** → show only City General's 4 roles.

---

### Part 4 — Dynamic Permission Allocation (3 min)

Still on Roles (City General filtered). Click the **lock icon** on the **Doctor** row.

> "This drawer is the entire RBAC management UI. No code changes, no deployments — the admin toggles permissions at runtime."

**Point at the permission list:**
- Doctor currently has **4 permissions** across two modules: Patient (View, Create, Update, ViewOwn)
- Administration module: all switches off

> "Doctors can manage patients but have zero access to user or role administration. That's the least-privilege principle enforced at the database layer."

**Toggle off `Patient:Create`:**
- Watch the switch animate and the module counter update from `2 / 5` to `1 / 5`

> "The revoke happened instantly — a DELETE to `/api/administration/roles/3/remove_permission/`. Next time the doctor logs in, their permission set is recomputed from the database."

**Toggle it back on:**
- Counter returns to `2 / 5`

> "And granted again. Fully dynamic. The permission check in `HasPermission` queries `user_roles → role_permissions` on every request — there's no token or cache to invalidate."

**Point at the roles grid** — the Permissions column chip for Doctor now reads `4 / 13` again. The grid updates live without a page refresh.

---

### Part 5 — Tenant Admin View (2 min)

**Logout → Login as:** `testadmin1@citygeneral.com` / `testadmin123`

> "Now I'm the City General Tenant Admin. Same application, completely different data scope."

**Dashboard:**
- KPI cards now show: **6** practitioners, **1** tenant, **25** patients
- No cross-tenant data visible anywhere

> "The dashboard endpoint returns different counts for this user because `request.tenant` resolves to City General. The query literally changes."

**Navigate to Staff:**
- No Tenant column — only City General's 6 users visible
- No Add Tenant Admin button (that's superadmin-only)
- **Add Staff Member** is available (they have `Administration:UserCreate`)

**Create a new staff member:**
- Click **Add Staff Member**
- Fill:
  - User Type: **Staff**
  - Role: **Doctor**
  - Email: `drjones@citygeneral.com`
  - Username: `drjones`
  - First name: `Sarah`, Last name: `Jones`
  - Password: `doctor123`
  - When Doctor is selected, the Specialisation field appears → type `Spinal Surgeon`
  - Password: `doctor123`
- Submit

> "New doctor created with the Doctor role pre-assigned. Sarah now has Patient:View, Patient:Create, Patient:Update, and Patient:ViewOwn — the same four permissions as testdoctor1."

---

### Part 6 — Staff Member View + Permission Boundary (2 min)

**Logout → Login as:** `testdoctor1@citygeneral.com` / `testdoctor123`

**Dashboard:**
> "As a doctor the dashboard is scoped to my hospital. I see patient stats but no staff management counts."

**Navigate to Patients:**
> "I have `Patient:View` — the patients grid loads. 25 records, all City General."

Click **View** on any patient row → Patient detail page:
> "Full patient record — condition, contact details, notes."

Go back. **Search for `Knee`:**
- 4 results appear instantly (Patients 1, 8, 16, 24)
- Point at the debounced input: no button press required

> "Client-side debounce + server-side search. The API call fires 300ms after typing stops."

**Navigate to Administration → Staff** (click in sidebar or navigate directly):

> "Watch what happens when a staff user tries to access an admin-only page."

- The page loads its shell (header renders) but the data call returns **403**
- A red MUI Alert appears inline: *"You do not have permission to view staff members. Contact your administrator."*
- No redirect, no error page — the feedback is in-context

> "This is intentional. Redirecting to a generic error page destroys context. The inline alert tells the user exactly what they can't do and where they are."

**Show in the Network tab:**
- `/api/practitioners/` → 403
- The `HasPermission('Administration:UserView')` check failed because the doctor's role doesn't include that key

**Navigate to Roles:**
- Same pattern: 403 Alert appears inline for `/api/administration/roles/`

---

### Part 7 — Nurse vs Doctor Permission Comparison (1 min)

**Logout → Login as:** `testnurse1@citygeneral.com` / `testnurse123`

**Navigate to Patients:**
- Grid loads (Nurse has `Patient:View`)
- Point at the action column: **no Edit button visible**

> "The Edit button is conditionally rendered based on `hasPermission('Patient:Update')`. Nurses have Update — so it should be visible."

Actually point it out — Nurses do have `Patient:Update` per the seed data.

> "Let me clarify: Doctor has 4 permissions, Nurse has 3 (View, Update, ViewOwn — no Create), Caretaker has 2 (View, ViewOwn only). The Add Patient button won't appear for a Caretaker because they don't have `Patient:Create`."

Log out and log in as `testcaretaker1@citygeneral.com` / `testcaretaker123` to show:
- Patients grid loads (View ✓)
- No Add Patient button (no Create)
- No Edit button visible (no Update)
- No Deactivate button (no Delete)

> "Zero UI clutter for actions they can't perform. `hasPermission()` in the frontend reads from the same permission list that the backend enforces — single source of truth."

---

### Part 8 — UI Polish (30 sec)

Back on any page:

- **Dark mode toggle** (top-right) — switch and back
- **Collapsible sidebar** — click hamburger, sidebar collapses to icons only
- **Resize browser** to ~400px width — hamburger menu appears, sidebar becomes a drawer

> "Responsive by default — MUI's breakpoint system handles it."

---

## Key Talking Points (for Q&A)

| Topic | One-liner |
|---|---|
| Architecture | Repository → Service → View. Views are intentionally dumb — they call one service method. |
| Tenant isolation | `TenantAwareModel` custom manager injects `WHERE tenant_id = X` at the ORM level — not in the view, not in the serialiser. |
| Permission check location | `HasPermission` DRF class runs before any view code executes. A 403 never reaches the service layer. |
| No hardcoded staff permissions | Staff roles have zero permissions by default. Every permission is explicitly assigned by an admin at runtime. |
| Superuser design | Superuser is never created through the UI — only via `createsuperuser` or `seed_demo_data`. It has no `tenant` FK and bypasses all `HasPermission` checks. |
| Self-permission fetch | Staff users can always `GET /api/administration/user-roles/<own_id>/permissions/` — the `CanViewUserPermissions` class allows it regardless of role. |
| 403 inline instead of redirect | Redirecting to `/forbidden` destroys context. An inline Alert is better UX and was the final fix in Day 10. |
| Atomic role assignment | `create_practitioner` and role assignment happen in the same request. There's no window where a user exists without a role. |

---

## Fallback — If Something Breaks

| Problem | Fix |
|---|---|
| Login fails | Check backend is running on :8000 and Vite proxy config points there |
| 403 on patients after login | Check DevTools console for `Loaded permissions: []` — re-run `seed_demo_data` |
| Permissions not toggling | Check Django session cookie is present in Network tab |
| Dashboard shows zeros | Run `python manage.py seed_demo_data` — flush may have left tables empty |
| CSRF error on POST | Hard-refresh the browser to get a fresh `csrftoken` cookie |
