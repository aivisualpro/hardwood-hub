import { Customer } from '../../models/Customer'
import { Dropdown } from '../../models/Dropdown'
/**
 * POST /api/dropdowns/seed-customer-status
 * One-time migration: extracts unique stage values from Customers
 * and seeds the "Customer Status" dropdown in hardwoodDB_Dropdowns.
 * Admin-only — requires Super Admin or Admin position.
 */
import { connectDB } from '../../utils/mongoose'
import { requireAdmin } from '../../utils/requireRole'
import { logger } from '../../utils/logger'
const log = logger('[seed-customer-status.post]')

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  await connectDB()

  // 1. Get all unique stage values from Customers
  const stages: string[] = await Customer.distinct('stage')
  const uniqueStages = stages.filter(s => s && s.trim()).sort()

  log.info(`[Dropdown Seed] Found ${uniqueStages.length} unique customer statuses:`, uniqueStages)

  // 2. Build options array with ObjectIds
  const options = uniqueStages.map((stage, idx) => ({
    label: stage,
    value: stage,
    order: idx,
  }))

  // 3. Upsert into Dropdowns collection
  const result = await Dropdown.findOneAndUpdate(
    { name: 'Customer Status' },
    {
      $set: {
        name: 'Customer Status',
        options,
      },
    },
    { upsert: true, new: true, lean: true },
  )

  return {
    success: true,
    dropdown: result,
    statuses: uniqueStages,
    count: uniqueStages.length,
  }
})
