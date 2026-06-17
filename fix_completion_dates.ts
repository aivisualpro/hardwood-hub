/**
 * FIX: Restore completionDate from changelog entries.
 * Finds the last changelog entry where field='status' and newValue='done',
 * and sets completionDate = changedAt from that entry.
 *
 * Usage:  npx tsx fix_completion_dates.ts
 */
import mongoose from 'mongoose'
import 'dotenv/config'

const MONGO_URI = process.env.NUXT_MONGODB_URI || ''
if (!MONGO_URI) {
  console.error('❌ NUXT_MONGODB_URI not set')
  process.exit(1)
}

async function run() {
  await mongoose.connect(MONGO_URI)
  console.log('✅ Connected to MongoDB')

  const db = mongoose.connection.db!
  const col = db.collection('hardwoodDB_tasks')

  // Find all done tasks
  const doneTasks = await col.find(
    { status: 'done' },
    { projection: { _id: 1, changelog: 1, createdAt: 1 } },
  ).toArray()

  console.log(`Found ${doneTasks.length} done tasks`)

  let fixed = 0
  let noChangelog = 0
  const ops: any[] = []

  for (const task of doneTasks) {
    const changelog = task.changelog || []

    // Find the LAST changelog entry where status was changed to 'done'
    let doneEntry = null
    for (let i = changelog.length - 1; i >= 0; i--) {
      const entry = changelog[i]
      if (entry.field === 'status' && entry.newValue === 'done' && entry.changedAt) {
        doneEntry = entry
        break
      }
    }

    if (doneEntry) {
      ops.push({
        updateOne: {
          filter: { _id: task._id },
          update: { $set: { completionDate: doneEntry.changedAt } },
        },
      })
      fixed++
      console.log(`  ✓ Task ${task._id} → completionDate = ${doneEntry.changedAt}`)
    }
    else {
      // No changelog entry found — fall back to createdAt as last resort
      noChangelog++
      console.log(`  ⚠ Task ${task._id} — no 'done' changelog entry, skipping`)
    }
  }

  if (ops.length) {
    // Use raw updateMany to avoid Mongoose timestamps overwriting updatedAt again
    const result = await col.bulkWrite(ops)
    console.log(`\n✅ Fixed ${result.modifiedCount} tasks`)
  }
  else {
    console.log('\nNo tasks to fix.')
  }

  if (noChangelog)
    console.log(`⚠ ${noChangelog} tasks had no changelog entry for status→done`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('❌ Fix failed:', err)
  process.exit(1)
})
