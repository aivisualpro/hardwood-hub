/**
 * GET  /api/notifications/automations — list automation rules (Manager+)
 * POST /api/notifications/automations — create a rule (Admin+)
 */
import { NotificationAutomation } from '../../../models/NotificationAutomation'
import { connectDB } from '../../../utils/mongoose'
import { requireAdmin, requireManager } from '../../../utils/requireRole'
import { findSubmodule } from '../../../utils/automationRegistry'
import { AutomationSchema } from '../../../utils/automationSchema'
import { parseBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()

  if (event.method === 'GET') {
    requireManager(event)
    const rules = await NotificationAutomation.find()
      .sort({ createdAt: -1 })
      .lean()
    return {
      success: true,
      data: rules.map((r: any) => ({
        ...r,
        _id: String(r._id),
        assignees: (r.assignees || []).map(String),
      })),
    }
  }

  if (event.method === 'POST') {
    requireAdmin(event)
    const raw = await readBody(event)
    const data = parseBody(AutomationSchema, raw)

    if (!findSubmodule(data.module, data.submodule))
      throw createError({ statusCode: 400, message: `Unknown module/submodule: ${data.module}/${data.submodule}` })

    const session = (event.context as any).session
    const doc = await NotificationAutomation.create({
      ...data,
      createdBy: session?.email || '',
    })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
