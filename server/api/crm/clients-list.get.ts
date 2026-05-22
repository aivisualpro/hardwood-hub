/**
 * GET /api/crm/clients-list
 * Lightweight list for dropdowns — returns _id, name, address only.
 * Excludes archived submissions. Sorted by name A→Z.
 */
import { connectDB } from '../../utils/mongoose'
import { CrmSubmission } from '../../models/CrmSubmission'

export default defineEventHandler(async (event) => {
  await connectDB()

  const docs = await CrmSubmission.find({ status: { $ne: 'archived' } })
    .select('_id name address city')
    .sort({ name: 1 })
    .lean<{ _id: any; name: string; address: string; city: string }[]>()

  return {
    success: true,
    data: docs.map(d => ({
      _id: String(d._id),
      name: d.name || '(No name)',
      location: [d.address, d.city].filter(Boolean).join(', '),
    })),
  }
})
