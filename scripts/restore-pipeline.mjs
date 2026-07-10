/**
 * Standalone restore script — run with:
 *   node scripts/restore-pipeline.mjs
 *
 * Restores the assignedTo and projectAssignedTo fields from hardwoodDB_pipeline_backup
 */
import 'dotenv/config'
import mongoose from 'mongoose'

const uri = process.env.NUXT_MONGODB_URI
if (!uri) {
  console.error('FATAL: NUXT_MONGODB_URI is not set in .env')
  process.exit(1)
}

await mongoose.connect(uri)
console.log('✓ Connected to MongoDB')

const db = mongoose.connection.db

const backupCollection = db.collection('hardwoodDB_pipeline_backup')
const pipelineCollection = db.collection('hardwoodDB_pipeline')

const backupDocs = await backupCollection.find({}).toArray()
console.log(`✓ Found ${backupDocs.length} documents in backup`)

let restoredCount = 0

for (const backupDoc of backupDocs) {
  await pipelineCollection.updateOne(
    { _id: backupDoc._id },
    { 
      $set: { 
        assignedTo: backupDoc.assignedTo,
        projectAssignedTo: backupDoc.projectAssignedTo
      } 
    }
  )
  restoredCount++
}

console.log(`\n✓ Successfully restored ${restoredCount} documents from backup.`)
await mongoose.disconnect()
