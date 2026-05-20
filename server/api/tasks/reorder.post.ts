// POST /api/tasks/reorder — batch update order and status after drag-drop
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'
import { notifyTaskInReview } from '../../utils/taskNotifications'

export default defineEventHandler(async (event) => {
    await connectDB()

    const body = await readBody(event)
    // body.updates = [{ _id, status, order }, ...]
    const updates: { _id: string, status: string, order: number }[] = body.updates || []

    if (!updates.length) {
        throw createError({ statusCode: 400, message: 'No updates provided' })
    }

    // Find tasks that are being moved TO "in-review"
    const inReviewIds = updates.filter(u => u.status === 'in-review').map(u => u._id)

    // Fetch those tasks BEFORE the bulk update to detect status changes
    let tasksToNotify: any[] = []
    if (inReviewIds.length) {
        const oldTasks = await Task.find({
            _id: { $in: inReviewIds },
            status: { $ne: 'in-review' },  // only those NOT already in-review
        }).lean<any[]>()
        tasksToNotify = oldTasks || []
    }

    // Bulk update for performance
    const ops = updates.map(u => ({
        updateOne: {
            filter: { _id: u._id },
            update: { $set: { status: u.status, order: u.order } },
        },
    }))

    await Task.bulkWrite(ops)

    // Fire-and-forget notifications for tasks that just moved to "in-review"
    for (const task of tasksToNotify) {
        if (task.createdBy?.name) {
            notifyTaskInReview({
                taskId: task.taskId,
                title: task.title,
                createdByName: task.createdBy.name,
                assigneeNames: (task.assignees || []).map((a: any) => a.name).filter(Boolean).join(', '),
                priority: task.priority,
                dueDate: task.dueDate,
            }).catch(() => {})
        }
    }

    return { success: true }
})
