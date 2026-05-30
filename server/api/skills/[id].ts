import { Skill } from '../../models/Skill'
// GET    /api/skills/:id
// PUT    /api/skills/:id
// DELETE /api/skills/:id
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { SkillWriteSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const skill = await Skill.findById(id).lean()
    if (!skill)
      throw createError({ statusCode: 404, message: 'Skill not found' })
    return { success: true, data: skill }
  }

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(SkillWriteSchema.partial(), raw)

    const updated = await Skill.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean()
    if (!updated)
      throw createError({ statusCode: 404, message: 'Skill not found' })
    return { success: true, data: updated }
  }

  if (event.method === 'DELETE') {
    await Skill.findByIdAndDelete(id)
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

