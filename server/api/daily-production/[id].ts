import { DailyProduction } from '../../models/DailyProduction'
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { DailyProductionUpdateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  const id = objectId(getRouterParam(event, 'id'))

  if (!id)
    throw createError({ statusCode: 400, message: 'ID is required' })

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(DailyProductionUpdateSchema, raw)
    const doc = await DailyProduction.findByIdAndUpdate(id, data, { new: true })
    if (!doc)
      throw createError({ statusCode: 404, message: 'Not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    const doc = await DailyProduction.findByIdAndDelete(id)
    if (!doc)
      throw createError({ statusCode: 404, message: 'Not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
