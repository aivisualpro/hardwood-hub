/**
 * EXACT recovery of pipeline stages using a restored Atlas snapshot.
 *
 * The snapshot (taken before the July 14 dropdown save) contains the OLD
 * "Customer Status" dropdown with the original option ids + labels.
 * This script reads that old dropdown, matches old labels to the current
 * dropdown options, and relinks every pipeline record's status exactly.
 * Labels that no longer exist in the current dropdown are re-added so no
 * record loses its stage.
 *
 * Usage:
 *   Preview:  OLD_URI="<snapshot connection string>" node --env-file=.env scripts/restore-stages-from-snapshot.mjs
 *   Apply:    OLD_URI="<snapshot connection string>" node --env-file=.env scripts/restore-stages-from-snapshot.mjs --apply
 *
 * OLD_URI examples:
 *   - local mongod running on downloaded snapshot: mongodb://localhost:27017
 *   - temp Atlas cluster restored from snapshot:   mongodb+srv://user:pass@restore-temp.xxxxx.mongodb.net
 */
import { MongoClient, ObjectId } from 'mongodb'

const APPLY = process.argv.includes('--apply')
const OLD_URI = process.env.OLD_URI
const PROD_URI = process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI

if (!OLD_URI) {
  console.error('Set OLD_URI to the snapshot/restored-cluster connection string.')
  process.exit(1)
}

const norm = s => String(s ?? '').trim().toLowerCase()

// ── 1. Read OLD dropdown from snapshot ────────────────────────────────────
const oldClient = new MongoClient(OLD_URI)
await oldClient.connect()
const oldDb = oldClient.db('hardwoodDB')
const oldDD = await oldDb.collection('hardwoodDB_Dropdowns').findOne({ name: 'Customer Status' })
if (!oldDD) {
  console.error('Old "Customer Status" dropdown not found in snapshot DB "hardwoodDB".')
  process.exit(1)
}
console.log(`✓ Old dropdown found in snapshot — ${oldDD.options.length} options:`)
const oldIdToOption = new Map()
for (const o of oldDD.options) {
  oldIdToOption.set(String(o._id), o)
  console.log(`   ${String(o._id)}  "${o.label}"`)
}
await oldClient.close()

// ── 2. Read CURRENT dropdown from prod ────────────────────────────────────
const prod = new MongoClient(PROD_URI)
await prod.connect()
const db = prod.db()
const curDD = await db.collection('hardwoodDB_Dropdowns').findOne({ name: 'Customer Status' })
const labelToNewId = new Map()
for (const o of curDD.options)
  labelToNewId.set(norm(o.label), o._id)

// ── 3. Plan: old id → new id (re-adding missing labels if needed) ─────────
const pipeline = db.collection('hardwoodDB_pipeline')
const usedOldIds = await pipeline.distinct('status', { status: { $ne: null } })

console.log(`\n${APPLY ? '=== APPLY MODE ===' : '=== DRY RUN — use --apply to execute ==='}`)

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
  const backupName = `hardwoodDB_pipeline_backup_${stamp}`
  const docs = await pipeline.find({}).toArray()
  await db.collection(backupName).insertMany(docs)
  console.log(`✓ Backed up ${docs.length} docs to ${backupName}`)
}

let fixed = 0
let alreadyOk = 0
const missingLabels = []

for (const oldId of usedOldIds) {
  const sid = String(oldId)
  const count = await pipeline.countDocuments({ status: oldId })

  // Already points at a current option? (e.g. records staged after the incident)
  if ([...labelToNewId.values()].some(id => String(id) === sid)) {
    alreadyOk += count
    continue
  }

  const oldOpt = oldIdToOption.get(sid)
  if (!oldOpt) {
    console.log(`• ${sid} (${count} records) — NOT in snapshot dropdown either; leaving as-is`)
    continue
  }

  let newId = labelToNewId.get(norm(oldOpt.label))
  if (!newId) {
    missingLabels.push(oldOpt.label)
    console.log(`• ${sid} (${count} records) → label "${oldOpt.label}" missing from current dropdown — will re-add option`)
    if (APPLY) {
      newId = new ObjectId()
      await db.collection('hardwoodDB_Dropdowns').updateOne(
        { _id: curDD._id },
        { $push: { options: {
          _id: newId,
          label: oldOpt.label,
          value: oldOpt.value ?? oldOpt.label,
          color: oldOpt.color ?? '',
          icon: oldOpt.icon ?? '',
          order: 999,
        } } },
      )
      labelToNewId.set(norm(oldOpt.label), newId)
    }
    else {
      continue
    }
  }

  console.log(`• ${sid} (${count} records) → "${oldOpt.label}"`)
  if (APPLY) {
    const res = await pipeline.updateMany(
      { status: oldId },
      { $set: { status: new ObjectId(String(newId)) } },
    )
    fixed += res.modifiedCount
  }
  else {
    fixed += count
  }
}

console.log(`\n${APPLY ? '✓ Relinked' : 'Would relink'} ${fixed} records. ${alreadyOk} already correct.`)
if (!APPLY && missingLabels.length)
  console.log(`Labels to re-add on apply: ${missingLabels.join(', ')}`)

await prod.close()
