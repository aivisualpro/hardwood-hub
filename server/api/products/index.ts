import { defineEventHandler, readBody, getQuery } from 'h3'
import { Product } from '../../models/Product'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const method = event.node.req.method

  if (method === 'GET') {
    const query = getQuery(event)
    const search = (query.search as string) || ''
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 50
    const skip = (page - 1) * limit

    const filter: any = {}
    if (search) {
      const regex = { $regex: search, $options: 'i' }
      filter.$or = [
        { sku: regex },
        { description: regex },
        { color: regex },
        { type: regex },
        { vendor: regex },
        { manufacturer: regex },
        { styleName: regex },
        { colorName: regex },
      ]
    }

    const [data, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ])

    return {
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const product = new Product(body)
    await product.save()
    return { success: true, data: product }
  }
})
