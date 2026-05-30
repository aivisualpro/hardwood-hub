import { defineEventHandler, readBody } from 'h3'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { CustomerUpdateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method
  const id = objectId(event.context.params?.id)

  if (method === 'GET') {
    const customer = await Customer.findById(id).lean()
    if (!customer)
      return { success: false, error: 'Not found' }
    return { success: true, data: customer }
  }

  if (method === 'PUT') {
    requireManager(event)
    const raw = await readBody(event)
    const data = parseBody(CustomerUpdateSchema, raw)
    const updated = await Customer.findByIdAndUpdate(id, { $set: data }, { new: true })
    return { success: true, data: updated }
  }

  if (method === 'DELETE') {
    requireManager(event)
    await Customer.findByIdAndDelete(id)
    return { success: true }
  }
})
