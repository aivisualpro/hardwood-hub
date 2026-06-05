import { StainSignOff } from '../../models/StainSignOff'
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { StainSignOffWriteSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)
  await requirePermission(event, '/external/stain-sign-off')

  if (event.method === 'GET') {
    const docs = await StainSignOff.find().sort({ createdAt: -1 }).lean<any[]>()
    return { success: true, data: docs }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const data = parseBody(StainSignOffWriteSchema, raw)
    const doc = await StainSignOff.create(data)
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

