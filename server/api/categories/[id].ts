import { Category } from '../../models/Category'
// GET    /api/categories/:id
// PUT    /api/categories/:id  — update name, color, etc.
// DELETE /api/categories/:id
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { CategoryWriteSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const cat = await Category.findById(id).lean()
    if (!cat)
      throw createError({ statusCode: 404, message: 'Category not found' })
    return { success: true, data: cat }
  }

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(CategoryWriteSchema.partial(), raw)
    const update: Record<string, any> = {}
    if (data.category !== undefined)
      update.category = data.category
    if (data.icon !== undefined)
      update.icon = data.icon
    if (data.color !== undefined)
      update.color = data.color
    if (data.order !== undefined)
      update.order = data.order

    const updated = await Category.findByIdAndUpdate(id, update, { returnDocument: 'after' }).lean()
    if (!updated)
      throw createError({ statusCode: 404, message: 'Category not found' })
    return { success: true, data: updated }
  }

  if (event.method === 'DELETE') {
    const deleted = await Category.findByIdAndDelete(id).lean()
    if (!deleted)
      throw createError({ statusCode: 404, message: 'Category not found' })
    return { success: true, data: deleted }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

