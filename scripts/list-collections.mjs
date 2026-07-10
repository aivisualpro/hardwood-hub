import 'dotenv/config'
import mongoose from 'mongoose'

const uri = process.env.NUXT_MONGODB_URI
await mongoose.connect(uri)
const db = mongoose.connection.db
const collections = await db.listCollections().toArray()
console.log(collections.map(c => c.name))
await mongoose.disconnect()
