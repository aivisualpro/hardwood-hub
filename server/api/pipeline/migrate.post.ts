import { Customer } from '../../models/Customer'
import { Pipeline } from '../../models/Pipeline'
/**
 * POST /api/pipeline/migrate
 * One-time migration: copies all documents from hardwoodDB_Customers → hardwoodDB_pipeline.
 * Safe to run multiple times — skips documents that already exist by _id.
 */
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'

export default defineEventHandler(async () => {
  await connectDB()
  requireAdmin(event)

  // 1. Get all existing customer docs (raw)
  const customers = await Customer.find().lean<any[]>()

  if (!customers.length) {
    return { success: true, message: 'No customers to migrate', copied: 0, skipped: 0 }
  }

  // 2. Check which _ids already exist in Pipeline
  const existingIds = new Set(
    (await Pipeline.find().select('_id').lean<{ _id: any }[]>())
      .map((d: any) => String(d._id)),
  )

  // 3. Filter out already-migrated docs
  const toInsert = customers.filter((c: any) => !existingIds.has(String(c._id)))

  if (toInsert.length === 0) {
    return {
      success: true,
      message: 'All documents already migrated',
      copied: 0,
      skipped: customers.length,
    }
  }

  // 4. Bulk insert — preserving original _id and timestamps
  await Pipeline.insertMany(toInsert, { ordered: false })

  return {
    success: true,
    message: `Migration complete: ${toInsert.length} copied, ${customers.length - toInsert.length} skipped (already existed)`,
    copied: toInsert.length,
    skipped: customers.length - toInsert.length,
    total: customers.length,
  }
})
