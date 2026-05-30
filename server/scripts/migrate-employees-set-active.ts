// One-time: set all employees without status to Active
// Original: server/api/employees/set-all-active.post.ts
import { Employee } from '../models/Employee'

/**
 * Run with:
 *   npx tsx server/scripts/migrate-employees-set-active.ts
 *
 * Requires MONGODB_URI (and any other env vars used by the logic below) to be
 * set in your environment, e.g.:
 *   MONGODB_URI=... npx tsx server/scripts/migrate-employees-set-active.ts
 *
 * This file was extracted from server/api/employees/set-all-active.post.ts and is intentionally NOT
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


        const result = await Employee.updateMany(
            { $or: [{ status: { $exists: false } }, { status: null }, { status: '' }] },
            { $set: { status: 'Active' } },
        )

        return { success: true, modified: result.modifiedCount }
    } finally {
        await mongoose.disconnect()
        console.log('[DB] Disconnected')
    }
}

run().catch(err => { console.error(err); process.exit(1) })
