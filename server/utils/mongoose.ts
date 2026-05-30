/**
 * server/utils/mongoose.ts
 *
 * H2 fix — promise-caching singleton for Mongoose connections.
 *
 * The previous implementation used `let isConnected = false` which has two
 * failure modes in serverless/edge environments:
 *
 *   1. Race condition: two concurrent cold-start requests both see
 *      isConnected===false and call mongoose.connect() simultaneously,
 *      producing duplicate connection attempts and possible pool exhaustion.
 *
 *   2. Stale flag: if the underlying TCP connection is dropped (Atlas
 *      maintenance, network blip) the flag stays true and connectDB()
 *      returns without reconnecting, leaving the pool in a broken state.
 *
 * The fix:
 *   - Store the connect() Promise in a module-level variable so concurrent
 *     callers all await the SAME promise (no duplicate connects).
 *   - Check mongoose.connection.readyState before creating a new promise:
 *       0 = disconnected → connect
 *       1 = connected    → return immediately (hot path, ~0 µs)
 *       2 = connecting   → await the cached promise (no duplicate connect)
 *       3 = disconnecting → wait, then reconnect
 *   - Stored on globalThis so the same promise survives Nitro's module
 *     re-evaluation (same pattern as the rate-limit store).
 */
import mongoose from 'mongoose'

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConnectPromise: Promise<typeof mongoose> | undefined
}

export async function connectDB(): Promise<void> {
  // readyState 1 = connected — fast path, no async work needed
  if (mongoose.connection.readyState === 1)
    return

  const uri = process.env.NUXT_MONGODB_URI
  if (!uri)
    throw new Error('FATAL: NUXT_MONGODB_URI is not set')

  // readyState 2 = already connecting — reuse the in-flight promise
  if (mongoose.connection.readyState === 2 && globalThis.__mongooseConnectPromise) {
    await globalThis.__mongooseConnectPromise
    return
  }

  // readyState 0 or 3 — initiate a new connection and cache the promise
  globalThis.__mongooseConnectPromise = mongoose.connect(uri, {
    maxPoolSize: 10,        // M10 Atlas supports up to 500 connections
    minPoolSize: 2,         // Keep 2 warm to avoid cold-start latency
    socketTimeoutMS: 30_000,
    serverSelectionTimeoutMS: 5_000,
    heartbeatFrequencyMS: 10_000,
  })

  await globalThis.__mongooseConnectPromise
}
