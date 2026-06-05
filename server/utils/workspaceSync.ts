/**
 * Workspace sync utilities — single source of truth for allowedMenus ↔ menuPermissions
 *
 * menuPermissions is the authority. allowedMenus is auto-derived from it
 * to prevent drift between what the sidebar shows and what CRUD gates check.
 */

/**
 * Derive allowedMenus from menuPermissions.
 *
 * Rules:
 * - If menuPermissions contains the wildcard key '*', return ['*'] (admin)
 * - Otherwise, return every route key whose permissions include 'read'
 * - If menuPermissions is empty, return [] (deny all for non-admin)
 *
 * @param perms  The menuPermissions record { '/tasks': ['create','read'], ... }
 * @returns      The derived allowedMenus array
 */
export function deriveAllowedMenus(perms: Record<string, string[]>): string[] {
  if (!perms || Object.keys(perms).length === 0) return []

  // Wildcard: if any key is '*', the workspace is admin-level
  if ('*' in perms) return ['*']

  // Collect all routes that have 'read' in their permission array
  const menus: string[] = []
  for (const [route, ops] of Object.entries(perms)) {
    if (Array.isArray(ops) && ops.includes('read')) {
      menus.push(route)
    }
  }
  return menus
}
