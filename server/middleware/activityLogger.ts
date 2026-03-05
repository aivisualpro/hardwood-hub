import { logActivity } from '../utils/logActivity'
import { connectDB } from '../utils/mongoose'
import { Employee } from '../models/Employee'

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
    'tasks': 'Tasks',
}

const actionMap: Record<string, string> = {
    'POST': 'create',
    'PUT': 'update',
    'DELETE': 'delete',
}

function extractUserFromCookie(event: any): { name: string, image: string } {
    const cookieHeader = getHeader(event, 'cookie') || ''
    const match = cookieHeader.match(/hardwood_user=([^;]+)/)
    if (match) {
        try {
            const decoded = decodeURIComponent(match[1])
            const parsed = JSON.parse(decoded)
            return {
                name: parsed.employee || parsed.email || 'Unknown',
                image: parsed.profileImage || ''
            }
        } catch {
            return { name: 'Unknown', image: '' }
        }
    }
    return { name: 'Unknown', image: '' }
}

// Cache employee names for richer descriptions
const employeeCache = new Map<string, string>()
async function resolveEmployeeName(id: string): Promise<string> {
    if (!id || id.length < 10) return ''
    if (employeeCache.has(id)) return employeeCache.get(id) || ''
    try {
        await connectDB()
        const emp = await Employee.findById(id).select('employee').lean<any>()
        const name = emp?.employee || ''
        employeeCache.set(id, name)
        return name
    } catch {
        return ''
    }
}

export default defineEventHandler(async (event) => {
    const url = event.path || ''
    const method = event.method

    if (!url.startsWith('/api/') || !['POST', 'PUT', 'DELETE'].includes(method)) return
    if (url.includes('/api/activities')) return

    // Capture body BEFORE the response finishes (stream is consumed during handler)
    let capturedBody: any = null
    if (method === 'POST' || method === 'PUT') {
        try {
            // Read a copy of the body manually from the raw request 
            // We'll use a hook approach: read after handler runs via event context
            const originalReadBody = (globalThis as any).__originalReadBody
            // Instead, we store body in event context via a simpler approach:
            // The body is already parsed by Nitro's readBody, so we capture it from the event
        } catch { /* ignore */ }
    }

    event.node.res.on('finish', async () => {
        try {
            const statusCode = event.node.res.statusCode
            if (statusCode >= 200 && statusCode < 300) {
                const pathParts = url.replace('/api/', '').split('/')
                const moduleName = pathParts[0] || 'unknown'
                const targetId = pathParts[1] || ''
                const action = actionMap[method] || method.toLowerCase()
                const moduleLabel = moduleMap[moduleName] || moduleName
                const { name: user, image: userImage } = extractUserFromCookie(event)
                const ip = getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip') || ''
                const userAgent = getHeader(event, 'user-agent') || ''

                // Handle special auth routes
                let description = ''
                if (moduleName === 'auth') {
                    const subRoute = pathParts[1] || ''
                    if (subRoute === 'login' || subRoute === 'google') {
                        description = `logged in`
                        await logActivity({ user, action: 'login', module: 'Authentication', description, ip, userAgent, userImage })
                        return
                    }
                    if (subRoute === 'logout') {
                        description = `logged out`
                        await logActivity({ user, action: 'logout', module: 'Authentication', description, ip, userAgent, userImage })
                        return
                    }
                }

                // Try to get the body from event context (stored by our body-capture plugin)
                const body = (event as any)._capturedBody || null
                let targetName = ''

                // Resolve richer descriptions
                if (moduleName === 'performance' && body) {
                    const empName = await resolveEmployeeName(body.employee || '')
                    if (empName) targetName = empName
                }
                if (moduleName === 'employees' && body) {
                    targetName = body.employee || ''
                }
                if (moduleName === 'skills' && body) {
                    targetName = body.skill || ''
                }
                if (moduleName === 'workspaces' && body) {
                    targetName = body.name || ''
                }

                // Build description
                switch (action) {
                    case 'create':
                        description = targetName
                            ? `created a new ${moduleLabel} record for ${targetName}`
                            : `created a new ${moduleLabel} record`
                        break
                    case 'update':
                        description = targetName
                            ? `updated ${moduleLabel} record for ${targetName}`
                            : `updated a ${moduleLabel} record`
                        break
                    case 'delete':
                        description = targetName
                            ? `deleted ${moduleLabel} record for ${targetName}`
                            : `deleted a ${moduleLabel} record`
                        break
                    default:
                        description = `performed ${action} on ${moduleLabel}`
                }

                await logActivity({
                    user,
                    action: action as any,
                    module: moduleLabel,
                    description,
                    targetId,
                    targetName,
                    ip,
                    userAgent,
                    userImage,
                })
            }
        } catch (err) {
            console.error('[Activity Middleware]', err)
        }
    })
})
