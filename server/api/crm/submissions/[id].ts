/**
 * GET/PATCH /api/crm/submissions/[id]
 * GET: View single submission
 * PATCH: Update status, starred, notes
 */
import { connectDB } from '../../../utils/mongoose'
import { CrmSubmission } from '../../../models/CrmSubmission'

export default defineEventHandler(async (event) => {
  await connectDB()
  const id = getRouterParam(event, 'id')

  if (event.method === 'GET') {
    const doc = await CrmSubmission.findById(id).lean()
    if (!doc) throw createError({ statusCode: 404, message: 'Submission not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'PATCH') {
    const body = await readBody(event)
    const allowed = ['status', 'starred', 'notes']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    const doc = await CrmSubmission.findByIdAndUpdate(id, updates, { new: true }).lean()
    if (!doc) throw createError({ statusCode: 404, message: 'Submission not found' })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
