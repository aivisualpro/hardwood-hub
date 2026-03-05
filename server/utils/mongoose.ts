import mongoose from 'mongoose'

let isConnected = false

export async function connectDB() {
    if (isConnected) return

    const uri = process.env.NUXT_MONGODB_URI
    if (!uri) throw new Error('NUXT_MONGODB_URI is not set')

    await mongoose.connect(uri)
    isConnected = true
    console.log('[MongoDB] Connected')
}
