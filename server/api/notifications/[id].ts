/**
 * PATCH  /api/notifications/:id — mark read/unread { read: boolean }
 * DELETE /api/notifications/:id — delete a notification
 * Both scoped to the current user's own notifications.
 */
import { Notification } from '../../models/Notification'
import { connectDB } from '../../utils/mongoose'
import { objectId } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  const session = (event.context as any).session
  if (!session?.id)
    throw createError({ statusCode: 401, message: 'Authentication required.' })

  const id = objectId(event.context.params?.id)

  if (event.method === 'PATCH') {
    const body = await readBody(event)
    const readAt = body?.read === false ? null : new Date()
    const doc = await Notification.findOneAndUpdate(
      { _id: id, recipientId: session.id },
      { $set: { readAt } },
      { new: true },
    ).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Notification not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    await Notification.deleteOne({ _id: id, recipientId: session.id })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
