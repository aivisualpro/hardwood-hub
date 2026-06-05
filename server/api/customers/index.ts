import { defineEventHandler, readBody } from 'h3'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { CustomerCreateSchema, parseBody } from '../../utils/validation'

/**
 * Escape a string for safe use inside a MongoDB $regex value.
 * Prevents user input from being interpreted as regex operators.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/pipeline')
  const method = event.node.req.method

  if (method === 'GET') {
    const query = getQuery(event)

    // ── Pagination ──────────────────────────────────────────────────────────
    const page = Math.max(1, Number.parseInt(query.page as string) || 1)
    const rawLimit = Number.parseInt(query.limit as string)
    const limit = rawLimit === 0 ? 0 : Math.min(500, Math.max(1, rawLimit || 25))
    const skip = limit > 0 ? (page - 1) * limit : 0

    // ── Filters ──────────────────────────────────────────────────────────────
    const search = (query.search as string | undefined)?.trim()
    const type = (query.type as string | undefined)?.trim()
    const status = (query.status as string | undefined)?.trim()
    const sortField = (query.sortField as string) || 'createdAt'
    const sortDir = query.sortDir === 'asc' ? 1 : -1

    // Whitelist sortable fields to prevent arbitrary key injection
    const ALLOWED_SORT = new Set(['createdAt', 'name', 'email', 'city', 'type'])
    const safeSort = ALLOWED_SORT.has(sortField) ? sortField : 'createdAt'

    const filter: Record<string, any> = {}

    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' }
      filter.$or = [
        { name: re },
        { firstName: re },
        { lastName: re },
        { email: re },
        { phone: re },
        { city: re },
      ]
    }

    if (type)
      filter.type = type

    if (status)
      filter.status = status

    // ── Query ────────────────────────────────────────────────────────────────
    let q = Customer.find(filter)
      .select('-gallery -notes')
      .sort({ [safeSort]: sortDir })
    if (limit > 0) {
      q = q.skip(skip).limit(limit)
    }

    const [customers, total] = await Promise.all([
      q.lean(),
      Customer.countDocuments(filter),
    ])

    // Stringify ObjectId fields so they survive Nitro's JSON serialization on Vercel
    const serialized = customers.map((c: any) => ({
      ...c,
      _id: String(c._id),
      status: c.status ? String(c.status) : null,
      type: c.type ? String(c.type) : null,
      relatedContacts: (c.relatedContacts || []).map((rc: any) => ({
        ...rc,
        _id: rc._id ? String(rc._id) : undefined,
      })),
    }))

    return {
      success: true,
      data: serialized,
      pagination: {
        page,
        limit: limit || total,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
      },
    }
  }

  if (method === 'POST') {
    requireManager(event)
    const raw = await readBody(event)
    const data = parseBody(CustomerCreateSchema, raw)
    const newCustomer = new Customer(data)
    await newCustomer.save()
    return { success: true, data: newCustomer }
  }
})
