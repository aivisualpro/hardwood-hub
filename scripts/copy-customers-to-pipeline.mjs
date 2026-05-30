/**
 * One-time script: copy hardwoodDB_Customers → hardwoodDB_pipeline
 * 
 * Uses raw MongoDB driver (via mongoose.connection) so every field —
 * _id, ObjectIds, dates, nested subdocument _ids, timestamps — is
 * cloned exactly as-is.  Safe to re-run: skips docs whose _id
 * already exists in the target collection.
 *
 * Usage:  node scripts/copy-customers-to-pipeline.mjs
 */
import mongoose from 'mongoose'
import 'dotenv/config'

const uri = process.env.NUXT_MONGODB_URI
if (!uri) { console.error('❌  NUXT_MONGODB_URI not set'); process.exit(1) }

await mongoose.connect(uri)
console.log('✅  Connected to MongoDB')

const db = mongoose.connection.db

const srcCollection = db.collection('hardwoodDB_Customers')
const destCollection = db.collection('hardwoodDB_pipeline')

// 1. Read every document from the source collection (raw BSON)
const allDocs = await srcCollection.find({}).toArray()
console.log(`📦  Found ${allDocs.length} documents in hardwoodDB_Customers`)

if (allDocs.length === 0) {
  console.log('Nothing to copy.')
  await mongoose.disconnect()
  process.exit(0)
}

// 2. Check which _ids already exist in destination
const existingIds = new Set(
  (await destCollection.find({}, { projection: { _id: 1 } }).toArray())
    .map(d => d._id.toString()),
)
console.log(`📌  ${existingIds.size} documents already in hardwoodDB_pipeline`)

// 3. Filter out docs that already exist
const toInsert = allDocs.filter(d => !existingIds.has(d._id.toString()))

if (toInsert.length === 0) {
  console.log('✅  All documents already migrated — nothing to do.')
  await mongoose.disconnect()
  process.exit(0)
}

// 4. Bulk insert — raw documents, preserving every field exactly
const result = await destCollection.insertMany(toInsert, { ordered: false })
console.log(`✅  Copied ${result.insertedCount} documents to hardwoodDB_pipeline`)
console.log(`⏭   Skipped ${allDocs.length - toInsert.length} (already existed)`)

await mongoose.disconnect()
console.log('🔌  Disconnected')
