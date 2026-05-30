import { defineEventHandler, readBody } from 'h3'
import { Product } from '../../models/Product'
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'

/**
 * POST /api/products/import
 * Accepts { rows: object[] } — array of parsed product objects
 * Bulk inserts all rows. No required fields.
 */
export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  const body = await readBody(event)
  const rows = body.rows

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: 'No rows provided' }
  }

  // Normalize boolean and numeric fields
  const BOOL_FIELDS = ['isBoxPricesLinked', 'sellByBox', 'worksheetByBox', 'isTaxable', 'isAddon']
  const NUM_FIELDS = ['wasteAddon', 'salesPrice', 'costPrice', 'boxSalesPrice', 'boxCostPrice', 'unitsPerBox']

  const cleaned = rows.map((row: any) => {
    const doc: any = { ...row }

    for (const f of BOOL_FIELDS) {
      if (doc[f] !== undefined) {
        const v = String(doc[f]).toLowerCase().trim()
        doc[f] = v === 'true' || v === '1' || v === 'yes'
      }
    }

    for (const f of NUM_FIELDS) {
      if (doc[f] !== undefined && doc[f] !== '') {
        doc[f] = Number.parseFloat(doc[f]) || 0
      }
    }

    return doc
  })

  try {
    const result = await Product.insertMany(cleaned, { ordered: false })
    return { success: true, imported: result.length }
  }
  catch (err: any) {
    // With ordered: false, some may have been inserted even if others failed
    const inserted = err.insertedDocs?.length || 0
    return {
      success: inserted > 0,
      imported: inserted,
      errors: err.writeErrors?.length || 0,
      message: err.message,
    }
  }
})
