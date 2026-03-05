// GET  /api/skill-bonus   — list all skill bonus records
// POST /api/skill-bonus   — create a skill bonus record
import { connectDB } from '../../utils/mongoose'
import { SkillBonus } from '../../models/SkillBonus'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const docs = await SkillBonus.find().sort({ createdAt: -1 }).lean<any[]>()
        return { success: true, data: docs }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { skillSet, reviewedTimes, supervisorCheck, bonusAmount } = body
        if (!skillSet)
            throw createError({ statusCode: 400, message: 'skillSet is required' })

        const doc = await SkillBonus.create({
            skillSet,
            reviewedTimes: reviewedTimes ?? 1,
            supervisorCheck: supervisorCheck ?? '',
            bonusAmount: bonusAmount ?? 0,
        })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
