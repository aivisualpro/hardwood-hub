/**
 * Copy all collections from source MongoDB to destination MongoDB
 */
import mongoose from 'mongoose'

const SOURCE_URI = 'mongodb+srv://adeel:Stp8e23BuXPTBemF@bookingx.qni27fu.mongodb.net/hardwoodDB'
const DEST_URI = 'mongodb+srv://michael_db_user:A2HW1234@cluster0.jysjiw.mongodb.net/hardwoodDB'

async function copyDatabase() {
  console.log('🔌 Connecting to SOURCE...')
  const sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise()
  const sourceDb = sourceConn.db!

  console.log('🔌 Connecting to DESTINATION...')
  const destConn = await mongoose.createConnection(DEST_URI).asPromise()
  const destDb = destConn.db!

  // List all collections in source
  const collections = await sourceDb.listCollections().toArray()
  console.log(`\n📋 Found ${collections.length} collections to copy:\n`)

  for (const colInfo of collections) {
    const name = colInfo.name
    const sourceCol = sourceDb.collection(name)
    const destCol = destDb.collection(name)

    const docs = await sourceCol.find({}).toArray()
    const count = docs.length

    if (count === 0) {
      console.log(`  ⏭️  ${name}: 0 docs (skipped)`)
      continue
    }

    // Drop destination collection first (clean copy)
    try {
      await destCol.drop()
    }
    catch { /* collection might not exist */ }

    // Insert all documents
    await destCol.insertMany(docs)
    console.log(`  ✅ ${name}: ${count} docs copied`)
  }

  // Also copy indexes
  console.log('\n📑 Copying indexes...')
  for (const colInfo of collections) {
    const name = colInfo.name
    const sourceCol = sourceDb.collection(name)
    const destCol = destDb.collection(name)

    const indexes = await sourceCol.indexes()
    for (const idx of indexes) {
      if (idx.name === '_id_')
        continue // skip default
      try {
        const { key, ...options } = idx
        delete (options as any).v
        await destCol.createIndex(key, options)
      }
      catch (e: any) {
        console.warn(`  ⚠️  ${name}.${idx.name}: ${e.message}`)
      }
    }
  }

  console.log('\n🏁 Done! All collections copied.')
  await sourceConn.close()
  await destConn.close()
  process.exit(0)
}

copyDatabase().catch((err) => {
  console.error('❌ Failed:', err)
  process.exit(1)
})
