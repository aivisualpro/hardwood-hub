// PUT    /api/tasks/:id   — update a task (including status change for drag-drop)
// DELETE /api/tasks/:id   — delete a task
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'
import { Employee } from '../../models/Employee'
import { notifyStatusChange, notifyComment } from '../../utils/taskNotifications'

const POPULATE_FIELDS = [
    { path: 'assignees', select: '_id employee profileImage' },
    { path: 'createdBy', select: '_id employee profileImage' },
    { path: 'approvedBy', select: '_id employee profileImage' },
]

export default defineEventHandler(async (event) => {
    await connectDB()
    Employee // ensure model registered
    const id = getRouterParam(event, 'id')

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const changedBy = body._changedBy || '' // passed from client
        delete body._changedBy

        // Fetch old doc first to detect changes
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

        // ── Build changelog entries ──
        const TRACKED_FIELDS = ['title', 'description', 'priority', 'status', 'dueDate', 'assignees', 'labels']
        const changelogEntries: any[] = []
        const now = new Date()

        for (const field of TRACKED_FIELDS) {
            if (body[field] === undefined) continue
            const oldVal = oldDoc[field]
            const newVal = body[field]

            // Stringify for comparison (handles dates, arrays, objects)
            const oldStr = JSON.stringify(oldVal ?? null)
            const newStr = JSON.stringify(newVal ?? null)
            if (oldStr === newStr) continue

            changelogEntries.push({
                field,
                oldValue: oldVal,
                newValue: newVal,
                changedBy,
                changedAt: now,
            })
        }

        // Update doc — use $set for fields, $push for changelog
        const updateOps: any = { $set: { ...body } }
        if (changelogEntries.length) {
            updateOps.$push = { changelog: { $each: changelogEntries } }
        }

        const doc: any = await Task.findByIdAndUpdate(id, updateOps, { new: true }).populate(POPULATE_FIELDS).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Task not found' })

        // ── Email on ANY status change ──
        const statusChanged = body.status && body.status !== oldDoc.status
        if (statusChanged && doc.createdBy?.employee) {
            notifyStatusChange({
                title: doc.title,
                createdByName: doc.createdBy.employee,
                movedByName: changedBy || undefined,
                assigneeNames: (doc.assignees || []).map((a: any) => a.employee).filter(Boolean).join(', '),
                priority: doc.priority,
                dueDate: doc.dueDate,
                oldStatus: oldDoc.status,
                newStatus: body.status,
            }).catch(() => {})
        }
        // ── Email on comment added ──
        if (body.comments && Array.isArray(body.comments)) {
            const oldCommentIds = new Set((oldDoc.comments || []).map((c: any) => c.id))
            const newComments = body.comments.filter((c: any) => !oldCommentIds.has(c.id))
            for (const cm of newComments) {
                notifyComment({
                    taskTitle: doc.title,
                    commentText: cm.text || '',
                    commentAuthor: cm.author || 'Unknown',
                    createdById: oldDoc.createdBy?.toString() || '',
                    assigneeIds: (oldDoc.assignees || []).map((a: any) => a.toString()),
                }).catch(() => {})
            }
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
