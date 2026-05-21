// PUT    /api/tasks/:id   — update a task (including status change for drag-drop)
// DELETE /api/tasks/:id   — delete a task
import mongoose from 'mongoose'
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'
import { Employee } from '../../models/Employee'
import { notifyStatusChange, notifyComment } from '../../utils/taskNotifications'
import { verifySessionToken } from '../../lib/session'

const POPULATE_FIELDS = [
    { path: 'assignees', select: '_id employee profileImage' },
    { path: 'createdBy', select: '_id employee profileImage' },
    { path: 'approvedBy', select: '_id employee profileImage' },
]

function getObjectIdString(val: any): string | null {
    if (!val) return null
    if (typeof val === 'string') return val
    if (typeof val === 'object') {
        if (typeof val.toHexString === 'function') {
            return val.toHexString()
        }
        if (val._id) {
            return getObjectIdString(val._id)
        }
        if (val.id && typeof val.id === 'string') {
            return val.id
        }
        return String(val)
    }
    return String(val)
}

function resolveChangedById(event: any, body: any): string {
    let session = (event.context as any).session
    if (!session) {
        const token = getCookie(event, 'hardwood_session')
        if (token) {
            session = verifySessionToken(token)
        }
    }
    if (session?.id) return session.id

    if (body?._changedById) return body._changedById

    // Fallback to hardwood_user cookie
    const userCookieStr = getCookie(event, 'hardwood_user')
    if (userCookieStr) {
        try {
            let cleanStr = userCookieStr
            if (cleanStr.startsWith('j:')) {
                cleanStr = cleanStr.slice(2)
            }
            const userObj = JSON.parse(decodeURIComponent(cleanStr))
            const id = userObj?._id || userObj?.id
            if (id) return String(id)
        } catch {}
    }

    return ''
}

function resolveChangedBy(event: any, body: any): string {
    if (body?._changedBy) return body._changedBy

    // Fallback to hardwood_user cookie
    const userCookieStr = getCookie(event, 'hardwood_user')
    if (userCookieStr) {
        try {
            let cleanStr = userCookieStr
            if (cleanStr.startsWith('j:')) {
                cleanStr = cleanStr.slice(2)
            }
            const userObj = JSON.parse(decodeURIComponent(cleanStr))
            if (userObj?.employee) return String(userObj.employee)
            if (userObj?.name) return String(userObj.name)
        } catch {}
    }

    return ''
}

export default defineEventHandler(async (event) => {
    await connectDB()
    Employee // ensure model registered
    const id = getRouterParam(event, 'id')

    if (event.method === 'PUT') {
        const body = await readBody(event)

        const changedById = resolveChangedById(event, body)
        let changedBy = resolveChangedBy(event, body)

        console.log('[tasks PUT id] Request for task id:', id)
        console.log('[tasks PUT id] body:', body)
        console.log('[tasks PUT id] changedById:', changedById)
        console.log('[tasks PUT id] changedBy:', changedBy)

        if (changedById && !changedBy) {
            const emp = await Employee.findById(changedById).lean<any>()
            if (emp) {
                changedBy = emp.employee || ''
            }
        }
        delete body._changedBy
        delete body._changedById

        if (body.approvedBy !== undefined) {
            const approvedByIdStr = getObjectIdString(body.approvedBy)
            if (approvedByIdStr && approvedByIdStr.length === 24) {
                body.approvedBy = new mongoose.Types.ObjectId(approvedByIdStr)
            } else {
                body.approvedBy = null
            }
        }

        // Fetch old doc first to detect changes
        const oldDoc: any = await Task.findById(id).lean()
        if (!oldDoc) throw createError({ statusCode: 404, message: 'Task not found' })

        // ── Approval gate: cannot move to "done" without approval ──
        if (body.status === 'done' && oldDoc.status !== 'done') {
            const creatorId = getObjectIdString(oldDoc.createdBy)
            const oldApprovedById = getObjectIdString(oldDoc.approvedBy)

            // Let's resolve if the user is a Super Admin
            let isSuperAdmin = false
            if (changedById) {
                const emp = await Employee.findById(changedById).lean<any>()
                if (emp?.position === 'Super Admin') {
                    isSuperAdmin = true
                }
            }

            const isCreator = !creatorId || (!!changedById && creatorId.trim().toLowerCase() === changedById.trim().toLowerCase())

            console.log('[tasks PUT id] creatorId:', creatorId)
            console.log('[tasks PUT id] oldApprovedById:', oldApprovedById)
            console.log('[tasks PUT id] isCreator:', isCreator)
            console.log('[tasks PUT id] isSuperAdmin:', isSuperAdmin)

            // A task can be moved to Done if:
            // 1. It is already approved.
            // 2. OR the current user is the creator.
            // 3. OR the current user is a Super Admin.
            const isAllowed = !!oldApprovedById || isCreator || isSuperAdmin

            console.log('[tasks PUT id] final isAllowed evaluated:', isAllowed)

            if (!isAllowed) {
                throw createError({
                    statusCode: 403,
                    message: 'Task must be approved by the creator before it can be moved to Done',
                })
            }

            // If allowed and not already approved, auto-approve it using the logged-in user
            if (!oldApprovedById) {
                const approverIdStr = changedById || creatorId
                body.approvedBy = approverIdStr ? new mongoose.Types.ObjectId(approverIdStr) : null
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
                approvedByName: doc.approvedBy?.employee || undefined,
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
