/**
 * GET    /api/change-orders/:id — get a single change order (full detail)
 * PUT    /api/change-orders/:id — update a change order
 * DELETE /api/change-orders/:id — delete a change order
 */
import { ChangeOrder } from '../../models/ChangeOrder'
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { stripHiddenFields, sanitizeWriteBody } from '../../utils/applyFieldPermissions'
import { ChangeOrderUpdateSchema, objectId, parseBody } from '../../utils/validation'
import { requireManager } from '../../utils/requireRole'
import { actorFromEvent, fireAutomations } from '../../utils/automationEngine'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  await requirePermission(event, '/crm/change-orders')

  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const doc = await ChangeOrder.findById(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Change order not found' })
    return { success: true, data: stripHiddenFields(event, '/crm/change-orders', doc as any) }
  }

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const body = parseBody(ChangeOrderUpdateSchema, raw)
    const cleaned = sanitizeWriteBody(event, '/crm/change-orders', body)

    const before = await ChangeOrder.findById(id).lean()
    const doc = await ChangeOrder.findByIdAndUpdate(id, { $set: cleaned }, { new: true }).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Change order not found' })
    fireAutomations({ module: 'crm', submodule: 'change-orders', action: 'update', before, after: doc, actor: actorFromEvent(event) })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    const doc = await ChangeOrder.findByIdAndDelete(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Change order not found' })
    fireAutomations({ module: 'crm', submodule: 'change-orders', action: 'delete', before: doc, actor: actorFromEvent(event) })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
