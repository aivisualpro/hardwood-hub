import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || ''

async function run() {
    await mongoose.connect(MONGO_URI)
    const db = mongoose.connection.db!

    const tasks = await db.collection('hardwoodDB_tasks').find({}).toArray()
    console.log(`Found ${tasks.length} tasks:`)
    for (const t of tasks) {
        console.log(`Task: "${t.title}" | Status: ${t.status}`)
        console.log(`  createdBy:`, JSON.stringify(t.createdBy), `type:`, typeof t.createdBy, `constructor:`, t.createdBy ? t.createdBy.constructor.name : 'null')
        console.log(`  approvedBy:`, JSON.stringify(t.approvedBy), `type:`, typeof t.approvedBy, `constructor:`, t.approvedBy ? t.approvedBy.constructor.name : 'null')
    }

    const employees = await db.collection('hardwoodDB_Employees').find({}).toArray()
    console.log(`Found ${employees.length} employees:`)
    for (const e of employees) {
        console.log(`  Employee: ${e.employee} | ID: ${e._id} | Position: ${e.position}`)
    }

    await mongoose.disconnect()
}

run().catch(console.error)
