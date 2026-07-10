/**
 * Standalone recovery script — run with:
 *   node scripts/recover-assigned-to.mjs
 *
 * Recovers `assignedTo` fields in hardwoodDB_pipeline by matching
 * them with hardwoodDB_Customers, and resolving those string values
 * to actual employee ObjectIds.
 */
import 'dotenv/config'
import mongoose from 'mongoose'

const uri = process.env.NUXT_MONGODB_URI
if (!uri) {
  console.error('FATAL: NUXT_MONGODB_URI is not set in .env')
  process.exit(1)
}

await mongoose.connect(uri)
console.log('✓ Connected to MongoDB')

const db = mongoose.connection.db

// 1. Build employee lookup maps (casing-insensitive)
const employees = await db.collection('hardwoodDB_Employees').find({}).toArray()
const empByEmail = new Map()
const empByName = new Map()
const empById = new Map()

for (const emp of employees) {
  if (emp.email) empByEmail.set(emp.email.toLowerCase(), emp)
  if (emp.employee) empByName.set(emp.employee.toLowerCase(), emp)
  empById.set(String(emp._id), emp)
}
console.log(`✓ Loaded ${employees.length} employees`)

function resolveToObjectId(val) {
  const v = val.trim()
  if (!v) return null

  // If it's already a valid ObjectId and exists in our employees
  if (mongoose.Types.ObjectId.isValid(v) && empById.has(v)) {
    return new mongoose.Types.ObjectId(v)
  }

  // Check email match
  const byEmail = empByEmail.get(v.toLowerCase())
  if (byEmail) return byEmail._id

  // Check name match
  const byName = empByName.get(v.toLowerCase())
  if (byName) return byName._id

  // Shorthand helpers for common first names
  const lower = v.toLowerCase()
  if (lower === 'jordan' || lower === 'jord') {
    const match = employees.find(e => e.employee && e.employee.toLowerCase().includes('jordan'))
    if (match) return match._id
  }
  if (lower === 'jacob' || lower === 'jcob') {
    const match = employees.find(e => e.employee && e.employee.toLowerCase().includes('jacob'))
    if (match) return match._id
  }
  if (lower === 'ian') {
    const match = employees.find(e => e.employee && e.employee.toLowerCase().includes('ian'))
    if (match) return match._id
  }
  if (lower === 'bobby') {
    const match = employees.find(e => e.employee && e.employee.toLowerCase().includes('bobby'))
    if (match) return match._id
  }
  if (lower === 'tom') {
    const match = employees.find(e => e.employee && e.employee.toLowerCase().includes('tom'))
    if (match) return match._id
  }
  if (lower === 'chris') {
    const match = employees.find(e => e.employee && e.employee.toLowerCase().includes('chris'))
    if (match) return match._id
  }
  if (lower === 'jeremy') {
    const match = employees.find(e => e.employee && e.employee.toLowerCase().includes('jeremy'))
    if (match) return match._id
  }

  return null
}

// 2. Load all customers and pipeline docs
const customers = await db.collection('hardwoodDB_Customers').find({}).toArray()
const pipelineDocs = await db.collection('hardwoodDB_pipeline').find({}).toArray()

// Create a map of customers by ID, email, name, and phone
const custById = new Map()
const custByEmail = new Map()
const custByPhone = new Map()
const custByName = new Map()

for (const c of customers) {
  custById.set(String(c._id), c)
  if (c.email) custByEmail.set(c.email.toLowerCase(), c)
  if (c.phone) custByPhone.set(c.phone.replace(/\D/g, ''), c)
  if (c.name) custByName.set(c.name.toLowerCase(), c)
}

console.log(`✓ Loaded ${customers.length} customers and ${pipelineDocs.length} pipeline records`)

let restoredCount = 0
let failedMatchCount = 0
const unmatchedPipelineDocs = []
const unmatchedAssigneeValues = []

for (const pipe of pipelineDocs) {
  // Try to find the matching customer
  let matchedCustomer = null

  if (pipe.customerId) {
    matchedCustomer = custById.get(String(pipe.customerId))
  }
  if (!matchedCustomer && pipe.email) {
    matchedCustomer = custByEmail.get(pipe.email.toLowerCase())
  }
  if (!matchedCustomer && pipe.phone) {
    matchedCustomer = custByPhone.get(pipe.phone.replace(/\D/g, ''))
  }
  if (!matchedCustomer && pipe.name) {
    matchedCustomer = custByName.get(pipe.name.toLowerCase())
  }

  if (!matchedCustomer) {
    failedMatchCount++
    unmatchedPipelineDocs.push(`Pipeline doc: "${pipe.name}" (${pipe._id})`)
    continue
  }

  // Get the original assignedTo field from the matched customer
  const originalAssignedTo = matchedCustomer.assignedTo

  if (!originalAssignedTo) {
    continue
  }

  // Convert to ObjectId array
  const finalIds = []
  if (typeof originalAssignedTo === 'string' && originalAssignedTo.trim()) {
    const parts = originalAssignedTo.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    for (const p of parts) {
      const oid = resolveToObjectId(p)
      if (oid) {
        finalIds.push(oid)
      } else {
        unmatchedAssigneeValues.push(`Customer: "${matchedCustomer.name}" -> value: "${p}"`)
      }
    }
  } else if (Array.isArray(originalAssignedTo)) {
    // If it's already an array, clean it and convert string ObjectIds or names
    for (const item of originalAssignedTo) {
      if (!item) continue
      const oid = resolveToObjectId(String(item))
      if (oid) {
        finalIds.push(oid)
      } else {
        unmatchedAssigneeValues.push(`Customer: "${matchedCustomer.name}" -> value: "${item}"`)
      }
    }
  }

  // Update pipeline record with the recovered and resolved ObjectIds
  if (finalIds.length > 0) {
    await db.collection('hardwoodDB_pipeline').updateOne(
      { _id: pipe._id },
      { $set: { assignedTo: finalIds } }
    )
    restoredCount++
  }
}

console.log('\n── Recovery Complete ──')
console.log(`  Successfully restored: ${restoredCount} pipeline records`)
console.log(`  Failed to match customer: ${failedMatchCount}`)

if (unmatchedPipelineDocs.length > 0) {
  console.log(`\n  Unmatched Pipeline Docs (first 10):`)
  for (const doc of unmatchedPipelineDocs.slice(0, 10)) {
    console.log(`    • ${doc}`)
  }
}

if (unmatchedAssigneeValues.length > 0) {
  console.log(`\n  Unresolved Assignee Values (first 10):`)
  for (const val of unmatchedAssigneeValues.slice(0, 10)) {
    console.log(`    • ${val}`)
  }
}

await mongoose.disconnect()
console.log('\n✓ Done')
