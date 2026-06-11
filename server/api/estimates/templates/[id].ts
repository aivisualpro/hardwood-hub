import { EstimateTemplate } from '../../../models/EstimateTemplate'
// GET    /api/estimates/templates/:id — get a single template
// PUT    /api/estimates/templates/:id — update a template
// DELETE /api/estimates/templates/:id — delete a template
import { connectDB } from '../../../utils/mongoose'
import { requireManager } from '../../../utils/requireRole'
import { requirePermission } from '../../../utils/requirePermission'
import { EstimateTemplateUpdateSchema, objectId, parseBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  await requirePermission(event, '/crm/estimates')
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const doc = await EstimateTemplate.findById(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Template not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(EstimateTemplateUpdateSchema, raw)
    const doc = await EstimateTemplate.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Template not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    await EstimateTemplate.findByIdAndDelete(id)
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
