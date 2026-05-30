import { ActivityLog } from '../../models/ActivityLog'
/**
 * GET /api/activities/unread-count
 * Returns the number of unread activities.
 */
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async () => {
  await connectDB()
  const count = await ActivityLog.countDocuments({ isRead: false })
  return {
    success: true,
    count,
  }
})
