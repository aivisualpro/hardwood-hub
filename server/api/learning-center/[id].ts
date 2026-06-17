import { LearningResource } from '../../models/LearningResource'
// GET    /api/learning-center/:id  — single resource (any authenticated employee)
// PUT    /api/learning-center/:id  — update (admins / super-users only)
// DELETE /api/learning-center/:id  — delete (admins / super-users only)
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { LearningResourceUpdateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const doc = await LearningResource.findById(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Resource not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'PUT') {
    await requirePermission(event, '/learning-center')
    const data = parseBody(LearningResourceUpdateSchema, await readBody(event))
    const updated = await LearningResource.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).lean()
    if (!updated)
      throw createError({ statusCode: 404, message: 'Resource not found' })
    return { success: true, data: updated }
  }

  if (event.method === 'DELETE') {
    await requirePermission(event, '/learning-center')
    const deleted = await LearningResource.findByIdAndDelete(id).lean()
    if (!deleted)
      throw createError({ statusCode: 404, message: 'Resource not found' })
    return { success: true, message: 'Resource deleted' }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
