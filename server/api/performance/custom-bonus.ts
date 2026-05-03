import { connectDB } from '../../utils/mongoose'
import { EmpSubCategoryBonus } from '../../models/EmpSubCategoryBonus'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const bonuses = await EmpSubCategoryBonus.find().lean<any[]>()
        
        return {
            status: 'success',
            data: bonuses.map((b: any) => ({
                _id: String(b._id),
                employee: String(b.employee),
                subCategory: String(b.subCategory),
                bonusAmount: b.bonusAmount,
                reason: b.reason,
                createdBy: b.createdBy ? String(b.createdBy) : null,
                createdAt: b.createdAt
            }))
        }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { employee, subCategory, bonusAmount, reason, createdBy } = body

        if (!employee || !subCategory || typeof bonusAmount !== 'number') {
            throw createError({ statusCode: 400, message: 'employee, subCategory, and bonusAmount are required' })
        }

        // Upsert the custom bonus at sub-category level
        const updated = await EmpSubCategoryBonus.findOneAndUpdate(
            { employee, subCategory },
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
                subCategory: String(updated.subCategory),
                bonusAmount: updated.bonusAmount,
                reason: updated.reason,
                createdBy: updated.createdBy ? String(updated.createdBy) : null,
            }
        }
    }
})
