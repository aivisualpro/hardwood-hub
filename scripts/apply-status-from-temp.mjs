/**
 * STEP 2 — Apply statuses from hardwoodDB_pipelineTemp to the live pipeline.
 *
 * For each doc in hardwoodDB_pipelineTemp:
 *   old status id → old label (via hardwoodDB_DropdownsOldSnapshot)
 *              → current option id (via live "Customer Status" dropdown, matched by label)
 *   then sets that status on the live hardwoodDB_pipeline doc with the same _id.
 * Labels that no longer exist in the current dropdown are re-added automatically.
 *
 * Usage:
 *   Preview:  node --env-file=.env scripts/apply-status-from-temp.mjs
 *   Apply:    node --env-file=.env scripts/apply-status-from-temp.mjs --apply
 */
import { MongoClient, ObjectId } from 'mongodb'

const APPLY = process.argv.includes('--apply')
const norm = s => String(s ?? '').trim().toLowerCase()

const client = new MongoClient(process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI)
await client.connect()
const db = client.db()

const temp = await db.collection('hardwoodDB_pipelineTemp').find({}).toArray()
if (!temp.length) {
  console.error('hardwoodDB_pipelineTemp is empty — run copy-status-from-backup.mjs first.')
  process.exit(1)
}

const oldDD = await db.collection('hardwoodDB_DropdownsOldSnapshot').findOne({ name: 'Customer Status' })
if (!oldDD) {
  console.error('hardwoodDB_DropdownsOldSnapshot missing — run copy-status-from-backup.mjs first.')
  process.exit(1)
}
const oldIdToLabel = new Map()
for (const o of oldDD.options || [])
  oldIdToLabel.set(String(o._id), o.label)

const curDD = await db.collection('hardwoodDB_Dropdowns').findOne({ name: 'Customer Status' })
const labelToNewId = new Map()
const newIds = new Set()
for (const o of curDD.options || []) {
  labelToNewId.set(norm(o.label), o._id)
  newIds.add(String(o._id))
}

const pipeline = db.collection('hardwoodDB_pipeline')
console.log(APPLY ? '=== APPLY MODE ===' : '=== DRY RUN — use --apply to execute ===')

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
  const backupName = `hardwoodDB_pipeline_backup_${stamp}`
  const docs = await pipeline.find({}).toArray()
  await db.collection(backupName).insertMany(docs)
  console.log(`✓ Backed up ${docs.length} live docs to ${backupName}`)
}

const stats = { relinked: 0, alreadyCurrent: 0, nullStatus: 0, noLabel: 0, missingLive: 0, labelsReadded: [] }
const perLabel = new Map()

for (const t of temp) {
  if (!t.status) { stats.nullStatus++; continue }
  const sid = String(t.status)

  // Status already a current option id (snapshot taken after a partial fix)? keep as-is
  if (newIds.has(sid)) { stats.alreadyCurrent++; continue }

  const label = oldIdToLabel.get(sid)
  if (!label) { stats.noLabel++; continue }

  let newId = labelToNewId.get(norm(label))
  if (!newId) {
    // Re-add the deleted label so these records keep their stage
    newId = new ObjectId()
    if (APPLY) {
      await db.collection('hardwoodDB_Dropdowns').updateOne(
        { _id: curDD._id },
        { $push: { options: { _id: newId, label, value: label, color: '', icon: '', order: 999 } } },
      )
    }
    labelToNewId.set(norm(label), newId)
    newIds.add(String(newId))
    stats.labelsReadded.push(label)
  }

  perLabel.set(label, (perLabel.get(label) || 0) + 1)
  if (APPLY) {
    const res = await pipeline.updateOne(
      { _id: t._id },
      { $set: { status: new ObjectId(String(newId)) } },
    )
    if (res.matchedCount === 0) { stats.missingLive++; continue }
  }
  stats.relinked++
}

console.log(`\nPer-stage results:`)
for (const [label, n] of [...perLabel.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`  "${label}"  x${n}`)

console.log(`\n${APPLY ? '✓ Relinked' : 'Would relink'}: ${stats.relinked}`)
console.log(`  already pointing at current options: ${stats.alreadyCurrent}`)
console.log(`  null status in snapshot:             ${stats.nullStatus}`)
console.log(`  old id not in old dropdown:          ${stats.noLabel}`)
if (APPLY) console.log(`  temp docs missing from live:         ${stats.missingLive}`)
if (stats.labelsReadded.length)
  console.log(`  labels re-added to dropdown:         ${stats.labelsReadded.join(', ')}`)

await client.close()
