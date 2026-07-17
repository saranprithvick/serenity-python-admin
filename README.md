# OrthoMed — Enterprise Healthcare Administration Platform

## Overview

OrthoMed is a multi-tenant, role-based access control administrative platform for orthopaedic healthcare organisations. Built with Django REST Framework and React, the architecture is inspired by the [Serenity Framework](https://github.com/volkanceylan/Serenity) — feature-based modules with a strict Repository → Service → View layering, string-key permissions, and tenant-scoped row-level data isolation.

Every user belongs to a tenant. Every API response is filtered by that tenant. A user from Tenant A can never see data from Tenant B.

---

## Key Features

- **Multi-tenant architecture** — complete data isolation per organisation via `TenantAwareModel` and middleware
- **Role-Based Access Control** — dynamic permission allocation using `Module:Action` string keys
- **Three-tier user hierarchy** — Platform Superadmin → Tenant Admin → Staff
- **Healthcare-specific roles** — Doctor, Nurse, Caretaker (permissions assigned by Tenant Admin)
- **Real-time in-app chat** — live clinical discussion threads per patient record using Django Channels and WebSockets (SignalR-equivalent pattern)
- **Real-time dashboard** — KPI cards with sparklines, bar/line/donut charts, activity feed, calendar, and quick actions
- **Patient management** — searchable, filterable grid with full detail pages
- **Dark/light mode** — system-preference aware with manual override toggle
- **Responsive design** — MUI-based layout adapting to desktop, tablet, and mobile

---

## Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| Django 5 | Web framework |
| Django REST Framework | API layer |
| Django Channels 4 | WebSocket support for real-time chat |
| PostgreSQL | Database |
| Python 3.13 | Language |
| Daphne | ASGI server (required for WebSocket support) |

### Frontend

| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| MUI v5 | Component library |
| Recharts | Data visualisation |
| React Router v7 | Routing |
| Axios | HTTP client |

---

## Architecture

### Backend Layer Pattern

```
HTTP Request → View → Service → Repository → Database
WebSocket    → Consumer (Django Channels) → Database
```

Every app under `backend/apps/` follows this exact file structure:

| File | Responsibility |
|---|---|
| `models.py` | ORM models only — no logic |
| `repositories.py` | All database queries — no business logic |
| `services.py` | Business logic — calls repositories, never ORM directly |
| `serializers.py` | DRF serializers — validation and (de)serialisation |
| `views.py` | DRF views — thin layer that calls services only |
| `permissions.py` | Custom DRF permission classes using the string-key system |
| `urls.py` | App-level URL routing |
| `tests.py` | Tests for all layers |

### Apps

| App | Purpose |
|---|---|
| `tenancy` | `Tenant` model, `TenantAwareModel` abstract base, `TenantMiddleware` |
| `practitioners` | Login users (`Practitioner` model), authentication API |
| `administration` | Roles, permissions, RBAC management API |
| `patients` | Patient domain records |
| `chat` | Real-time WebSocket chat per patient record |

### Permission System

Permissions use string keys in the format `Module:Action`:

```
Patient:View          Patient:Create        Patient:Update
Patient:Delete        Patient:ViewOwn

Administration:UserView     Administration:UserCreate
Administration:UserUpdate   Administration:UserDelete
Administration:RoleView     Administration:RoleCreate
Administration:RoleUpdate   Administration:RoleDelete
```

Staff roles (Doctor, Nurse, Caretaker) start with no permissions. The Tenant Admin allocates permissions dynamically via the Roles UI using toggle switches — no code changes required.

### Real-Time Chat Architecture

```
Browser (React)
    │  WebSocket ws://localhost:8000/ws/chat/patient/<id>/
    │
Daphne (ASGI Server)
    │
Django Channels
    │
PatientChatConsumer
    │  Authenticates via session key query param
    │  Verifies tenant isolation before accepting
    │
In-Memory Channel Layer
    │  Broadcasts messages to all connected staff
    │
PostgreSQL
    └─ PatientChatMessage (persisted history)
```

---

## Database Schema

| Table | Key Columns |
|---|---|
| `tenants` | `id`, `name`, `slug`, `is_active`, `created_at` |
| `practitioners` | `id`, `tenant_id`, `email`, `username`, `first_name`, `last_name`, `user_type` (`tenant_admin` \| `staff`), `specialisation`, `is_active`, `is_superuser` |
| `roles` | `id`, `tenant_id`, `name`, `description`, `is_active`, `created_at` |
| `permissions` | `id`, `key` (unique), `module`, `action`, `description` |
| `role_permissions` | `id`, `role_id`, `permission_id` |
| `user_roles` | `id`, `user_id`, `role_id` |
| `patients` | `id`, `tenant_id`, `first_name`, `last_name`, `email`, `phone`, `specialisation`, `city`, `country`, `address`, `notes`, `is_active`, `created_at` |
| `chat_messages` | `id`, `tenant_id`, `patient_id`, `sent_by_id`, `message`, `sent_at`, `is_read` |

---

## Setup Instructions

### Prerequisites

- Python 3.13+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
# Clone repository
git clone <repo-url>
cd serenity-python-admin

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Configure environment — create backend/.env with the following keys:
# DB_NAME=orthomed
# DB_USER=postgres
# DB_PASSWORD=yourpassword
# DB_HOST=localhost
# DB_PORT=5432
# SECRET_KEY=your-secret-key

# Run migrations
python manage.py migrate

# Seed demo data (creates tenants, roles, and demo users)
python manage.py seed_demo_data

# Start server
# Option A — Standard HTTP only (no chat):
python manage.py runserver

# Option B — Full ASGI with WebSocket support (required for live chat):
daphne -b 127.0.0.1 -p 8000 config.asgi:application
```

> **Note:** The live chat feature requires daphne. The standard `runserver` command does not support WebSocket connections.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173`.

---

## Demo Credentials

| Role | Email | Password | Access |
|---|---|---|---|
| Platform Superadmin | superadmin@orthomed.com | superadmin123 | All tenants, all data |
| Tenant Admin (City General) | testadmin1@citygeneral.com | testadmin123 | City General Hospital only |
| Doctor | testdoctor1@citygeneral.com | testdoctor123 | Patient:View / Create / Update + Live Chat |
| Nurse | testnurse1@citygeneral.com | testnurse123 | Patient:View / Update + Live Chat |
| Caretaker | testcaretaker1@citygeneral.com | testcaretaker123 | Patient:View + Live Chat |
| Tenant Admin (Metro Ortho) | testadmin2@metroortho.com | testadmin123 | Metro Ortho Clinic only |

---

## API Endpoints

### Authentication

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/api/practitioners/auth/login/` | No | Login |
| POST | `/api/practitioners/auth/logout/` | Yes | Logout |
| GET | `/api/practitioners/auth/me/` | Yes | Current user profile |
| GET | `/api/practitioners/auth/dashboard-stats/` | Yes | KPI counts |
| GET | `/api/practitioners/auth/dashboard-chart-data/` | Yes | Chart data |
| GET | `/api/practitioners/auth/recent-activity/` | Yes | Activity feed |

### Practitioners (Staff)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/api/practitioners/` | `Administration:UserView` | List staff members |
| POST | `/api/practitioners/` | `Administration:UserCreate` | Create staff member |
| GET | `/api/practitioners/<id>/` | `Administration:UserView` | Get staff member |
| PUT | `/api/practitioners/<id>/` | `Administration:UserUpdate` | Update staff member |
| DELETE | `/api/practitioners/<id>/` | `Administration:UserDelete` | Deactivate staff member |

### Patients

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/api/patients/` | `Patient:View` | List patients |
| POST | `/api/patients/` | `Patient:Create` | Create patient |
| GET | `/api/patients/<id>/` | `Patient:View` | Patient detail |
| PUT | `/api/patients/<id>/` | `Patient:Update` | Update patient |
| DELETE | `/api/patients/<id>/` | `Patient:Delete` | Deactivate patient |

### Administration

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/api/administration/roles/` | `Administration:RoleView` | List roles |
| POST | `/api/administration/roles/` | `Administration:RoleCreate` | Create role |
| GET | `/api/administration/roles/<id>/` | `Administration:RoleView` | Role with permissions |
| POST | `/api/administration/roles/<id>/assign_permission/` | `Administration:RoleUpdate` | Grant permission to role |
| DELETE | `/api/administration/roles/<id>/remove_permission/` | `Administration:RoleUpdate` | Revoke permission from role |
| GET | `/api/administration/permissions/` | `Administration:RoleView` | List all permissions |
| GET | `/api/administration/user-roles/<id>/roles/` | `Administration:UserView` | Get user's roles |
| GET | `/api/administration/user-roles/<id>/permissions/` | Self or `Administration:UserView` | Get user's permissions |
| POST | `/api/administration/user-roles/assign/` | `Administration:UserUpdate` | Assign role to user |
| DELETE | `/api/administration/user-roles/remove/` | `Administration:UserUpdate` | Remove role from user |

### Chat

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `WS` | `/ws/chat/patient/<id>/` | Yes (session key) | WebSocket — live chat per patient |
| GET | `/api/chat/patients/<id>/messages/` | `Patient:View` | Retrieve chat history |

---

## Running Tests

```bash
cd backend
source ../.venv/bin/activate
python manage.py test --verbosity=2
```

The test suite covers model constraints, repository isolation, service-layer logic, permission enforcement, tenant isolation, WebSocket chat, and API endpoints across all five apps.

---

## Production Considerations

| Concern | Current (Dev) | Production Recommendation |
|---|---|---|
| Channel Layer | In-Memory | Redis (`channels-redis`) |
| ASGI Server | Daphne | Daphne or Uvicorn behind Nginx |
| Database | Local PostgreSQL | Managed PostgreSQL (RDS, Supabase) |
| Static Files | Vite dev server | `npm run build` + Nginx |
| Secret Key | `.env` file | Environment variable / secrets manager |