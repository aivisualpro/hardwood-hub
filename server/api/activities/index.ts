import { connectDB } from '../../utils/mongoose'
import { ActivityLog } from '../../models/ActivityLog'

export default defineEventHandler(async (event) => {
    await connectDB()

    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 50
    const skip = (page - 1) * limit

    // Build filter
    const filter: Record<string, any> = {}

    if (query.user && query.user !== 'all') {
        filter.user = { $regex: query.user, $options: 'i' }
    }
    if (query.module && query.module !== 'all') {
        filter.module = query.module
    }
    if (query.action && query.action !== 'all') {
        filter.action = query.action
    }
    if (query.search) {
        filter.description = { $regex: query.search, $options: 'i' }
    }

    const [data, total] = await Promise.all([
        ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<any[]>(),
        ActivityLog.countDocuments(filter),
    ])

    // Get distinct users and modules for filter dropdowns
    const [users, modules] = await Promise.all([
        ActivityLog.distinct('user'),
        ActivityLog.distinct('module'),
    ])

    return {
        success: true,
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        filters: {
            users,
            modules,
        },
    }
})
