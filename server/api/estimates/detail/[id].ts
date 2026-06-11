import { Estimate } from '../../../models/Estimate'
/**
 * GET    /api/estimates/detail/:id — get single estimate
 * PUT    /api/estimates/detail/:id — update an estimate
 * DELETE /api/estimates/detail/:id — delete an estimate
 */
import { connectDB } from '../../../utils/mongoose'
import { requirePermission } from '../../../utils/requirePermission'
import { stripHiddenFields, sanitizeWriteBody } from '../../../utils/applyFieldPermissions'
import { logger } from '../../../utils/logger'
import { EstimateUpdateSchema, objectId, parseBody } from '../../../utils/validation'
const log = logger('[id]')

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/estimates')
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const doc = await Estimate.findById(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Estimate not found' })
    return { success: true, data: stripHiddenFields(event, '/crm/estimates', doc) }
  }

  if (event.method === 'PUT') {
    const existing = await Estimate.findById(id).lean()
    if (!existing)
      throw createError({ statusCode: 404, message: 'Estimate not found' })
    const raw = await readBody(event)
    const data = parseBody(EstimateUpdateSchema, raw)
    const cleaned = sanitizeWriteBody(event, '/crm/estimates', data)
    const doc = await Estimate.findByIdAndUpdate(id, cleaned, { returnDocument: 'after' }).lean()
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    const doc = await Estimate.findById(id).lean()
    if (!doc)
      return { success: true }
    // Cleanup Vercel Blobs if attached
    if (doc.attachedPdf && (doc.attachedPdf.includes('vercel-storage.com') || doc.attachedPdf.includes('vercel.com'))) {
      try {
        const { del } = await import('@vercel/blob')
        await del(doc.attachedPdf, { token: process.env.BLOB_READ_WRITE_TOKEN })
        log.info('[vercel-blob] Deleted attached PDF:', doc.attachedPdf)
      }
      catch (e: any) {
        log.warn('[vercel-blob] Failed to delete blob:', e.message)
      }
    }
    await Estimate.findByIdAndDelete(id)
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
