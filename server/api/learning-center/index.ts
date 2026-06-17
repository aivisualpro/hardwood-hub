import { LearningResource } from '../../models/LearningResource'
// GET  /api/learning-center        — list (open to every authenticated employee)
// POST /api/learning-center        — create (admins / super-users only)
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { escapeRegex, LearningResourceCreateSchema, parseBody } from '../../utils/validation'

const CATEGORIES = ['app-skill-guide', 'video-resources', 'nwfa-documentation', 'installation-guidelines']
const ADMIN_POSITIONS = ['Super Admin', 'Admin']

export default defineEventHandler(async (event) => {
  await connectDB()

  // ── READ — intentionally NOT permission-gated ────────────────────────────
  // The Learning Center is for the whole team. 02.apiAuth.ts already guarantees
  // a valid session on every /api/ request, and /api/learning-center is left out
  // of 03.permissions.ts so any logged-in employee can read it.
  if (event.method === 'GET') {
    const query = getQuery(event)
    const filter: Record<string, any> = {}

    const category = (query.category as string | undefined)?.trim()
    if (category && category !== 'all' && CATEGORIES.includes(category))
      filter.category = category

    const search = (query.search as string | undefined)?.trim()
    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' }
      filter.$or = [{ title: re }, { description: re }, { tags: re }]
    }

    // Non-admins only see published resources; admins also see drafts.
    const isAdmin = ADMIN_POSITIONS.includes(event.context?.session?.position || '')
    if (!isAdmin)
      filter.isPublished = true

    const items = await LearningResource.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .lean()

    return { success: true, data: items }
  }

  // ── CREATE — admins / super-users only ───────────────────────────────────
  if (event.method === 'POST') {
    await requirePermission(event, '/learning-center')
    const data = parseBody(LearningResourceCreateSchema, await readBody(event))
    const doc = await LearningResource.create({
      ...data,
      createdBy: event.context?.session?.id || null,
    })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
