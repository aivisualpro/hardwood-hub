/**
 * Repair pipeline stages orphaned by the dropdown-id regeneration bug.
 *
 * Preview (no writes):   node --env-file=.env scripts/repair-pipeline-stages.mjs
 * Apply (with backup):   node --env-file=.env scripts/repair-pipeline-stages.mjs --apply
 *
 * How the mapping was reconstructed:
 *  - The original dropdown was created 2026-05-15 by seed-customer-status,
 *    which inserts options ALPHABETICALLY → sequential ObjectIds mirror
 *    alphabetical order (…c419 = 1st label, …c42c = 20th label).
 *  - 3 options were added 2026-05-20 (the 6a0e… ids).
 *  - Two seeded labels ("contact made", "SUBSCRIBERS") were later deleted.
 *  - Record counts per id were used to anchor/verify positions
 *    (124 on the last position = "phone call", 115 = "Paid in full", etc.)
 *
 * REVIEW THE MAPPING BELOW BEFORE APPLYING. Lines marked GUESS are the
 * uncertain ones — confirm with the client, then edit if needed.
 */
import { MongoClient, ObjectId } from 'mongodb'

const APPLY = process.argv.includes('--apply')

// old status id → current dropdown option LABEL (must match exactly)
// Set a value to null to leave those records unchanged (stay Uncategorized).
const MAPPING = {
  '6a066dc042205c7205f6c419': 'Changes Requested', //  x16  confident
  '6a066dc042205c7205f6c41a': 'Estimate sent', //  x9   confident
  '6a066dc042205c7205f6c41e': 'Needs Crew assigned', //  x17  confident
  '6a066dc042205c7205f6c41f': 'Needs Deposit', //  x2   confident
  '6a066dc042205c7205f6c420': 'Needs Sched', //  x5   GUESS — could be "Needs Follow-Up, Inspection, Maintenance, Call Back"
  '6a066dc042205c7205f6c421': 'Needs estimate', //  x7   confident
  '6a066dc042205c7205f6c422': 'Needs wood', //  x3   confident
  '6a066dc042205c7205f6c423': 'Paid in full', //  x115 confident
  '6a066dc042205c7205f6c425': 'Project In Progress', //  x9   confident
  '6a066dc042205c7205f6c428': 'Waiting for P', //  x1   confident
  '6a066dc042205c7205f6c42a': 'phone call', //  x2   was "contact made" (deleted label) → closest match
  '6a066dc042205c7205f6c42b': 'inspection done Completed/needs final Bill', //  x2   confident
  '6a066dc042205c7205f6c42c': 'phone call', //  x124 confident (last alphabetical seed slot)
  // The 3 options added 2026-05-20 — id order = order they were added:
  '6a0e175751be539680cebce4': 'Needs Quick quote', //  x7   GUESS
  '6a0e177451be539680cebd29': 'Needs Follow-Up, Inspection, Maintenance, Call Back', //  x2   GUESS
  '6a0e29a02682618b12a91bb7': 'Lost', //  x10  GUESS
}

const uri = process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI
const client = new MongoClient(uri)
await client.connect()
const db = client.db()

// Resolve current dropdown option ids by label
const dd = await db.collection('hardwoodDB_Dropdowns').findOne({ name: 'Customer Status' })
if (!dd) {
  console.error('Customer Status dropdown not found — aborting.')
  process.exit(1)
}
const labelToId = new Map()
for (const o of dd.options || [])
  labelToId.set(String(o.label).trim(), o._id)

// Validate mapping labels exist
let bad = false
for (const [oldId, label] of Object.entries(MAPPING)) {
  if (label && !labelToId.has(label)) {
    console.error(`MAPPING error: label "${label}" (for ${oldId}) not found in dropdown.`)
    bad = true
  }
}
if (bad) process.exit(1)

const pipeline = db.collection('hardwoodDB_pipeline')

console.log(APPLY ? '=== APPLY MODE ===' : '=== DRY RUN (no writes) — use --apply to execute ===')

if (APPLY) {
  // Backup first
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const backupName = `hardwoodDB_pipeline_backup_${stamp}`
  const docs = await pipeline.find({}).toArray()
  await db.collection(backupName).deleteMany({})
  await db.collection(backupName).insertMany(docs)
  console.log(`✓ Backed up ${docs.length} docs to ${backupName}`)
}

let totalFixed = 0
for (const [oldId, label] of Object.entries(MAPPING)) {
  const filter = { status: new ObjectId(oldId) }
  const count = await pipeline.countDocuments(filter)
  if (!count) continue

  if (!label) {
    console.log(`\n• ${oldId}  (${count} records) → SKIPPED (no mapping)`)
    continue
  }

  const newId = labelToId.get(label)
  const samples = await pipeline.find(filter).limit(5)
    .project({ name: 1, projectName: 1 }).toArray()
  console.log(`\n• ${oldId}  (${count} records) → "${label}"`)
  console.log(`    e.g. ${samples.map(s => s.name || s.projectName || '?').join(' | ')}`)

  if (APPLY) {
    const res = await pipeline.updateMany(filter, { $set: { status: new ObjectId(String(newId)) } })
    totalFixed += res.modifiedCount
  }
  else {
    totalFixed += count
  }
}

console.log(`\n${APPLY ? '✓ Fixed' : 'Would fix'} ${totalFixed} records.`)
if (!APPLY)
  console.log('Review the proposals above (especially GUESS lines), edit MAPPING if needed, then re-run with --apply')

await client.close()
