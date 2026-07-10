import { defineEventHandler, readBody } from 'h3'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { CustomerUpdateSchema, objectId, parseBody } from '../../utils/validation'
import { actorFromEvent, fireAutomations } from '../../utils/automationEngine'

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/pipeline')
  const method = event.node.req.method
  const id = objectId(event.context.params?.id)

  if (method === 'GET') {
    const customer = await Customer.findById(id).lean()
    if (!customer)
      return { success: false, error: 'Not found' }
    return { success: true, data: customer }
  }

  if (method === 'PUT') {
    requireManager(event)
    const raw = await readBody(event)
    const data = parseBody(CustomerUpdateSchema, raw)
    const before = await Customer.findById(id).lean()
    const updated = await Customer.findByIdAndUpdate(id, { $set: data }, { new: true })
    fireAutomations({ module: 'crm', submodule: 'customers', action: 'update', before, after: updated?.toObject?.() || updated, actor: actorFromEvent(event) })
    return { success: true, data: updated }
  }

  if (method === 'DELETE') {
    requireManager(event)
    const before = await Customer.findById(id).lean()
    await Customer.findByIdAndDelete(id)
    fireAutomations({ module: 'crm', submodule: 'customers', action: 'delete', before, actor: actorFromEvent(event) })
    return { success: true }
  }
})
