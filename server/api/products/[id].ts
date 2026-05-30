import { defineEventHandler, readBody } from 'h3'
import { Product } from '../../models/Product'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { objectId, parseBody } from '../../utils/validation'
import { z } from 'zod'

const ProductUpdateSchema = z.object({
  sku: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  color: z.string().max(200).optional(),
  type: z.string().max(200).optional(),
  vendor: z.string().max(200).optional(),
  manufacturer: z.string().max(200).optional(),
  styleName: z.string().max(200).optional(),
  colorName: z.string().max(200).optional(),
  price: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  unit: z.string().max(50).optional(),
  species: z.string().max(200).optional(),
  finish: z.string().max(200).optional(),
  images: z.array(z.string().url()).optional(),
  tags: z.array(z.string().max(100)).optional(),
  notes: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
}).strict()

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method
  const id = objectId(event.context.params?.id)

  if (method === 'GET') {
    const product = await Product.findById(id)
    if (!product)
      return { success: false, error: 'Not found' }
    return { success: true, data: product }
  }

  if (method === 'PUT') {
    requireManager(event)
    const raw = await readBody(event)
    const data = parseBody(ProductUpdateSchema, raw)
    const updated = await Product.findByIdAndUpdate(id, { $set: data }, { new: true })
    return { success: true, data: updated }
  }

  if (method === 'DELETE') {
    requireManager(event)
    await Product.findByIdAndDelete(id)
    return { success: true }
  }
})
