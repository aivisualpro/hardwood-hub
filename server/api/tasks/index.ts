// GET  /api/tasks          — list tasks, grouped by status, with pagination per column
// POST /api/tasks          — create a task
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'
import { Employee } from '../../models/Employee'
import { notifyNewTask } from '../../utils/taskNotifications'

const POPULATE_FIELDS = [
    { path: 'assignees', select: '_id employee profileImage' },
    { path: 'createdBy', select: '_id employee profileImage' },
]

export default defineEventHandler(async (event) => {
    await connectDB()
    // Ensure Employee model is registered for populate
    Employee

    if (event.method === 'GET') {
        const query = getQuery(event)
        const status = query.status as string | undefined       // filter by column
        const limit = parseInt(query.limit as string) || 20
        const skip = parseInt(query.skip as string) || 0

        if (status) {
            // Load specific column with pagination
            const [tasks, total] = await Promise.all([
                Task.find({ status }).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE_FIELDS).lean<any[]>(),
                Task.countDocuments({ status }),
            ])
            return { success: true, data: tasks, total, hasMore: skip + tasks.length < total }
        }

        // Load all columns (initial load) — limited per column
        const statuses = ['todo', 'in-progress', 'in-review', 'done']
        const columns: Record<string, { tasks: any[], total: number, hasMore: boolean }> = {}

        await Promise.all(statuses.map(async (s) => {
            const [tasks, total] = await Promise.all([
                Task.find({ status: s }).sort({ dueDate: 1, createdAt: -1 }).limit(limit).populate(POPULATE_FIELDS).lean<any[]>(),
                Task.countDocuments({ status: s }),
            ])
            columns[s] = { tasks, total, hasMore: tasks.length < total }
        }))

        return { success: true, columns }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)

        try {
            // Get the max order for the target column
            const maxOrderDoc = await Task.findOne({ status: body.status || 'todo' }).sort({ order: -1 }).select('order').lean<any>()
            const order = (maxOrderDoc?.order ?? -1) + 1

            let doc = await Task.create({
                title: body.title,
                description: body.description || '',
                priority: body.priority || 'medium',
                assignees: body.assignees || [],
                createdBy: body.createdBy || null,
                dueDate: body.dueDate || null,
                status: body.status || 'todo',
                labels: body.labels || [],
                subtasks: body.subtasks || [],
                comments: body.comments || [],
                order,
            })
            // Populate assignees and createdBy before returning
            doc = await Task.findById(doc._id).populate(POPULATE_FIELDS).lean()

            // Fire-and-forget: notify assignees
            if (doc && body.assignees?.length) {
                notifyNewTask({
                    title: doc.title,
                    description: doc.description,
                    createdByName: (doc as any).createdBy?.employee || '',
                    assigneeIds: body.assignees,
                    priority: doc.priority,
                    dueDate: doc.dueDate,
                    status: doc.status,
                }).catch(() => {})
            }
        
            return { success: true, data: doc }
        } catch (e: any) {
            throw createError({ statusCode: 500, message: e?.message || 'Failed to create task' })
        }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
