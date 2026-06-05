/**
 * GET    /api/pipeline/:id  — get single pipeline record
 * PUT    /api/pipeline/:id  — update a pipeline record
 * DELETE /api/pipeline/:id  — delete a pipeline record
 */
import { defineEventHandler, readBody } from 'h3'
import { Pipeline } from '../../models/Pipeline'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { PipelineUpdateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/pipeline')
  const method = event.node.req.method
  const id = objectId(event.context.params?.id)

  if (method === 'GET') {
    const record = await Pipeline.findById(id).lean()
    if (!record)
      return { success: false, error: 'Not found' }
    return { success: true, data: record }
  }

  if (method === 'PUT') {
    requireManager(event)
    const raw = await readBody(event)
    const data = parseBody(PipelineUpdateSchema, raw)
    const updated = await Pipeline.findByIdAndUpdate(id, { $set: data }, { new: true })
    return { success: true, data: updated }
  }

  if (method === 'DELETE') {
    requireManager(event)
    await Pipeline.findByIdAndDelete(id)
    return { success: true }
  }
})
