import { connectDB } from '../../utils/mongoose'
import { DailyProduction } from '../../models/DailyProduction'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (!id) throw createError({ statusCode: 400, message: 'ID is required' })

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const doc = await DailyProduction.findByIdAndUpdate(id, body, { new: true })
        if (!doc) throw createError({ statusCode: 404, message: 'Not found' })
        return { success: true, data: doc }
    }

    if (event.method === 'DELETE') {
        const doc = await DailyProduction.findByIdAndDelete(id)
        if (!doc) throw createError({ statusCode: 404, message: 'Not found' })
        return { success: true }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
