import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || ''
const TARGET_ID = '69a8e3941ed653889cfc1405'

async function run() {
    await mongoose.connect(MONGO_URI)
    const db = mongoose.connection.db!
    const result = await db.collection('hardwoodDB_tasks').updateMany(
        {},
        { $set: { createdBy: new mongoose.Types.ObjectId(TARGET_ID) } }
    )
    console.log(`✅ Updated ${result.modifiedCount} tasks → createdBy: ${TARGET_ID}`)
    await mongoose.disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })
