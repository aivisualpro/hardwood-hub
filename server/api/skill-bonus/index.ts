import { SkillBonus } from '../../models/SkillBonus'
// GET  /api/skill-bonus   — list all skill bonus records
// POST /api/skill-bonus   — create a skill bonus record
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { SkillBonusWriteSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)
  await requirePermission(event, '/admin/skills')

  if (event.method === 'GET') {
    const docs = await SkillBonus.find().sort({ createdAt: -1 }).lean<any[]>()
    return { success: true, data: docs }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const data = parseBody(SkillBonusWriteSchema, raw)
    const doc = await SkillBonus.create(data)
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

