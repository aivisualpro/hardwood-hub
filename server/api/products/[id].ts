import { defineEventHandler, readBody } from 'h3'
import { Product } from '../../models/Product'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { stripHiddenFields, sanitizeWriteBody } from '../../utils/applyFieldPermissions'
import { objectId, parseBody } from '../../utils/validation'
import { actorFromEvent, fireAutomations } from '../../utils/automationEngine'
import { z } from 'zod'

const ProductUpdateSchema = z.object({
  sku: z.string().max(200).optional(),
  color: z.string().max(200).optional(),
  path: z.string().max(500).optional(),
  type: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  trade: z.string().max(200).optional(),
  unit: z.string().max(50).optional(),
  wasteAddon: z.number().optional(),
  salesPrice: z.number().optional(),
  costPrice: z.number().optional(),
  boxSalesPrice: z.number().optional(),
  boxCostPrice: z.number().optional(),
  isBoxPricesLinked: z.boolean().optional(),
  boxName: z.string().max(200).optional(),
  unitsPerBox: z.number().optional(),
  sellByBox: z.boolean().optional(),
  worksheetByBox: z.boolean().optional(),
  isTaxable: z.boolean().optional(),
  isAddon: z.boolean().optional(),
  vendor: z.string().max(200).optional(),
  vendorSku: z.string().max(200).optional(),
  manufacturer: z.string().max(200).optional(),
  costCode: z.string().max(100).optional(),
  styleCode: z.string().max(100).optional(),
  styleName: z.string().max(200).optional(),
  colorCode: z.string().max(100).optional(),
  colorName: z.string().max(200).optional(),
}).strict()

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/products')
  const method = event.node.req.method
  const id = objectId(event.context.params?.id)

  if (method === 'GET') {
    const product = await Product.findById(id)
    if (!product)
      return { success: false, error: 'Not found' }
    return { success: true, data: stripHiddenFields(event, '/crm/products', product.toObject()) }
  }

  if (method === 'PUT') {
    requireManager(event)
    const raw = await readBody(event)
    const data = parseBody(ProductUpdateSchema, raw)
    const cleaned = sanitizeWriteBody(event, '/crm/products', data)
    const before = await Product.findById(id).lean()
    const updated = await Product.findByIdAndUpdate(id, { $set: cleaned }, { new: true })
    fireAutomations({ module: 'crm', submodule: 'products', action: 'update', before, after: updated?.toObject?.() || updated, actor: actorFromEvent(event) })
    return { success: true, data: updated }
  }

  if (method === 'DELETE') {
    requireManager(event)
    const before = await Product.findById(id).lean()
    await Product.findByIdAndDelete(id)
    fireAutomations({ module: 'crm', submodule: 'products', action: 'delete', before, actor: actorFromEvent(event) })
    return { success: true }
  }
})
