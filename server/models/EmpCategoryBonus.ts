import mongoose from 'mongoose'

const EmpCategoryBonusSchema = new mongoose.Schema(
    {
        employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
        bonusAmount: { type: Number, required: true, default: 0 },
        reason: { type: String, default: '' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Who gave the bonus
    },
    { timestamps: true, collection: 'hardwoodDB_EmpCategoryBonuses' },
)

// Ensure one custom bonus per employee per category
EmpCategoryBonusSchema.index({ employee: 1, category: 1 }, { unique: true })

export const EmpCategoryBonus = mongoose.models.EmpCategoryBonus || mongoose.model('EmpCategoryBonus', EmpCategoryBonusSchema)
