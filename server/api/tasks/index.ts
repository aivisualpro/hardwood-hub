// GET  /api/tasks          — list tasks, grouped by status, with pagination per column
// POST /api/tasks          — create a task
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const query = getQuery(event)
        const status = query.status as string | undefined       // filter by column
        const limit = parseInt(query.limit as string) || 20
        const skip = parseInt(query.skip as string) || 0

        if (status) {
            // Load specific column with pagination
            const [tasks, total] = await Promise.all([
                Task.find({ status }).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit).lean<any[]>(),
                Task.countDocuments({ status }),
            ])
            return { success: true, data: tasks, total, hasMore: skip + tasks.length < total }
        }

        // Load all columns (initial load) — limited per column
        const statuses = ['todo', 'in-progress', 'in-review', 'done']
        const columns: Record<string, { tasks: any[], total: number, hasMore: boolean }> = {}

        await Promise.all(statuses.map(async (s) => {
            const [tasks, total] = await Promise.all([
                Task.find({ status: s }).sort({ order: 1, createdAt: -1 }).limit(limit).lean<any[]>(),
                Task.countDocuments({ status: s }),
            ])
            columns[s] = { tasks, total, hasMore: tasks.length < total }
        }))

        return { success: true, columns }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)

        // Auto-generate taskId
        const last = await Task.findOne().sort({ createdAt: -1 }).select('taskId').lean<any>()
        let nextNum = 1
        if (last?.taskId) {
            const match = last.taskId.match(/TASK-(\d+)/)
            if (match) nextNum = parseInt(match[1]) + 1
        }
        const taskId = `TASK-${String(nextNum).padStart(3, '0')}`

        // Get the max order for the target column
        const maxOrderDoc = await Task.findOne({ status: body.status || 'todo' }).sort({ order: -1 }).select('order').lean<any>()
        const order = (maxOrderDoc?.order ?? -1) + 1

        const doc = await Task.create({
            taskId,
            title: body.title,
            description: body.description || '',
            priority: body.priority || 'medium',
            assignee: body.assignee || null,
            dueDate: body.dueDate || null,
            status: body.status || 'todo',
            labels: body.labels || [],
            subtasks: body.subtasks || [],
            comments: body.comments || [],
            order,
        })

        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
