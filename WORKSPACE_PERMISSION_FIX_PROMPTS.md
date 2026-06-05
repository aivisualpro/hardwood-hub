# Workspace Permission Fix — AI Agent Prompts

> **Verification status (round 2):**
> - ✅ Prompt 1 (GET open / write admin-only) — done
> - ✅ Prompt 2 (fail-closed defaults) — done
> - ⚠️ **Prompt 3 (server enforcement) — HALF DONE. `requirePermission.ts` was created but wired into 0 routes → not active. See Prompt 9.**
> - ⚠️ **Prompt 4 (route guard) — BROKEN. Relies on a cache only the sidebar fills, which loads after middleware → non-admins get wrongly bounced to /my-profile on refresh/deep-link. See Prompt 10.**
> - ✅ Prompt 5 (no-default update schema + CrudOp validation) — done
> - ✅ Prompt 6 (duplicate schema removed) — done
> - ✅ Prompt 7 (UI gating) — expanded 7→14 pages; verify the rest in Prompt 11
> - ✅ Prompt 8 (sync + locked editable) — done; one edge case in Prompt 11
>
> **Run Prompts 9 and 10 — they are the unfinished critical work.**

---

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

---
---

# ROUND 2 — Unfinished / broken (run these)

## Prompt 9 — Actually WIRE requirePermission into the CRUD routes (Prompt 3 was not finished)

```
server/utils/requirePermission.ts exists and is correct, but grep shows it is imported/called in
ZERO routes — so server-side permission enforcement does nothing and the API can still be bypassed.
Finish the job: call it at the top of every data CRUD handler (after connectDB), passing the
frontend route path that matches the ROUTE_CAPS keys in
app/pages/admin/general-settings/[[tab]].vue. Let the op auto-derive from the HTTP method.

Wire these files (path → route arg):
- server/api/tasks/index.ts, [id].ts, reorder.post.ts            → '/tasks'
- server/api/pipeline/index.ts, [id].ts                          → '/crm/pipeline'
- server/api/customers/index.ts, [id].ts, import.post.ts         → '/crm/pipeline'
- server/api/products/index.ts, [id].ts, import.post.ts          → '/crm/products'
- server/api/subcategories/index.ts, [id].ts                     → '/admin/skills'
- server/api/stain-sign-off/index.ts, [id].ts                    → '/external/stain-sign-off'
- server/api/contracts/index.ts, detail/[id].ts, templates/*     → '/crm/contracts'
- server/api/project-communication* (if present)                 → '/project-communication'
- server/api/skill-bonus* (if present)                           → '/admin/skills'

Example for server/api/tasks/[id].ts:
  import { requirePermission } from '../../utils/requirePermission'
  // inside the handler, after await connectDB():
  await requirePermission(event, '/tasks')   // op derived from method (GET/POST/PUT/DELETE)

Do NOT add it to: server/api/auth/*, /api/nav/*, /api/upload/*, /api/version, /api/crm/webhook,
/api/google-calendar/callback|webhook, contract public sign routes, or the /api/workspaces routes
(those already use requireAdmin). For seed/migrate endpoints, gate with requireAdmin instead.

Verify: as a non-admin in a workspace that grants only 'read' on /tasks, a direct
DELETE /api/tasks/[id] returns 403, and a direct POST /api/tasks returns 403, even though the UI
hides the buttons. As an admin, all still work. grep 'requirePermission' server/api should now list
every CRUD route.
```

---

## Prompt 10 — Fix the route guard: it redirects valid users because the workspace list isn't loaded yet

```
app/middleware/permissions.global.ts calls usePermissions().can('read', route), and usePermissions
reads the workspace list from useNuxtData('workspaces-list'). But that cache is ONLY populated by
app/components/layout/AppSidebar.vue, which mounts AFTER route middleware runs. So on a hard refresh
or direct deep-link, the cache is empty when the guard runs, a non-admin resolves to the deny
fallback, and they get wrongly redirected to /my-profile even on pages they ARE allowed to see.

Fix: make the guard load the workspace list itself before checking, using the SAME cache key so the
sidebar reuses it (useAsyncData dedupes by key). In permissions.global.ts, before calling
usePermissions:

  await useAsyncData('workspaces-list', () =>
    $fetch('/api/workspaces', { headers: useRequestHeaders(['cookie']) }))

Then call usePermissions().can('read', routePath) as now. This guarantees the data exists during
SSR and client navigation. Keep the admin-tier bypass and the unmapped-route allow.

Verify: log in as a non-admin with access to /tasks but NOT /hr/employees. Hard-refresh on /tasks →
page loads (no redirect). Directly visit /hr/employees → redirected to /my-profile. Admin sees
everything. No redirect loop on /my-profile.
```

---

## Prompt 11 — Finish UI gating coverage + guard the wildcard admin workspace (verification pass)

```
Two cleanups:

1. usePermissions is now used in 14 pages, but confirm every remaining CRUD page gates its buttons.
   Check these (add canCreate/canUpdate/canDelete guards if they have create/edit/delete actions and
   their route is in ROUTE_CAPS): /email, /sales/invoices, /crm/appointments, /crm/flooring-estimate.
   Pure read-only pages (/admin/dashboard, /admin/activities, /reports/*, /hr/employees-bonus-report)
   only need the route-level read guard from Prompt 10 — no button changes.

2. Protect the locked Admin (wildcard) workspace from losing its '*'. In server/api/workspaces/[id].ts
   PUT, deriveAllowedMenus(data.menuPermissions) runs whenever menuPermissions is sent; if the locked
   Admin workspace is saved with an empty/normal menuPermissions, its allowedMenus ['*'] gets
   overwritten and admins lose global access. Add a guard: if wp.isLocked AND wp.allowedMenus
   includes '*', do not overwrite allowedMenus — keep ['*'] regardless of derived value. Alternatively,
   block editing menuPermissions on the wildcard admin workspace entirely.

Verify: editing+saving the Admin workspace keeps allowedMenus = ['*']; a normal CRUD page with
read-only permission shows no add/edit/delete buttons.
```

---
---

# ROUND 3 — Coverage gap, ObjectId, + Field-Level Security

> **Re-audit of 9–11:** Prompt 9 ✅ wired into 23 routes, Prompt 10 ✅ middleware self-fetches the
> workspace list, Prompt 11 ✅ wildcard admin preserved. BUT the Prompt 9 list was INCOMPLETE — these
> CRUD areas were never listed and are still UNGATED: **employees, daily-production,
> project-communication, performance, bonus-distribution, email/gmail.** Worse, `/api/employees`
> uses `requireAdmin`, so a non-admin (e.g. Supervisor) with the Employees menu still gets 403.
> Prompts 12–13 close this. Prompts 14–17 add field-level security.

---

## Prompt 12 — Gate the remaining CRUD routes + unlock Employees for workspace control

```
requirePermission is wired into 23 routes but several CRUD areas were missed, and
server/api/employees/index.ts + [id].ts use requireAdmin — which means a non-admin granted the
Employees menu via their workspace STILL gets 403 (the menu permission is meaningless server-side).

Fix:
1. In server/api/employees/index.ts and server/api/employees/[id].ts, REPLACE the requireAdmin(event)
   call with: await requirePermission(event, '/hr/employees')  (op auto-derives from method).
   Keep requireAdmin only on server/api/employees/set-all-active.post.ts (bulk admin op).
2. Add await requirePermission(event, '<route>') after connectDB() in:
   - server/api/daily-production/index.ts, [id].ts          → '/daily-production'
   - server/api/project-communication/index.ts, [id].ts     → '/project-communication'
   - server/api/performance/index.ts                        → '/hr/employee-performance'
   - server/api/bonus-distribution/[employeeId].ts          → '/hr/employees-bonus-report' (op 'read')
   - server/api/gmail/messages.get.ts, gmail/messages/[id].ts → '/email'
   - server/api/dashboard/stats.get.ts                      → '/admin/dashboard' (op 'read')
Leave ungated: auth/*, nav/counts, google-calendar/callback|webhook, gmail OAuth callback/status/
disconnect.

Verify: Supervisor "Thomas Russell" (non-admin) in a workspace that grants read on /hr/employees can
GET /api/employees (200) but DELETE /api/employees/[id] returns 403. Remove the Employees menu from
that workspace → GET /api/employees returns 403. Admin still has full access.
```

---

## Prompt 13 — Make workspace-id handling ObjectId-safe

```
The employees.workspace field is a Mongoose ObjectId (default null), but server/api/auth/me.get.ts
returns it as `workspace: employee.workspace || ''` without stringifying, and the client compares it
with === against workspace _id strings. If serialization ever yields a non-string, the user's
workspace won't match any team and they fall through to the deny fallback (sees nothing).

Fix:
1. server/api/auth/me.get.ts → return `workspace: employee.workspace ? String(employee.workspace) : ''`.
2. app/composables/usePermissions.ts and app/components/layout/AppSidebar.vue → coerce both sides of
   every workspace-id comparison: use String(t._id) === String(userWs) and
   String(t._id) === String(activeTeamId.value).
3. server/utils/requirePermission.ts already resolves via Employee.findById(session.id).workspace
   (ObjectId) → Workspace.findById(...) — leave as is.

Verify: a user whose employees.workspace is an ObjectId resolves to their real workspace (not the
"No Access" fallback) and the sidebar shows their granted menus.
```

---

## Field-Level Security (new) — Prompts 14–17

**Concept:** keep `menuPermissions` (per-menu CRUD) unchanged; ADD a separate `fieldPermissions`
that controls individual fields *within* a menu. Each field has a mode: `hidden` | `read` | `edit`.
A field not listed inherits the menu (edit if the menu grants update, else read). Your example:
grant read+update on `/hr/employees` but set the `workspace` field to `read` (visible, not editable)
or `hidden`. Run 14 → 15 → 16 → 17 in order.

## Prompt 14 — Field-level security: model, validation, field registry

```
Add field-level permissions to workspaces, additively (do not change menuPermissions).

1. server/models/Workspace.ts: add field
   fieldPermissions: { type: Schema.Types.Mixed, default: {} }
   and add `fieldPermissions: Record<string, Record<string, 'hidden'|'read'|'edit'>>` to IWorkspace.

2. server/utils/validation.ts: add
   const FieldModeEnum = z.enum(['hidden', 'read', 'edit'])
   and add to BOTH WorkspaceCreateSchema (with .optional().default({})) and WorkspaceUpdateSchema
   (.optional(), no default):
   fieldPermissions: z.record(z.string(), z.record(z.string(), FieldModeEnum))

3. server/api/workspaces/index.ts (POST) and [id].ts (PUT): persist fieldPermissions the same way as
   menuPermissions (in PUT, only $set it when present).

4. Create app/constants/routeFields.ts exporting ROUTE_FIELDS:
   Record<string, { key: string, label: string }[]> listing the gateable fields per menu. Seed it
   with /hr/employees: name, email, position, status, workspace, basePay; and add entries for the
   other CRUD routes' main editable fields (pipeline, products, tasks, contracts). Sensitive tokens
   (gmailTokens, calendarTokens, etc.) must NOT be listed (they are never exposed anyway).

Verify: creating/updating a workspace with
fieldPermissions: { '/hr/employees': { workspace: 'read', basePay: 'hidden' } } saves and round-trips.
```

## Prompt 15 — Field-level security: admin UI in the workspace editor

```
In app/pages/admin/general-settings/[[tab]].vue workspace editor, under each menu that has an entry
in ROUTE_FIELDS (import from app/constants/routeFields.ts), render a field-permission sub-section:
for every field show a 3-way control (Hidden / View / Edit) bound to
wpForm.value.fieldPermissions[menuId][fieldKey]. Only show it when the menu is enabled and its
menuPermissions include 'read'. Add helpers fieldMode(menuId, field) / setFieldMode(menuId, field, mode).
Default unset = 'edit' if the menu has 'update', else 'read'. Clamp: never allow 'edit' if the menu
lacks update. Persist fieldPermissions in saveWorkspace() (it already sends the whole wpForm).

Verify: on a workspace, expand the Employees menu, set "workspace" = View and "basePay" = Hidden,
save, reopen the editor — selections persist.
```

## Prompt 16 — Field-level security: frontend enforcement

```
Extend app/composables/usePermissions.ts with:
  fieldMode(field: string, routePath?: string): 'hidden' | 'read' | 'edit'
Logic: read the active workspace fieldPermissions[route][field]; if unset, return 'edit' when
can('update', route) else 'read' when can('read', route) else 'hidden'; clamp 'edit'→'read' if the
menu lacks update, and anything→'hidden' if the menu lacks read.

Apply it on the Employees page first (app/pages/hr/employees.vue): for each gateable field, hide the
table column and the form input when fieldMode === 'hidden', and render the input disabled/readonly
when fieldMode === 'read'. Use the same pattern for the other pages listed in ROUTE_FIELDS.

Verify: a workspace with workspace='read', basePay='hidden' on /hr/employees shows the employees
table WITHOUT a basePay column, and the edit form shows the Workspace field disabled and no basePay
field.
```

## Prompt 17 — Field-level security: server enforcement (must-have)

```
Field rules must be enforced on the server, not just hidden in the UI.

1. Create server/utils/applyFieldPermissions.ts exporting:
   - stripHiddenFields(event, routePath, doc|docs): removes fields whose mode is 'hidden' from GET
     responses (single object or array).
   - sanitizeWrite(event, routePath, body): for POST/PUT, deletes any key whose mode is 'read' or
     'hidden' so it can't be changed; return the cleaned body. Reuse resolveWorkspace + the field
     registry; admin-tier users bypass.
2. Wire into server/api/employees/index.ts ([GET] map results through stripHiddenFields; [POST] run
   body through sanitizeWrite) and server/api/employees/[id].ts ([GET] strip; [PUT] sanitize). Then
   apply the same two calls to the other CRUD routes that have ROUTE_FIELDS entries.

Verify: as the workspace=read/basePay=hidden user, GET /api/employees responses contain NO basePay,
and a direct PUT /api/employees/[id] with { basePay: 999, workspace: '<other>' } is ignored for those
fields (server drops them) while permitted fields still update. Admin can change everything.
```

---
---

# ROUND 4 — Runtime crash (503 / service worker) + "empty workspace = all access"

> **Diagnosis of the errors in your screenshot/logs:**
> 1. **503 / `Headers Timeout Error`** — `app/middleware/permissions.global.ts` does
>    `await useAsyncData(() => $fetch('/api/workspaces'))` INSIDE route middleware during SSR. Calling
>    your own API over loopback from middleware deadlocks the dev server → timeout → 503. (Regression
>    from Prompt 10.)
> 2. **`Failed to convert value to 'Response'` / `a redirected response was used for a request whose
>    redirect mode is not "follow"`** — `public/sw.js` re-fetches navigation requests; when middleware/
>    auth returns a 302 redirect (SSR), the service worker can't handle the redirected response and
>    throws. The redirects on `/` and `/admin/general-settings/workspaces` come from the permission
>    guard + auth redirect.
> 3. **Empty workspace = all-access is being denied.** Your convention: an employee with an EMPTY
>    `workspace` field is a super-user who can switch into any workspace to preview it. But the current
>    fail-closed logic only grants that to position Admin/Super Admin and the server `requirePermission`
>    returns 403 for an empty workspace. So your non-admin tester gets blocked.
>
> Run **Prompt 18 first** (stops the crash), then **19** (empty = all-access), then **20** (optional preview).

---

## Prompt 18 — Stop the SSR deadlock and the service-worker redirect crash

```
Two files cause the 503s and the "Failed to convert value to 'Response'" / "redirected response …
redirect mode not follow" console errors.

A) app/middleware/permissions.global.ts — REMOVE the loopback fetch and run the guard client-side
   only. Rewrite so it:
   - returns immediately on the server: `if (import.meta.server) return`
   - keeps the exempt list (/login, /my-profile, /, /public*, /sign*)
   - returns if no user
   - returns if user.workspace is empty (super-user — see Prompt 19) or position is Admin/Super Admin
   - resolves routePath via resolveRoutePath(); returns if null
   - reads the workspace list from the cache WITHOUT fetching: `const { data } = useNuxtData('workspaces-list')`
   - if `!data.value` → return (be lenient; do NOT redirect — the server APIs already enforce via
     requirePermission, so this guard is UX only)
   - otherwise `const { can } = usePermissions(); if (!can('read', routePath)) return navigateTo('/my-profile')`
   DELETE the `await useAsyncData('workspaces-list', () => $fetch('/api/workspaces', ...))` block entirely.
   (AppSidebar.vue still fetches 'workspaces-list' during SSR, so the cache is populated from the payload
   on hard refresh — no loopback needed here.)

B) public/sw.js — stop intercepting navigations and bump the cache version:
   - at the top of the `fetch` listener, after the non-GET check, add:
       if (event.request.mode === 'navigate') return   // let the browser handle page loads/redirects
   - only cache.put when response.status === 200 AND response.type !== 'opaqueredirect' AND !response.redirected
   - remove '/' from STATIC_ASSETS (caching a redirecting '/' makes install fail)
   - change CACHE_NAME from 'aivisualpro-v1' to 'aivisualpro-v2' so the new worker activates

Verify: `npm run dev`, hard-refresh the app once (to update the service worker). No more 503 /
Headers Timeout in the node log, and the console no longer shows "Failed to convert value to
'Response'" or "redirected response … redirect mode not follow". Navigating to a disallowed page
client-side still redirects to /my-profile.
```

---

## Prompt 19 — "Empty workspace = all access" on BOTH client and server

```
Convention: an employee whose `workspace` field is empty/null is a super-user with access to ALL
workspaces (and can switch into any to preview it). Make this true on client and server. Keep the
fail-closed behavior ONLY for the different case where a workspace IS assigned but can't be resolved.

1. app/composables/usePermissions.ts — rewrite the activeTeam computed:
   const userWs = user.value?.workspace
   if (userWs) {
     const mine = allTeams.find(t => String(t._id) === String(userWs))
     if (mine) return mine
     return { allowedMenus: [], menuPermissions: {} }   // assigned but missing → fail closed
   }
   // EMPTY workspace = super-user. If a workspace is selected, preview it; else full wildcard.
   const selected = allTeams.find(t => String(t._id) === String(activeTeamId.value))
   if (selected) return selected
   return { allowedMenus: ['*'], menuPermissions: {} }
   Remove the isAdminTier-gated empty fallback. In can(), the `if (!ws) return isAdminTier.value`
   line can stay as a harmless guard.

2. server/utils/requirePermission.ts — distinguish empty vs missing in resolveWorkspace:
   - when `!employee.workspace`, set event.context._workspaceEmpty = true and return null
   In requirePermission(), replace the `if (!ws)` block with:
   if (!ws) {
     if (event.context._workspaceEmpty) return   // empty workspace = all access (super-user)
     if (isAdmin) return                          // admin with no workspace = allowed
     throw createError({ statusCode: 403, message: `Permission denied: no workspace for ${routePath}.` })
   }

3. app/middleware/permissions.global.ts — ensure it returns early for empty-workspace users
   (already added in Prompt 18: `if (!user.value.workspace) return`).

SECURITY NOTE (intended behavior): any employee with an empty workspace now has FULL access. Make sure
every employee who must be restricted has a workspace assigned; leave workspace empty only for
owners/testers.

Verify: log in as the non-admin tester whose employees.workspace is empty. They can open every menu,
all API calls return 200, and the workspace switcher in the sidebar lists all workspaces. Selecting a
restricted workspace makes the sidebar + CRUD buttons reflect that workspace's permissions.
```

---

## Prompt 20 — (Optional) Make the empty-workspace preview enforce on the server too

```
Right now an empty-workspace super-user previews a selected workspace only visually (menus/buttons),
while the server still allows everything (they're a super-user). If you want the preview to ALSO be
enforced server-side so it behaves exactly like that workspace:

In server/utils/requirePermission.ts resolveWorkspace(), when employee.workspace is empty, read the
`active_workspace_id` cookie (getCookie(event, 'active_workspace_id')); if it is set, load THAT
workspace and use it for the permission check instead of returning all-access. If the cookie is unset
or the workspace isn't found, fall back to all-access. Gate this behind the empty-workspace case only,
so assigned users are unaffected.

Verify: empty-workspace tester selects a read-only workspace, then a direct DELETE on a gated API
returns 403 (matching the previewed restrictions); clearing the selection restores full access.
```
