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
    const changedById = body._changedById || ''

    if (!updates.length) {
        throw createError({ statusCode: 400, message: 'No updates provided' })
    }

    // ── Approval gate: block unapproved tasks from moving to "done" ──
    // Exception: if the person dragging IS the task creator, auto-approve
    // Exception: if createdBy is null (legacy tasks before cookie fix), auto-approve
    const doneIds = updates.filter(u => u.status === 'done').map(u => u._id)
    if (doneIds.length) {
        const unapproved: any[] = await Task.find({
            _id: { $in: doneIds },
            approvedBy: null,
            status: { $ne: 'done' },
        }).select('taskId createdBy').lean()

        if (unapproved.length) {
            const autoApproveIds: string[] = []
            const blockedTasks: any[] = []

            for (const t of unapproved) {
                const creatorId = t.createdBy ? String(t.createdBy) : null

                // Auto-approve if: no creator recorded (legacy task), OR creator matches current user
                const isCreator = !creatorId || (!!changedById && creatorId === changedById)
                if (isCreator) {
                    autoApproveIds.push(String(t._id))
                } else {
                    blockedTasks.push(t)
                }
            }

            // Auto-approve the creator's own tasks (and legacy tasks with no creator)
            if (autoApproveIds.length) {
                await Task.updateMany(
                    { _id: { $in: autoApproveIds } },
                    { $set: { approvedBy: changedById || null } },
                )
            }

            // Block the rest
            if (blockedTasks.length) {
                const names = blockedTasks.map((t: any) => t.taskId).join(', ')
                throw createError({
                    statusCode: 403,
                    message: `Task must be approved by the creator before it can be moved to Done: ${names}`,
                })
            }
        }
    }

    // Fetch all affected tasks BEFORE the bulk update to detect status changes
    const allIds = updates.map(u => u._id)
    const oldTasks: any[] = await Task.find({ _id: { $in: allIds } })
        .populate({ path: 'createdBy', select: '_id employee profileImage' })
        .populate({ path: 'assignees', select: '_id employee profileImage' })
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
                title: oldTask.title,
                createdByName: oldTask.createdBy.employee,
                movedByName: changedBy || undefined,
                assigneeNames: (oldTask.assignees || []).map((a: any) => a.employee).filter(Boolean).join(', '),
                priority: oldTask.priority,
                dueDate: oldTask.dueDate,
                oldStatus: oldTask.status,
                newStatus: u.status,
            }).catch(() => {})
        }
    }

    return { success: true }
})
