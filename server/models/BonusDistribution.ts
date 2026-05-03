import mongoose from 'mongoose'

const BonusDistributionSchema = new mongoose.Schema(
    {
        employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
        subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
        subCategoryName: { type: String, default: '' },
        categoryName: { type: String, default: '' },
        bonusType: { type: String, enum: ['skill', 'custom'], required: true },
        earnedAmount: { type: Number, required: true, default: 0 },
        awardedAmount: { type: Number, default: 0 },
        status: { type: String, enum: ['earned', 'awarded'], default: 'earned' },
        awardedAt: { type: Date, default: null },
        awardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
        awardedByName: { type: String, default: '' },
        notes: { type: String, default: '' },
    },
    { timestamps: true, collection: 'hardwoodDB_BonusDistributions' },
)

// Index for fast lookups per employee
BonusDistributionSchema.index({ employee: 1 })
// One record per employee per sub-category per type
BonusDistributionSchema.index({ employee: 1, subCategory: 1, bonusType: 1 }, { unique: true })

export const BonusDistribution = mongoose.models.BonusDistribution || mongoose.model('BonusDistribution', BonusDistributionSchema)
