import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || ''

async function run() {
  await mongoose.connect(MONGO_URI)
  const db = mongoose.connection.db!

  // List collections to be sure
  const collections = await db.listCollections().toArray()
  console.log('Collections:', collections.map(c => c.name))

  const employees = await db.collection('hardwoodDB_Employees').find().toArray()
  console.log('\nEmployees:')
  for (const emp of employees) {
    console.log(`- Name: ${emp.employee}, ID: ${emp._id}, Position: ${emp.position}`)
  }

  const tasks = await db.collection('hardwoodDB_tasks').find({}).limit(10).toArray()
  console.log('\nTasks (First 10):')
  for (const t of tasks) {
    console.log(`- Title: ${t.title}, createdBy: ${t.createdBy} (type: ${typeof t.createdBy}), approvedBy: ${t.approvedBy}`)
  }
  await mongoose.disconnect()
}

run().catch(console.error)
