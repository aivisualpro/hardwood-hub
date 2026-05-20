// POST /api/tasks/reorder — batch update order and status after drag-drop
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'
import { Employee } from '../../models/Employee'
import { notifyStatusChange } from '../../utils/taskNotifications'

export default defineEventHandler(async (event) => {
    await connectDB()
    Employee // ensure model registered

    const body = await readBody(event)
    // body.updates = [{ _id, status, order }, ...], body._changedBy = string
    const updates: { _id: string, status: string, order: number }[] = body.updates || []
    const changedBy = body._changedBy || ''

    if (!updates.length) {
        throw createError({ statusCode: 400, message: 'No updates provided' })
    }

    // ── Approval gate: block unapproved tasks from moving to "done" ──
    const doneIds = updates.filter(u => u.status === 'done').map(u => u._id)
    if (doneIds.length) {
        const unapproved: any[] = await Task.find({
            _id: { $in: doneIds },
            approvedBy: null,
            status: { $ne: 'done' },
        }).select('taskId').lean()

        if (unapproved.length) {
            const names = unapproved.map((t: any) => t.taskId).join(', ')
            throw createError({
                statusCode: 403,
                message: `Tasks must be approved before moving to Done: ${names}`,
            })
        }
    }

    // Fetch all affected tasks BEFORE the bulk update to detect status changes
    const allIds = updates.map(u => u._id)
    const oldTasks: any[] = await Task.find({ _id: { $in: allIds } })
        .populate({ path: 'createdBy', select: '_id employee profileImage' })
        .lean()
    const oldStatusMap = new Map(oldTasks.map(t => [t._id.toString(), t]))

    // Build bulk ops — also clear approvedBy when entering in-review
    const inReviewIds = new Set(updates.filter(u => u.status === 'in-review').map(u => u._id))
    const now = new Date()
    const ops = updates.map(u => {
        const setFields: any = { status: u.status, order: u.order }
        if (u.status === 'in-review' && inReviewIds.has(u._id)) {
            setFields.approvedBy = null
        }

        const oldTask = oldStatusMap.get(u._id)
        const changelogEntry = oldTask && oldTask.status !== u.status
            ? { field: 'status', oldValue: oldTask.status, newValue: u.status, changedBy, changedAt: now }
            : null

        return {
            updateOne: {
                filter: { _id: u._id },
                update: {
                    $set: setFields,
                    ...(changelogEntry ? { $push: { changelog: changelogEntry } } : {}),
                },
            },
        }
    })

    await Task.bulkWrite(ops as any[])

    // Fire-and-forget status change notifications
    for (const u of updates) {
        const oldTask = oldStatusMap.get(u._id)
        if (oldTask && oldTask.status !== u.status && oldTask.createdBy?.employee) {
            notifyStatusChange({
                taskId: oldTask.taskId,
                title: oldTask.title,
                createdByName: oldTask.createdBy.employee,
                movedByName: changedBy || undefined,
                assigneeNames: (oldTask.assignees || []).map((a: any) => a.employee || a.name).filter(Boolean).join(', '),
                priority: oldTask.priority,
                dueDate: oldTask.dueDate,
                oldStatus: oldTask.status,
                newStatus: u.status,
            }).catch(() => {})
        }
    }

    return { success: true }
})
