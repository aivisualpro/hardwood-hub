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
    const query = getQuery(event)
    const customerId = query.customerId as string | undefined
    const search = query.search as string | undefined
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 200))

    const filter: Record<string, any> = {}
    if (customerId) filter.customerId = customerId
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { projectName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ]
    }

    const records = await Pipeline.find(filter)
      .select('-gallery -relatedContacts -notes')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    const serialized = records.map((c: any) => ({
      ...c,
      _id: String(c._id),
      customerId: c.customerId ? String(c.customerId) : null,
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
