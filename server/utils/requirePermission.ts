/**
 * requirePermission — server-side workspace CRUD permission enforcement
 *
 * Mirrors the logic in app/composables/usePermissions.ts but runs on the
 * server so API calls can't bypass UI-hidden buttons.
 *
 * Usage (inside defineEventHandler):
 *   import { requirePermission } from '../../utils/requirePermission'
 *   await requirePermission(event, '/tasks', 'delete')
 *
 * Or use the auto-mapper:
 *   await requirePermission(event, '/tasks')  // derives op from HTTP method
 */
import { Employee } from '../models/Employee'
import { Workspace } from '../models/Workspace'
import { connectDB } from './mongoose'

const ADMIN_POSITIONS = ['Super Admin', 'Admin']

type CrudOp = 'create' | 'read' | 'update' | 'delete'

/** Map HTTP method to CRUD operation */
function methodToOp(method: string): CrudOp {
  switch (method.toUpperCase()) {
    case 'POST': return 'create'
    case 'PUT':
    case 'PATCH': return 'update'
    case 'DELETE': return 'delete'
    default: return 'read' // GET, HEAD, OPTIONS
  }
}

/**
 * Load the caller's workspace (cached per request on event.context).
 * Returns the workspace document or null.
 */
async function resolveWorkspace(event: any): Promise<any> {
  // Return cached result if already resolved this request
  if (event.context._workspaceResolved) return event.context._workspace

  event.context._workspaceResolved = true
  event.context._workspace = null

  const session = event.context?.session
  if (!session?.id) return null

  await connectDB()

  // Look up employee to get their workspace field
  const employee = await Employee.findById(session.id).select('workspace position').lean<any>()
  if (!employee) return null

  // Store position from DB (more current than token) on context
  event.context._employeePosition = employee.position || session.position || ''

  if (!employee.workspace) {
    event.context._workspaceEmpty = true // empty workspace = super-user

    // If the super-user is previewing a specific workspace via the switcher,
    // load it so permission checks are enforced server-side too.
    const previewId = getCookie(event, 'active_workspace_id')
    if (previewId) {
      const preview = await Workspace.findById(previewId).lean<any>()
      if (preview) {
        event.context._workspace = preview
        return preview
      }
    }

    // No preview selected (or not found) → full access
    return null
  }

  // Load the workspace document
  const ws = await Workspace.findById(employee.workspace).lean<any>()
  event.context._workspace = ws
  return ws
}

/**
 * Check if the workspace grants a specific CRUD operation on a route.
 * Same logic as app/composables/usePermissions.ts can():
 * - Wildcard admin with no specific perms → full access
 * - perms[route] exists → must include op
 * - Menu in allowedMenus but no perms → all ops granted
 * - Otherwise → deny
 */
function checkPermission(ws: any, routePath: string, op: CrudOp): boolean {
  const allowed: string[] = ws.allowedMenus || []
  const perms: Record<string, string[]> = ws.menuPermissions || {}

  // Wildcard workspace (admin) with no specific perms → full access
  if (allowed.includes('*') && Object.keys(perms).length === 0)
    return true

  // Check if this route has specific permissions defined
  if (perms[routePath] && perms[routePath].length > 0)
    return perms[routePath].includes(op)

  // If menu is allowed but no specific perms → all ops granted
  if (allowed.includes('*') || allowed.includes(routePath))
    return true

  // Not allowed
  return false
}

/**
 * Enforce workspace CRUD permissions on the server.
 * Throws 403 if the caller doesn't have permission.
 *
 * @param event      H3 event
 * @param routePath  Frontend route path (e.g. '/tasks', '/crm/pipeline')
 * @param op         CRUD operation (auto-derived from HTTP method if omitted)
 */
export async function requirePermission(
  event: any,
  routePath: string,
  op?: CrudOp,
): Promise<void> {
  const operation = op || methodToOp(event.method || 'GET')
  const session = event.context?.session

  if (!session) {
    throw createError({ statusCode: 401, message: 'Authentication required.' })
  }

  const position = event.context._employeePosition || session.position || ''
  const isAdmin = ADMIN_POSITIONS.includes(position)

  const ws = await resolveWorkspace(event)

  if (!ws) {
    if (event.context._workspaceEmpty) return // empty workspace = all access (super-user)
    if (isAdmin) return                        // admin with no workspace = allowed
    throw createError({
      statusCode: 403,
      message: `Permission denied: no workspace for ${routePath}.`,
    })
  }

  // Check workspace permissions
  if (!checkPermission(ws, routePath, operation)) {
    throw createError({
      statusCode: 403,
      message: `Permission denied: ${operation} not allowed on ${routePath}.`,
    })
  }
}
