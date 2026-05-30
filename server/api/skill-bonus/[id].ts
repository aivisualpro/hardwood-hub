import { SkillBonus } from '../../models/SkillBonus'
// PUT    /api/skill-bonus/:id — update
// DELETE /api/skill-bonus/:id — delete
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { SkillBonusUpdateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(SkillBonusUpdateSchema, raw)
    const doc = await SkillBonus.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Record not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    const doc = await SkillBonus.findByIdAndDelete(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Record not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

