// POST /api/tasks/reorder — batch update order and status after drag-drop
import mongoose from 'mongoose'
import { Employee } from '../../models/Employee'
import { Task } from '../../models/Task'
import { logger } from '../../utils/logger'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { TaskReorderSchema, parseBody } from '../../utils/validation'
import { notifyStatusChange } from '../../utils/taskNotifications'

const log = logger('[tasks/reorder]')

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
  await requirePermission(event, '/tasks', 'update')
  Employee // ensure model registered

  // C1 fix: derive caller identity from the verified session token — not from
  // request body fields (body._changedById / body._changedBy) which are spoofable.
  const session = (event.context as any).session
  const changedById: string = session?.id ?? ''
  const callerPosition: string = session?.position ?? ''
  const isSuperAdmin = callerPosition === 'Super Admin'

  const raw = await readBody(event)
  const { updates } = parseBody(TaskReorderSchema, raw)

  if (!updates.length)
    throw createError({ statusCode: 400, message: 'No updates provided' })

  // Resolve display name for changelog (single DB call, safe — we already trust changedById from session)
  let changedBy = ''
  if (changedById) {
    const emp = await Employee.findById(changedById).select('employee').lean<any>()
    changedBy = emp?.employee ?? ''
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
      log.info('unapproved tasks blocking done:', unapproved.map((t: any) => t._id))

      const autoApproveIds: string[] = []
      const blockedTasks: any[] = []

      for (const t of unapproved) {
        const creatorId = getObjectIdString(t.createdBy)
        const isCreator = !creatorId
          || (!!changedById && creatorId.trim().toLowerCase() === changedById.trim().toLowerCase())
        const isAllowed = isCreator || isSuperAdmin

        log.info(`task ${t._id}: creatorId=${creatorId} callerIs=${changedById} isCreator=${isCreator} isSuperAdmin=${isSuperAdmin} allowed=${isAllowed}`)

        if (isAllowed)
          autoApproveIds.push(String(t._id))
        else
          blockedTasks.push(t)
      }

      if (autoApproveIds.length) {
        const approvedByVal = changedById ? new mongoose.Types.ObjectId(changedById) : null
        await Task.updateMany(
          { _id: { $in: autoApproveIds } },
          { $set: { approvedBy: approvedByVal } },
        )
      }

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

  const inReviewIds = new Set(updates.filter(u => u.status === 'in-review').map(u => u._id))
  const now = new Date()
  const ops = updates.map((u) => {
    const setFields: any = { status: u.status, order: u.order }
    if (u.status === 'in-review' && inReviewIds.has(u._id))
      setFields.approvedBy = null

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
