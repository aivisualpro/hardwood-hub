/**
 * GET /api/crm/submissions
 * Returns CRM submissions, filterable by ?type=...&status=...&search=...
 * Supports pagination with ?page=1&limit=50
 */
import { connectDB } from '../../utils/mongoose'
import { CrmSubmission } from '../../models/CrmSubmission'

export default defineEventHandler(async (event) => {
  await connectDB()

  const query = getQuery(event)
  const type = query.type as string | undefined
  const status = query.status as string | undefined
  const search = query.search as string | undefined
  const email = query.email as string | undefined
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50))

  const filter: Record<string, any> = {}
  if (type) filter.type = type
  if (status) filter.status = status
  if (email) filter.email = email
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } },
    ]
  }

  const [data, total] = await Promise.all([
    CrmSubmission.find(filter)
      .sort({ dateSubmitted: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CrmSubmission.countDocuments(filter),
  ])

  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})
