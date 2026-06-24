/**
 * GET /api/timesheet/active — returns the current user's active time entry (if any)
 *
 * Used by the global TimeClock widget to show a running counter.
 */
import { defineEventHandler } from 'h3'
import { TimeEntry } from '../../models/TimeEntry'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const session = event.context?.session

  if (!session?.id) {
    return { success: true, data: null }
  }

  const entry = await TimeEntry.findOne({
    employeeId: session.id,
    status: 'active',
  }).lean()

  if (!entry) {
    return { success: true, data: null }
  }

  return {
    success: true,
    data: {
      ...entry,
      _id: String((entry as any)._id),
      employeeId: String((entry as any).employeeId),
      projectId: (entry as any).projectId ? String((entry as any).projectId) : null,
    },
  }
})
