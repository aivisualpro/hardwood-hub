import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || ''

function getObjectIdString(val: any): string | null {
    if (!val) return null
    if (typeof val === 'string') return val
    if (typeof val === 'object') {
        if (typeof val.toHexString === 'function') {
            return val.toHexString()
        }
        if (val._id) {
            return getObjectIdString(val._id)
        }
        if (val.id && typeof val.id === 'string') {
            return val.id
        }
        return String(val)
    }
    return String(val)
}

async function run() {
    await mongoose.connect(MONGO_URI)
    const db = mongoose.connection.db!

    const tasks = await db.collection('hardwoodDB_tasks').find({ title: "Why do we use it?" }).toArray()
    const t = tasks[0]
    if (!t) {
        console.log('Task not found!')
        await mongoose.disconnect()
        return
    }

    console.log('Task:', t.title)
    console.log('t.createdBy type:', typeof t.createdBy)
    console.log('t.createdBy constructor:', t.createdBy ? t.createdBy.constructor.name : 'null')
    
    const creatorId = getObjectIdString(t.createdBy)
    console.log('creatorId resolved:', creatorId)

    const changedById = "69a8e3941ed653889cfc1406"
    console.log('changedById simulated:', changedById)

    const isCreator = !creatorId || (!!changedById && creatorId.trim().toLowerCase() === changedById.trim().toLowerCase())
    console.log('isCreator:', isCreator)

    // Let's also check who the logged in user actually has
    const emp = await db.collection('hardwoodDB_Employees').findOne({ _id: new mongoose.Types.ObjectId(changedById) })
    console.log('Employee position:', emp?.position)

    await mongoose.disconnect()
}

run().catch(console.error)
