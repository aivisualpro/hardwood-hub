import { defineEventHandler, readBody } from 'h3'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method

  if (method === 'GET') {
    // Projection: exclude heavy embedded arrays not needed for list views
    const customers = await Customer.find()
      .select('-gallery -relatedContacts -notes')
      .sort({ createdAt: -1 })
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
