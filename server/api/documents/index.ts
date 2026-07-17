/**
 * GET  /api/documents      — list documents (filter by projectId or customerId)
 * POST /api/documents      — create a new document record
 */
import { defineEventHandler, readBody, getQuery } from 'h3'
import { Document } from '../../models/Document'
import { Estimate } from '../../models/Estimate'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method

  if (method === 'GET') {
    const query = getQuery(event)
    const projectId = query.projectId as string | undefined
    const customerId = query.customerId as string | undefined

    const filter: Record<string, any> = {}
    if (projectId) filter.projectId = projectId
    if (customerId) filter.customerId = customerId

    const docs = await Document.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    const serialized = docs.map((d: any) => ({
      ...d,
      _id: String(d._id),
      projectId: d.projectId ? String(d.projectId) : null,
      customerId: d.customerId ? String(d.customerId) : null,
    }))

    let virtualDocs: any[] = []
    if (projectId || customerId) {
      const estFilter: Record<string, any> = {}
      if (projectId) estFilter.projectId = projectId
      if (customerId) estFilter.customerId = customerId

      const estimates = await Estimate.find(estFilter).lean()
      virtualDocs = estimates.map((est: any) => ({
        _id: `est_${est._id}`,
        projectId: est.projectId ? String(est.projectId) : null,
        customerId: est.customerId ? String(est.customerId) : null,
        date: est.createdAt || est.updatedAt || new Date(),
        documentType: 'Estimate',
        isEstimate: true,
        files: [{
          url: `/api/estimates/download-pdf/${est._id}`,
          name: `${est.title || 'Estimate'}_#${est.estimateNumber || est._id}.pdf`,
          size: 0,
          type: 'application/pdf'
        }],
        uploadedAt: est.createdAt || est.updatedAt || new Date()
      }))
    }

    const combined = [...serialized, ...virtualDocs].sort(
      (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
    )

    return { success: true, data: combined }
  }

  if (method === 'POST') {
    const body = await readBody(event)

    if (!body.projectId) {
      throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
    }

    const doc = new Document({
      projectId: body.projectId,
      customerId: body.customerId || null,
      date: body.date || new Date(),
      documentType: body.documentType || '',
      files: body.files || [],
      uploadedAt: body.uploadedAt || new Date(),
    })

    await doc.save()

    return {
      success: true,
      data: {
        ...doc.toObject(),
        _id: String(doc._id),
        projectId: String(doc.projectId),
        customerId: doc.customerId ? String(doc.customerId) : null,
      },
    }
  }
})
