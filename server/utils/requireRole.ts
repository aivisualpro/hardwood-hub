/**
 * RBAC helper — requireRole / requireAdmin / requireManager / requireStaff
 *
 * Usage (inside any defineEventHandler):
 *   import { requireAdmin } from '../../utils/requireRole'
 *   requireAdmin(event)     // throws 403 if caller is not Admin or Super Admin
 *   requireManager(event)   // throws 403 if caller is below Manager tier
 *   requireStaff(event)     // throws 403 if caller is unauthenticated (sanity guard)
 *
 * Role tiers:
 *   Super Admin → 4 | Admin → 3 | Manager → 2 | Staff → 1 | <other> → 0
 *
 * The caller's position is read from event.context.session.position — embedded in
 * the signed access token at login, so no extra DB call is needed per request.
 * Add any position string that should map to a tier in ROLE_TIER below.
 */

export const ROLE_TIER: Record<string, number> = {
  'Staff': 1,
  'Manager': 2,
  'Admin': 3,
  'Super Admin': 4,
}

export type RoleLevel = keyof typeof ROLE_TIER

function getTier(position: string | undefined): number {
  if (!position)
    return 0
  return ROLE_TIER[position] ?? 0
}

/**
 * Throws 403 if the authenticated caller's role tier is below `minRole`.
 * Must be called inside a route that has already passed through 02.apiAuth.ts
 * (i.e., event.context.session is populated).
 */
export function requireRole(event: any, minRole: RoleLevel): void {
  const session = (event.context as any).session
  if (!session) {
    throw createError({ statusCode: 401, message: 'Authentication required.' })
  }
  const callerTier = getTier(session.position)
  const requiredTier = ROLE_TIER[minRole] ?? 0
  if (callerTier < requiredTier) {
    throw createError({
      statusCode: 403,
      message: `Access denied. Required role: ${minRole} (your role: ${session.position || 'unknown'}).`,
    })
  }
}

// Convenience aliases
export const requireAdmin = (event: any) => requireRole(event, 'Admin')
export const requireManager = (event: any) => requireRole(event, 'Manager')
export const requireStaff = (event: any) => requireRole(event, 'Staff')
