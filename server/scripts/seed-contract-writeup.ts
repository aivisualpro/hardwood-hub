// Seed Employee Write Up contract template
// Original: server/api/contracts/templates/seed-writeup.post.ts
import { ContractTemplate } from '../models/ContractTemplate'

/**
 * Run with:
 *   npx tsx server/scripts/seed-contract-writeup.ts
 *
 * Requires MONGODB_URI (and any other env vars used by the logic below) to be
 * set in your environment, e.g.:
 *   MONGODB_URI=... npx tsx server/scripts/seed-contract-writeup.ts
 *
 * This file was extracted from server/api/contracts/templates/seed-writeup.post.ts and is intentionally NOT
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
          { slug: 'employee-write-up' },
          {
            name: 'Employee Write Up',
            slug: 'employee-write-up',
            description: 'Standard multi-step employee disciplinary write-up form with manager and employee signatures.',
            content: CONTENT,
            variables: VARIABLES,
            category: 'HR',
            isActive: true,
            createdBy: 'system',
          },
          { upsert: true, new: true }
        )

        return { success: true, message: 'Employee Write Up template seeded', data: doc }
    } finally {
        await mongoose.disconnect()
        console.log('[DB] Disconnected')
    }
}

run().catch(err => { console.error(err); process.exit(1) })
