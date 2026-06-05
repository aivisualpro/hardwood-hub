# Workspace Permission Fix — AI Agent Prompts

Run these in order. Each is self-contained. Don't skip 1–3; they are the root cause.

---

## Prompt 1 — Let non-admins READ the workspace list (root cause)

```
In server/api/workspaces/index.ts the GET branch runs requireAdmin(event), so every
non-admin user gets a 403 when the sidebar/usePermissions fetch the workspace list. As a
result their permissions never load and they fall back to full access.

Fix: only POST/PUT/DELETE should require admin. GET must be readable by any authenticated
user. In server/api/workspaces/index.ts, remove the top-level requireAdmin(event) call and
move requireAdmin(event) INSIDE the `if (event.method === 'POST')` branch only. In
server/api/workspaces/[id].ts, keep requireAdmin(event) for PUT and DELETE but it must NOT
block GET (add a GET branch that returns the single workspace for any authenticated user, or
leave GET unhandled if unused). Remove the unused requireManager imports in both files.

Verify: log in as a non-admin (position "Crew member") and confirm GET /api/workspaces returns
200 with data, and POST/PUT/DELETE still return 403 for that user.
```

---

## Prompt 2 — Make permission resolution FAIL CLOSED (security)

```
The permission system currently fails OPEN. When no workspace resolves, app/composables/
usePermissions.ts defaults to { allowedMenus: ['*'], menuPermissions: {} } and
app/components/layout/AppSidebar.vue falls back to a team with allowedMenus: ['*']. So any
load error silently grants full access to everything.

Fix both to fail closed for non-admins:
- In usePermissions.ts, change the fallback so that if the user has an assigned workspace
  (user.value.workspace) but it cannot be found, return { allowedMenus: [], menuPermissions: {} }
  (deny), NOT ['*']. Only treat a user with NO assigned workspace AND admin/super-admin position
  as wildcard.
- In AppSidebar.vue isAllowed()/activeTeam fallback, apply the same rule: wildcard ['*'] only
  for admin-tier users with no assigned workspace; everyone else with no resolved workspace sees
  nothing.

Verify: a non-admin whose workspace fails to load should see an EMPTY menu and no CRUD buttons,
not full access.
```

---

## Prompt 3 — Enforce CRUD permissions on the SERVER (critical)

```
menuPermissions/allowedMenus are only checked in the Vue UI. No API endpoint enforces them, so
any user can bypass hidden buttons by calling the API directly (e.g. DELETE /api/tasks/[id]).
grep confirms: outside the Workspace model/validation/migration files, no server route reads
menuPermissions or allowedMenus.

Build server-side enforcement:
1. Create server/utils/requirePermission.ts exporting
   requirePermission(event, routePath: string, op: 'create'|'read'|'update'|'delete').
   It must: load the caller's workspace (from the employee's workspace field via the session id,
   or the active_workspace_id cookie), read allowedMenus + menuPermissions, and apply the SAME
   logic as app/composables/usePermissions.ts can(): wildcard admin => allow; perms[route] exists
   => must include op; menu in allowedMenus but no perms => allow; otherwise throw 403. Cache the
   workspace lookup per request on event.context.
2. Map HTTP method -> op (GET=read, POST=create, PUT/PATCH=update, DELETE=delete) and wire
   requirePermission into every data CRUD route under server/api (tasks, pipeline, customers,
   products, employees, project-communication, daily-production, stain-sign-off, contracts,
   subcategories, etc.), passing the matching frontend route path from ROUTE_CAPS in
   app/pages/admin/general-settings/[[tab]].vue.

Verify: as a non-admin whose workspace grants only 'read' on /tasks, a direct
DELETE /api/tasks/[id] must return 403 even though the UI button is hidden.
```

---

## Prompt 4 — Block direct URL access to unpermitted pages

```
The only route middleware is app/middleware/auth.global.ts (auth only). There is no guard
stopping a user from typing a URL for a page their workspace doesn't allow — the sidebar hides
it but the page still loads.

Add app/middleware/permissions.global.ts (defineNuxtRouteMiddleware) that, after auth, uses the
same allowedMenus/menuPermissions logic as usePermissions.can('read', to.path). If read is not
granted for the destination route, redirect to /my-profile (or a 403 page). Skip the check for
admin-tier users and for public/auth routes. Reuse the can() logic from usePermissions so there
is ONE source of truth — do not re-implement it differently.

Verify: a non-admin without /hr/employees access who navigates directly to /hr/employees is
redirected, not shown the page.
```

---

## Prompt 5 — Stop partial updates from wiping permissions + validate shape

```
In server/utils/validation.ts, WorkspaceCreateSchema defines allowedMenus with .default([]) and
menuPermissions with z.record(z.string(), z.unknown()).default({}). The PUT handler in
server/api/workspaces/[id].ts uses WorkspaceCreateSchema.partial(), but Zod .partial() keeps the
inner .default(), so any PUT that omits allowedMenus or menuPermissions resets them to empty —
silently destroying saved permissions. The z.unknown() value type also means malformed
permission data is accepted.

Fix:
1. Add a dedicated WorkspaceUpdateSchema with NO defaults: every field optional, and when a key
   is absent it must be left untouched (do not $set it). Type menuPermissions strictly as
   z.record(z.string(), z.array(z.enum(['create','read','update','delete']))).
2. In server/api/workspaces/[id].ts PUT handler, build the $set object from only the keys
   actually present in the parsed body, so omitted fields are never overwritten.
3. Apply the same strict menuPermissions type to WorkspaceCreateSchema.

Verify: PUT /api/workspaces/[id] with body { name: 'X' } only changes name and leaves
allowedMenus and menuPermissions intact. Sending an invalid op like 'foo' is rejected with 400.
```

---

## Prompt 6 — Remove the duplicate / conflicting workspace schema

```
server/utils/validation.ts contains TWO unrelated workspace schemas:
- WorkspaceWriteSchema (slug, allowedRoles, isDefault, settings) — does NOT match the Mongoose
  model and is not used by the API; WorkspaceUpdateSchema is derived from it.
- WorkspaceCreateSchema (logo, plan, allowedMenus, menuPermissions) — matches the model and is
  what the API actually uses.

Delete the stale WorkspaceWriteSchema and its derived WorkspaceUpdateSchema, and keep a single
source of truth that matches server/models/Workspace.ts (name, logo, plan, allowedMenus,
menuPermissions, isLocked). Update any imports. Make sure both server/api/workspaces/index.ts and
[id].ts import the correct create/update schemas.

Verify: project type-checks, grep for WorkspaceWriteSchema returns no references, and create +
update workspace still work end to end.
```

---

## Prompt 7 — Actually wire permission checks into every CRUD page

```
ROUTE_CAPS in app/pages/admin/general-settings/[[tab]].vue lists ~22 routes with CRUD ops, but
usePermissions is only consumed in 7 files (DocumentPage.vue, KanbanBoard.vue, admin/skills.vue,
project-communication.vue, stain-sign-off.vue x2, hr/employees.vue). Every other CRUD page shows
create/edit/delete buttons regardless of workspace permissions.

Audit every page/component under app/pages and app/components that has a create, edit, save, or
delete action whose route appears in ROUTE_CAPS. In each, import usePermissions and gate the
action: hide or :disabled the Create button on !canCreate(route), Edit on !canUpdate(route),
Delete on !canDelete(route), and guard the page body on !canRead(route). Use the route path that
matches the ROUTE_CAPS key.

Verify: for a workspace with read-only on a route, that page shows data but no add/edit/delete
controls; combined with Prompt 3 the API also blocks those ops.
```

---

## Prompt 8 — Keep allowedMenus and menuPermissions in sync

```
The sidebar (AppSidebar.vue isAllowed) gates visibility purely on allowedMenus, while CRUD gates
on menuPermissions — these two can drift (a menu visible with no read op, or perms set on a menu
not in allowedMenus). Also the seeded Admin workspace is isLocked and the PUT handler rejects ANY
edit, so its menus can never be adjusted.

Fix:
1. Treat menuPermissions as the single source of truth on the server: on create/update, derive
   allowedMenus = Object.keys(menuPermissions that include 'read') so the two can never disagree,
   OR enforce in validation that every key in menuPermissions is also in allowedMenus and vice
   versa.
2. For locked workspaces, allow updating allowedMenus/menuPermissions but keep name/logo/plan
   immutable, instead of rejecting the whole PUT — so the Admin workspace stays a real, editable
   wildcard ['*'].

Verify: toggling a menu's read off in the editor removes it from the sidebar AND blocks the page;
the Admin/locked workspace can have its menus edited but not renamed.
```
