/**
 * POST /api/dropdowns/seed-customer-status
 * One-time migration: extracts unique stage values from Customers
 * and seeds the "Customer Status" dropdown in hardwoodDB_Dropdowns.
 */
import { connectDB } from '../../utils/mongoose'
import { Customer } from '../../models/Customer'
import { Dropdown } from '../../models/Dropdown'

export default defineEventHandler(async () => {
  await connectDB()

  // 1. Get all unique stage values from Customers
  const stages: string[] = await Customer.distinct('stage')
  const uniqueStages = stages.filter(s => s && s.trim()).sort()

  console.log(`[Dropdown Seed] Found ${uniqueStages.length} unique customer statuses:`, uniqueStages)

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
    { upsert: true, new: true, lean: true }
  )

  return {
    success: true,
    dropdown: result,
    statuses: uniqueStages,
    count: uniqueStages.length,
  }
})
