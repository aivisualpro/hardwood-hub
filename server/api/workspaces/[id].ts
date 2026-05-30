import { Workspace } from '../../models/Workspace'
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { WorkspaceCreateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)
  const id = objectId(getRouterParam(event, 'id'))

  if (!id)
    throw createError({ statusCode: 400, message: 'ID is required' })

  if (event.method === 'PUT') {
    const wp = await Workspace.findById(id)
    if (!wp)
      throw createError({ statusCode: 404, message: 'Workspace not found' })

    if (wp.isLocked) {
      // Cannot change name/logo of locked workspace, maybe just menus but Admin must have all
      throw createError({ statusCode: 403, message: 'Cannot modify a locked workspace' })
    }

    const raw = await readBody(event)
    const data = parseBody(WorkspaceCreateSchema.partial(), raw)

    const doc = await Workspace.findByIdAndUpdate(
      id,
      {
        name: data.name,
        logo: data.logo,
        plan: data.plan,
        allowedMenus: data.allowedMenus,
        menuPermissions: data.menuPermissions || {},
      },
      { new: true },
    )
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
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
