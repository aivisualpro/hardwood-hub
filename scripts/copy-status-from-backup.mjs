/**
 * STEP 1 — Copy _id + status from the July 9 snapshot into the live DB.
 *
 * Creates on the LIVE db:
 *   hardwoodDB_pipelineTemp         — { _id, status } for every pipeline doc in the snapshot
 *   hardwoodDB_DropdownsOldSnapshot — the old "Customer Status" dropdown (needed to
 *                                     translate old status ids → labels)
 *
 * Usage:
 *   OLD_URI="<snapshot connection string>" node --env-file=.env scripts/copy-status-from-backup.mjs
 */
import { MongoClient } from 'mongodb'

const OLD_URI = process.env.OLD_URI
const PROD_URI = process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI
if (!OLD_URI) {
  console.error('Set OLD_URI to the snapshot/restored-cluster connection string.')
  process.exit(1)
}

// ── Read from snapshot ──────────────────────────────────────────────
const oldClient = new MongoClient(OLD_URI)
await oldClient.connect()
const oldDb = oldClient.db('hardwoodDB')

const statusDocs = await oldDb.collection('hardwoodDB_pipeline')
  .find({}, { projection: { _id: 1, status: 1 } })
  .toArray()
console.log(`✓ Snapshot: ${statusDocs.length} pipeline docs (${statusDocs.filter(d => d.status).length} with a status)`)

const oldDD = await oldDb.collection('hardwoodDB_Dropdowns').findOne({ name: 'Customer Status' })
if (oldDD) {
  console.log(`✓ Snapshot: old "Customer Status" dropdown with ${oldDD.options?.length ?? 0} options:`)
  for (const o of oldDD.options || [])
    console.log(`   ${String(o._id)}  "${o.label}"`)
}
else {
  console.warn('⚠ Old "Customer Status" dropdown not found in snapshot!')
}
await oldClient.close()

// ── Write to live db ────────────────────────────────────────────────
const prod = new MongoClient(PROD_URI)
await prod.connect()
const db = prod.db()

await db.collection('hardwoodDB_pipelineTemp').drop().catch(() => {})
await db.collection('hardwoodDB_pipelineTemp').insertMany(statusDocs)
console.log(`✓ Wrote ${statusDocs.length} docs to hardwoodDB_pipelineTemp`)

if (oldDD) {
  await db.collection('hardwoodDB_DropdownsOldSnapshot').drop().catch(() => {})
  await db.collection('hardwoodDB_DropdownsOldSnapshot').insertOne(oldDD)
  console.log('✓ Wrote old dropdown to hardwoodDB_DropdownsOldSnapshot')
}

await prod.close()
console.log('\nDone. Next: node --env-file=.env scripts/apply-status-from-temp.mjs   (dry run)')
