// GET  /api/skills         — list all skills
// POST /api/skills         — create a skill
import { connectDB } from '../../utils/mongoose'
import { Skill } from '../../models/Skill'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const skills = await Skill.find().sort({ skill: 1 }).lean()
        return { success: true, data: skills }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { skill, category, subCategory, description, level, icon, isRequired } = body
        if (!skill || !category || !subCategory)
            throw createError({ statusCode: 400, message: 'skill, category and subCategory are required' })
        const doc = await Skill.create({ skill, category, subCategory, description, level, icon, isRequired: isRequired ?? false })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
