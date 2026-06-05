import { ContractTemplate } from '../../../models/ContractTemplate'
// GET    /api/contracts/templates/:id — get a single template
// PUT    /api/contracts/templates/:id — update a template
// DELETE /api/contracts/templates/:id — delete a template
import { connectDB } from '../../../utils/mongoose'
import { requireAdmin, requireManager } from '../../../utils/requireRole'
import { requirePermission } from '../../../utils/requirePermission'
import { ContractTemplateUpdateSchema, objectId, parseBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  await requirePermission(event, '/crm/contracts')
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const doc = await ContractTemplate.findById(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Template not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(ContractTemplateUpdateSchema, raw)
    const doc = await ContractTemplate.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Template not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    await ContractTemplate.findByIdAndDelete(id)
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
