/**
 * Rebuild the old-status-id → label mapping empirically:
 * match pipeline records to Customers (by email/phone) and cross-tabulate
 * each orphaned status id against the customer's `stage` string.
 * Run:  node --env-file=.env scripts/recover-status-mapping.mjs
 */
import { MongoClient } from 'mongodb'

const uri = process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI
const client = new MongoClient(uri)
await client.connect()
const db = client.db()

// 1. Customer stage distribution
const custStages = await db.collection('hardwoodDB_Customers').aggregate([
  { $group: { _id: '$stage', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]).toArray()
console.log('=== Customer.stage distribution ===')
for (const r of custStages)
  console.log(`  ${JSON.stringify(r._id)}  x${r.count}`)

// 2. Build customer lookup by email and phone
const customers = await db.collection('hardwoodDB_Customers')
  .find({}, { projection: { email: 1, phone: 1, stage: 1, name: 1 } }).toArray()
const byEmail = new Map()
const byPhone = new Map()
for (const c of customers) {
  if (c.email) byEmail.set(String(c.email).trim().toLowerCase(), c)
  if (c.phone) {
    const p = String(c.phone).replace(/\D/g, '')
    if (p.length >= 7) byPhone.set(p, c)
  }
}

// 3. Cross-tabulate: orphaned pipeline status id → customer stage string
const pipes = await db.collection('hardwoodDB_pipeline')
  .find({ status: { $ne: null } }, { projection: { email: 1, phone: 1, status: 1, name: 1 } }).toArray()

const crosstab = new Map() // statusId -> Map(stage -> count)
let matched = 0
let unmatched = 0
for (const p of pipes) {
  let cust = null
  if (p.email) cust = byEmail.get(String(p.email).trim().toLowerCase())
  if (!cust && p.phone) {
    const ph = String(p.phone).replace(/\D/g, '')
    if (ph.length >= 7) cust = byPhone.get(ph)
  }
  if (!cust || !cust.stage) { unmatched++; continue }
  matched++
  const sid = String(p.status)
  if (!crosstab.has(sid)) crosstab.set(sid, new Map())
  const m = crosstab.get(sid)
  m.set(cust.stage, (m.get(cust.stage) || 0) + 1)
}

console.log(`\n=== Pipeline↔Customer match: ${matched} matched, ${unmatched} unmatched ===`)
console.log('\n=== Cross-tab: old status id → customer stage strings ===')
for (const [sid, m] of [...crosstab.entries()].sort((a, b) => {
  const ta = [...a[1].values()].reduce((s, x) => s + x, 0)
  const tb = [...b[1].values()].reduce((s, x) => s + x, 0)
  return tb - ta
})) {
  const total = [...m.values()].reduce((s, x) => s + x, 0)
  const parts = [...m.entries()].sort((a, b) => b[1] - a[1])
    .map(([stage, n]) => `"${stage}" x${n}`)
    .join(', ')
  console.log(`  ${sid} (${total} matched): ${parts}`)
}

await client.close()
console.log('\nDone.')
