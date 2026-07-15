/**
 * Diagnose why pipeline stage tabs show everything as Uncategorized.
 * Run:  node --env-file=.env scripts/diagnose-pipeline-stages.mjs
 */
import { MongoClient } from 'mongodb'

const uri = process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI
if (!uri) {
  console.error('No NUXT_MONGODB_URI in .env')
  process.exit(1)
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db()

// 1. Customer Status dropdown
const dd = await db.collection('hardwoodDB_Dropdowns').findOne({ name: 'Customer Status' })
console.log('\n=== Customer Status dropdown ===')
if (!dd) {
  console.log('NOT FOUND — this is the problem: no dropdown, no stage tabs.')
}
else {
  console.log(`options (${dd.options?.length || 0}):`)
  for (const o of dd.options || [])
    console.log(`  ${String(o._id)}  label="${o.label}"  value="${o.value ?? ''}"`)
}

// 2. Pipeline status distribution
const agg = await db.collection('hardwoodDB_pipeline').aggregate([
  { $group: { _id: '$status', count: { $sum: 1 }, t: { $first: { $type: '$status' } } } },
  { $sort: { count: -1 } },
]).toArray()
console.log('\n=== Pipeline status distribution ===')
for (const r of agg)
  console.log(`  status=${r._id === null || r._id === undefined ? 'null/missing' : String(r._id)}  type=${r.t}  count=${r.count}`)

// 3. Cross-check: do stored statuses match current dropdown option ids?
const optionIds = new Set((dd?.options || []).map(o => String(o._id)))
const orphaned = agg.filter(r => r._id != null && !optionIds.has(String(r._id)))
const matched = agg.filter(r => r._id != null && optionIds.has(String(r._id)))
console.log('\n=== Verdict ===')
console.log(`  statuses matching current dropdown options: ${matched.reduce((s, r) => s + r.count, 0)}`)
console.log(`  ORPHANED statuses (point to nonexistent option ids): ${orphaned.reduce((s, r) => s + r.count, 0)}`)
console.log(`  null/missing status: ${agg.filter(r => r._id == null).reduce((s, r) => s + r.count, 0)}`)

// 4. Legacy stage strings that could be used for recovery
const stageAgg = await db.collection('hardwoodDB_pipeline').aggregate([
  { $match: { stage: { $exists: true, $nin: [null, ''] } } },
  { $group: { _id: '$stage', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]).toArray()
console.log('\n=== Legacy "stage" strings on pipeline docs (recovery source) ===')
if (!stageAgg.length)
  console.log('  none found')
for (const r of stageAgg)
  console.log(`  "${r._id}"  count=${r.count}`)

await client.close()
