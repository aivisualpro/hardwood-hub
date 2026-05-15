/**
 * Fix Migration: Convert denormalized status { _id, name, color, icon } → plain ObjectId
 * 
 * Run: node scripts/migrate-customer-status.mjs
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Reads the "Customer Status" dropdown from hardwoodDB_Dropdowns
 * 3. For each customer, matches their .stage string to a dropdown option
 * 4. Sets customer.status = ObjectId (plain reference)
 * 5. Unsets the old .stage field
 */

import { MongoClient, ObjectId } from 'mongodb'

const MONGO_URI = 'mongodb+srv://adeel:Stp8e23BuXPTBemF@bookingx.qni27fu.mongodb.net/hardwoodDB'

async function run() {
  const client = new MongoClient(MONGO_URI)
  await client.connect()
  console.log('✅ Connected to MongoDB')

  const db = client.db('hardwoodDB')
  const customersCol = db.collection('hardwoodDB_Customers')
  const dropdownsCol = db.collection('hardwoodDB_Dropdowns')

  // 1. Get the "Customer Status" dropdown
  const dropdown = await dropdownsCol.findOne({ name: 'Customer Status' })
  if (!dropdown) {
    console.error('❌ "Customer Status" dropdown not found. Run the seed first.')
    await client.close()
    process.exit(1)
  }

  console.log(`📋 Found ${dropdown.options.length} status options`)

  // Build lookup: normalized label → option ObjectId
  const optionMap = new Map()
  for (const opt of dropdown.options) {
    optionMap.set(opt.label.trim().toLowerCase(), opt._id)
  }

  // 2. Fix already-migrated customers (denormalized → plain ObjectId)
  const denormalized = await customersCol.find({
    'status._id': { $exists: true }
  }).toArray()

  console.log(`\n🔧 Fixing ${denormalized.length} denormalized status records...`)
  let fixed = 0
  for (const cust of denormalized) {
    const oid = cust.status._id
    if (oid) {
      await customersCol.updateOne(
        { _id: cust._id },
        { $set: { status: oid } }
      )
      fixed++
    }
  }
  console.log(`   ✅ Fixed ${fixed} records`)

  // 3. Migrate remaining customers with .stage but no .status
  const remaining = await customersCol.find({
    stage: { $exists: true, $ne: '' },
    $or: [
      { status: { $exists: false } },
      { status: null },
    ]
  }).toArray()

  console.log(`\n👥 Found ${remaining.length} remaining customers with stage but no status`)

  let matched = 0
  let unmatched = 0
  const unmatchedStages = new Set()

  for (const cust of remaining) {
    const stageStr = (cust.stage || '').trim()
    if (!stageStr) continue

    const option = optionMap.get(stageStr.toLowerCase())
    if (option) {
      await customersCol.updateOne(
        { _id: cust._id },
        {
          $set: { status: option },
          $unset: { stage: '' }
        }
      )
      matched++
    } else {
      unmatched++
      unmatchedStages.add(stageStr)
    }
  }

  // 4. Clean up stage field on already-migrated records
  const cleanupResult = await customersCol.updateMany(
    { status: { $exists: true, $ne: null }, stage: { $exists: true } },
    { $unset: { stage: '' } }
  )
  console.log(`\n🧹 Cleaned up .stage field on ${cleanupResult.modifiedCount} records`)

  console.log(`\n📊 Migration Summary:`)
  console.log(`   🔧 Fixed denormalized:  ${fixed}`)
  console.log(`   ✅ Newly matched:       ${matched}`)
  console.log(`   ⚠️  Unmatched stages:   ${unmatched}`)

  if (unmatchedStages.size > 0) {
    console.log(`\n⚠️  Unmatched stage values:`)
    for (const s of unmatchedStages) {
      console.log(`   - "${s}"`)
    }
  }

  // Verify
  const sample = await customersCol.findOne({ status: { $exists: true, $ne: null } })
  console.log(`\n🔍 Sample record status field:`, JSON.stringify(sample?.status))

  await client.close()
  console.log('\n🔌 Done!')
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
