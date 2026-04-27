import { connectDB } from '../../utils/mongoose'
import { EmpCategoryBonus } from '../../models/EmpCategoryBonus'
import { Employee } from '../../models/Employee'
import { Category } from '../../models/Category'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const bonuses = await EmpCategoryBonus.find().lean<any[]>()
        
        return {
            status: 'success',
            data: bonuses.map((b: any) => ({
                _id: String(b._id),
                employee: String(b.employee),
                category: String(b.category),
                bonusAmount: b.bonusAmount,
                reason: b.reason,
                createdBy: b.createdBy ? String(b.createdBy) : null,
                createdAt: b.createdAt
            }))
        }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { employee, category, bonusAmount, reason, createdBy } = body

        if (!employee || !category || typeof bonusAmount !== 'number') {
            throw createError({ statusCode: 400, message: 'employee, category, and bonusAmount are required' })
        }

        // Upsert the custom bonus
        const updated = await EmpCategoryBonus.findOneAndUpdate(
            { employee, category },
            { 
                $set: { 
                    bonusAmount, 
                    reason: reason || '',
                    createdBy: createdBy || null
                } 
            },
            { upsert: true, new: true }
        )

        return {
            status: 'success',
            data: {
                _id: String(updated._id),
                employee: String(updated.employee),
                category: String(updated.category),
                bonusAmount: updated.bonusAmount,
                reason: updated.reason,
                createdBy: updated.createdBy ? String(updated.createdBy) : null,
            }
        }
    }
})
