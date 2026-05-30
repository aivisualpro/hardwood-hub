import { verifySessionToken } from '../../lib/session'
import { DailyProduction } from '../../models/DailyProduction'
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { DailyProductionWriteSchema, parseBody } from '../../utils/validation'

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

    const raw = await readBody(event)
    const data = parseBody(DailyProductionWriteSchema, raw)
    const doc = await DailyProduction.create({
      ...data,
      createdBy: session?.id ?? null,
    })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
