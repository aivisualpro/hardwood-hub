/**
 * GET /api/notifications — current user's notifications
 * Query: page, limit, unread=1, module
 */
import { Notification } from '../../models/Notification'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const session = (event.context as any).session
  if (!session?.id)
    throw createError({ statusCode: 401, message: 'Authentication required.' })

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25))

  const filter: Record<string, any> = { recipientId: session.id }
  if (query.unread === '1')
    filter.readAt = null
  if (query.module)
    filter.module = String(query.module)

  const [data, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientId: session.id, readAt: null }),
  ])

  return {
    success: true,
    data: data.map((n: any) => ({ ...n, _id: String(n._id), recipientId: String(n.recipientId), ruleId: n.ruleId ? String(n.ruleId) : null })),
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
})
