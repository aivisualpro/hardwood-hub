// PUT    /api/tasks/:id   — update a task (including status change for drag-drop)
// DELETE /api/tasks/:id   — delete a task
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const doc = await Task.findByIdAndUpdate(id, body, { new: true }).lean<any>()
        if (!doc) throw createError({ statusCode: 404, message: 'Task not found' })
        return { success: true, data: doc }
    }

    if (event.method === 'DELETE') {
        const doc = await Task.findByIdAndDelete(id).lean<any>()
        if (!doc) throw createError({ statusCode: 404, message: 'Task not found' })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
