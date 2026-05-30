import { Skill } from '../../models/Skill'
// GET  /api/skills         — list all skills
// POST /api/skills         — create a skill
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { SkillWriteSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)

  if (event.method === 'GET') {
    const skills = await Skill.find().sort({ skill: 1 }).lean()
    return { success: true, data: skills }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const data = parseBody(SkillWriteSchema, raw)
    const doc = await Skill.create(data)
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

