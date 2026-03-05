// POST /api/tasks/reorder — batch update order and status after drag-drop
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'

export default defineEventHandler(async (event) => {
    await connectDB()

    const body = await readBody(event)
    // body.updates = [{ _id, status, order }, ...]
    const updates: { _id: string, status: string, order: number }[] = body.updates || []

    if (!updates.length) {
        throw createError({ statusCode: 400, message: 'No updates provided' })
    }

    // Bulk update for performance
    const ops = updates.map(u => ({
        updateOne: {
            filter: { _id: u._id },
            update: { $set: { status: u.status, order: u.order } },
        },
    }))

    await Task.bulkWrite(ops)

    return { success: true }
})
