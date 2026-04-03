/**
 * GET    /api/contracts/detail/:id — get single contract
 * PUT    /api/contracts/detail/:id — update a contract
 * DELETE /api/contracts/detail/:id — delete a contract
 */
import { connectDB } from '../../../utils/mongoose'
import { Contract } from '../../../models/Contract'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (event.method === 'GET') {
        const doc = await Contract.findById(id).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Contract not found' })
        return { success: true, data: doc }
    }

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const doc = await Contract.findByIdAndUpdate(id, body, { returnDocument: 'after' }).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Contract not found' })
        return { success: true, data: doc }
    }

    if (event.method === 'DELETE') {
        await Contract.findByIdAndDelete(id)
        return { success: true }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
