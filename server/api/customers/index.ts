import { defineEventHandler, readBody } from 'h3'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method

  if (method === 'GET') {
    const query = getQuery(event)
    const search = query.search as string | undefined
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 200))

    const filter: Record<string, any> = {}
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ]
    }

    // Projection: exclude heavy embedded arrays not needed for list views
    const customers = await Customer.find(filter)
      .select('-gallery -relatedContacts -notes')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    // Stringify ObjectId fields so they survive Nitro's JSON serialization on Vercel
    // (raw BSON ObjectIds serialize to nested objects instead of hex strings in production)
    const serialized = customers.map((c: any) => ({
      ...c,
      _id: String(c._id),
      status: c.status ? String(c.status) : null,
    }))
    return { success: true, data: serialized }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const newCustomer = new Customer(body)
    await newCustomer.save()
    return { success: true, data: newCustomer }
  }
})
