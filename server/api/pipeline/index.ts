/**
 * GET  /api/pipeline      — list all pipeline records
 * POST /api/pipeline      — create a new pipeline record
 */
import { defineEventHandler, readBody } from 'h3'
import { Pipeline } from '../../models/Pipeline'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method

  if (method === 'GET') {
    const records = await Pipeline.find()
      .select('-gallery -relatedContacts -notes')
      .sort({ createdAt: -1 })
      .lean()
    const serialized = records.map((c: any) => ({
      ...c,
      _id: String(c._id),
      status: c.status ? String(c.status) : null,
    }))
    return { success: true, data: serialized }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const record = new Pipeline(body)
    await record.save()
    return { success: true, data: record }
  }
})
