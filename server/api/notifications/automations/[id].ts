/**
 * PUT    /api/notifications/automations/:id — update a rule (Admin+)
 * PATCH  /api/notifications/automations/:id — toggle enabled { enabled } (Admin+)
 * DELETE /api/notifications/automations/:id — delete a rule (Admin+)
 */
import { NotificationAutomation } from '../../../models/NotificationAutomation'
import { connectDB } from '../../../utils/mongoose'
import { requireAdmin } from '../../../utils/requireRole'
import { findSubmodule } from '../../../utils/automationRegistry'
import { AutomationSchema } from '../../../utils/automationSchema'
import { objectId, parseBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)
  const id = objectId(event.context.params?.id)

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(AutomationSchema, raw)
    if (!findSubmodule(data.module, data.submodule))
      throw createError({ statusCode: 400, message: `Unknown module/submodule: ${data.module}/${data.submodule}` })
    const doc = await NotificationAutomation.findByIdAndUpdate(id, { $set: data }, { new: true }).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Automation not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'PATCH') {
    const body = await readBody(event)
    const doc = await NotificationAutomation.findByIdAndUpdate(
      id,
      { $set: { enabled: !!body?.enabled } },
      { new: true },
    ).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Automation not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    await NotificationAutomation.findByIdAndDelete(id)
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
