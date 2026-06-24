/**
 * GET  /api/timesheet       — paginated list of time entries with filters
 * POST /api/timesheet       — clock in (create new active entry)
 */
import { defineEventHandler, readBody } from 'h3'
import { TimeEntry } from '../../models/TimeEntry'
import { Employee } from '../../models/Employee'
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { TimeEntryClockInSchema, parseBody } from '../../utils/validation'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/hr/timesheet')
  const session = event.context?.session

  if (event.method === 'GET') {
    const query = getQuery(event)

    // ── Pagination ──────────────────────────────────────────────────────────
    const page = Math.max(1, Number.parseInt(query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit as string) || 50))
    const skip = (page - 1) * limit

    // ── Filters ─────────────────────────────────────────────────────────────
    const filter: Record<string, any> = {}

    // Employee filter (non-admins only see their own)
    const employeeId = query.employeeId as string | undefined
    const isAdmin = ['Super Admin', 'Admin', 'Manager'].includes(session?.position || '')

    if (employeeId) {
      filter.employeeId = employeeId
    }
    else if (!isAdmin) {
      // Staff can only see their own entries
      filter.employeeId = session?.id
    }

    // Status filter
    const status = (query.status as string | undefined)?.trim()
    if (status && (status === 'active' || status === 'completed'))
      filter.status = status

    // Date range filter
    const dateFrom = query.dateFrom as string | undefined
    const dateTo = query.dateTo as string | undefined
    if (dateFrom || dateTo) {
      filter.clockIn = {}
      if (dateFrom) filter.clockIn.$gte = new Date(dateFrom)
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        filter.clockIn.$lte = end
      }
    }

    // Search
    const search = (query.search as string | undefined)?.trim()
    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' }
      filter.$or = [
        { employeeName: re },
        { projectName: re },
        { customerName: re },
        { notes: re },
      ]
    }

    // ── Query ────────────────────────────────────────────────────────────────
    const [records, total] = await Promise.all([
      TimeEntry.find(filter).sort({ clockIn: -1 }).skip(skip).limit(limit).lean(),
      TimeEntry.countDocuments(filter),
    ])

    const serialized = records.map((r: any) => ({
      ...r,
      _id: String(r._id),
      employeeId: r.employeeId ? String(r.employeeId) : null,
      projectId: r.projectId ? String(r.projectId) : null,
    }))

    return {
      success: true,
      data: serialized,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  if (event.method === 'POST') {
    // ── Clock In ──────────────────────────────────────────────────────────
    const raw = await readBody(event)
    const data = parseBody(TimeEntryClockInSchema, raw)

    // Prevent double clock-in: only one active entry per employee
    const existing = await TimeEntry.findOne({
      employeeId: session?.id,
      status: 'active',
    }).lean()

    if (existing) {
      throw createError({
        statusCode: 409,
        message: 'You already have an active clock-in. Please clock out first.',
      })
    }

    // Look up the employee name for denormalization
    const emp = await Employee.findById(session?.id).select('employee').lean<any>()

    const entry = new TimeEntry({
      employeeId: session?.id,
      employeeName: emp?.employee || session?.employee || 'Unknown',
      projectId: data.projectId || null,
      projectName: data.projectName || '',
      customerName: data.customerName || '',
      clockIn: new Date(),
      notes: data.notes || '',
      status: 'active',
    })

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

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
