// PUT    /api/tasks/:id   — update a task (including status change for drag-drop)
// DELETE /api/tasks/:id   — delete a task
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'
import { notifyTaskInReview } from '../../utils/taskNotifications'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (event.method === 'PUT') {
        const body = await readBody(event)

        // Fetch old doc first to detect status change
        const oldDoc: any = await Task.findById(id).lean()
        if (!oldDoc) throw createError({ statusCode: 404, message: 'Task not found' })

        // ── Approval gate: cannot move to "done" without approval ──
        if (body.status === 'done' && oldDoc.status !== 'done') {
            if (!oldDoc.approvedBy) {
                throw createError({
                    statusCode: 403,
                    message: 'Task must be approved by the creator before it can be moved to Done',
                })
            }
        }

        // Clear approval when moving INTO in-review (fresh review cycle)
        if (body.status === 'in-review' && oldDoc.status !== 'in-review') {
            body.approvedBy = null
        }

        const doc: any = await Task.findByIdAndUpdate(id, body, { new: true }).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Task not found' })

        // If status changed TO "in-review", notify creator
        if (
            body.status === 'in-review' &&
            oldDoc.status !== 'in-review' &&
            doc.createdBy?.name
        ) {
            // Fire-and-forget (non-blocking)
            notifyTaskInReview({
                taskId: doc.taskId,
                title: doc.title,
                createdByName: doc.createdBy.name,
                assigneeNames: (doc.assignees || []).map((a: any) => a.name).filter(Boolean).join(', '),
                priority: doc.priority,
                dueDate: doc.dueDate,
            }).catch(() => {})
        }

        return { success: true, data: doc }
    }

    if (event.method === 'DELETE') {
        const doc = await Task.findByIdAndDelete(id).lean<any>()
        if (!doc) throw createError({ statusCode: 404, message: 'Task not found' })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
