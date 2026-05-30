# Hardwood Hub — Code Audit & Agent Prompts

Audited 2026-05-30. Stack: **Nuxt 4 + Vue 3, Nitro (Vercel), MongoDB/Mongoose, Google OAuth + signed session cookie** (`hardwood_session`).

> Note on confidence: my shell access dropped out partway through, so this file separates findings I **confirmed** from actual file/grep output vs. items your agent should **verify first**. Each item is a paste-ready prompt for your AI agent. The agent should re-read the relevant file before acting — do not assume my line references are exact.

---

## 🔴 Critical

### C1. No authorization layer — any logged-in user can do anything (CONFIRMED)
`server/middleware/02.apiAuth.ts` only authenticates: it verifies the `hardwood_session` cookie and attaches `event.context.session = { id, email }` — **no role/position**. The session token payload (`server/lib/session.ts`) carries only `id`, `email`, `exp`. Authorization is ad-hoc: only **3** endpoints check anything (`tasks/reorder.post.ts`, `tasks/[id].ts`, `performance/index.ts`, all via an inline `position === 'Super Admin'` string), and **none of them read `event.context.session`** — they identify the user from request data, which is spoofable. The other ~90 endpoints have no role check at all, so any authenticated employee can hit every non-public endpoint (including the seed/migrate/debug routes in C3, and `DELETE /api/customers/[id]`). There is effectively no admin/staff separation.

> **Prompt:** Add role-based authorization. (1) Include the employee's role/position in the session payload in `server/lib/session.ts` (or look it up per request from the Employee record). (2) Add a `requireRole(event, ['admin','manager'])` helper in `server/utils/` that reads `event.context.session` and throws 403 if the role isn't allowed. (3) Apply it across `server/api/**`: seed/migrate/debug + employee/bonus/contract-admin routes → admin only; normal create/update/delete → appropriate roles; reads → any authenticated user. List every endpoint you gated and the role assigned.

### C2. Session-secret fallback + timing-unsafe verification (CONFIRMED)
`server/lib/session.ts` falls back to a literal `DEFAULT_SECRET = 'hardwood-hub-default-secret-change-in-production'` when `SESSION_SECRET` is unset. It only throws when the default is used **and** `NODE_ENV === 'production'` exactly — so on Vercel **preview** deployments, Docker, or any host that doesn't set `NODE_ENV` to that exact value, sessions are silently signed with a publicly-known secret and anyone can forge a valid `hardwood_session` cookie. Separately, signature verification uses `if (sig !== expectedSig)` — a non-constant-time string compare (timing side-channel).

> **Prompt:** In `server/lib/session.ts`: (1) remove `DEFAULT_SECRET` entirely and throw on startup whenever `SESSION_SECRET` is missing/empty, regardless of `NODE_ENV`; (2) replace the `sig !== expectedSig` check with `crypto.timingSafeEqual` (guard against length mismatch first). Also remove the matching `'...change-in-production'` fallback from `sessionSecret` in `nuxt.config.ts`. Confirm no hardcoded secret fallbacks remain anywhere.

### C2b. No session revocation (CONFIRMED)
Session tokens embed a 7-day expiry and are stateless; `logout.post.ts` only clears the cookie client-side. A stolen/leaked token stays valid for up to 7 days with no way to revoke it server-side.

> **Prompt:** Add server-side session invalidation — e.g. a token version/`sessionEpoch` on the Employee record included in the token and checked on verify, so logout / "log out everywhere" / deactivation immediately invalidates existing tokens. Consider shortening the 7-day lifetime and adding refresh.

### C3. Seed / migrate / debug endpoints shipped to production (CONFIRMED)
These mutate data and are reachable over HTTP: `contracts/templates/seed.ts`, `seed-residential.post.ts`, `seed-writeup.post.ts`, `customers/migrate.post.ts`, `pipeline/migrate.post.ts`, `tasks/seed.post.ts`, `workspaces/migrate-hr-routes.post.ts`, plus a whole `server/api/debug/` directory. Two are **GET** requests that mutate state — `dropdowns/seed-customer-status.get.ts` and `dropdowns/seed-production.get.ts` — which is dangerous (prefetchable, cacheable, CSRF-able, crawlable).

> **Prompt:** Move all one-off seed/migration logic out of `server/api/` into `server/scripts/` (run manually via tsx, not as HTTP routes) and delete the routes. Delete the entire `server/api/debug/` directory. For anything that must stay as an endpoint, make it POST (never GET for mutations) and gate it behind an admin role check. Before deleting, grep `app/` for fetch calls to these paths and report any real usage so the UI doesn't break. Give me the final deleted-files list.

### C4. No input validation on write endpoints (CONFIRMED)
`zod` is installed but imported in **0** of the API handlers; none of the 26 POST/PUT/PATCH endpoints validate their body. Combined with Mongoose `create`/`findByIdAndUpdate`, this allows malformed types and mass-assignment of fields the client shouldn't set.

> **Prompt:** Add a `zod` schema for the body of each write endpoint under `server/api/` and parse with it (400 on failure). When writing to Mongoose, pass an explicit whitelist of validated fields — never spread the raw body. Also coerce/validate that `[id]` route params are valid Mongo ObjectIds before querying (guards against `$ne`/`$gt` NoSQL-operator injection). Start with customers, contracts, tasks; show me the customer create + update schemas as a sample before doing the rest.

---

## 🟠 High

### H1. Edge SWR caching on authenticated endpoints (CONFIRMED — verify sensitivity)
`nuxt.config.ts` `routeRules` apply Vercel edge `swr` caching to `/api/employees` (30s), `/api/dashboard/stats` (15s), `/api/workspaces` (60s), `/api/skills/tree`, `/api/app-settings`. Edge caches are shared across users and don't vary by auth cookie, so one user's response can be served to another. You already hit a related bug (the comment notes `/api/dropdowns` SWR was removed because it ignored query params).

> **Prompt:** Review each `swr` route rule in `nuxt.config.ts`. For any endpoint that returns auth-scoped or user-specific data, remove edge caching (or switch to per-request caching that varies by user). Confirm that `/api/employees` and `/api/dashboard/stats` cannot serve one user's data to another. Document which routes are safe to cache because they're identical for all authenticated users.

### H2. Mongoose connection uses a module-level boolean, not a cached promise (CONFIRMED)
`server/utils/mongoose.ts` gates connection with `let isConnected = false` and returns early when true. On Vercel this is the classic serverless anti-pattern: the boolean doesn't reflect `mongoose.connection.readyState`, and because the connect promise isn't cached, concurrent requests on a cold/warm lambda can race and open duplicate connections (or use a dropped one). Pool options are otherwise reasonable, and it does throw if `NUXT_MONGODB_URI` is missing (good).

> **Prompt:** Rewrite `server/utils/mongoose.ts` to the standard serverless singleton: cache both the connection and the in-flight connect **promise** on `globalThis` (e.g. `globalThis.__mongoose = { conn, promise }`), reuse the promise so concurrent calls await the same connect, and check `mongoose.connection.readyState` instead of a plain boolean. Keep the existing pool options and the missing-URI throw.

### H3. No rate limiting on public/auth/webhook endpoints (CONFIRMED)
No `helmet`/rate-limit/CORS dependency exists. Public surface includes `/api/auth/google`, `/api/crm/webhook.post.ts`, `/api/crm/calendly-webhook-setup.post.ts`, `/api/google-calendar/webhook.post.ts`, and `/api/contracts/sign/[token]`. Webhooks with no signature verification or rate limit can be spoofed/flooded.

> **Prompt:** Add per-IP rate limiting to public POST endpoints (auth, webhooks, contract signing). For each webhook (`crm/webhook`, `google-calendar/webhook`, calendly), verify the provider's signature/secret before processing and reject otherwise. Tell me which webhooks currently have no signature check.

---

## 🟡 Medium

### M1. `.env` hygiene: dead Next.js vars + duplicate OAuth apps (CONFIRMED)
`.env` contains `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` — `NEXT_PUBLIC_` is a Next.js prefix and does nothing in Nuxt (dead/misleading; the client can't read them). There are also **two** Google OAuth credential sets: `GOOGLE_CLIENT_ID/SECRET` and `GCAL_CLIENT_ID/SECRET`.

> **Prompt:** Clean up `.env`: remove the `NEXT_PUBLIC_*` keys (Next.js leftovers — if the client genuinely needs the Cloudinary cloud name, expose it via `runtimeConfig.public` instead). Confirm whether `GOOGLE_*` and `GCAL_*` are intentionally two different OAuth apps or accidental duplication, and consolidate if they're the same. Create/refresh `.env.example` listing every key name with empty values.

### M2. 171 raw `console.*` calls (136 server / 35 client) (CONFIRMED)
No logging abstraction; risk of printing request bodies/tokens/documents to production logs.

> **Prompt:** Add a small logger util that silences debug/info in production but keeps error logging, and replace `console.*` across `server/` and `app/`. Remove any log that prints request bodies, cookies, tokens, or full DB documents. Report replaced-vs-removed counts.

### M3. Centralized error handling (VERIFY)
Endpoints appear to throw ad-hoc errors; without a global handler, raw Mongoose errors/stacks can reach the client.

> **Prompt:** Add a Nitro error handler that logs full errors server-side but returns a generic message + status to the client in production. Audit write endpoints to ensure DB calls are wrapped and no raw stack/error text is returned.

---

## ⚪ Housekeeping / industry standards

### K1. Scratch/test/inspect/migrate files committed to repo root (CONFIRMED)
Tracked in git: `scratch.js`, `scratch.mjs`, `scratch.py`, `scratch-test.mjs`, `inspect.ts`, `inspect.cjs`, `inspect_tasks.ts`, `check_db.ts`, `find_adeel.ts`, `query_stages.js`, `simulate_reorder.ts`, `simulate_request.ts`, `test_db.ts`, `test_gate.ts`, `test_employee.cjs`, `test_validation.mjs`, `test-cloudinary-large.js`, `test-vertex.js`, `migrate-cloudinary.ts`, `migrate-tags.ts`. Plus committed data dumps `formatted_chunks.json`, `replacements.json`, an empty `app_settings.json`, and a stray `node_modules_local/` directory.

> **Prompt:** Delete these one-off root scripts and committed JSON dumps and the `node_modules_local/` directory from the repo. Add `.gitignore` patterns so they don't return. Confirm `npm run build` still succeeds afterward.

### K2. `.calendly-*.json` likely contains real PII in git history (CONFIRMED — handle carefully)
`.calendly-test.json` and `.calendly-invitees-test.json` are committed and look like real Calendly invitee exports (names/emails).

> **Prompt:** Check whether `.calendly-test.json` / `.calendly-invitees-test.json` contain real personal data. If yes: remove them from the working tree AND from git history (git filter-repo or BFG), then force-push after coordinating with anyone who has the repo cloned. Report what you found before rewriting history.

### K3. No test framework at all (CONFIRMED)
No `vitest`/test runner in `devDependencies`; the only "tests" are the scratch `test_*` files above. `lint` and `typecheck` scripts exist but there's no CI enforcing them.

> **Prompt:** Add Vitest. Write real tests for the new session-secret/auth helpers, the zod schemas, and a couple of endpoints (auth success/failure, a 403 authorization case). Add a GitHub Actions workflow running `lint` + `typecheck` + `test` on every push.

### K4. Run the gates and fix fallout (CONFIRMED scripts exist)
> **Prompt:** Run `npm run lint` and `npm run typecheck`, fix what they report, and keep the build green.

---

## 🔵 Additional confirmed findings (final pass)

### A1. Google token audience check is skippable → auth bypass (CONFIRMED)
`server/api/auth/google.post.ts` verifies the Google ID token via the `tokeninfo` endpoint and checks the audience **only** `if (clientId && payload.aud !== clientId)`. If `GOOGLE_CLIENT_ID` is unset/empty, the `aud` check is skipped and a valid Google ID token minted for *any other* OAuth app would be accepted — an authentication bypass. `google-auth-library` is already a dependency and does this verification properly.

> **Prompt:** In `server/api/auth/google.post.ts`, make audience verification mandatory — throw if `GOOGLE_CLIENT_ID` is missing rather than skipping the check. Better: replace the manual `tokeninfo` fetch with `google-auth-library`'s `OAuth2Client.verifyIdToken({ idToken, audience })`, which validates signature, issuer, audience, and expiry in one call.

### A2. `Employee.email` is not unique (CONFIRMED)
`server/models/Employee.ts` declares `email` with a plain `EmployeeSchema.index({ email: 1 })` and **no `unique: true`**. Login does `Employee.findOne({ email })`; if two employee docs share an email, login silently authenticates as an arbitrary one. `position` is also free-text with no enum, so roles aren't standardized.

> **Prompt:** Make `email` unique in `server/models/Employee.ts` (`unique: true`, drop the redundant separate index), after de-duplicating any existing records. Define an enum/allow-list for `position` (or a dedicated `role` field) so the authorization work in C1 has stable values to check.

### A3. Unverified / inconsistent webhooks (CONFIRMED)
`server/api/google-calendar/webhook.post.ts` is in the public allow-list and only reads non-secret `x-goog-*` headers — no channel-token/secret verification, so it's spoofable (anyone can POST forged change notifications). Meanwhile `server/api/crm/webhook.post.ts` is **not** public, so it requires a `hardwood_session` cookie — an external CRM can't send that, so it likely can't actually authenticate as a webhook.

> **Prompt:** For the Google Calendar webhook, store a secret token per channel when you create the watch and verify the incoming `x-goog-channel-token` against it; reject otherwise. For the CRM webhook, decide its real auth model (shared-secret header / HMAC signature) and add it to the public list with that verification — don't rely on the session cookie.

### A4. Raw-regex search + unguarded ObjectId casts (CONFIRMED)
`server/api/customers/index.ts` builds `$regex` filters directly from the user's `search` string (ReDoS / regex-injection risk), and `customers/[id].ts` passes the raw `id` straight into `findById`/`findByIdAndUpdate` with no validation and no try/catch — an invalid id throws an unhandled Mongoose `CastError` (500). These are the same class as C4.

> **Prompt:** Escape user input before using it in `$regex` (or use an Atlas text index), validate that `[id]` params are valid `mongoose.Types.ObjectId` before querying (return 400 otherwise), and wrap DB calls so a `CastError` doesn't surface as a 500. Roll this into the C4 validation pass.

---

### Corrections to an earlier draft
My first pass of this file (now overwritten) wrongly described a JWT/bcrypt login with open `/api/auth/register` role escalation, a `your-secret-key` fallback, and a `reset-and-seed` deleteMany route — **none of those exist here**. Auth is Google-OAuth-only (`server/api/auth/login.post.ts` is disabled); sessions are custom HMAC-signed cookies. The real issues are C1 (no authorization) and C2 (session-secret fallback). Ignore any prior mention of register/JWT/bcrypt.

### Suggested order
C2 + A1 (secret fallback & token-audience — fast, high impact) → C1 (add the authorization layer) → C3 (delete seed/debug routes) → C4 + A4 (validation) → H2 (db) → H1/H3/A3 → A2 → M/K cleanup.
