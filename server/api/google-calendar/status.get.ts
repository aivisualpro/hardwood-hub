import { Employee } from '../../models/Employee'
/**
 * GET /api/google-calendar/status — Check if current user has Calendar connected
 */
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  const session = (event.context as any).session
  if (!session?.id)
    throw createError({ statusCode: 401, message: 'Not authenticated' })

  await connectDB()

  const emp = await Employee.findById(session.id).select('calendarTokens calendarEmail calendarChannelExpiry').lean()
  if (!emp)
    throw createError({ statusCode: 404, message: 'Employee not found' })

  const connected = !!emp.calendarTokens
  return {
    success: true,
    data: {
      connected,
      email: emp.calendarEmail || '',
      watchActive: emp.calendarChannelExpiry ? new Date(emp.calendarChannelExpiry) > new Date() : false,
      watchExpiry: emp.calendarChannelExpiry || null,
    },
  }
})
