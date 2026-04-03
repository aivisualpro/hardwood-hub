// GET  /api/contracts/templates — list all templates
// POST /api/contracts/templates — create a template
import { connectDB } from '../../../utils/mongoose'
import { ContractTemplate } from '../../../models/ContractTemplate'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const docs = await ContractTemplate.find().sort({ createdAt: -1 }).lean<any[]>()
        return { success: true, data: docs }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        if (!body.name) throw createError({ statusCode: 400, message: 'Template name is required' })

        // Auto-generate slug from name
        const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

        const doc = await ContractTemplate.create({
            ...body,
            slug,
        })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
