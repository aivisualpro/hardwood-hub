import { StainSignOff } from '../../models/StainSignOff'
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { StainSignOffUpdateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  await requirePermission(event, '/external/stain-sign-off')
  const id = objectId(getRouterParam(event, 'id'))

  if (!id)
    throw createError({ statusCode: 400, message: 'ID is required' })

  if (event.method === 'GET') {
    const doc = await StainSignOff.findById(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(StainSignOffUpdateSchema, raw)
    const doc = await StainSignOff.findByIdAndUpdate(id, data, { new: true })
    if (!doc)
      throw createError({ statusCode: 404, message: 'Not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    const doc = await StainSignOff.findByIdAndDelete(id)
    if (!doc)
      throw createError({ statusCode: 404, message: 'Not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
