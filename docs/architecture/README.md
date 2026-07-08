# Architecture Diagrams

Three Mermaid diagrams covering the core architectural patterns of OrthoMed.

## How to View

**GitHub** renders `.mmd` files natively — just open any file in the GitHub UI.

**VS Code** — install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) extension, then open the `.mmd` file and press `Cmd+Shift+P → Markdown: Open Preview`.

**Browser** — paste the diagram source into [mermaid.live](https://mermaid.live) for an interactive, shareable render.

---

## Diagrams

### 1. `request-flow.mmd` — End-to-End Request Lifecycle

**Type:** Sequence diagram

Traces a single API call from the moment a user clicks something in the browser, through every Django layer, to the database and back.

Key points shown:

- **Axios** attaches the `sessionid` cookie and `X-CSRFToken` header automatically on every request
- **TenantMiddleware** runs before any view code. It reads the session, looks up the logged-in `Practitioner`, and attaches `request.tenant` from the user's FK — this is the only place tenant resolution happens
- **DRF Permission Check** (`HasPermission`) queries `user_roles` and `role_permissions` to decide whether the requesting user holds the required `Module:Action` key. Superusers bypass this entirely
- The **View** is intentionally thin — it calls one service method and serialises the result. No business logic lives here
- The **Repository** is the only layer that touches the ORM directly. It filters every query by `tenant_id`, enforcing row-level isolation
- The **alt block** shows both paths: 403 (permission denied, inline Alert on frontend) and 200 OK (full response chain)

---

### 2. `database-schema.mmd` — Entity Relationship Diagram

**Type:** ER diagram

Shows all seven tables and how they relate.

| Relationship | Meaning |
|---|---|
| `tenants ──< practitioners` | Every practitioner (login user) belongs to one tenant |
| `tenants ──< roles` | Roles are scoped per tenant — Tenant A's Doctor role is independent of Tenant B's |
| `tenants ──< patients` | Every patient record is owned by exactly one tenant |
| `practitioners ──< user_roles` | A user can hold multiple roles simultaneously |
| `roles ──< user_roles` | Many users can share the same role |
| `roles ──< role_permissions` | A role can be granted any subset of the 13 system permissions |
| `permissions ──< role_permissions` | The same permission can be granted to many roles |

The `permissions` table is **tenant-agnostic** — there is one global set of 13 `Module:Action` keys. Roles are tenant-scoped. The join through `role_permissions` → `user_roles` is what makes the RBAC system work.

---

### 3. `rbac-flow.mmd` — Permission Decision Flowchart

**Type:** Flowchart

Shows the exact decision path the `HasPermission` DRF permission class takes for every API request.

Steps:

1. User logs in → Django creates a session
2. `TenantMiddleware` resolves `request.tenant` on every subsequent request
3. The view's permission class runs first — before any service or repository code
4. **Superuser fast-path:** `is_superuser=True` bypasses all checks (used only for platform administration, never created through the UI)
5. For regular users: look up all `user_roles` entries, collect the flat union of `permissions` across every assigned role, then check whether the required key is in that set
6. **Allowed** → the view proceeds to the service layer
7. **Denied** → 403 returned immediately; the frontend shows an inline MUI `Alert` (no redirect to `/forbidden`)

The 403-as-inline-alert design means staff users can navigate to admin pages and see a clear "you don't have permission" message rather than being ejected to an error page.
