/**
 * GET  /api/change-orders          — list all change orders
 * POST /api/change-orders          — create a new change order
 */
import { ChangeOrder } from '../../models/ChangeOrder'
import { Pipeline } from '../../models/Pipeline'
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { stripHiddenFields, sanitizeWriteBody } from '../../utils/applyFieldPermissions'
import { ChangeOrderCreateSchema, parseBody } from '../../utils/validation'
import { requireManager } from '../../utils/requireRole'
import { actorFromEvent, fireAutomations } from '../../utils/automationEngine'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  await requirePermission(event, '/crm/change-orders')

  if (event.method === 'GET') {
    const query = getQuery(event)
    const search = query.search as string | undefined
    const customerId = query.customerId as string | undefined
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))

    const filter: Record<string, any> = {}
    if (customerId)
      filter.customerId = customerId
    if (search) {
      filter.$or = [
        { changeOrderNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { projectName: { $regex: search, $options: 'i' } },
      ]
    }

    const [data, total] = await Promise.all([
      ChangeOrder.find(filter)
        .select('-content -variableValues')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ChangeOrder.countDocuments(filter),
    ])

    return {
      success: true,
      data: stripHiddenFields(event, '/crm/change-orders', data as any[]),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const body = parseBody(ChangeOrderCreateSchema, raw)
    const cleaned = sanitizeWriteBody(event, '/crm/change-orders', body)

    // Auto-generate change order number
    const lastCo = await ChangeOrder.findOne().sort({ createdAt: -1 }).select('changeOrderNumber').lean()
    let nextNum = 1
    if (lastCo?.changeOrderNumber) {
      const match = lastCo.changeOrderNumber.match(/CO-(\d+)/)
      if (match) nextNum = parseInt(match[1], 10) + 1
    }
    const changeOrderNumber = cleaned.changeOrderNumber || `CO-${String(nextNum).padStart(3, '0')}`

    const doc = await ChangeOrder.create({ ...cleaned, changeOrderNumber })
    fireAutomations({ module: 'crm', submodule: 'change-orders', action: 'create', after: doc.toObject(), actor: actorFromEvent(event) })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
