import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { createSessionToken } from './server/lib/session'

dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || ''

async function run() {
    await mongoose.connect(MONGO_URI)
    const db = mongoose.connection.db!

    const task = await db.collection('hardwoodDB_tasks').findOne({ title: "Why do we use it?" })
    if (!task) {
        console.error('Task not found')
        await mongoose.disconnect()
        return
    }

    console.log('Task found:', task.title, 'ID:', task._id)

    // Generate token for Adeel Jabbar
    const token = createSessionToken('69a8e3941ed653889cfc1406', 'adeel@annarborhardwoods.com')
    console.log('Generated token:', token)

    // Perform PUT request to local Nuxt server
    const url = `http://localhost:9568/api/tasks/${task._id}`
    console.log('Sending PUT request to:', url)

    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `hardwood_session=${token}`
            },
            body: JSON.stringify({
                status: 'done',
                approvedBy: '69a8e3941ed653889cfc1406',
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
