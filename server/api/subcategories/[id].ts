import { SubCategory } from '../../models/SubCategory'
// GET    /api/subcategories/:id
// PUT    /api/subcategories/:id  — update predecessor (or any field)
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { SubcategoryWriteSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)
  await requirePermission(event, '/admin/skills')
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const sub = await SubCategory.findById(id).lean()
    if (!sub)
      throw createError({ statusCode: 404, message: 'SubCategory not found' })
    return { success: true, data: sub }
  }

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(SubcategoryWriteSchema.partial(), raw)

    const updated = await SubCategory.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean()
    if (!updated)
      throw createError({ statusCode: 404, message: 'SubCategory not found' })
    return { success: true, data: updated }
  }

  if (event.method === 'DELETE') {
    const deleted = await SubCategory.findByIdAndDelete(id).lean()
    if (!deleted)
      throw createError({ statusCode: 404, message: 'SubCategory not found' })
    return { success: true, data: deleted }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

