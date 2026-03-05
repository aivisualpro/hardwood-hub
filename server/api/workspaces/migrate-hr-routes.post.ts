// POST /api/workspaces/migrate-hr-routes
// One-time migration: updates allowedMenus and menuPermissions
// from /admin/employees* routes to /hr/* routes
import { connectDB } from '../../utils/mongoose'
import { Workspace } from '../../models/Workspace'

const ROUTE_MAP: Record<string, string> = {
    '/admin/employees': '/hr/employees',
    '/admin/employee-performance': '/hr/employee-performance',
    '/admin/employees-bonus-report': '/hr/employees-bonus-report',
    '/general-settings': '/admin/general-settings',
}

export default defineEventHandler(async (event) => {
    if (event.method !== 'POST') {
        throw createError({ statusCode: 405, message: 'Method not allowed' })
    }

    await connectDB()

    const workspaces = await Workspace.find().lean<any[]>()
    const results: any[] = []

    for (const ws of workspaces) {
        const updates: any = {}
        let changed = false

        // Migrate allowedMenus
        if (Array.isArray(ws.allowedMenus)) {
            const newMenus = ws.allowedMenus.map((m: string) => ROUTE_MAP[m] || m)
            if (JSON.stringify(newMenus) !== JSON.stringify(ws.allowedMenus)) {
                updates.allowedMenus = newMenus
                changed = true
            }
        }

        // Migrate menuPermissions
        if (ws.menuPermissions && typeof ws.menuPermissions === 'object') {
            const newPerms: Record<string, string[]> = {}
            for (const [route, ops] of Object.entries(ws.menuPermissions)) {
                const newRoute = ROUTE_MAP[route] || route
                newPerms[newRoute] = ops as string[]
                if (newRoute !== route) changed = true
            }
            if (changed || Object.keys(newPerms).length > 0) {
                updates.menuPermissions = newPerms
            }
        }

        if (changed) {
            await Workspace.findByIdAndUpdate(ws._id, { $set: updates })
            results.push({ workspace: ws.name, updated: true, changes: updates })
        } else {
            results.push({ workspace: ws.name, updated: false })
        }
    }

    return { success: true, data: results }
})
