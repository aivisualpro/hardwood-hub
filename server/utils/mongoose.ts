import mongoose from 'mongoose'

let isConnected = false

export async function connectDB() {
    if (isConnected) return

    const uri = process.env.NUXT_MONGODB_URI
    if (!uri) throw new Error('NUXT_MONGODB_URI is not set')

    await mongoose.connect(uri, {
        maxPoolSize: 10,            // M10 supports up to 500 connections
        minPoolSize: 2,             // Keep 2 warm connections
        socketTimeoutMS: 30000,     // 30s socket timeout
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
    })
    isConnected = true
    console.log('[MongoDB] Connected')
}
