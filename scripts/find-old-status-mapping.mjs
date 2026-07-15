/**
 * Hunt for the old Customer Status option ids (6a066dc0…, 6a0e…) anywhere in the DB
 * so we can rebuild the old-id → label mapping and repair pipeline records.
 * Run:  node --env-file=.env scripts/find-old-status-mapping.mjs
 */
import { MongoClient, ObjectId } from 'mongodb'

const uri = process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI
const client = new MongoClient(uri)
await client.connect()
const db = client.db()

// The orphaned ids from the diagnosis
const orphanIds = [
  '6a066dc042205c7205f6c419', '6a066dc042205c7205f6c41a', '6a066dc042205c7205f6c41e',
  '6a066dc042205c7205f6c41f', '6a066dc042205c7205f6c420', '6a066dc042205c7205f6c421',
  '6a066dc042205c7205f6c422', '6a066dc042205c7205f6c423', '6a066dc042205c7205f6c425',
  '6a066dc042205c7205f6c428', '6a066dc042205c7205f6c42a', '6a066dc042205c7205f6c42b',
  '6a066dc042205c7205f6c42c', '6a0e29a02682618b12a91bb7', '6a0e175751be539680cebce4',
  '6a0e177451be539680cebd29',
]

// 0. Decode timestamps — when were old vs new option ids created?
console.log('=== ObjectId timestamps ===')
console.log('old batch (6a066dc0…):', new ObjectId('6a066dc042205c7205f6c419').getTimestamp().toISOString())
console.log('old extra (6a0e29a0…):', new ObjectId('6a0e29a02682618b12a91bb7').getTimestamp().toISOString())
console.log('new batch (6a566d27…):', new ObjectId('6a566d27ea9be85bd624185b').getTimestamp().toISOString())

// 1. All collections
const cols = await db.listCollections().toArray()
console.log('\n=== Collections ===')
console.log(cols.map(c => c.name).join(', '))

// 2. Any other dropdown docs containing the orphaned option ids?
const oids = orphanIds.map(s => new ObjectId(s))
for (const c of cols) {
  const name = c.name
  // Search likely candidates: anything dropdown/backup/log/activity/automation-ish + all small collections
  const count = await db.collection(name).estimatedDocumentCount()
  const interesting = /drop|back|log|activ|audit|autom|notif|hist/i.test(name) || count < 500
  if (!interesting) continue
  try {
    const hit = await db.collection(name).findOne({
      $or: [
        { 'options._id': { $in: oids } },
        { 'options._id': { $in: orphanIds } },
      ],
    })
    if (hit) {
      console.log(`\n!!! FOUND options doc in "${name}":`)
      console.log(JSON.stringify(hit, null, 1).slice(0, 4000))
    }
  }
  catch { /* skip */ }
}

// 3. Notifications / activity text that may mention status changes with labels
for (const name of cols.map(c => c.name)) {
  if (!/notif|activ|audit|autom|hist|log/i.test(name)) continue
  const sample = await db.collection(name).find({}).sort({ _id: -1 }).limit(3).toArray()
  if (sample.length) {
    console.log(`\n=== sample from "${name}" (${sample.length}) ===`)
    console.log(JSON.stringify(sample, null, 1).slice(0, 2500))
  }
}

// 4. Customers: stage strings + how many pipeline docs can be matched by email/phone
const custStages = await db.collection('hardwoodDB_customers').aggregate([
  { $match: { stage: { $exists: true, $nin: [null, ''] } } },
  { $group: { _id: '$stage', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]).toArray().catch(() => [])
console.log('\n=== Customer stage strings ===')
console.log(custStages.length ? custStages.map(r => `  "${r._id}" x${r.count}`).join('\n') : '  (collection missing or empty — will list below)')

if (!custStages.length) {
  // find the customers collection name
  for (const c of cols) {
    if (/customer/i.test(c.name)) {
      const n = await db.collection(c.name).countDocuments()
      console.log(`  candidate collection: ${c.name} (${n} docs)`)
    }
  }
}

await client.close()
console.log('\nDone.')
