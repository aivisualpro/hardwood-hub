import 'dotenv/config'
import mongoose from 'mongoose'

const uri = process.env.NUXT_MONGODB_URI
await mongoose.connect(uri)
const db = mongoose.connection.db

console.log('Searching activity logs for recent pipeline updates...')
const logs = await db.collection('hardwoodDB_activitylogs').find({
  $or: [
    { collection: 'hardwoodDB_pipeline' },
    { module: 'crm' }
  ]
}).sort({ timestamp: -1 }).limit(10).toArray()

console.log(JSON.stringify(logs, null, 2))
await mongoose.disconnect()
