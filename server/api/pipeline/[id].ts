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
import { stripHiddenFields, sanitizeWriteBody } from '../../utils/applyFieldPermissions'
import { PipelineUpdateSchema, objectId, parseBody } from '../../utils/validation'
import { actorFromEvent, fireAutomations } from '../../utils/automationEngine'

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/pipeline')
  const method = event.node.req.method
  const id = objectId(event.context.params?.id)

  if (method === 'GET') {
    const record = await Pipeline.findById(id).lean()
    if (!record)
      return { success: false, error: 'Not found' }
    return { success: true, data: stripHiddenFields(event, '/crm/pipeline', record) }
  }

  if (method === 'PUT') {
    requireManager(event)
    const raw = await readBody(event)
    const data = parseBody(PipelineUpdateSchema, raw)
    const cleaned = sanitizeWriteBody(event, '/crm/pipeline', data)
    const before = await Pipeline.findById(id).lean()
    const updated = await Pipeline.findByIdAndUpdate(id, { $set: cleaned }, { new: true })
    fireAutomations({ module: 'crm', submodule: 'pipeline', action: 'update', before, after: updated?.toObject?.() || updated, actor: actorFromEvent(event) })
    return { success: true, data: updated }
  }

  if (method === 'DELETE') {
    requireManager(event)
    const before = await Pipeline.findById(id).lean()
    await Pipeline.findByIdAndDelete(id)
    fireAutomations({ module: 'crm', submodule: 'pipeline', action: 'delete', before, actor: actorFromEvent(event) })
    return { success: true }
  }
})
