import mongoose from 'mongoose'

// Seed demo tasks into MongoDB
// Original: server/api/tasks/seed.post.ts
import { Task } from '../models/Task'
/**
 * Run with:
 *   npx tsx server/scripts/seed-tasks.ts
 *
 * Requires MONGODB_URI (and any other env vars used by the logic below) to be
 * set in your environment, e.g.:
 *   MONGODB_URI=... npx tsx server/scripts/seed-tasks.ts
 *
 * This file was extracted from server/api/tasks/seed.post.ts and is intentionally NOT
 * an HTTP route — it runs once manually and should never be re-added to server/api/.
 */
import 'dotenv/config'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri)
    throw new Error('MONGODB_URI is not set')
  await mongoose.connect(uri)
  console.log('[DB] Connected')

  try {
    // Seed disabled — tasks are now user-created only
    return { success: true, message: 'Seed disabled', skipped: true }
  }
  finally {
    await mongoose.disconnect()
    console.log('[DB] Disconnected')
  }
}

run().catch((err) => { console.error(err); process.exit(1) })
