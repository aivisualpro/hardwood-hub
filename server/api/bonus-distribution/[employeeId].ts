import { connectDB } from '../../utils/mongoose'
import { BonusDistribution } from '../../models/BonusDistribution'

export default defineEventHandler(async (event) => {
    await connectDB()
    const employeeId = getRouterParam(event, 'employeeId')

    if (!employeeId) {
        throw createError({ statusCode: 400, message: 'employeeId is required' })
    }

    // GET — fetch all bonus distribution records for an employee
    if (event.method === 'GET') {
        const records = await BonusDistribution.find({ employee: employeeId })
            .sort({ createdAt: -1 })
            .lean<any[]>()

        return {
            status: 'success',
            data: records.map((r: any) => ({
                _id: String(r._id),
                employee: String(r.employee),
                subCategory: r.subCategory ? String(r.subCategory) : null,
                subCategoryName: r.subCategoryName || '',
                categoryName: r.categoryName || '',
                bonusType: r.bonusType,
                earnedAmount: r.earnedAmount,
                awardedAmount: r.awardedAmount || 0,
                status: r.status,
                awardedAt: r.awardedAt,
                awardedBy: r.awardedBy ? String(r.awardedBy) : null,
                awardedByName: r.awardedByName || '',
                notes: r.notes || '',
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
            }))
        }
    }

    // POST — upsert bonus distribution records (sync earned amounts or mark as awarded)
    if (event.method === 'POST') {
        const body = await readBody(event)
        const { action } = body

        // Action: "sync" — bulk upsert earned amounts from the bonus report
        if (action === 'sync') {
            const { records } = body
            if (!Array.isArray(records)) {
                throw createError({ statusCode: 400, message: 'records array is required for sync' })
            }

            const ops = records.map((rec: any) => ({
                updateOne: {
                    filter: {
                        employee: employeeId,
                        subCategory: rec.subCategory,
                        bonusType: rec.bonusType,
                    },
                    update: {
                        $set: {
                            earnedAmount: rec.earnedAmount,
                            subCategoryName: rec.subCategoryName || '',
                            categoryName: rec.categoryName || '',
                        },
                        $setOnInsert: {
                            employee: employeeId,
                            subCategory: rec.subCategory,
                            bonusType: rec.bonusType,
                            status: 'earned',
                            awardedAmount: 0,
                        }
                    },
                    upsert: true,
                }
            }))

            if (ops.length > 0) {
                await BonusDistribution.bulkWrite(ops)
            }

            return { status: 'success', message: `Synced ${ops.length} records` }
        }

        // Action: "award" — mark a specific bonus as awarded
        if (action === 'award') {
            const { distributionId, awardedAmount, awardedBy, awardedByName, notes } = body
            if (!distributionId) {
                throw createError({ statusCode: 400, message: 'distributionId is required for award action' })
            }

            const updated = await BonusDistribution.findByIdAndUpdate(
                distributionId,
                {
                    $set: {
                        status: 'awarded',
                        awardedAmount: awardedAmount ?? 0,
                        awardedAt: new Date(),
                        awardedBy: awardedBy || null,
                        awardedByName: awardedByName || '',
                        notes: notes || '',
                    }
                },
                { new: true }
            )

            if (!updated) {
                throw createError({ statusCode: 404, message: 'Distribution record not found' })
            }

            return { status: 'success', data: updated }
        }

        // Action: "unmark" — revert an awarded bonus back to earned
        if (action === 'unmark') {
            const { distributionId } = body
            if (!distributionId) {
                throw createError({ statusCode: 400, message: 'distributionId is required for unmark action' })
            }

            const updated = await BonusDistribution.findByIdAndUpdate(
                distributionId,
                {
                    $set: {
                        status: 'earned',
                        awardedAmount: 0,
                        awardedAt: null,
                        awardedBy: null,
                        awardedByName: '',
                        notes: '',
                    }
                },
                { new: true }
            )

            return { status: 'success', data: updated }
        }

        throw createError({ statusCode: 400, message: 'Invalid action. Use sync, award, or unmark' })
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
