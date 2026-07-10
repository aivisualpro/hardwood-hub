/**
 * POST /api/notifications/mark-all-read — mark all of the current user's notifications read
 */
import { Notification } from '../../models/Notification'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const session = (event.context as any).session
  if (!session?.id)
    throw createError({ statusCode: 401, message: 'Authentication required.' })

  const res = await Notification.updateMany(
    { recipientId: session.id, readAt: null },
    { $set: { readAt: new Date() } },
  )
  return { success: true, modified: res.modifiedCount }
})
