# Day 7 Summary — Practitioner Grid + React UI (Dark Mode & Theme System)

**Date:** 2026-07-03
**Branch:** feature/day-06-practitioner-module
**Focus:** Dark mode architecture, font standardisation, tenant filter for superadmin, dashboard polish, full UI theme audit.

---

## What Was Built Today

Day 7 focused entirely on the frontend. No backend models or migrations were changed. The goal was to make the entire React app respond correctly to dark mode, replace the font, and give the superadmin a way to filter records by tenant from any list page.

---

## Files Modified

### `frontend/index.html`

**What it is:** The single HTML page that Vite uses as the entry point.

**What changed:** The Google Fonts `<link>` was updated to load **Plus Jakarta Sans** (weights 400, 500, 600, 700) instead of Inter. This font is more modern and has better weight contrast for a dashboard product.

**Why:** Plus Jakarta Sans was selected after comparing it against Inter and Nunito. It reads cleanly at small sizes (data grid cells, chip labels) while still having a distinctive feel at large headings.

---

### `frontend/src/theme/index.js`

**What it is:** The theme definition file. Every colour, font, border-radius, and component style override lives here.

**What changed — full rewrite:**

Before Day 7, this file exported a single `buildTheme(isDark)` function that was called inside `AppLayout.jsx`. That meant every time the user toggled dark mode, `AppLayout` rebuilt the theme and wrapped its children in a new `ThemeProvider`. Child components never received the new theme through React context because the `ThemeProvider` that owned the theme was itself changing.

Now the file exports four things:

| Export | Purpose |
|--------|---------|
| `lightTheme` | Full MUI theme for light mode — orange primary, white paper, light grey background |
| `darkTheme` | Full MUI theme for dark mode — orange primary, slate paper (`#1E293B`), deep navy background (`#0F172A`) |
| `ColorModeContext` | A React context that carries `{ toggleColorMode, mode }` |
| `useColorMode` | A convenience hook: `const { toggleColorMode, mode } = useColorMode()` |

Both themes share the same `baseTypography` (Plus Jakarta Sans, weights mapped to MUI variants) and `baseComponents` (button border-radius, chip border-radius). Dark theme adds extra overrides for `MuiTextField` input borders so they remain visible on dark backgrounds without being harsh.

**Why structured this way:** Having two pre-built theme objects (not functions) means they can be passed directly to `ThemeProvider` without rebuilding on every render. The context gives any deeply-nested component access to the toggle without prop-drilling.

---

### `frontend/src/main.tsx`

**What it is:** The React root. It mounts the app and wraps it with providers.

**What changed — full rewrite:**

A new `Root` component was added. `Root` owns the `mode` state (`'light' | 'dark'`), reads the initial value from `localStorage` (`orthomed_color_mode`), and computes `colorMode` (the context value) via `useMemo` so the object reference stays stable across renders. It picks `lightTheme` or `darkTheme` based on `mode` and passes whichever is current to `ThemeProvider`.

Think of it like a light switch on the wall of the whole house — everyone inside (every React component) automatically gets the new lighting because the switch is at the top.

```
Root (owns mode state)
 └─ ColorModeContext.Provider   ← supplies { toggleColorMode, mode }
     └─ ThemeProvider (theme = lightTheme | darkTheme)
         └─ CssBaseline
             └─ AuthProvider
                 └─ BrowserRouter
                     └─ App
```

`localStorage` is written inside `setMode`'s updater function, so the preference is preserved across page reloads.

---

### `frontend/src/components/layout/AppLayout.jsx`

**What it is:** The app shell — sidebar, top navbar, and content area.

**What changed:**

- Removed: local `useMemo`, `createTheme`, `ThemeProvider` imports, the `buildTheme` function, the outer `<ThemeProvider>` wrapper, and the `darkMode` boolean state.
- Added: `import { useTheme } from '@mui/material/styles'` and `import { useColorMode } from '../../theme'`.
- Inside the component: `const { toggleColorMode, mode } = useColorMode()` and `const theme = useTheme()`.
- `const isDark = mode === 'dark'` drives the toggle button icon (sun vs. moon) and any one-off `isDark` conditionals needed for the sidebar and navbar gradients.

**Why:** AppLayout no longer owns the theme. It only reads it. All theme propagation comes from the `Root` component in `main.tsx`.

---

### `frontend/src/components/common/TenantFilter.jsx` *(new file)*

**What it is:** A small dropdown component that superadmins can use to filter list pages by tenant. Regular users never see it.

**How it works:**

- Accepts `{ show, selectedTenant, onChange }` props.
- If `show` is falsy, returns `null` immediately — zero DOM overhead for normal users.
- On mount (when `show` is true), fetches `/api/tenants/` and sorts the result by `id`.
- Renders a 240px MUI `Select` with an "All Tenants" option plus one option per tenant.

**How it connects:** The parent page passes `show={isSuperuser}`, tracks `selectedTenant` in local state, and filters the row array before passing it to `DataGrid`. This is client-side filtering — the full list is fetched once and sliced in the browser, which is appropriate at the current data scale.

---

### `frontend/src/components/common/DataGrid.jsx`

**What it is:** The shared table component used by Users, Roles, and Practitioners pages.

**What changed:** Every hardcoded hex colour was replaced with MUI token strings:

| Was | Now |
|-----|-----|
| `bgcolor: '#fff'` | `bgcolor: 'background.paper'` |
| `bgcolor: '#F8FAFC'` (header) | `bgcolor: 'background.default'` |
| `color: '#1e2a3b'` | `color: 'text.primary'` |
| `color: '#6B7280'` (empty state) | `color: 'text.secondary'` |
| `borderColor: '#E2E8F0'` | `borderColor: 'divider'` |
| Alternating row: `#F8FAFC` | `'background.default'` |

MUI resolves these string tokens at render time from whichever theme is currently active, so the grid now switches colours automatically when the theme changes.

---

### `frontend/src/components/common/FormModal.jsx`

**What it is:** The shared modal wrapper used for "Add" and "Edit" forms across all pages.

**What changed:** Title area bottom border and actions area top border switched from hardcoded `#E2E8F0` to `borderColor: 'divider'`. The Cancel button's text colour, border colour, and hover background all use MUI tokens so they adapt to dark mode.

---

### `frontend/src/components/common/ConfirmDialog.jsx`

**What it is:** The confirmation dialog shown before destructive actions (deactivate user/practitioner).

**What changed:** Title `color: 'text.primary'`, message `color: 'text.secondary'`, Cancel button same token treatment as FormModal.

---

### `frontend/src/pages/dashboard/DashboardPage.jsx`

**What it is:** The landing page after login. Shows KPI cards, a trend area chart, and a "by specialisation" donut chart.

**What changed:**

1. **Imported `useTheme`** and derived `isDark`, `gridColor` (`theme.palette.divider`), `tickColor` (`theme.palette.text.secondary`), and `paperColor` (`theme.palette.background.paper`).

2. **KPI cards and section cards:** All `color: '#1A202C'`, `bgcolor: '#fff'`, and `color: '#718096'` replaced with `'text.primary'`, `'background.paper'`, and `'text.secondary'`.

3. **Activity icon backgrounds:** Use `isDark` ternary — `rgba(249,115,22,0.15)` in dark, `#FFF7ED` in light. Translucent backgrounds look correct against the dark paper surface.

4. **Recharts chart strokes and ticks:** `CartesianGrid stroke={gridColor}`, XAxis/YAxis tick `fill: tickColor`. This makes the grid lines and axis labels match the theme.

5. **Donut chart legend fix:** The original `<Legend />` component from recharts was placed inside a fixed-height `ResponsiveContainer`. With three long specialisation labels, the legend overflowed the SVG box and was clipped. The fix:
   - Remove `<Legend />` from recharts entirely.
   - Shrink the `ResponsiveContainer` height from 220px to 170px.
   - Move the donut centre label from `cy="43%"` to `cy="50%"`.
   - Render a custom MUI legend *below* the chart container using `Box` + `Typography`. Each item is a coloured circle + name + count, wrapping naturally in the layout flow.

   This gives full control over font size, line-height, and dark mode colours — recharts' built-in Legend does not respond to MUI theme tokens.

---

### `frontend/src/pages/administration/UsersPage.jsx`

**What it is:** Lists all platform users. Superadmin sees users from all tenants.

**What changed:**
- Added `useTheme`, `isDark`, `TenantFilter` imports.
- Status chip (`Active`/`Inactive`) now uses `isDark` ternary: dark green `#4ADE80` on `rgba(34,197,94,0.15)` background in dark mode; the light-mode values (`#16A34A` on `#DCFCE7`) were invisible on dark card backgrounds.
- Page title and subtitle use `'text.primary'` / `'text.secondary'`.
- `TenantFilter` rendered above the grid with `show={isSuperuser}`.

---

### `frontend/src/pages/administration/RolesPage.jsx`

**What it is:** Lists roles and allows assigning/removing permissions via a side drawer.

**What changed:** Same `useTheme`/`isDark`/status chip/header token treatment as UsersPage. `TenantFilter` is mounted with `show={false}` — the roles API intentionally returns empty for superusers (no tenant context on superuser requests, Day 4 contract). The component renders nothing when `show={false}`.

Drawer components already used `borderColor: 'divider'` and `color: 'text.secondary'` from Day 5, so no changes were needed there.

---

### `frontend/src/pages/practitioners/PractitionersPage.jsx`

**What it is:** Lists practitioner records. Superadmin sees practitioners from all tenants.

**What changed:** Same pattern as UsersPage — `useTheme`, `isDark`, status chip, header, `TenantFilter show={isSuperuser}`.

---

### `frontend/src/pages/administration/PermissionsPage.jsx`

**What it is:** Read-only view of all permission keys, grouped by module in accordions.

**What changed:**
- `AccordionSummary` background: `bgcolor: 'background.default'` (was `#f8fafc`).
- Module name and permission key text: `color: 'text.primary'` (was `#1e2a3b`, replace_all, 2 occurrences).
- Page title and subtitle: `'text.primary'` / `'text.secondary'`.

---

## How It All Fits Together

**Dark mode toggle flow, end to end:**

1. User clicks the sun/moon icon in the top navbar inside `AppLayout`.
2. `AppLayout` calls `toggleColorMode()` from `useColorMode()`.
3. `toggleColorMode` updates `mode` state in the `Root` component (in `main.tsx`) and writes the new value to `localStorage`.
4. React re-renders `Root`. The `theme` variable now points to `darkTheme` instead of `lightTheme`.
5. `ThemeProvider` receives the new theme object and puts it in React context.
6. Every component in the tree that reads the theme — via `useTheme()`, via `sx` string tokens like `'text.primary'`, or via MUI components that automatically read from the theme provider — re-renders with the dark palette values.
7. On next page load, `Root` reads `localStorage` and starts in dark mode immediately — no flash.

**Tenant filter flow, end to end:**

1. Superadmin logs in. `AuthContext` sets `user.is_superuser = true`.
2. UsersPage renders with `isSuperuser = true`, passing `show={true}` to `TenantFilter`.
3. `TenantFilter` mounts, fetches `/api/tenants/`, and populates the dropdown.
4. Superadmin picks "Tenant 2" from the dropdown. `selectedTenant` state in UsersPage becomes `2`.
5. The `rows` prop passed to `DataGrid` is filtered: `users.filter(u => u.tenant_id === 2)`.
6. Grid re-renders showing only that tenant's users. No extra API call is made.

---

## Architectural Decisions

**Why move ThemeProvider to `main.tsx`?**
AppLayout's local `ThemeProvider` created a scoping problem: components outside the layout (e.g., `AuthContext`, modals rendered via portals) did not receive theme updates. Hosting the provider at the root ensures the entire component tree always reads from one source of truth.

**Why keep status chip colours as `isDark` ternaries instead of putting them in the theme?**
MUI's Chip `sx` prop does not have a semantic colour for "success background on dark paper". Adding a custom palette token for this specific chip would add complexity for a two-variant pattern. A local `isDark` ternary is cleaner and self-contained.

**Why client-side tenant filtering?**
The tenant list is small (single-digit count for any reasonable deployment). Fetching the full user/practitioner list and slicing in the browser avoids adding a query parameter to the API, which would need backend changes. If the tenant count grows, the filter can be moved to a URL query param without changing the UI contract.

**Why replace recharts `<Legend>` with custom MUI JSX?**
Recharts renders its legend inside the SVG coordinate space. SVG text and elements do not inherit CSS colours or respond to MUI's theme tokens. A custom MUI legend below the chart gets dark mode for free via `'text.secondary'` and `'text.primary'` tokens, and wraps naturally in the layout without clipping.

---

## What's Next (Day 8)

Per the revised plan confirmed with the mentor:

- Rename `authentication.User` → `practitioners.Practitioner` as `AUTH_USER_MODEL`.
- Add `user_type` field (`tenant_admin` / `staff`) to Practitioner.
- Add `specialisation` CharField (already on the patient model — move/copy to the auth model).
- Rename `apps/practitioners/` → `apps/patients/` (patient records, not login users).
- Create `apps/practitioners/` fresh as the auth user model.
- Expand permission keys to the full healthcare set.
- Seed four roles: Tenant Admin, Doctor, Nurse, Caretaker.
- Reset and recreate migrations (AUTH_USER_MODEL change requires it).
- Update frontend routes and page names to reflect the rename.
