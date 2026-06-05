/**
 * usePermissions — workspace-based CRUD permissions composable
 *
 * Reads the active workspace's menuPermissions and exposes helpers
 * to check whether the current user can create / read / update / delete
 * on any given route.
 *
 * Usage:
 *   const { canCreate, canRead, canUpdate, canDelete, can } = usePermissions()
 *   if (canCreate('/tasks')) { ... }
 *   if (can('delete', '/hr/employees')) { ... }
 */
export function usePermissions(routeOverride?: string) {
  // Active workspace — shares the same cached fetch as AppSidebar.vue.
  // useNuxtData reads from the useAsyncData('workspaces-list') cache without
  // triggering an additional network request.
  const { data: workspacesRes } = useNuxtData('workspaces-list')
  const activeTeamId = useCookie<string>('active_workspace_id')

  // Read workspace from the shared auth state instead of the cookie snapshot.
  // This is always reactive — updates immediately after login without a reload.
  const { user } = useAuth()
  const route = useRoute()

  // Admin-tier positions that get wildcard access when no workspace is assigned
  const ADMIN_POSITIONS = ['Super Admin', 'Admin']

  const isAdminTier = computed(() =>
    ADMIN_POSITIONS.includes(user.value?.position || ''),
  )

  const activeTeam = computed(() => {
    const allTeams: any[] = workspacesRes.value?.data || []

    // Filter to user's assigned workspace if set
    const userWs = user.value?.workspace
    const teams = userWs
      ? allTeams.filter((t: any) => String(t._id) === String(userWs))
      : allTeams

    const t = teams.find((t: any) => String(t._id) === String(activeTeamId.value))
    if (t) return t
    if (teams[0]) return teams[0]

    // Fallback: no workspace resolved
    // FAIL CLOSED: only admin-tier users with no assigned workspace get wildcard
    if (!userWs && isAdminTier.value)
      return { allowedMenus: ['*'], menuPermissions: {} }

    // Everyone else: deny all
    return { allowedMenus: [], menuPermissions: {} }
  })

  const currentRoute = computed(() => routeOverride || route.path)

  /**
   * Check if the workspace grants a specific operation on a route.
   * - If allowedMenus includes '*' AND no menuPermissions are set → full access
   * - If menuPermissions exist for the route → use those
   * - If the menu is in allowedMenus but no menuPermissions → all ops allowed
   */
  function can(op: 'create' | 'read' | 'update' | 'delete', routePath?: string): boolean {
    const ws = activeTeam.value
    if (!ws)
      return isAdminTier.value // fail closed for non-admins

    const allowed: string[] = ws.allowedMenus || []
    const perms: Record<string, string[]> = ws.menuPermissions || {}
    const target = routePath || currentRoute.value

    // Wildcard workspace (admin) with no specific perms → full access
    if (allowed.includes('*') && Object.keys(perms).length === 0)
      return true

    // Check if this route has specific permissions defined
    if (perms[target] && perms[target].length > 0)
      return perms[target].includes(op)

    // If menu is allowed but no specific perms → all ops granted
    if (allowed.includes('*') || allowed.includes(target))
      return true

    // Not allowed at all
    return false
  }

  function canCreate(routePath?: string) { return can('create', routePath) }
  function canRead(routePath?: string) { return can('read', routePath) }
  function canUpdate(routePath?: string) { return can('update', routePath) }
  function canDelete(routePath?: string) { return can('delete', routePath) }

  /**
   * Resolve a field's visibility mode within a menu:
   * - 'edit'   → field is visible and editable
   * - 'read'   → field is visible but disabled/readonly
   * - 'hidden' → field is not shown at all
   *
   * If fieldPermissions has no entry for the field, defaults to:
   *   'edit' if menu grants update, else 'read' if grants read, else 'hidden'.
   * The result is clamped: 'edit' → 'read' if menu lacks update;
   * anything → 'hidden' if menu lacks read.
   */
  function fieldMode(field: string, routePath?: string): 'hidden' | 'read' | 'edit' {
    const ws = activeTeam.value
    const target = routePath || currentRoute.value
    const menuHasUpdate = can('update', target)
    const menuHasRead = can('read', target)

    // If no read at all, the whole menu is hidden
    if (!menuHasRead) return 'hidden'

    const stored = ws?.fieldPermissions?.[target]?.[field] as string | undefined

    if (stored) {
      if (stored === 'edit' && !menuHasUpdate) return 'read'
      if (stored === 'hidden') return 'hidden'
      return stored as 'hidden' | 'read' | 'edit'
    }

    // Default: inherit from menu level
    return menuHasUpdate ? 'edit' : 'read'
  }

  return {
    can,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    fieldMode,
    activeTeam,
  }
}
