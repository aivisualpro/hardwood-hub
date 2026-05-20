/**
 * Migration: Convert createdBy from embedded {id, name, avatar} to Employee ObjectId
 * Run once: npx tsx server/scripts/migrate-createdBy.ts
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI || ''

async function migrate() {
    if (!MONGO_URI) {
        console.error('❌ No MONGODB_URI found in .env')
        process.exit(1)
    }

    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected to MongoDB')

    const db = mongoose.connection.db!
    const tasksCol = db.collection('hardwoodDB_tasks')
    const employeesCol = db.collection('hardwoodDB_Employees')

    // Build a name → _id lookup from employees
    const employees = await employeesCol.find({}, { projection: { _id: 1, employee: 1 } }).toArray()
    const nameToId = new Map<string, any>()
    for (const emp of employees) {
        if (emp.employee) {
            nameToId.set(emp.employee, emp._id)
        }
    }
    console.log(`📋 Loaded ${nameToId.size} employees`)

    // Find tasks with old embedded createdBy format
    const tasks = await tasksCol.find({
        'createdBy.name': { $exists: true },
    }).toArray()

    console.log(`🔍 Found ${tasks.length} tasks with old createdBy format`)

    let updated = 0
    let skipped = 0

    for (const task of tasks) {
        const creatorName = (task.createdBy as any)?.name
        if (!creatorName) {
            skipped++
            continue
        }

        const employeeId = nameToId.get(creatorName)
        if (!employeeId) {
            console.warn(`  ⚠️  ${task.taskId}: No employee found for "${creatorName}", skipping`)
            skipped++
            continue
        }

        await tasksCol.updateOne(
            { _id: task._id },
            { $set: { createdBy: employeeId } }
        )
        console.log(`  ✅ ${task.taskId}: "${creatorName}" → ${employeeId}`)
        updated++
    }

    console.log(`\n🏁 Done! Updated: ${updated}, Skipped: ${skipped}`)
    await mongoose.disconnect()
    process.exit(0)
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err)
    process.exit(1)
})
