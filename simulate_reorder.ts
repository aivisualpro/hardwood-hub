import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { createSessionToken } from './server/lib/session'

dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || ''

async function run() {
    await mongoose.connect(MONGO_URI)
    const db = mongoose.connection.db!

    // Find the task we just moved to 'done' and move it back to 'in-review' first
    const task = await db.collection('hardwoodDB_tasks').findOne({ title: "Why do we use it?" })
    if (!task) {
        console.error('Task not found')
        await mongoose.disconnect()
        return
    }

    console.log('Task found:', task.title, 'ID:', task._id, 'Status:', task.status)

    // Reset status to 'in-review' and approvedBy to null so it's unapproved and in-review
    await db.collection('hardwoodDB_tasks').updateOne(
        { _id: task._id },
        { $set: { status: 'in-review', approvedBy: null } }
    )
    console.log('Reset task status to in-review and approvedBy to null.')

    // Generate token for Adeel Jabbar
    const token = createSessionToken('69a8e3941ed653889cfc1406', 'adeel@annarborhardwoods.com')

    // Perform reorder POST request to local Nuxt server
    const url = `http://localhost:9568/api/tasks/reorder`
    console.log('Sending POST reorder request to:', url)

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `hardwood_session=${token}`
            },
            body: JSON.stringify({
                updates: [
                    { _id: String(task._id), status: 'done', order: 0 }
                ],
                _changedBy: 'Adeel Jabbar',
                _changedById: '69a8e3941ed653889cfc1406'
            })
        })

        console.log('Response Status:', res.status)
        const text = await res.text()
        console.log('Response body:', text)
    } catch (err) {
        console.error('Fetch error:', err)
    }

    await mongoose.disconnect()
}

run().catch(console.error)
