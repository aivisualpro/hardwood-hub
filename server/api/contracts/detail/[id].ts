import { Contract } from '../../../models/Contract'
/**
 * GET    /api/contracts/detail/:id — get single contract
 * PUT    /api/contracts/detail/:id — update a contract
 * DELETE /api/contracts/detail/:id — delete a contract
 */
import { connectDB } from '../../../utils/mongoose'
import { requirePermission } from '../../../utils/requirePermission'
import { stripHiddenFields, sanitizeWriteBody } from '../../../utils/applyFieldPermissions'
import { logger } from '../../../utils/logger'
import { ContractUpdateSchema, objectId, parseBody } from '../../../utils/validation'
const log = logger('[id]')

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/contracts')
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const doc = await Contract.findById(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Contract not found' })
    return { success: true, data: stripHiddenFields(event, '/crm/contracts', doc) }
  }

  if (event.method === 'PUT') {
    const existing = await Contract.findById(id).lean()
    if (!existing)
      throw createError({ statusCode: 404, message: 'Contract not found' })
    if (existing.status === 'signed') {
      throw createError({ statusCode: 403, message: 'Signed contracts cannot be modified.' })
    }
    const raw = await readBody(event)
    const data = parseBody(ContractUpdateSchema, raw)
    const cleaned = sanitizeWriteBody(event, '/crm/contracts', data)
    const doc = await Contract.findByIdAndUpdate(id, cleaned, { returnDocument: 'after' }).lean()
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    const doc = await Contract.findById(id).lean()
    if (!doc)
      return { success: true }
    if (doc.status === 'signed') {
      const sessionEmail = event.context?.session?.email || ''
      if (sessionEmail !== 'adeel@annarborhardwoods.com') {
        throw createError({ statusCode: 403, message: 'Signed contracts cannot be deleted.' })
      }
    }
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
    await Contract.findByIdAndDelete(id)
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
