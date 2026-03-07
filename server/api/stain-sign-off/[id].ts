import { connectDB } from '../../utils/mongoose'
import { StainSignOff } from '../../models/StainSignOff'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (!id) throw createError({ statusCode: 400, message: 'ID is required' })

    if (event.method === 'GET') {
        const doc = await StainSignOff.findById(id).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Not found' })
        return { success: true, data: doc }
    }

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const doc = await StainSignOff.findByIdAndUpdate(id, body, { new: true })
        if (!doc) throw createError({ statusCode: 404, message: 'Not found' })
        return { success: true, data: doc }
    }

    if (event.method === 'DELETE') {
        const doc = await StainSignOff.findByIdAndDelete(id)
        if (!doc) throw createError({ statusCode: 404, message: 'Not found' })
        return { success: true }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
