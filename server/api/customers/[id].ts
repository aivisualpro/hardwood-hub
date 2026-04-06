import { defineEventHandler, readBody } from 'h3'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method
  const id = event.context.params?.id

  if (!id) return { success: false, error: 'No ID provided' }

  if (method === 'GET') {
    const customer = await Customer.findById(id)
    if (!customer) return { success: false, error: 'Not found' }
    return { success: true, data: customer }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const updated = await Customer.findByIdAndUpdate(id, body, { new: true })
    return { success: true, data: updated }
  }

  if (method === 'DELETE') {
    await Customer.findByIdAndDelete(id)
    return { success: true }
  }
})
