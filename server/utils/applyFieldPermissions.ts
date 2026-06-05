/**
 * applyFieldPermissions — server-side field-level security enforcement
 *
 * Two helpers:
 *   stripHiddenFields  — for GET responses: removes fields whose mode is 'hidden'
 *   sanitizeWriteBody  — for POST/PUT:      deletes fields whose mode is 'read' or 'hidden'
 *
 * Both reuse the per-request workspace cached by requirePermission via
 * event.context._workspace / event.context._workspaceResolved.
 *
 * Admin-tier users bypass all field restrictions.
 */

// Server-side ROUTE_FIELDS registry — mirrors app/constants/routeFields.ts
// Kept in sync manually. Only keys matter here (labels are UI-only).
const ROUTE_FIELD_KEYS: Record<string, string[]> = {
  '/hr/employees': ['employee', 'email', 'position', 'status', 'workspace', 'basePay'],
  '/crm/pipeline': ['name', 'email', 'phone', 'address', 'status', 'totalEstimate', 'assignedTo', 'notes'],
  '/crm/products': ['sku', 'description', 'salesPrice', 'costPrice', 'vendor', 'manufacturer', 'type', 'unit'],
  '/tasks': ['title', 'description', 'priority', 'status', 'assignees', 'dueDate'],
  '/crm/contracts': ['title', 'status', 'content', 'notes', 'customerName', 'customerEmail'],
}

const ADMIN_POSITIONS = ['Super Admin', 'Admin']

type FieldMode = 'hidden' | 'read' | 'edit'

/**
 * Resolve a single field's effective mode.
 * Mirrors the clamping logic from usePermissions.fieldMode():
 * - Stored value from fieldPermissions takes priority
 * - Unset defaults to 'edit' if menu has update, else 'read'
 * - Clamped: 'edit' → 'read' if no update; anything → 'hidden' if no read
 */
function resolveFieldMode(
  ws: any,
  routePath: string,
  fieldKey: string,
): FieldMode {
  const allowed: string[] = ws?.allowedMenus || []
  const perms: Record<string, string[]> = ws?.menuPermissions || {}
  const fieldPerms: Record<string, Record<string, string>> = ws?.fieldPermissions || {}

  // Check menu-level CRUD ops using same logic as requirePermission
  function menuHasOp(op: string): boolean {
    if (allowed.includes('*') && Object.keys(perms).length === 0) return true
    const routePerms = perms[routePath]
    if (routePerms && routePerms.length > 0) return routePerms.includes(op)
    if (allowed.includes('*') || allowed.includes(routePath)) return true
    return false
  }

  const hasRead = menuHasOp('read')
  const hasUpdate = menuHasOp('update')

  if (!hasRead) return 'hidden'

  const stored = fieldPerms[routePath]?.[fieldKey]

  if (stored) {
    if (stored === 'edit' && !hasUpdate) return 'read'
    if (stored === 'hidden') return 'hidden'
    return stored as FieldMode
  }

  return hasUpdate ? 'edit' : 'read'
}

/**
 * Strip hidden fields from GET response data.
 * Accepts a single document or an array of documents.
 * Returns the filtered data (mutates in place for perf).
 */
export function stripHiddenFields<T>(
  event: any,
  routePath: string,
  data: T,
): T {
  // Admin bypass
  const position = event.context._employeePosition || event.context?.session?.position || ''
  if (ADMIN_POSITIONS.includes(position)) return data

  const ws = event.context._workspace
  if (!ws) return data // no workspace → no stripping

  const fieldKeys = ROUTE_FIELD_KEYS[routePath]
  if (!fieldKeys) return data // route not registered

  // Collect hidden fields for this route
  const hiddenFields: string[] = []
  for (const key of fieldKeys) {
    if (resolveFieldMode(ws, routePath, key) === 'hidden') {
      hiddenFields.push(key)
    }
  }

  if (hiddenFields.length === 0) return data

  // Strip from single doc or array
  if (Array.isArray(data)) {
    for (const doc of data) {
      for (const key of hiddenFields) {
        delete (doc as any)[key]
      }
    }
  }
  else if (data && typeof data === 'object') {
    for (const key of hiddenFields) {
      delete (data as any)[key]
    }
  }

  return data
}

/**
 * Sanitize a write body (POST/PUT) by removing fields that the user's
 * workspace marks as 'read' or 'hidden'. This prevents users from
 * modifying fields they shouldn't be able to change.
 *
 * Returns the cleaned body.
 */
export function sanitizeWriteBody(
  event: any,
  routePath: string,
  body: Record<string, any>,
): Record<string, any> {
  // Admin bypass
  const position = event.context._employeePosition || event.context?.session?.position || ''
  if (ADMIN_POSITIONS.includes(position)) return body

  const ws = event.context._workspace
  if (!ws) return body

  const fieldKeys = ROUTE_FIELD_KEYS[routePath]
  if (!fieldKeys) return body

  for (const key of fieldKeys) {
    if (!(key in body)) continue // field not in payload — skip
    const mode = resolveFieldMode(ws, routePath, key)
    if (mode === 'hidden' || mode === 'read') {
      delete body[key]
    }
  }

  return body
}
