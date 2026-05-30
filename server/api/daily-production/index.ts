import { verifySessionToken } from '../../lib/session'
import { DailyProduction } from '../../models/DailyProduction'
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)

  if (event.method === 'GET') {
    const docs = await DailyProduction.find().sort({ createdAt: -1 }).lean<any[]>()
    return { success: true, data: docs }
  }

  if (event.method === 'POST') {
    const token = getCookie(event, 'hardwood_session')
    const session = token ? verifySessionToken(token) : null

    const body = await readBody(event)
    const doc = await DailyProduction.create({
      ...body,
      createdBy: session?.id ?? null,
    })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
