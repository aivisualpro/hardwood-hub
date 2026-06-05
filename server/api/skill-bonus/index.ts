import { SkillBonus } from '../../models/SkillBonus'
// GET  /api/skill-bonus   — list all skill bonus records
// POST /api/skill-bonus   — create a skill bonus record
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { SkillBonusWriteSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()

  if (event.method === 'GET') {
    // Read access: anyone with /hr/employee-performance can view skill bonuses
    await requirePermission(event, '/hr/employee-performance', 'read')
    const docs = await SkillBonus.find().sort({ createdAt: -1 }).lean<any[]>()
    return { success: true, data: docs }
  }

  if (event.method === 'POST') {
    // Write access: only users with /admin/skills create permission
    await requirePermission(event, '/admin/skills', 'create')
    const raw = await readBody(event)
    const data = parseBody(SkillBonusWriteSchema, raw)
    const doc = await SkillBonus.create(data)
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

