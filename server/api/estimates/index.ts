import { Estimate } from '../../models/Estimate'
import { Pipeline } from '../../models/Pipeline'
/**
 * GET  /api/estimates — list all estimates
 * POST /api/estimates — create a new estimate
 */
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { stripHiddenFields, sanitizeWriteBody } from '../../utils/applyFieldPermissions'
import { EstimateCreateSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/estimates')

  if (event.method === 'GET') {
    const query = getQuery(event)
    const status = query.status as string | undefined
    const search = query.search as string | undefined
    const customerId = query.customerId as string | undefined
    const projectId = query.projectId as string | undefined
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))

    const filter: Record<string, any> = {}
    if (status)
      filter.status = status
    if (customerId)
      filter.customerId = customerId
    if (projectId)
      filter.projectId = projectId
    if (search) {
      filter.$or = [
        { estimateNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
      ]
    }

    const [data, total] = await Promise.all([
      Estimate.find(filter)
        .select('-content -attachedPdf -attachedGalleryImages -variableValues')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Estimate.countDocuments(filter),
    ])

    // Enrich with projectName from Pipeline collection
    const projectIds = data
      .filter((c: any) => c.projectId)
      .map((c: any) => c.projectId)

    if (projectIds.length > 0) {
      const projects = await Pipeline.find(
        { _id: { $in: projectIds } },
        { projectName: 1, name: 1 },
      ).lean()
      const projectMap = new Map(projects.map((p: any) => [String(p._id), p]))

      for (const ct of data as any[]) {
        if (ct.projectId) {
          const proj = projectMap.get(String(ct.projectId))
          ct.projectName = proj?.projectName || proj?.name || ''
        }
      }
    }

    return {
      success: true,
      data: stripHiddenFields(event, '/crm/estimates', data as any[]),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const body = parseBody(EstimateCreateSchema, raw)
    const cleaned = sanitizeWriteBody(event, '/crm/estimates', body)

    // Extract from variableValues if provided, else from body directly
    const estimateNumber = cleaned.estimateNumber || cleaned.variableValues?.estimate_number || `EST-${Date.now()}` // Fallback if missing

    // Set createdBy from authenticated session
    const session = (event.context as any).session
    const createdBy = session?.id || null

    const doc = await Estimate.create({ ...cleaned, estimateNumber, createdBy })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
