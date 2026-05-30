import mongoose from 'mongoose'
import { Dropdown } from '../../models/Dropdown'
import { Pipeline } from '../../models/Pipeline'
/**
 * GET /api/crm/pipeline-clients
 * Lightweight list of pipeline customers for dropdowns.
 * Excludes customers whose status label is "Lost".
 * Returns _id, name, email, address/city.
 */
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async () => {
  await connectDB()

  // 1. Find the "Lost" status option ID to exclude
  const statusDropdown = await Dropdown.findOne({ name: 'Customer Status' }).lean<any>()
  const lostOptionIds: string[] = []
  if (statusDropdown?.options) {
    for (const opt of statusDropdown.options) {
      if (opt.label?.toLowerCase() === 'lost') {
        lostOptionIds.push(String(opt._id))
      }
    }
  }

  // 2. Build filter: exclude customers with "Lost" status
  const filter: any = {}
  if (lostOptionIds.length > 0) {
    filter.status = { $nin: lostOptionIds.map(id => new mongoose.Types.ObjectId(id)) }
  }

  // 3. Fetch lightweight customer list
  const docs = await Pipeline.find(filter)
    .select('_id name email address city')
    .sort({ name: 1 })
    .lean<{ _id: any, name: string, email: string, address: string, city: string }[]>()

  return {
    success: true,
    data: docs.map((d: any) => ({
      _id: String(d._id),
      name: d.name || '(No name)',
      email: d.email || '',
      location: [d.address, d.city].filter(Boolean).join(', '),
    })),
  }
})
