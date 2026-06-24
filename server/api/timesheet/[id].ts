/**
 * PUT    /api/timesheet/:id — clock out / update entry
 * DELETE /api/timesheet/:id — admin-only delete
 */
import { defineEventHandler, readBody } from 'h3'
import { TimeEntry } from '../../models/TimeEntry'
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { requireManager } from '../../utils/requireRole'
import { objectId, parseBody, TimeEntryClockOutSchema, TimeEntryUpdateSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/hr/timesheet')
  const id = objectId(getRouterParam(event, 'id'))
  const session = event.context?.session

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const entry = await TimeEntry.findById(id)

    if (!entry)
      throw createError({ statusCode: 404, message: 'Time entry not found.' })

    // Staff can only modify their own entries
    const isAdmin = ['Super Admin', 'Admin', 'Manager'].includes(session?.position || '')
    if (!isAdmin && String(entry.employeeId) !== String(session?.id)) {
      throw createError({ statusCode: 403, message: 'You can only modify your own time entries.' })
    }

    // If the entry is still active → clock out
    if (entry.status === 'active') {
      const data = parseBody(TimeEntryClockOutSchema, raw)
      entry.clockOut = new Date()
      entry.status = 'completed'

      // Compute duration in minutes
      const ms = entry.clockOut.getTime() - new Date(entry.clockIn).getTime()
      entry.duration = Math.round(ms / 60000)

      if (data.notes !== undefined) entry.notes = data.notes
    }
    else {
      // Already completed → admin edit
      const data = parseBody(TimeEntryUpdateSchema, raw)
      if (data.projectId !== undefined) entry.projectId = data.projectId
      if (data.projectName !== undefined) entry.projectName = data.projectName
      if (data.customerName !== undefined) entry.customerName = data.customerName
      if (data.notes !== undefined) entry.notes = data.notes
      if (data.clockIn) entry.clockIn = new Date(data.clockIn)
      if (data.clockOut) {
        entry.clockOut = new Date(data.clockOut)
        const ms = entry.clockOut.getTime() - new Date(entry.clockIn).getTime()
        entry.duration = Math.round(ms / 60000)
      }
    }

    await entry.save()

    return {
      success: true,
      data: {
        ...entry.toObject(),
        _id: String(entry._id),
        employeeId: String(entry.employeeId),
        projectId: entry.projectId ? String(entry.projectId) : null,
      },
    }
  }

  if (event.method === 'DELETE') {
    requireManager(event)
    const result = await TimeEntry.findByIdAndDelete(id)
    if (!result)
      throw createError({ statusCode: 404, message: 'Time entry not found.' })

    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
