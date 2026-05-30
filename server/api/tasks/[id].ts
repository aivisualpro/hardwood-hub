// PUT    /api/tasks/:id   — update a task (including status change for drag-drop)
// DELETE /api/tasks/:id   — delete a task
import mongoose from 'mongoose'
import { Employee } from '../../models/Employee'
import { Task } from '../../models/Task'
import { logger } from '../../utils/logger'
import { connectDB } from '../../utils/mongoose'
import { objectId } from '../../utils/validation'
import { notifyComment, notifyStatusChange } from '../../utils/taskNotifications'
import { requireManager } from '../../utils/requireRole'

const log = logger('[tasks/id]')

const POPULATE_FIELDS = [
  { path: 'assignees', select: '_id employee profileImage' },
  { path: 'createdBy', select: '_id employee profileImage' },
  { path: 'approvedBy', select: '_id employee profileImage' },
]

function getObjectIdString(val: any): string | null {
  if (!val)
    return null
  if (typeof val === 'string')
    return val
  if (typeof val === 'object') {
    if (typeof val.toHexString === 'function')
      return val.toHexString()
    if (val._id)
      return getObjectIdString(val._id)
    if (val.id && typeof val.id === 'string')
      return val.id
    return String(val)
  }
  return String(val)
}

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  Employee // ensure model registered

  // C4: validate route param
  const id = objectId(getRouterParam(event, 'id'))

  // C1 fix: derive caller identity from the verified session token only —
  // the previous helpers fell back to body._changedById / hardwood_user cookie,
  // both of which are fully attacker-controlled.
  const session = (event.context as any).session
  const changedById: string = session?.id ?? ''
  const callerPosition: string = session?.position ?? ''
  const isSuperAdmin = callerPosition === 'Super Admin'

  if (event.method === 'PUT') {
    const body = await readBody(event)

    log.info('PUT task id:', id)

    // Resolve display name for changelog (single DB call from trusted session id)
    let changedBy = ''
    if (changedById) {
      const emp = await Employee.findById(changedById).select('employee').lean<any>()
      changedBy = emp?.employee ?? ''
    }

    // Strip internal tracking fields that must not be written directly
    delete body._changedBy
    delete body._changedById

    if (body.approvedBy !== undefined) {
      const approvedByIdStr = getObjectIdString(body.approvedBy)
      if (approvedByIdStr && approvedByIdStr.length === 24)
        body.approvedBy = new mongoose.Types.ObjectId(approvedByIdStr)
      else
        body.approvedBy = null
    }

    // Fetch old doc first to detect changes
    const oldDoc: any = await Task.findById(id).lean()
    if (!oldDoc)
      throw createError({ statusCode: 404, message: 'Task not found' })

    // ── Approval gate: cannot move to "done" without approval ──
    if (body.status === 'done' && oldDoc.status !== 'done') {
      const creatorId = getObjectIdString(oldDoc.createdBy)
      const oldApprovedById = getObjectIdString(oldDoc.approvedBy)

      const isCreator = !creatorId
        || (!!changedById && creatorId.trim().toLowerCase() === changedById.trim().toLowerCase())

      log.info('done gate: creatorId=', creatorId, 'caller=', changedById, 'isCreator=', isCreator, 'isSuperAdmin=', isSuperAdmin)

      const isAllowed = !!oldApprovedById || isCreator || isSuperAdmin

      if (!isAllowed) {
        throw createError({
          statusCode: 403,
          message: 'Task must be approved by the creator before it can be moved to Done',
        })
      }

      if (!oldApprovedById) {
        const approverIdStr = changedById || creatorId
        body.approvedBy = approverIdStr ? new mongoose.Types.ObjectId(approverIdStr) : null
      }
    }

    // Clear approval when moving INTO in-review (fresh review cycle)
    if (body.status === 'in-review' && oldDoc.status !== 'in-review')
      body.approvedBy = null

    // ── Build changelog entries ──
    const TRACKED_FIELDS = ['title', 'description', 'priority', 'status', 'dueDate', 'assignees', 'labels']
    const changelogEntries: any[] = []
    const now = new Date()

    for (const field of TRACKED_FIELDS) {
      if (body[field] === undefined)
        continue
      const oldVal = oldDoc[field]
      const newVal = body[field]
      const oldStr = JSON.stringify(oldVal ?? null)
      const newStr = JSON.stringify(newVal ?? null)
      if (oldStr === newStr)
        continue
      changelogEntries.push({ field, oldValue: oldVal, newValue: newVal, changedBy, changedAt: now })
    }

    const updateOps: any = { $set: { ...body } }
    if (changelogEntries.length)
      updateOps.$push = { changelog: { $each: changelogEntries } }

    const doc: any = await Task.findByIdAndUpdate(id, updateOps, { new: true }).populate(POPULATE_FIELDS).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Task not found' })

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
    if (!doc)
      throw createError({ statusCode: 404, message: 'Task not found' })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
