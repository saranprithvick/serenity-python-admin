# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.
Read it fully before taking any action.

---

## Project Overview

A **Serenity-inspired multi-tenant admin platform** built with Django + React.
Architectural patterns mirror the Serenity Framework (.NET):
- Feature-based module structure (not flat files)
- Repository → Service → View layering
- String-key permission system (`Module:Action`)
- TenantId-based row-level data isolation

---

## Project State

| Day | Module | Status |
|-----|--------|--------|
| 1 | Project scaffolding (Django + React + PostgreSQL) | ✅ Done |
| 2 | Authentication module | ✅ Done |
| 3 | RBAC (roles, permissions) | ✅ Done |
| 4 | Multi-tenancy middleware + filtering | ✅ Done |
| 5 | Administration UI | ✅ Done |
| 6 | Superuser elevation + Practitioners | ✅ Done |
| 7 | UI transformation | ✅ Done |
| 8 | Rename + Healthcare roles + Role assignment + Sparklines | ✅ Done |
| 9 | Dashboard right panel + Permission toggles + Polish + Expanded seed data | ✅ Done |
| 10 | Login redesign + Patient search + Error pages + Patient detail | ✅ Done |
| 11 | README + Diagrams + Demo flow + Final release | ✅ Done |

**Current task:** Project complete — OrthoMed v1.0.0

Apps under `backend/apps/` are empty skeletons — none are wired into
`INSTALLED_APPS` or `config/urls.py` yet unless the status above says Done.
(`tenancy`, `practitioners`, `patients`, and `administration` are now fully wired and migrated.)

---

## Repository Layout
backend/

├── config/              # Django project package

│   ├── settings.py      # Single settings file (dev), reads from .env

│   ├── urls.py          # Root URL conf (ROOT_URLCONF = config.urls)

│   ├── wsgi.py

│   └── asgi.py

├── apps/

│   ├── tenancy/         # Tenant model + TenantAwareModel base

│   ├── authentication/  # Custom User model, login/logout API

│   ├── administration/  # Users, roles, permissions management

│   └── practitioners/   # Practitioner module (Serenity pattern demo)

├── .env                 # Gitignored — DB credentials, SECRET_KEY

├── requirements.txt

└── manage.py
frontend/

├── src/

│   ├── layouts/         # AppLayout.tsx, Navbar.tsx, Sidebar.tsx

│   ├── modules/         # Feature modules (mirrors backend apps)

│   └── components/      # Shared components (DataGrid, Modal, Form)

├── package.json

└── vite.config.ts
---

## Commands

### Backend (activate venv first)
```bash
source .venv/bin/activate           # from repo root
cd backend

python manage.py runserver          # dev server on :8000
python manage.py makemigrations     # after model changes
python manage.py migrate
python manage.py createsuperuser
python manage.py test               # all tests
python manage.py test apps.authentication  # single app
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # Vite dev server with HMR
npm run build     # tsc -b + vite build (type errors block build)
npm run lint
```

---

## Backend Architecture

### Module Pattern — follow this for EVERY app

Each app under `apps/` contains exactly these files:

| File | Responsibility |
|------|----------------|
| `models.py` | ORM models only. No logic. |
| `repositories.py` | All database queries. No business logic. |
| `services.py` | Business logic. Calls repositories. Never ORM directly. |
| `serializers.py` | DRF serializers. Validation + (de)serialization only. |
| `views.py` | DRF views/viewsets. Thin — call services only. |
| `permissions.py` | DRF permission classes using the string-key system. |
| `urls.py` | App-level URL routing, included from `config/urls.py`. |
| `tests.py` | pytest tests for all layers. |

### Tenancy (CRITICAL — applies to every model)

- `apps/tenancy/` contains the `Tenant` model and `TenantAwareModel` abstract base.
- **Every model that stores tenant data MUST inherit from `TenantAwareModel`.**
- `TenantAwareModel` adds a `tenant` ForeignKey and a custom manager that
  automatically filters by `request.tenant`.
- Every ViewSet must filter querysets by `self.request.tenant`.
- **Tenant middleware** resolves tenant from session and attaches it to `request.tenant`.
- A user from Tenant A must NEVER see data from Tenant B — ever.

### Permission System

Permissions use **string keys** in the format `Module:Action`.

Examples:
Practitioner:View
Practitioner:Create
Practitioner:Update
Practitioner:Delete
Administration:Security

- Do NOT use Django's built-in `app_label.codename` permission system.
- A `Permission` model (added in Day 3) stores these keys.
- `Role` groups permissions. `User` belongs to a `Role`.
- Permission checks happen at the **view level** via custom DRF
  permission classes in each app's `permissions.py`.

### Authentication

- Session-based (not JWT). Django sessions + `SessionAuthentication`.
- `AUTH_USER_MODEL = 'authentication.User'`
- Custom `User` model extends `AbstractBaseUser`.
- `email` is the `USERNAME_FIELD`.
- User has a `tenant` ForeignKey (null=True for superusers).
- Login sets `request.session`, logout flushes it.

### Wiring Up a New App (checklist)

1. Set `AppConfig.name = 'apps.<appname>'` in `apps/<appname>/apps.py`
2. Add `'apps.<appname>'` to `INSTALLED_APPS` in `config/settings.py`
3. `include('apps.<appname>.urls')` in `config/urls.py`
4. Run `makemigrations` + `migrate`

### Configuration

- Settings: `config/settings.py`, reads `.env` via `python-dotenv`
- Database: PostgreSQL — env vars: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `SECRET_KEY` and `DEBUG=True` are dev defaults in settings
- `CORS_ALLOW_ALL_ORIGINS = True` for development
- `REST_FRAMEWORK` settings block not yet added — add it when wiring auth

---

## Frontend Architecture

Vite + React 19 + TypeScript + MUI + React Router v7 + axios.

- `src/layouts/` — App shell (AppLayout, Navbar, Sidebar)
- `src/modules/` — One subfolder per backend app (authentication, practitioners, etc.)
- `src/components/` — Shared UI: DataGrid, Modal, Form wrappers
- `npm run build` runs `tsc -b` first — type errors block the build

---

## Daily Workflow
At the end of each implementation day, run in this order:
1. /daily-summary     → generates docs/daily-logs/day-N-summary.md
2. /update-claude-md  → updates Project State table in this file
3. /git-checkpoint    → commits all work including docs and CLAUDE.md

Never start a new day without completing all three steps.
The Project State table is the single source of truth for
what Claude Code knows about project progress.

---

## Project Complete — OrthoMed v1.0.0

All features implemented and tested. 164 tests passing.

To reset demo data before presentation:
```bash
python manage.py flush --no-input
python manage.py migrate
python manage.py seed_demo_data
```

Demo credentials:
```
superadmin@orthomed.com        / superadmin123
testadmin1@citygeneral.com     / testadmin123
testdoctor1@citygeneral.com    / testdoctor123
testnurse1@citygeneral.com     / testnurse123
testcaretaker1@citygeneral.com / testcaretaker123
testadmin2@metroortho.com      / testadmin123
```

---

## Rules — DO NOT violate these

1. **Never put business logic in views or serializers.** Views call services. That's it.
2. **Never query the ORM directly from a view or service.** All queries go through repositories.
3. **Never use Django's built-in permission system.** Use the string-key `Module:Action` model.
4. **Never create flat files at project root** (`models.py`, `views.py`). Always use the module structure.
5. **Never expose cross-tenant data.** Every queryset must be filtered by tenant.
6. **Never hardcode tenant IDs.** Always resolve from `request.tenant`.
7. **Never add a new pip package without adding it to `requirements.txt`.**
8. **Never modify `apps/tenancy/` without explicit instruction** — it's the foundation everything else depends on.
9. **Always write tests** in `tests.py` alongside any new feature.
10. **Always run `python manage.py migrate`** after any model change before testing.

## Superuser Elevation — Completed Day 6
Superuser (is_superuser=True) can:
- View all users across all tenants (UserViewSet)
- View all practitioners across all tenants (PractitionerViewSet)
- See platform-wide counts on the dashboard (DashboardStatsView)
- Specify a target tenant when creating users and practitioners
- Access all roles via `RoleService.get_all_roles()` (service layer)

Note: `GET /api/administration/roles/` still returns empty for superusers
(no tenant context) — this is the Day 4 API isolation contract and is intentional.
Use `get_all_roles()` at the service layer for explicit cross-tenant role access.

## Revised Plan (Post Mentor Meeting — Day 7)

### Day 8 — Naming Rename + Model Changes
- users → practitioners (AUTH_USER_MODEL change)
- practitioners → patients
- Add user_type field (tenant_admin, staff)
- Add specialisation field on practitioner
- Expand permissions to healthcare set
- Seed healthcare roles: Tenant Admin, Doctor, Nurse, Caretaker
- No default permissions for staff roles (admin assigns dynamically)

### Day 9 — User Creation Flow + Permission Management UI
- user_type selection during creation (not superadmin — that's bootstrap)
- Superadmin creates Tenant Admins via UI
- Tenant Admin creates Staff Members with role selection
- Role assignment atomic with user creation
- Permission management UI: toggle switches per permission per role

### Day 10 — Testing + Presentation
- Full test suite
- seed_demo_data final version
- Architecture diagram
- Demo flow script
- Documentation
- Final PR

## Naming Conventions (FINAL — confirmed by mentor)
- People who LOG IN: Practitioners (table: practitioners,
  was: users)
- Records managed: Patients (table: patients,
  was: practitioners)
- AUTH_USER_MODEL: practitioners.Practitioner
- API routes: /api/practitioners/, /api/patients/
- Permission keys:
  Patient:View, Patient:Create, Patient:Update,
  Patient:Delete, Patient:ViewOwn
  Administration:UserView, Administration:UserCreate,
  Administration:UserUpdate, Administration:UserDelete,
  Administration:RoleView, Administration:RoleCreate,
  Administration:RoleUpdate, Administration:RoleDelete

## Healthcare Roles (FINAL)
Tenant Admin  → all permissions auto-assigned on creation
Doctor        → empty by default, admin assigns
Nurse         → empty by default, admin assigns
Caretaker     → empty by default, admin assigns

## User Type Field
user_type choices: tenant_admin, staff
Superadmin is NOT a user_type — created via management
command only, never through UI.

## Specialisation
Stored as CharField on Practitioner model.
Examples: Orthopaedic Surgeon, Physiotherapist,
General Practitioner, Sports Medicine Specialist.
Affects display only — not permission logic.