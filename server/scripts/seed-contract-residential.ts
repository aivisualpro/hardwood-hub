// Seed Residential Flooring Contract template
// Original: server/api/contracts/templates/seed-residential.post.ts
import { ContractTemplate } from '../models/ContractTemplate'

/**
 * Run with:
 *   npx tsx server/scripts/seed-contract-residential.ts
 *
 * Requires MONGODB_URI (and any other env vars used by the logic below) to be
 * set in your environment, e.g.:
 *   MONGODB_URI=... npx tsx server/scripts/seed-contract-residential.ts
 *
 * This file was extracted from server/api/contracts/templates/seed-residential.post.ts and is intentionally NOT
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

        }

        const doc = await ContractTemplate.findOneAndUpdate(
          { slug: 'residential-contract-updated' },
          {
            name: 'Residential Contract updated',
            slug: 'residential-contract-updated',
            description: 'Comprehensive residential construction contract including payments, schedule, warranty, and arbitration terms.',
            content: CONTENT,
            variables: VARIABLES,
            category: 'Agreements',
            isActive: true,
            createdBy: 'system',
          },
          { upsert: true, new: true }
        )

        return { success: true, message: 'Residential Contract updated template seeded', data: doc }
    } finally {
        await mongoose.disconnect()
        console.log('[DB] Disconnected')
    }
}

run().catch(err => { console.error(err); process.exit(1) })
