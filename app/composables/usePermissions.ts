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
 *   if (can('delete', '/admin/employees')) { ... }
 */
export function usePermissions(routeOverride?: string) {
    // Active workspace (mirrors logic in AppSidebar.vue)
    const { data: workspacesRes } = useNuxtData('workspaces-list')
    const activeTeamId = useCookie<string>('active_workspace_id')
    const userCookie = useCookie<{ workspace?: string } | null>('hardwood_user')
    const route = useRoute()

    const activeTeam = computed(() => {
        const allTeams: any[] = workspacesRes.value?.data || []

        // Filter to user's assigned workspace if set
        const userWs = userCookie.value?.workspace
        const teams = userWs
            ? allTeams.filter((t: any) => t._id === userWs) || allTeams
            : allTeams

        const t = teams.find((t: any) => t._id === activeTeamId.value)
        return t || teams[0] || { allowedMenus: ['*'], menuPermissions: {} }
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
        if (!ws) return true // no workspace context → allow all

        const allowed: string[] = ws.allowedMenus || []
        const perms: Record<string, string[]> = ws.menuPermissions || {}
        const target = routePath || currentRoute.value

        // Wildcard workspace (admin) with no specific perms → full access
        if (allowed.includes('*') && Object.keys(perms).length === 0) return true

        // Check if this route has specific permissions defined
        if (perms[target] && perms[target].length > 0) {
            return perms[target].includes(op)
        }

        // If menu is allowed but no specific perms → all ops granted
        if (allowed.includes('*') || allowed.includes(target)) return true

        // Not allowed at all
        return false
    }

    function canCreate(routePath?: string) { return can('create', routePath) }
    function canRead(routePath?: string) { return can('read', routePath) }
    function canUpdate(routePath?: string) { return can('update', routePath) }
    function canDelete(routePath?: string) { return can('delete', routePath) }

    return {
        can,
        canCreate,
        canRead,
        canUpdate,
        canDelete,
        activeTeam,
    }
}
