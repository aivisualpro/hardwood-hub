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

    // ── Approval gate: block unapproved tasks from moving to "done" ──
    const doneIds = updates.filter(u => u.status === 'done').map(u => u._id)
    if (doneIds.length) {
        const unapproved: any[] = await Task.find({
            _id: { $in: doneIds },
            status: { $ne: 'done' },       // only those NOT already in done
            approvedBy: null,               // not approved yet
        }).lean()

        if (unapproved.length) {
            const names = unapproved.map((t: any) => t.taskId).join(', ')
            throw createError({
                statusCode: 403,
                message: `Tasks must be approved before moving to Done: ${names}`,
            })
        }
    }

    // Find tasks that are being moved TO "in-review"
    const inReviewIds = updates.filter(u => u.status === 'in-review').map(u => u._id)

    // Fetch those tasks BEFORE the bulk update to detect status changes
    let tasksToNotify: any[] = []
    if (inReviewIds.length) {
        const oldTasks: any[] = await Task.find({
            _id: { $in: inReviewIds },
            status: { $ne: 'in-review' },  // only those NOT already in-review
        }).lean()
        tasksToNotify = oldTasks || []
    }

    // Build bulk ops — also clear approvedBy when entering in-review
    const inReviewIdSet = new Set(inReviewIds)
    const ops = updates.map(u => {
        const setFields: any = { status: u.status, order: u.order }
        // Clear approval when freshly entering in-review
        if (u.status === 'in-review' && inReviewIdSet.has(u._id)) {
            setFields.approvedBy = null
        }
        return {
            updateOne: {
                filter: { _id: u._id },
                update: { $set: setFields },
            },
        }
    })

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
