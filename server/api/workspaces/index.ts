import { connectDB } from '../../utils/mongoose'
import { Workspace } from '../../models/Workspace'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const docs = await Workspace.find().sort({ createdAt: 1 }).lean<any[]>()

        // Seed Admin Workspace if empty
        if (docs.length === 0) {
            const admin = await Workspace.create({
                name: 'Admin Workspace',
                logo: 'i-lucide-shield-check',
                plan: 'Full Access',
                allowedMenus: ['*'], // We'll interpret ['*'] or empty string as everything
                isLocked: true
            })
            return { success: true, data: [admin] }
        }

        return { success: true, data: docs }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { name, logo, plan, allowedMenus, menuPermissions } = body
        if (!name)
            throw createError({ statusCode: 400, message: 'Workspace name is required' })

        const doc = await Workspace.create({
            name,
            logo: logo || 'i-lucide-building',
            plan: plan || 'Workspace',
            allowedMenus: allowedMenus || [],
            menuPermissions: menuPermissions || {},
            isLocked: false
        })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
