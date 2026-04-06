import { defineEventHandler, readBody } from 'h3'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method

  if (method === 'GET') {
    const customers = await Customer.find().sort({ createdAt: -1 })
    return { success: true, data: customers }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const newCustomer = new Customer(body)
    await newCustomer.save()
    return { success: true, data: newCustomer }
  }
})
