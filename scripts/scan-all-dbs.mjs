/**
 * Scan every database on the cluster for:
 *  - old Customer Status dropdown docs (containing the orphaned option ids)
 *  - pipeline backup collections
 * Run:  node --env-file=.env scripts/scan-all-dbs.mjs
 */
import { MongoClient, ObjectId } from 'mongodb'

const uri = process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI
const client = new MongoClient(uri)
await client.connect()

const orphanIds = [
  '6a066dc042205c7205f6c419', '6a066dc042205c7205f6c41a', '6a066dc042205c7205f6c41e',
  '6a066dc042205c7205f6c41f', '6a066dc042205c7205f6c420', '6a066dc042205c7205f6c421',
  '6a066dc042205c7205f6c422', '6a066dc042205c7205f6c423', '6a066dc042205c7205f6c425',
  '6a066dc042205c7205f6c428', '6a066dc042205c7205f6c42a', '6a066dc042205c7205f6c42b',
  '6a066dc042205c7205f6c42c', '6a0e29a02682618b12a91bb7', '6a0e175751be539680cebce4',
  '6a0e177451be539680cebd29',
]
const oids = orphanIds.map(s => new ObjectId(s))

const admin = client.db().admin()
const { databases } = await admin.listDatabases()
console.log('=== Databases ===')
console.log(databases.map(d => `${d.name} (${(d.sizeOnDisk / 1024 / 1024).toFixed(1)}MB)`).join(', '))

for (const { name: dbName } of databases) {
  if (['admin', 'local', 'config'].includes(dbName)) continue
  const db = client.db(dbName)
  const cols = await db.listCollections().toArray()

  for (const c of cols) {
    const colName = c.name
    // 1. Any doc whose options array contains an orphaned id
    try {
      const hit = await db.collection(colName).findOne({
        $or: [
          { 'options._id': { $in: oids } },
          { 'options._id': { $in: orphanIds } },
        ],
      })
      if (hit) {
        console.log(`\n!!! OLD DROPDOWN FOUND: ${dbName}.${colName}`)
        for (const o of hit.options || [])
          console.log(`   ${String(o._id)}  "${o.label}"`)
      }
    }
    catch { /* views etc. */ }

    // 2. Backup-ish pipeline collections
    if (/pipeline/i.test(colName)) {
      const n = await db.collection(colName).countDocuments().catch(() => -1)
      console.log(`\npipeline collection: ${dbName}.${colName}  (${n} docs)`)
      if (n > 0 && colName !== 'hardwoodDB_pipeline') {
        const sample = await db.collection(colName).findOne({ status: { $ne: null } })
        if (sample)
          console.log(`   sample: name="${sample.name}" status=${String(sample.status)} stage=${JSON.stringify(sample.stage)}`)
      }
    }
  }
}

await client.close()
console.log('\nDone.')
