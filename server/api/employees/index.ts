import { Employee } from '../../models/Employee'
// GET /api/employees  — paginated list with search
// POST /api/employees — create
import { connectDB } from '../../utils/mongoose'
import { requireAdmin } from '../../utils/requireRole'
import { EmployeeCreateSchema, parseBody } from '../../utils/validation'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)

  if (event.method === 'GET') {
    const query = getQuery(event)

    // ── Pagination ────────────────────────────────────────────────────────────
    const page = Math.max(1, Number.parseInt(query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit as string) || 50))
    const skip = (page - 1) * limit
    const search = (query.search as string | undefined)?.trim()
    const status = (query.status as string | undefined)?.trim()

    const filter: Record<string, any> = {}

    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' }
      filter.$or = [
        { employee: re },
        { email: re },
        { position: re },
      ]
    }

    if (status && status !== 'all')
      filter.status = status

    const [employees, total] = await Promise.all([
      Employee.find(filter).sort({ employee: 1 }).skip(skip).limit(limit).lean(),
      Employee.countDocuments(filter),
    ])

    return {
      success: true,
      data: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const data = parseBody(EmployeeCreateSchema, raw)
    const doc = await Employee.create(data)
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
