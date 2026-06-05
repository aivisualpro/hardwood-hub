import { Workspace } from '../../models/Workspace'
import { connectDB } from '../../utils/mongoose'
import { requireAdmin } from '../../utils/requireRole'
import { WorkspaceUpdateSchema, objectId, parseBody } from '../../utils/validation'
import { deriveAllowedMenus } from '../../utils/workspaceSync'

export default defineEventHandler(async (event) => {
  await connectDB()
  const id = objectId(getRouterParam(event, 'id'))

  if (!id)
    throw createError({ statusCode: 400, message: 'ID is required' })

  if (event.method === 'GET') {
    const doc = await Workspace.findById(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Workspace not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'PUT') {
    requireAdmin(event)
    const wp = await Workspace.findById(id)
    if (!wp)
      throw createError({ statusCode: 404, message: 'Workspace not found' })

    const raw = await readBody(event)
    const data = parseBody(WorkspaceUpdateSchema, raw)

    // Only $set keys that were actually sent — omitted fields stay untouched
    const $set: Record<string, any> = {}

    // Locked workspaces: only allowedMenus/menuPermissions can be edited
    if (wp.isLocked) {
      if (data.name !== undefined || data.logo !== undefined || data.plan !== undefined) {
        throw createError({
          statusCode: 403,
          message: 'Locked workspace: only menu permissions can be edited. Name, logo, and plan are immutable.',
        })
      }
    }
    else {
      // Unlocked: allow identity fields
      if (data.name !== undefined) $set.name = data.name
      if (data.logo !== undefined) $set.logo = data.logo
      if (data.plan !== undefined) $set.plan = data.plan
    }

    // Permission fields — always editable
    if (data.menuPermissions !== undefined) {
      $set.menuPermissions = data.menuPermissions
      // Auto-derive allowedMenus from menuPermissions to keep them in sync
      $set.allowedMenus = deriveAllowedMenus(data.menuPermissions)
    }
    else if (data.allowedMenus !== undefined) {
      // If only allowedMenus is sent without menuPermissions, just set it
      $set.allowedMenus = data.allowedMenus
    }

    if (Object.keys($set).length === 0) {
      return { success: true, data: wp }
    }

    const doc = await Workspace.findByIdAndUpdate(id, { $set }, { new: true })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    requireAdmin(event)
    const wp = await Workspace.findById(id)
    if (!wp)
      throw createError({ statusCode: 404, message: 'Workspace not found' })

    if (wp.isLocked) {
      throw createError({ statusCode: 403, message: 'Cannot delete a locked workspace' })
    }

    await Workspace.findByIdAndDelete(id)
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
