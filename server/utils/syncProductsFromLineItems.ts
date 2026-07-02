/**
 * syncProductsFromLineItems
 *
 * Takes an array of line items extracted from a PDF estimate and upserts
 * each unique SKU into the Products collection.  Items without a SKU are
 * skipped silently.
 *
 * Matching key: `sku` (case-insensitive trimmed comparison via MongoDB
 * collation is NOT used here for simplicity — we normalise the key in JS).
 *
 * Fields written on first insert: sku, description, unit, salesPrice
 * Fields NOT overwritten on subsequent upserts: salesPrice (we keep the
 * manually-set price), description (we keep the richer manually-set value
 * if one already exists).
 */

import { Product } from '../models/Product'
import { logger } from './logger'

const log = logger('[syncProductsFromLineItems]')

export interface LineItemLike {
  sku?: string
  description?: string
  unit?: string
  price?: number
  amount?: number
}

export interface SyncResult {
  inserted: number
  skipped: number   // items with no SKU
  existing: number  // SKUs that were already in the DB
}

export async function syncProductsFromLineItems(
  lineItems: LineItemLike[],
): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, skipped: 0, existing: 0 }

  if (!lineItems?.length) return result

  // Deduplicate by normalised SKU within this batch
  const seen = new Set<string>()
  const unique: LineItemLike[] = []

  for (const item of lineItems) {
    const rawSku = (item.sku || '').trim()
    if (!rawSku) {
      result.skipped++
      continue
    }
    const key = rawSku.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(item)
    }
  }

  // For each unique SKU, check if it exists. If not, create it.
  for (const item of unique) {
    const sku = (item.sku || '').trim()
    try {
      const existing = await Product.findOne({
        sku: { $regex: `^${sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      }).lean()

      if (existing) {
        result.existing++
        log.info(`Product already exists, skipping: "${sku}"`)
      }
      else {
        await Product.create({
          sku,
          description: (item.description || '').trim(),
          unit: (item.unit || '').trim(),
          salesPrice: Number(item.price) || 0,
          // Leave all other fields at schema defaults
        })
        result.inserted++
        log.info(`New product created from estimate line item: "${sku}"`)
      }
    }
    catch (err: any) {
      log.error(`Failed to upsert product for SKU "${sku}":`, err?.message)
      // Don't throw — product sync failure should not break the estimate save
    }
  }

  return result
}
