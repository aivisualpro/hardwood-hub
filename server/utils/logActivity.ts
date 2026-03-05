import { ActivityLog } from '../models/ActivityLog'
import { connectDB } from './mongoose'

interface LogActivityParams {
    user: string
    action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'view' | 'assess' | 'import'
    module: string
    description: string
    targetId?: string
    targetName?: string
    metadata?: Record<string, any>
    ip?: string
    userAgent?: string
    userImage?: string
}

export async function logActivity(params: LogActivityParams) {
    try {
        await connectDB()
        await ActivityLog.create({
            user: params.user || 'System',
            action: params.action,
            module: params.module,
            description: params.description,
            targetId: params.targetId || '',
            targetName: params.targetName || '',
            metadata: params.metadata || {},
            ip: params.ip || '',
            userAgent: params.userAgent || '',
            userImage: params.userImage || '',
        })
    } catch (err) {
        // Silently fail — never block the main request for logging
        console.error('[ActivityLog] Failed to log:', err)
    }
}
