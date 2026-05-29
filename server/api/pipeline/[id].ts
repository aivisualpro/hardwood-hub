/**
 * GET    /api/pipeline/:id  — get single pipeline record
 * PUT    /api/pipeline/:id  — update a pipeline record
 * DELETE /api/pipeline/:id  — delete a pipeline record
 */
import { defineEventHandler, readBody } from 'h3'
import { Pipeline } from '../../models/Pipeline'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method
  const id = event.context.params?.id

  if (!id) return { success: false, error: 'No ID provided' }

  if (method === 'GET') {
    const record = await Pipeline.findById(id).lean()
    if (!record) return { success: false, error: 'Not found' }
    return { success: true, data: record }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const updated = await Pipeline.findByIdAndUpdate(id, body, { new: true })
    return { success: true, data: updated }
  }

  if (method === 'DELETE') {
    await Pipeline.findByIdAndDelete(id)
    return { success: true }
  }
})
