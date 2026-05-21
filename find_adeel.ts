import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || ''

async function run() {
    await mongoose.connect(MONGO_URI)
    const db = mongoose.connection.db!

    const emp = await db.collection('hardwoodDB_Employees').findOne({ _id: new mongoose.Types.ObjectId('69a8e3941ed653889cfc1406') })
    console.log('Adeel:', emp)

    await mongoose.disconnect()
}

run().catch(console.error)
