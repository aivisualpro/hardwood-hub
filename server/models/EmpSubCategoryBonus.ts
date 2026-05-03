import mongoose from 'mongoose'

const EmpSubCategoryBonusSchema = new mongoose.Schema(
    {
        employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
        subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: true },
        bonusAmount: { type: Number, required: true, default: 0 },
        reason: { type: String, default: '' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    },
    { timestamps: true, collection: 'hardwoodDB_EmpSubCategoryBonuses' },
)

// Ensure one custom bonus per employee per sub-category
EmpSubCategoryBonusSchema.index({ employee: 1, subCategory: 1 }, { unique: true })

export const EmpSubCategoryBonus = mongoose.models.EmpSubCategoryBonus || mongoose.model('EmpSubCategoryBonus', EmpSubCategoryBonusSchema)
