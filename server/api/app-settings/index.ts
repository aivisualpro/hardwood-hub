import { AppSetting } from '../../models/AppSetting'
// GET  /api/app-settings          — list all settings
// POST /api/app-settings          — upsert a setting { key, value, description? }
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { AppSettingsWriteSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  // No blanket requireAdmin — individual methods check below

  if (event.method === 'GET') {
    const docs = await AppSetting.find().lean() as any[]
    // Return as key→value map for convenience
    const map: Record<string, any> = {}
    for (const d of docs) map[d.key] = d.value
    return { success: true, data: map, docs }
  }

  if (event.method === 'POST') {
    await requirePermission(event, '/admin/general-settings', 'update')
    const raw = await readBody(event)
    const { key, value, description } = parseBody(AppSettingsWriteSchema, raw)

    const doc = await AppSetting.findOneAndUpdate(
      { key },
      { value, description: description ?? '' },
      { upsert: true, returnDocument: 'after' },
    ).lean()
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
