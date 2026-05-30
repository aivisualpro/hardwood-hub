import { ContractTemplate } from '../../../models/ContractTemplate'
// GET  /api/contracts/templates — list all templates
// POST /api/contracts/templates — create a template
import { connectDB } from '../../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { logger } from '../../../utils/logger'
const log = logger('[index]')

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)

  if (event.method === 'GET') {
    const docs = await ContractTemplate.find().sort({ createdAt: -1 }).lean()
    return { success: true, data: docs }
  }

  if (event.method === 'POST') {
    const body = await readBody(event)
    if (!body.name)
      throw createError({ statusCode: 400, message: 'Template name is required' })

    // Auto-generate slug from name
    let slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    try {
      const doc = await ContractTemplate.create({
        ...body,
        slug,
      })
      return { success: true, data: doc }
    }
    catch (err: any) {
      // If slug collision (E11000 duplicate key), append timestamp and retry
      if (err?.code === 11000 && err?.message?.includes('slug')) {
        slug = `${slug}-${Date.now()}`
        const doc = await ContractTemplate.create({
          ...body,
          slug,
        })
        return { success: true, data: doc }
      }
      log.error('[templates] Create failed:', err?.message || err)
      throw createError({ statusCode: 500, message: err?.message || 'Failed to create template' })
    }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
