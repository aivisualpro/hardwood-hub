// Update allowedMenus from /admin/employees to /hr/ routes
// Original: server/api/workspaces/migrate-hr-routes.post.ts
import { Workspace } from '../models/Workspace'

/**
 * Run with:
 *   npx tsx server/scripts/migrate-workspace-hr-routes.ts
 *
 * Requires MONGODB_URI (and any other env vars used by the logic below) to be
 * set in your environment, e.g.:
 *   MONGODB_URI=... npx tsx server/scripts/migrate-workspace-hr-routes.ts
 *
 * This file was extracted from server/api/workspaces/migrate-hr-routes.post.ts and is intentionally NOT
 * an HTTP route — it runs once manually and should never be re-added to server/api/.
 */
import 'dotenv/config'
import mongoose from 'mongoose'

async function run() {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI is not set')
    await mongoose.connect(uri)
    console.log('[DB] Connected')

    try {
        }

            // (DB connection handled by run() wrapper above)

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
    } finally {
        await mongoose.disconnect()
        console.log('[DB] Disconnected')
    }
}

run().catch(err => { console.error(err); process.exit(1) })
