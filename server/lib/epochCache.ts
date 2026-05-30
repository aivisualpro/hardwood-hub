import { Employee } from '../models/Employee'
/**
 * In-process epoch cache — avoids a MongoDB round-trip on every API request.
 *
 * Logic:
 *  - Cache entry TTL is 30 seconds.  Revocation propagates within ≤30 s.
 *  - On cache miss: query Employee.sessionEpoch from MongoDB, populate cache.
 *  - checkEpoch(id, tokenEpoch) returns true when tokenEpoch >= dbEpoch (token still valid).
 *  - invalidateEpochCache(id) is called by logout/revoke to evict immediately, so those
 *    paths propagate instantly rather than waiting for TTL expiry.
 */
import { connectDB } from '../utils/mongoose'

const CACHE_TTL_MS = 30_000 // 30 seconds

interface CacheEntry {
  epoch: number
  cachedAt: number
}

const cache = new Map<string, CacheEntry>()

async function fetchDbEpoch(employeeId: string): Promise<number | null> {
  await connectDB()
  const doc = await Employee.findById(employeeId).select('sessionEpoch').lean<any>()
  if (!doc)
    return null
  return (doc.sessionEpoch ?? 0) as number
}

/**
 * Returns true if the token's embedded epoch is still valid (>= the DB epoch).
 * Returns false if the employee no longer exists or the epoch is stale.
 */
export async function checkEpoch(employeeId: string, tokenEpoch: number): Promise<boolean> {
  const now = Date.now()
  const entry = cache.get(employeeId)

  if (entry && now - entry.cachedAt < CACHE_TTL_MS) {
    return tokenEpoch >= entry.epoch
  }

  // Cache miss or stale — fetch from DB
  const dbEpoch = await fetchDbEpoch(employeeId)
  if (dbEpoch === null)
    return false // employee deleted

  cache.set(employeeId, { epoch: dbEpoch, cachedAt: now })
  return tokenEpoch >= dbEpoch
}

/**
 * Evict a cached entry immediately (call after bumping sessionEpoch in DB).
 * Next request for this employee will hit MongoDB and see the new epoch.
 */
export function invalidateEpochCache(employeeId: string): void {
  cache.delete(employeeId)
}
