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
| 6 | Practitioner module | 🔄 In progress |

**Current task:** Implement Practitioner module: model, API, serializer, service

Apps under `backend/apps/` are empty skeletons — none are wired into
`INSTALLED_APPS` or `config/urls.py` yet unless the status above says Done.
(`tenancy`, `authentication`, and `administration` are now fully wired and migrated.)

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

## Pending — Superuser Elevation (Day 8)
Superuser (is_superuser=True) must be able to:
- View all users across all tenants
- View all roles across all tenants
- View all tenants via a management screen
- See platform-wide counts on the dashboard
- Specify a target tenant when creating users/roles

Current behaviour: superuser gets empty results (request.tenant = None).
This is a known gap, not a bug. Fix is additive — does not touch
existing tenant isolation logic for regular users.