/**
 * Server Middleware: Workspace Permission Enforcement
 *
 * Automatically enforces workspace-based CRUD permissions on API routes
 * by mapping API paths to their corresponding frontend route paths.
 * Runs AFTER 02.apiAuth.ts (which populates event.context.session).
 *
 * This prevents users from bypassing UI-hidden buttons by calling the API directly.
 */
import { requirePermission } from '../utils/requirePermission'

/**
 * Map API path prefixes to frontend route paths.
 * Order matters: more specific patterns must come first.
 */
const API_TO_ROUTE: [RegExp, string][] = [
  // ── Admin ─────────────────────────────────────────────
  [/^\/api\/skills/, '/admin/skills'],
  [/^\/api\/categories/, '/admin/skills'],
  [/^\/api\/subcategories/, '/admin/skills'],
  [/^\/api\/activities/, '/admin/activities'],
  [/^\/api\/dashboard/, '/admin/dashboard'],

  // ── HR ────────────────────────────────────────────────
  [/^\/api\/employees/, '/hr/employees'],
  [/^\/api\/performance/, '/hr/employee-performance'],
  [/^\/api\/bonus-distribution/, '/hr/employees-bonus-report'],
  [/^\/api\/skill-bonus/, '/hr/employees-bonus-report'],

  // ── Project Management ────────────────────────────────
  [/^\/api\/tasks/, '/tasks'],
  [/^\/api\/project-communication/, '/project-communication'],
  [/^\/api\/daily-production/, '/daily-production'],
  [/^\/api\/stain-sign-off/, '/external/stain-sign-off'],

  // ── CRM ───────────────────────────────────────────────
  [/^\/api\/pipeline/, '/crm/pipeline'],
  [/^\/api\/customers/, '/crm/pipeline'],
  [/^\/api\/products/, '/crm/products'],
  [/^\/api\/contracts/, '/crm/contracts'],
  [/^\/api\/crm\/appointments/, '/crm/appointments'],
  [/^\/api\/crm/, '/crm/pipeline'],

  // ── Communication ─────────────────────────────────────
  [/^\/api\/gmail/, '/email'],
  [/^\/api\/documents/, '/email'],
]

/**
 * API paths that should NOT be permission-checked:
 * - Auth routes (login, logout, etc.)
 * - Public routes (contract signing portal)
 * - Infrastructure (nav counts, workspaces list, settings, uploads, calendar hooks)
 */
const EXEMPT_PREFIXES = [
  '/api/auth/',
  '/api/public/',
  '/api/nav/',
  '/api/workspaces',
  '/api/app-settings',
  '/api/upload/',
  '/api/dropdowns',
  '/api/google-calendar/',
  '/api/version',
  '/api/contracts/sign/', // public signing portal
]

function isExempt(url: string): boolean {
  for (const prefix of EXEMPT_PREFIXES) {
    if (url.startsWith(prefix)) return true
  }
  return false
}

function resolveRoute(apiPath: string): string | null {
  for (const [pattern, route] of API_TO_ROUTE) {
    if (pattern.test(apiPath)) return route
  }
  return null
}

export default defineEventHandler(async (event) => {
  const url = event.path || ''

  // Only guard API routes
  if (!url.startsWith('/api/')) return

  // Skip exempt routes
  if (isExempt(url)) return

  // Skip if no session (02.apiAuth.ts already handles 401)
  if (!event.context?.session) return

  // Resolve which frontend route this API maps to
  const frontendRoute = resolveRoute(url)
  if (!frontendRoute) return // unmapped API → no permission check (safe default for infra)

  // Enforce permission
  await requirePermission(event, frontendRoute)
})
