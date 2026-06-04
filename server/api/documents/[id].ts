/**
 * GET    /api/documents/:id  — get single document
 * PUT    /api/documents/:id  — update a document
 * DELETE /api/documents/:id  — delete a document
 */
import { defineEventHandler, readBody } from 'h3'
import { Document } from '../../models/Document'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const id = event.context.params?.id
  const method = event.node.req.method

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID is required' })
  }

  if (method === 'GET') {
    const doc = await Document.findById(id).lean()
    if (!doc) {
      throw createError({ statusCode: 404, statusMessage: 'Document not found' })
    }
    return {
      success: true,
      data: {
        ...doc,
        _id: String((doc as any)._id),
        projectId: (doc as any).projectId ? String((doc as any).projectId) : null,
        customerId: (doc as any).customerId ? String((doc as any).customerId) : null,
      },
    }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const updated = await Document.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Document not found' })
    }
    return {
      success: true,
      data: {
        ...updated,
        _id: String((updated as any)._id),
        projectId: (updated as any).projectId ? String((updated as any).projectId) : null,
        customerId: (updated as any).customerId ? String((updated as any).customerId) : null,
      },
    }
  }

  if (method === 'DELETE') {
    const deleted = await Document.findByIdAndDelete(id)
    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: 'Document not found' })
    }
    return { success: true }
  }
})
