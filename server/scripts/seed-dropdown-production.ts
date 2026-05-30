// Seed Daily Production Categories and Sub Types dropdowns
// Original: server/api/dropdowns/seed-production.get.ts
import { Dropdown } from '../models/Dropdown'

/**
 * Run with:
 *   npx tsx server/scripts/seed-dropdown-production.ts
 *
 * Requires MONGODB_URI (and any other env vars used by the logic below) to be
 * set in your environment, e.g.:
 *   MONGODB_URI=... npx tsx server/scripts/seed-dropdown-production.ts
 *
 * This file was extracted from server/api/dropdowns/seed-production.get.ts and is intentionally NOT
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

      // 1. Seed "Daily Production Categories"
      const categoryOptions = Object.keys(CATEGORY_SUBTYPES).map((cat, idx) => ({
        label: cat,
        value: cat,
        color: '',
        icon: '',
        order: idx,
        category: '',
      }))

      await Dropdown.findOneAndUpdate(
        { name: 'Daily Production Categories' },
        { $set: { name: 'Daily Production Categories', options: categoryOptions } },
        { upsert: true, new: true }
      )

      // 2. Seed "Daily Production Sub Types" with category on each option
      let subtypeOrder = 0
      const subtypeOptions: any[] = []
      for (const [cat, subs] of Object.entries(CATEGORY_SUBTYPES)) {
        for (const sub of subs) {
          subtypeOptions.push({
            label: sub,
            value: sub,
            color: '',
            icon: '',
            order: subtypeOrder++,
            category: cat,
          })
        }
      }

      await Dropdown.findOneAndUpdate(
        { name: 'Daily Production Sub Types' },
        { $set: { name: 'Daily Production Sub Types', options: subtypeOptions } },
        { upsert: true, new: true }
      )

      return {
        success: true,
        message: `Seeded ${categoryOptions.length} categories and ${subtypeOptions.length} subtypes`,
      }
    } finally {
        await mongoose.disconnect()
        console.log('[DB] Disconnected')
    }
}

run().catch(err => { console.error(err); process.exit(1) })
