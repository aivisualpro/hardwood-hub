import { Workspace } from '../../models/Workspace'
import { connectDB } from '../../utils/mongoose'
import { requireAdmin } from '../../utils/requireRole'
import { WorkspaceCreateSchema, parseBody } from '../../utils/validation'
import { deriveAllowedMenus } from '../../utils/workspaceSync'

export default defineEventHandler(async (event) => {
  await connectDB()

  if (event.method === 'GET') {
    const docs = await Workspace.find().sort({ createdAt: 1 }).lean<any[]>()

    // Seed Admin Workspace if empty
    if (docs.length === 0) {
      const admin = await Workspace.create({
        name: 'Admin Workspace',
        logo: 'i-lucide-shield-check',
        plan: 'Full Access',
        allowedMenus: ['*'], // We'll interpret ['*'] or empty string as everything
        isLocked: true,
      })
      return { success: true, data: [admin] }
    }

    return { success: true, data: docs }
  }

  if (event.method === 'POST') {
    requireAdmin(event)
    const raw = await readBody(event)
    const data = parseBody(WorkspaceCreateSchema, raw)

    // Auto-derive allowedMenus from menuPermissions to keep them in sync
    const perms = data.menuPermissions || {}
    const menus = Object.keys(perms).length > 0
      ? deriveAllowedMenus(perms)
      : (data.allowedMenus || [])

    const doc = await Workspace.create({
      name: data.name,
      logo: data.logo || 'i-lucide-building',
      plan: data.plan || 'Workspace',
      allowedMenus: menus,
      menuPermissions: perms,
      isLocked: false,
    })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
