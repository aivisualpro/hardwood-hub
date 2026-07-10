/**
 * GET  /api/pipeline      — paginated list of pipeline records
 * POST /api/pipeline      — create a new pipeline record
 */
import { defineEventHandler, readBody } from 'h3'
import { Pipeline } from '../../models/Pipeline'
import mongoose from 'mongoose'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { stripHiddenFields, sanitizeWriteBody } from '../../utils/applyFieldPermissions'
import { PipelineCreateSchema, parseBody } from '../../utils/validation'
import { actorFromEvent, fireAutomations } from '../../utils/automationEngine'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Strip empty strings / invalid ObjectIds from an array field before populate */
function cleanIdArray(arr: any[] | undefined): any[] {
  if (!Array.isArray(arr)) return []
  return arr.filter((v: any) => {
    if (!v) return false
    if (typeof v === 'string') return mongoose.Types.ObjectId.isValid(v) && v.length > 0
    return true // already an ObjectId or populated doc
  })
}

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/pipeline')
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

    const customerName = (query.customerName as string | undefined)?.trim()

    if (customerId) {
      // Match pipeline records that either have the customerId FK set,
      // or whose name/customerName matches the customer name passed from the UI.
      const custConditions: any[] = [{ customerId }]
      if (customerName) {
        const nameRe = { $regex: `^${escapeRegex(customerName)}$`, $options: 'i' }
        custConditions.push({ name: nameRe })
        custConditions.push({ customerName: nameRe })
      }
      filter.$or = custConditions
    }

    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' }
      const searchOr = [
        { name: re },
        { customerName: re },
        { projectName: re },
        { email: re },
        { phone: re },
        { city: re },
      ]
      // If $or is already set (from customerId), combine with $and
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }]
        delete filter.$or
      }
      else {
        filter.$or = searchOr
      }
    }

    if (status)
      filter.status = status

    // ── Query ──────────────────────────────────────────────────────────────────
    // When caller passes customerId they want all records for that customer (no page cap)
    if (customerId) {
      const rawRecords = await Pipeline.find(filter)
        .select('-gallery -relatedContacts -notes')
        .sort({ createdAt: -1 })
        .lean()
      // Clean invalid refs before populate to prevent CastError
      for (const r of rawRecords as any[]) {
        r.assignedTo = cleanIdArray(r.assignedTo)
        r.projectAssignedTo = cleanIdArray(r.projectAssignedTo)
      }
      const records = await Pipeline.populate(rawRecords, [
        { path: 'assignedTo', select: 'employee email profileImage' },
        { path: 'projectAssignedTo', select: 'employee email profileImage' },
      ])
      const serialized = records.map((c: any) => ({
        ...c,
        _id: String(c._id),
        customerId: c.customerId ? String(c.customerId) : null,
        status: c.status ? String(c.status) : null,
      }))
      return { success: true, data: stripHiddenFields(event, '/crm/pipeline', serialized) }
    }

    const [rawRecords, total] = await Promise.all([
      Pipeline.find(filter)
        .select('-gallery -relatedContacts -notes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Pipeline.countDocuments(filter),
    ])
    // Clean invalid refs before populate to prevent CastError
    for (const r of rawRecords as any[]) {
      r.assignedTo = cleanIdArray(r.assignedTo)
      r.projectAssignedTo = cleanIdArray(r.projectAssignedTo)
    }
    const records = await Pipeline.populate(rawRecords, [
      { path: 'assignedTo', select: 'employee email profileImage' },
      { path: 'projectAssignedTo', select: 'employee email profileImage' },
    ])

    const serialized = records.map((c: any) => ({
      ...c,
      _id: String(c._id),
      customerId: c.customerId ? String(c.customerId) : null,
      status: c.status ? String(c.status) : null,
    }))

    return {
      success: true,
      data: stripHiddenFields(event, '/crm/pipeline', serialized),
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
    const cleaned = sanitizeWriteBody(event, '/crm/pipeline', data)
    const record = new Pipeline(cleaned)
    await record.save()
    fireAutomations({ module: 'crm', submodule: 'pipeline', action: 'create', after: record.toObject(), actor: actorFromEvent(event) })
    return { success: true, data: record }
  }
})
