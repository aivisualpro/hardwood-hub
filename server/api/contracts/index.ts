/**
 * GET  /api/contracts — list all contracts
 * POST /api/contracts — create a new contract
 */
import { connectDB } from '../../utils/mongoose'
import { Contract } from '../../models/Contract'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const query = getQuery(event)
        const status = query.status as string | undefined
        const search = query.search as string | undefined
        const page = Math.max(1, Number(query.page) || 1)
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))

        const filter: Record<string, any> = {}
        if (status) filter.status = status
        if (search) {
            filter.$or = [
                { contractNumber: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerEmail: { $regex: search, $options: 'i' } },
            ]
        }

        const [data, total] = await Promise.all([
            Contract.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Contract.countDocuments(filter),
        ])

        return {
            success: true,
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        if (!body.title) throw createError({ statusCode: 400, message: 'Contract title is required' })
        if (!body.customerId) throw createError({ statusCode: 400, message: 'Customer is required' })

        // Auto-generate contract number: CO-YYMM-XXXX
        const now = new Date()
        const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`
        const count = await Contract.countDocuments()
        const contractNumber = body.contractNumber || `CO-${yymm}-${String(count + 1).padStart(4, '0')}`

        const doc = await Contract.create({ ...body, contractNumber })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
