/**
 * GET /api/crm/stats
 * Returns aggregate stats for the CRM dashboard
 */
import { connectDB } from '../../utils/mongoose'
import { CrmSubmission } from '../../models/CrmSubmission'

export default defineEventHandler(async () => {
  await connectDB()

  const [totalByType, totalByStatus, recentSubmissions, last30DaysByType] = await Promise.all([
    CrmSubmission.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    CrmSubmission.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CrmSubmission.find()
      .sort({ dateSubmitted: -1 })
      .limit(5)
      .lean(),
    CrmSubmission.aggregate([
      { $match: { dateSubmitted: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ])

  const totalCount = totalByType.reduce((sum: number, t: any) => sum + t.count, 0)

  return {
    success: true,
    data: {
      totalCount,
      byType: Object.fromEntries(totalByType.map((t: any) => [t._id, t.count])),
      byStatus: Object.fromEntries(totalByStatus.map((s: any) => [s._id, s.count])),
      last30Days: Object.fromEntries(last30DaysByType.map((t: any) => [t._id, t.count])),
      recentSubmissions,
    },
  }
})
