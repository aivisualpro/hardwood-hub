// Seed Customer Status dropdown from Customer.stage values
// Original: server/api/dropdowns/seed-customer-status.get.ts
import { Customer } from '../models/Customer'
import { Dropdown } from '../models/Dropdown'

/**
 * Run with:
 *   npx tsx server/scripts/seed-dropdown-customer-status.ts
 *
 * Requires MONGODB_URI (and any other env vars used by the logic below) to be
 * set in your environment, e.g.:
 *   MONGODB_URI=... npx tsx server/scripts/seed-dropdown-customer-status.ts
 *
 * This file was extracted from server/api/dropdowns/seed-customer-status.get.ts and is intentionally NOT
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

      // 1. Get all unique stage values from Customers
      const stages: string[] = await Customer.distinct('stage')
      const uniqueStages = stages.filter(s => s && s.trim()).sort()

      console.log(`[Dropdown Seed] Found ${uniqueStages.length} unique customer statuses:`, uniqueStages)

      // 2. Build options array with ObjectIds
      const options = uniqueStages.map((stage, idx) => ({
        label: stage,
        value: stage,
        order: idx,
      }))

      // 3. Upsert into Dropdowns collection
      const result = await Dropdown.findOneAndUpdate(
        { name: 'Customer Status' },
        {
          $set: {
            name: 'Customer Status',
            options,
          },
        },
        { upsert: true, new: true, lean: true }
      )

      return {
        success: true,
        dropdown: result,
        statuses: uniqueStages,
        count: uniqueStages.length,
      }
    } finally {
        await mongoose.disconnect()
        console.log('[DB] Disconnected')
    }
}

run().catch(err => { console.error(err); process.exit(1) })
