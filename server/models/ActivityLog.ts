import mongoose, { Schema, Document } from 'mongoose'

export interface IActivityLog extends Document {
    user: string
    action: string       // 'create' | 'update' | 'delete' | 'login' | 'logout' | 'view'
    module: string       // 'employees', 'skills', 'performance', 'project-communication', 'workspaces', 'skill-bonus', 'auth'
    description: string
    targetId?: string
    targetName?: string
    metadata?: Record<string, any>
    ip?: string
    userAgent?: string
    userImage?: string
    createdAt: Date
}

const ActivityLogSchema = new Schema(
    {
        user: { type: String, required: true },
        action: { type: String, required: true, index: true },
        module: { type: String, required: true, index: true },
        description: { type: String, required: true },
        targetId: { type: String, default: '' },
        targetName: { type: String, default: '' },
        metadata: { type: Schema.Types.Mixed, default: {} },
        ip: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        userImage: { type: String, default: '' },
    },
    { timestamps: true, collection: 'hardwoodDB_activitylogs' }
)

// Compound index for fast querying
ActivityLogSchema.index({ createdAt: -1 })
ActivityLogSchema.index({ user: 1, createdAt: -1 })
ActivityLogSchema.index({ module: 1, action: 1, createdAt: -1 })

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema)
