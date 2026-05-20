import { defineEventHandler, readBody } from 'h3'
import { Product } from '../../models/Product'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method
  const id = event.context.params?.id

  if (!id) return { success: false, error: 'No ID provided' }

  if (method === 'GET') {
    const product = await Product.findById(id)
    if (!product) return { success: false, error: 'Not found' }
    return { success: true, data: product }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const updated = await Product.findByIdAndUpdate(id, body, { new: true })
    return { success: true, data: updated }
  }

  if (method === 'DELETE') {
    await Product.findByIdAndDelete(id)
    return { success: true }
  }
})
