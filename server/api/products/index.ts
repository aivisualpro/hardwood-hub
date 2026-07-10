import { defineEventHandler, getQuery, readBody } from 'h3'
import { Product } from '../../models/Product'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { stripHiddenFields, sanitizeWriteBody } from '../../utils/applyFieldPermissions'
import { parseBody } from '../../utils/validation'
import { actorFromEvent, fireAutomations } from '../../utils/automationEngine'
import { z } from 'zod'

// Product schema — validates all writable product fields
const ProductWriteSchema = z.object({
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
  width: z.number().nonnegative().optional(),
  thickness: z.number().nonnegative().optional(),
  species: z.string().max(200).optional(),
  finish: z.string().max(200).optional(),
  images: z.array(z.string().url()).optional(),
  tags: z.array(z.string().max(100)).optional(),
  notes: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
}).strict()

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/products')
  const method = event.node.req.method

  if (method === 'GET') {
    const query = getQuery(event)
    const search = (query.search as string) || ''
    const page = Number.parseInt(query.page as string) || 1
    const limit = Number.parseInt(query.limit as string) || 50
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
      data: stripHiddenFields(event, '/crm/products', data as any[]),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  if (method === 'POST') {
    requireManager(event)
    const raw = await readBody(event)
    const data = parseBody(ProductWriteSchema, raw)
    const cleaned = sanitizeWriteBody(event, '/crm/products', data)
    const product = new Product(cleaned)
    await product.save()
    fireAutomations({ module: 'crm', submodule: 'products', action: 'create', after: product.toObject(), actor: actorFromEvent(event) })
    return { success: true, data: product }
  }
})
