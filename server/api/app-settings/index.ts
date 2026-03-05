// GET  /api/app-settings          — list all settings
// POST /api/app-settings          — upsert a setting { key, value, description? }
import { connectDB } from '../../utils/mongoose'
import { AppSetting } from '../../models/AppSetting'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const docs = await AppSetting.find().lean<any[]>()
        // Return as key→value map for convenience
        const map: Record<string, any> = {}
        for (const d of docs) map[d.key] = d.value
        return { success: true, data: map, docs }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { key, value, description } = body
        if (!key) throw createError({ statusCode: 400, message: 'key is required' })

        const doc = await AppSetting.findOneAndUpdate(
            { key },
            { value, description: description ?? '' },
            { upsert: true, returnDocument: 'after' },
        ).lean()
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
