// Copy Customers → Pipeline collection
// Original: server/api/pipeline/migrate.post.ts
import { Customer } from '../models/Customer'
import { Pipeline } from '../models/Pipeline'

/**
 * Run with:
 *   npx tsx server/scripts/migrate-pipeline-from-customers.ts
 *
 * Requires MONGODB_URI (and any other env vars used by the logic below) to be
 * set in your environment, e.g.:
 *   MONGODB_URI=... npx tsx server/scripts/migrate-pipeline-from-customers.ts
 *
 * This file was extracted from server/api/pipeline/migrate.post.ts and is intentionally NOT
 * an HTTP route — it runs once manually and should never be re-added to server/api/.
 */
import 'dotenv/config'
import mongoose from 'mongoose'

async function run() {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI is not set')
    await mongoose.connect(uri)
    console.log('[DB] Connected')

    try {
            // (DB connection handled by run() wrapper above)

      // 1. Get all existing customer docs (raw)
      const customers = await Customer.find().lean<any[]>()

      if (!customers.length) {
        return { success: true, message: 'No customers to migrate', copied: 0, skipped: 0 }
      }

      // 2. Check which _ids already exist in Pipeline
      const existingIds = new Set(
        (await Pipeline.find().select('_id').lean<{ _id: any }[]>())
          .map(d => String(d._id))
      )

      // 3. Filter out already-migrated docs
      const toInsert = customers.filter(c => !existingIds.has(String(c._id)))

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
    } finally {
        await mongoose.disconnect()
        console.log('[DB] Disconnected')
    }
}

run().catch(err => { console.error(err); process.exit(1) })
