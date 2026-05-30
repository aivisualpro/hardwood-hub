import { EmpSkillPerformance } from '../../models/EmpSkillPerformance'
// PUT    /api/performance/:id — update a performance record
// DELETE /api/performance/:id — delete a performance record
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { PerformanceUpdateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(PerformanceUpdateSchema, raw)
    const doc = await EmpSkillPerformance.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Record not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    const doc = await EmpSkillPerformance.findByIdAndDelete(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Record not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

