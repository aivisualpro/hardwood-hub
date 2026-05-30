# Round 2 — Verification + Navigation & Search Fixes

Re-checked 2026-05-30 against the live files in this folder. **Correction:** an earlier version of this file said "no fixes were applied" — that was based on a stale git read and was wrong. Your agent *did* do significant work. The accurate status is below.

---

## ✅ / ⚠️ Verification: what actually landed

**Committed** (`d037ddc security: remove calendly PII exports and scratch files`):
- ✅ **K2 done** — the `.calendly-*.json` PII exports were removed and `.gitignore` updated. Good — that was the most sensitive item.

**Done in the working tree (uncommitted):**
- ✅ **Session system upgraded** (`server/lib/session.ts`) — now issues a short-lived **access token (1 h)** + **refresh token (7 d)**, embeds `position` (for RBAC) and `epoch` (for revocation), and there's a working `/api/auth/refresh` endpoint + `authRefresh.client.ts` plugin. This is a real improvement over the old single 7-day token.
- ✅ **Security utility files created** — `server/utils/requireRole.ts`, `validation.ts`, `rateLimit.ts`, `logger.ts`.

**⚠️ Built but NOT wired in — these do nothing yet:**
- ❌ **C1 authorization** — `requireRole`/`requireAdmin` exist but are imported by **0 endpoints**. `position` is now in the session, but **no route reads `event.context.session` or enforces a role.** The app is still "any logged-in user can do anything," including the seed/migrate routes. *The helper is on the shelf; it has to be called in every handler to matter.*
- ❌ **C4 validation** — `validation.ts` exists but **0 API handlers import it** (and 0 import `zod`). Writes still do `new Customer(body)` with the raw body.
- ❌ **H3 rate limiting** — `rateLimit.ts` exists but isn't applied to `/api/auth/*` or webhooks.
- ❌ **M2 logging** — `logger.ts` exists but `console.*` calls are still throughout.

**⚠️ Not addressed at all:**
- ❌ **C2 session secret** — `session.ts` still has `DEFAULT_SECRET = 'hardwood-hub-default-secret-change-in-production'` and only throws when `NODE_ENV === 'production'` *exactly*; `nuxt.config.ts` still has the same `|| '...change-in-production'` fallback. Still uses non-constant-time `sig !== expectedSig`.
- ❌ **A1 Google audience** — still `if (clientId && payload.aud !== clientId)` (skipped if `GOOGLE_CLIENT_ID` unset); still a manual `tokeninfo` fetch instead of `google-auth-library`.
- ❌ **C3 seed/migrate routes** — all 9 still live under `server/api/` (2 still GET).
- ❌ **H2 Mongoose** — still `let isConnected = false` (no promise caching / `readyState`).
- ❌ **K1 scratch files** — root `scratch.*`, `inspect.*`, `test_*`, `simulate_*`, `migrate-*` still tracked. New: a committed **`server/api/auth/google.post.ts.backup`** and the working tree has a **massive 263-file uncommitted diff** (≈+15k/−11k) — almost all of it lint/formatting noise mixed in with the real logic changes, which makes review dangerous.

> **Prompt — finish wiring the security work that's already half-built (highest priority):**
> The utilities `server/utils/requireRole.ts`, `validation.ts`, `rateLimit.ts`, `logger.ts` exist but are imported by zero endpoints — they currently do nothing. Wire them in:
> 1. **Authorization (C1):** in every handler under `server/api/**`, call the right guard from `requireRole.ts` reading `event.context.session.position`. Seed/migrate/admin/employee/bonus routes → `requireAdmin`; create/update/delete on customers, contracts, products, pipeline, tasks → `requireManager` (or as appropriate); reads → authenticated only. Replace the 3 ad-hoc `position === 'Super Admin'` checks (`tasks/reorder.post.ts`, `tasks/[id].ts`, `performance/index.ts`) which currently read spoofable request data, not the session. List every endpoint + the guard you applied.
> 2. **Validation (C4):** import the `validation.ts` schemas (or zod) in each POST/PUT/PATCH handler; parse the body and write only whitelisted fields — no more `new Customer(body)` / `findByIdAndUpdate(id, body)` with the raw body. Validate `[id]` params are valid ObjectIds.
> 3. **Rate limiting (H3):** apply `rateLimit.ts` to `/api/auth/google`, `/api/auth/refresh`, and the webhooks.
> 4. **Logging (M2):** replace `console.*` with `logger.ts`.
> Then finish the untouched items: remove the `DEFAULT_SECRET` fallback in `session.ts` + `nuxt.config.ts` and throw if `SESSION_SECRET` is unset regardless of `NODE_ENV`; use `crypto.timingSafeEqual` for signature compare; make the Google `aud` check mandatory (or switch to `google-auth-library`); move the 9 seed/migrate routes to `server/scripts/`; rewrite `mongoose.ts` to cache the connect promise on `globalThis`; delete `google.post.ts.backup` and the root scratch files. **Commit the lint/formatting reflow separately from logic changes** so the security diff is reviewable.

---

## 🧭 Issue A — Sidebar routes only appear after a second refresh

**Root cause (confirmed).** Menu visibility depends on data fetches that are *gated on a cookie snapshot taken before the cookie exists*, and `useCookie` isn't reactive across instances when written later on the client:

- `app/components/auth/SignIn.vue` sets the `hardwood_user` cookie **client-side** right after Google login, then navigates. The login page uses a layout without the sidebar; the sidebar (`default` layout) mounts only *after* navigation.
- `app/components/layout/AppSidebar.vue` reads `const userCookie = useCookie('hardwood_user')` and then does:
  `await useFetch('/api/workspaces', { key: 'workspaces-list', immediate: !!userCookie.value })` and
  `await useFetch('/api/nav/counts', { immediate: !!userCookie.value })`.
- Which menu items show is decided by `isAllowed(link)` → `activeTeam.value.allowedMenus`, and `activeTeam` comes from that `/api/workspaces` response.

The problem is the **`immediate: !!userCookie.value` gate**. The `userCookie` ref is snapshotted when the component sets up; if its value isn't present/flushed at that instant (or the sidebar instance was created before login wrote the cookie), `immediate` is `false`, so `/api/workspaces` and `/api/nav/counts` **never fire**. `allowedMenus` stays empty → role-gated groups are filtered out → sidebar looks half-empty. A manual refresh re-runs setup with the cookie now present → `immediate` is `true` → fetches fire → full nav appears. That's your "second refresh." (Nav-count badges ride the same gate, so they're missing on first paint too.) `usePermissions.ts` has the same `useCookie('hardwood_user')` snapshot dependency.

> **Prompt:** Fix the "sidebar needs a second refresh" bug the industry-standard Nuxt way — drive nav off a single reactive auth state, and stop gating fetches on a cookie snapshot.
> 1. Create `app/composables/useAuth.ts` exposing a shared `const user = useState('auth-user', () => null)` plus `fetchUser()` that calls `$fetch('/api/auth/me', { headers: useRequestHeaders(['cookie']) })` — populated during SSR and refetchable on the client.
> 2. In `AppSidebar.vue`, remove the `immediate: !!userCookie.value` gates. Load workspaces and nav counts with `useAsyncData(..., () => $fetch(url, { headers: useRequestHeaders(['cookie']) }))` keyed off the auth state, and `watch(user, () => refresh())` so they (re)fetch as soon as the user is known — no reload. Derive `isAllowed`/`activeTeam` from that data reactively.
> 3. Rewrite `usePermissions.ts` to read `position`/workspace from the shared `useState` user instead of `useCookie('hardwood_user')`.
> 4. In `SignIn.vue` and `authRefresh.client.ts`, after login/refresh set the shared state (and `refreshCookie('hardwood_user')`) so the sidebar recomputes immediately.
> Verify: log in → full role-appropriate sidebar appears with badges, no second refresh; hard-load a deep link while logged in → sidebar present on first paint.

*(This pairs with C1: once routes are role-gated server-side, also enforce page-level roles in `auth.global.ts` so hiding a menu item isn't the only thing stopping access.)*

---

## 🔎 Issue B — Search & filters must be database-wide

**Root cause (confirmed).** Some list endpoints already paginate properly server-side, but several pages still load a capped slice and filter it in the browser — so search only sees what's loaded. Worst offender is Customers:

- `server/api/customers/index.ts` hard-caps at **200** (`Math.min(200, … || 200)`), with **no pagination** (`skip`/`page`), **no status/type filter**, and an **unescaped `$regex`**. It *does* accept `?search=` but the page never uses it.
- `app/pages/crm/customers.vue` fetches `'/api/customers?limit=1000'` — but the server silently caps that to 200 — then does **client-side** `filteredClients = computed(() => clients.filter(...))` and client-side sort. So only the 200 newest customers are searchable; anything older is invisible. (Same load-then-filter-client-side pattern in `pipeline/index.vue`, `hr/employees.vue`, `admin/activities.vue`, and others.)
- For contrast, `server/api/products/index.ts` and `contracts/index.ts` **already** do correct server-side `page`/`limit`/`skip` + `countDocuments` + search — use those as the template — but their pages may still re-filter client-side.

> **Prompt:** Make list search/filtering query the whole database with server-side pagination. Use the existing `server/api/products/index.ts` (page/limit/skip/countDocuments) as the reference pattern. Do Customers first, then roll out to pipeline, employees, activities, and verify products/contracts pages use server params (not client `.filter()`).
> **Server `server/api/customers/index.ts`:** accept `search`, `type`/`status`, `page` (default 1), `limit` (default 25, max 100). Build the filter from `type` and a **regex-escaped** `search` across name/firstName/lastName/email/phone/city. Return `{ success, data, total, page, limit, totalPages }` via `Customer.find(filter).sort(...).skip((page-1)*limit).limit(limit)` + `Customer.countDocuments(filter)`. Remove the 200 cap. Add a compound index for the common sort+filter.
> **Client `app/pages/crm/customers.vue`:** delete the client-side `filteredClients` filter and client sort. Send `search` (debounced ~300ms — `useDebounceFn` is already imported in similar pages), `type`, `page`, and sort to `/api/customers`, refetch on change with `watch`, and render server pagination using `total`. The list must now reflect the entire collection. Confirm by searching for a customer you know is older than the newest 200 — it should appear.
> Then apply the same server+client pattern to the pipeline, employees, and activities lists so every search/filter is database-wide.

**Minor bug while reading `customers.vue`:** the `filteredClients` block had stray dead conditions; it's moot once filtering moves server-side, but remove the leftover client filter entirely rather than leaving both.

---

### Suggested order
1. **Wire in the security utilities + finish C2/A1/C3/H2** (the work is half-done and currently provides no protection — top priority).
2. **Issue A** (nav reactive auth state) — small, high-visibility fix.
3. **Issue B** (DB-wide search) — Customers first as the template, then the rest.
4. Commit the formatting reflow separately so reviews stay sane.
