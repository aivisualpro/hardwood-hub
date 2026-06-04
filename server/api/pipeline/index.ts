/**
 * GET  /api/pipeline      — paginated list of pipeline records
 * POST /api/pipeline      — create a new pipeline record
 */
import { defineEventHandler, readBody } from 'h3'
import { Pipeline } from '../../models/Pipeline'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { PipelineCreateSchema, parseBody } from '../../utils/validation'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method

  if (method === 'GET') {
    const query = getQuery(event)

    // ── Pagination ────────────────────────────────────────────────────────────
    const page = Math.max(1, Number.parseInt(query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit as string) || 50))
    const skip = (page - 1) * limit

    // ── Filters ───────────────────────────────────────────────────────────────
    const customerId = query.customerId as string | undefined
    const search = (query.search as string | undefined)?.trim()
    const status = (query.status as string | undefined)?.trim()

    const filter: Record<string, any> = {}

    if (customerId)
      filter.customerId = customerId

    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' }
      filter.$or = [
        { name: re },
        { customerName: re },
        { projectName: re },
        { email: re },
        { phone: re },
        { city: re },
      ]
    }

    if (status)
      filter.status = status

    // ── Query ──────────────────────────────────────────────────────────────────
    // When caller passes customerId they want all records for that customer (no page cap)
    if (customerId) {
      const records = await Pipeline.find(filter)
        .select('-gallery -relatedContacts -notes')
        .sort({ createdAt: -1 })
        .lean()
      const serialized = records.map((c: any) => ({
        ...c,
        _id: String(c._id),
        customerId: c.customerId ? String(c.customerId) : null,
        status: c.status ? String(c.status) : null,
      }))
      return { success: true, data: serialized }
    }

    const [records, total] = await Promise.all([
      Pipeline.find(filter)
        .select('-gallery -relatedContacts -notes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Pipeline.countDocuments(filter),
    ])

    const serialized = records.map((c: any) => ({
      ...c,
      _id: String(c._id),
      customerId: c.customerId ? String(c.customerId) : null,
      status: c.status ? String(c.status) : null,
    }))

    return {
      success: true,
      data: serialized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  if (method === 'POST') {
    requireManager(event)
    const raw = await readBody(event)
    const data = parseBody(PipelineCreateSchema, raw)
    const record = new Pipeline(data)
    await record.save()
    return { success: true, data: record }
  }
})
