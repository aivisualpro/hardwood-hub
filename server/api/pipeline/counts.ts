/**
 * GET /api/pipeline/counts — aggregate counts per status for pipeline header chevrons
 * Returns { success: true, data: { total: N, counts: { [statusId]: N, uncategorized: N } } }
 */
import { defineEventHandler } from 'h3'
import { Pipeline } from '../../models/Pipeline'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()

  const query = getQuery(event)
  const search = (query.search as string | undefined)?.trim()

  const matchStage: Record<string, any> = {}
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    matchStage.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { customerName: { $regex: escaped, $options: 'i' } },
      { projectName: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      { city: { $regex: escaped, $options: 'i' } },
    ]
  }

  const pipeline: any[] = []
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage })
  }
  pipeline.push({
    $group: {
      _id: { $ifNull: ['$status', null] },
      count: { $sum: 1 },
    },
  })

  const results = await Pipeline.aggregate(pipeline)

  const counts: Record<string, number> = {}
  let total = 0
  for (const r of results) {
    const key = r._id ? String(r._id) : 'uncategorized'
    counts[key] = r.count
    total += r.count
  }

  return { success: true, data: { total, counts } }
})
