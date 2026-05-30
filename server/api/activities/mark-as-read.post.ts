import { ActivityLog } from '../../models/ActivityLog'
/**
 * POST /api/activities/mark-as-read
 * Marks all unread activities as read.
 */
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async () => {
  await connectDB()
  await ActivityLog.updateMany({ isRead: false }, { $set: { isRead: true } })
  return {
    success: true,
  }
})
