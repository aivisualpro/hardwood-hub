/**
 * POST /api/activities/mark-as-read
 * Marks all unread activities as read.
 */
import { connectDB } from '../../utils/mongoose'
import { ActivityLog } from '../../models/ActivityLog'

export default defineEventHandler(async () => {
  await connectDB()
  await ActivityLog.updateMany({ isRead: false }, { $set: { isRead: true } })
  return {
    success: true
  }
})
