// POST /api/tasks/reorder — batch update order and status after drag-drop
import mongoose from 'mongoose'
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'
import { Employee } from '../../models/Employee'
import { notifyStatusChange } from '../../utils/taskNotifications'
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

    const body = await readBody(event)
    // body.updates = [{ _id, status, order }, ...], body._changedBy = string
    const updates: { _id: string, status: string, order: number }[] = body.updates || []
    
    const changedById = resolveChangedById(event, body)
    let changedBy = resolveChangedBy(event, body)
    
    if (changedById && !changedBy) {
        const emp = await Employee.findById(changedById).lean<any>()
        if (emp) {
            changedBy = emp.employee || ''
        }
    }

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
        }).select('_id title createdBy').lean()
        if (unapproved.length) {
            console.log('[reorder] body:', body)
            console.log('[reorder] changedById:', changedById)
            console.log('[reorder] unapproved tasks:', unapproved)

            const autoApproveIds: string[] = []
            const blockedTasks: any[] = []

            // Let's resolve if the user is a Super Admin
            let isSuperAdmin = false
            if (changedById) {
                const emp = await Employee.findById(changedById).lean<any>()
                if (emp?.position === 'Super Admin') {
                    isSuperAdmin = true
                }
            }

            for (const t of unapproved) {
                const creatorId = getObjectIdString(t.createdBy)
                const isCreator = !creatorId || (!!changedById && creatorId.trim().toLowerCase() === changedById.trim().toLowerCase())

                const isAllowed = isCreator || isSuperAdmin
                console.log('[reorder] checking task:', t._id, 'creatorId:', creatorId, 'changedById:', changedById, 'isCreator:', isCreator, 'isSuperAdmin:', isSuperAdmin, 'isAllowed:', isAllowed)
                if (isAllowed) {
                    autoApproveIds.push(String(t._id))
                } else {
                    blockedTasks.push(t)
                }
            }

            // Auto-approve the creator's or admin's own tasks
            if (autoApproveIds.length) {
                const approvedByVal = changedById ? new mongoose.Types.ObjectId(changedById) : null
                await Task.updateMany(
                    { _id: { $in: autoApproveIds } },
                    { $set: { approvedBy: approvedByVal } },
                )
            }

            // Block the rest
            if (blockedTasks.length) {
                const names = blockedTasks.map((t: any) => t.title || 'Task').join(', ')
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
        if (oldTask && oldTask.status !== u.status) {
            // Fetch fully populated updated task to resolve creator and approvedBy names
            const updatedTask = await Task.findById(u._id)
                .populate(POPULATE_FIELDS)
                .lean<any>()

            if (updatedTask && updatedTask.createdBy?.employee) {
                notifyStatusChange({
                    title: updatedTask.title,
                    createdByName: updatedTask.createdBy.employee,
                    movedByName: changedBy || undefined,
                    assigneeNames: (updatedTask.assignees || []).map((a: any) => a.employee).filter(Boolean).join(', '),
                    approvedByName: updatedTask.approvedBy?.employee || undefined,
                    priority: updatedTask.priority,
                    dueDate: updatedTask.dueDate,
                    oldStatus: oldTask.status,
                    newStatus: u.status,
                }).catch(() => {})
            }
        }
    }

    return { success: true }
})

