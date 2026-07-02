/**
 * POST /api/estimates/sync-products
 *
 * One-time (and idempotent) backfill endpoint.
 * Iterates all Estimate documents that have line items and upserts every
 * unique SKU into the Products catalogue.
 *
 * Safe to call multiple times — existing products are never overwritten.
 *
 * Requires manager-level permission on /crm/products.
 */

import { Estimate } from '../../models/Estimate'
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { requireManager } from '../../utils/requireRole'
import { logger } from '../../utils/logger'
import { syncProductsFromLineItems } from '../../utils/syncProductsFromLineItems'

const log = logger('[estimates/sync-products.post]')

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/products')
  requireManager(event)

  log.info('Starting product sync from all existing estimates...')

  // Stream through all estimates that have at least one line item
  const estimates = await Estimate.find(
    { 'lineItems.0': { $exists: true } },
    { _id: 1, estimateNumber: 1, lineItems: 1 },
  ).lean()

  log.info(`Found ${estimates.length} estimates with line items`)

  let totalInserted = 0
  let totalExisting = 0
  let totalSkipped = 0
  let processed = 0

  for (const est of estimates as any[]) {
    try {
      const result = await syncProductsFromLineItems(est.lineItems || [])
      totalInserted += result.inserted
      totalExisting += result.existing
      totalSkipped += result.skipped
      processed++
    }
    catch (err: any) {
      log.error(`Failed processing estimate ${est.estimateNumber}:`, err?.message)
    }
  }

  log.info(
    `Backfill complete — processed: ${processed}, inserted: ${totalInserted}, existing: ${totalExisting}, skipped: ${totalSkipped}`,
  )

  return {
    success: true,
    summary: {
      estimatesProcessed: processed,
      productsInserted: totalInserted,
      productsAlreadyExisted: totalExisting,
      itemsSkippedNoSku: totalSkipped,
    },
  }
})
