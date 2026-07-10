import 'dotenv/config'
import mongoose from 'mongoose'

const uri = process.env.NUXT_MONGODB_URI
await mongoose.connect(uri)
const admin = mongoose.connection.db.admin()
const dbs = await admin.listDatabases()
console.log(dbs.databases)
await mongoose.disconnect()
