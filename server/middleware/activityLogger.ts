import { logActivity } from '../utils/logActivity'

// Map of API routes to human-readable module names
const moduleMap: Record<string, string> = {
    'employees': 'Employees',
    'skills': 'Skills',
    'categories': 'Categories',
    'subcategories': 'Sub-Categories',
    'performance': 'Employee Performance',
    'project-communication': 'Project Communication',
    'workspaces': 'Workspaces',
    'skill-bonus': 'Skill Bonus',
    'auth': 'Authentication',
    'app-settings': 'App Settings',
    'upload': 'File Upload',
}

const actionMap: Record<string, string> = {
    'POST': 'create',
    'PUT': 'update',
    'DELETE': 'delete',
}

function extractUserFromCookie(event: any): string {
    const cookieHeader = getHeader(event, 'cookie') || ''
    const match = cookieHeader.match(/hardwood_user=([^;]+)/)
    if (match) {
        try {
            const decoded = decodeURIComponent(match[1])
            const parsed = JSON.parse(decoded)
            return parsed.employee || parsed.email || 'Unknown'
        } catch {
            return 'Unknown'
        }
    }
    return 'Unknown'
}

export default defineEventHandler(async (event) => {
    // Only intercept mutation requests to /api/ routes
    const url = event.path || ''
    const method = event.method

    if (!url.startsWith('/api/') || !['POST', 'PUT', 'DELETE'].includes(method)) return
    // Skip logging the activities endpoint itself to avoid recursion
    if (url.includes('/api/activities')) return

    // We hook into the response AFTER it has been processed
    event.node.res.on('finish', async () => {
        try {
            const statusCode = event.node.res.statusCode
            // Only log successful mutations
            if (statusCode >= 200 && statusCode < 300) {
                const pathParts = url.replace('/api/', '').split('/')
                const moduleName = pathParts[0] || 'unknown'
                const targetId = pathParts[1] || ''
                const action = actionMap[method] || method.toLowerCase()
                const moduleLabel = moduleMap[moduleName] || moduleName
                const user = extractUserFromCookie(event)
                const ip = getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip') || ''
                const userAgent = getHeader(event, 'user-agent') || ''

                // Handle special auth routes
                let description = ''
                if (moduleName === 'auth') {
                    const subRoute = pathParts[1] || ''
                    if (subRoute === 'login' || subRoute === 'google') {
                        description = `${user} logged in`
                        await logActivity({ user, action: 'login', module: 'Authentication', description, ip, userAgent })
                        return
                    }
                    if (subRoute === 'logout') {
                        description = `${user} logged out`
                        await logActivity({ user, action: 'logout', module: 'Authentication', description, ip, userAgent })
                        return
                    }
                }

                // Build description
                switch (action) {
                    case 'create':
                        description = `${user} created a new ${moduleLabel} record`
                        break
                    case 'update':
                        description = `${user} updated a ${moduleLabel} record`
                        break
                    case 'delete':
                        description = `${user} deleted a ${moduleLabel} record`
                        break
                    default:
                        description = `${user} performed ${action} on ${moduleLabel}`
                }

                if (targetId && targetId !== 'index' && targetId.length > 3) {
                    description += ` (ID: ${targetId.substring(0, 8)}…)`
                }

                await logActivity({
                    user,
                    action: action as any,
                    module: moduleLabel,
                    description,
                    targetId,
                    ip,
                    userAgent
                })
            }
        } catch (err) {
            // Never crash the request
            console.error('[Activity Middleware]', err)
        }
    })
})
