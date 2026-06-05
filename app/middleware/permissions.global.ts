/**
 * Global middleware: block direct URL access to pages the user's workspace doesn't allow.
 *
 * Runs AFTER auth.global.ts (which ensures user is logged in).
 * Uses the same usePermissions().can('read') logic as the UI — one source of truth.
 *
 * If read is not granted for the destination route, redirects to /my-profile.
 * Skips public/auth pages, user profile, and infrastructure pages.
 *
 * IMPORTANT: We eagerly load the workspace list here using the same cache key
 * ('workspaces-list') that AppSidebar.vue uses. This guarantees the data exists
 * during SSR and hard-refresh — useAsyncData dedupes by key so the sidebar
 * won't re-fetch.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // ── Skip pages that don't need permission checks ──────────────────────────
  const exempt = [
    '/login',
    '/login-basic',
    '/my-profile',
    '/',
  ]
  if (
    exempt.includes(to.path)
    || to.path.startsWith('/public')
    || to.path.startsWith('/sign')
  )
    return

  // ── Ensure user is authenticated (auth.global handles redirect) ───────────
  const { user } = useAuth()
  if (!user.value) return // auth middleware will redirect to /login

  // ── Admin-tier users bypass permission checks ─────────────────────────────
  const ADMIN_POSITIONS = ['Super Admin', 'Admin']
  if (ADMIN_POSITIONS.includes(user.value.position || '')) return

  // ── Check read permission for this route ──────────────────────────────────
  // Normalize the path: strip dynamic segments to match the base route
  // e.g. /crm/pipeline/abc123/contacts → /crm/pipeline
  // e.g. /crm/contracts/list → /crm/contracts
  const routePath = resolveRoutePath(to.path)
  if (!routePath) return // unmapped route → allow (e.g. /components, /calendar)

  // ── Ensure workspace list is loaded before checking permissions ────────────
  // Uses the SAME cache key as AppSidebar.vue so the fetch is deduplicated.
  // Without this, on hard refresh the cache is empty and non-admin users are
  // wrongly denied because usePermissions reads from this cache.
  await useAsyncData('workspaces-list', () =>
    $fetch<any>('/api/workspaces', { headers: useRequestHeaders(['cookie']) }),
  )

  const { can } = usePermissions()
  if (!can('read', routePath)) {
    return navigateTo('/my-profile')
  }
})

/**
 * Map a full page path to the base route path used in allowedMenus/menuPermissions.
 * Returns null if the path doesn't correspond to a permission-gated area.
 */
function resolveRoutePath(path: string): string | null {
  // Known route prefixes in order of specificity (most specific first)
  const ROUTE_MAP: [string, string][] = [
    // Admin
    ['/admin/dashboard', '/admin/dashboard'],
    ['/admin/skills', '/admin/skills'],
    ['/admin/category-tree', '/admin/skills'],
    ['/admin/activities', '/admin/activities'],
    ['/admin/general-settings', '/admin/general-settings'],

    // HR
    ['/hr/employees', '/hr/employees'],
    ['/hr/employee-performance', '/hr/employee-performance'],
    ['/hr/employees-bonus-report', '/hr/employees-bonus-report'],

    // Project Management
    ['/tasks', '/tasks'],
    ['/project-communication', '/project-communication'],
    ['/daily-production', '/daily-production'],
    ['/stain-sign-off', '/external/stain-sign-off'],
    ['/external/stain-sign-off', '/external/stain-sign-off'],

    // CRM
    ['/crm/pipeline', '/crm/pipeline'],
    ['/crm/customers', '/crm/pipeline'],
    ['/crm/products', '/crm/products'],
    ['/crm/appointments', '/crm/appointments'],
    ['/crm/contracts', '/crm/contracts'],
    ['/crm/quotes', '/crm/flooring-estimate'],
    ['/crm/submissions', '/crm/flooring-estimate'],
    ['/crm/flooring-estimate', '/crm/flooring-estimate'],

    // Communication
    ['/email', '/email'],

    // Sales & Reports
    ['/sales/invoices', '/sales/invoices'],
    ['/reports/sales', '/reports/sales'],
    ['/reports/financial', '/reports/financial'],
  ]

  for (const [prefix, route] of ROUTE_MAP) {
    if (path === prefix || path.startsWith(prefix + '/'))
      return route
  }

  return null // not a permission-gated page
}
