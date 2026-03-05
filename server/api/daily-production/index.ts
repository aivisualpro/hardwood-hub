import { connectDB } from '../../utils/mongoose'
import { DailyProduction } from '../../models/DailyProduction'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const docs = await DailyProduction.find().sort({ createdAt: -1 }).lean<any[]>()
        return { success: true, data: docs }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const doc = await DailyProduction.create(body)
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
