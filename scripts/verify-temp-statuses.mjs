/**
 * Show what each pipeline record would get, by customer name — for eyeballing.
 * Run:  node --env-file=.env scripts/verify-temp-statuses.mjs
 * No writes.
 */
import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI)
await client.connect()
const db = client.db()
const norm = s => String(s ?? '').trim().toLowerCase()

const oldDD = await db.collection('hardwoodDB_DropdownsOldSnapshot').findOne({ name: 'Customer Status' })
const oldIdToLabel = new Map()
for (const o of oldDD?.options || [])
  oldIdToLabel.set(String(o._id), o.label)

const temp = await db.collection('hardwoodDB_pipelineTemp').find({}).toArray()
const tempById = new Map(temp.map(t => [String(t._id), t]))

const live = await db.collection('hardwoodDB_pipeline')
  .find({}, { projection: { name: 1, projectName: 1, status: 1 } })
  .sort({ name: 1 })
  .toArray()

// Group by proposed label
const groups = new Map()
for (const doc of live) {
  const t = tempById.get(String(doc._id))
  let label
  if (!t) label = '(not in July 9 snapshot — newer record, unchanged)'
  else if (!t.status) label = '(no stage on July 9 — stays uncategorized)'
  else label = oldIdToLabel.get(String(t.status)) || `(unknown old id ${String(t.status)})`
  if (!groups.has(label)) groups.set(label, [])
  groups.get(label).push(doc.name || doc.projectName || String(doc._id))
}

for (const [label, names] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n=== "${label}"  (${names.length}) ===`)
  console.log(names.join(', '))
}

await client.close()
