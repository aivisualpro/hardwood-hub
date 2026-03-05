import mongoose from 'mongoose'

const SubCategorySchema = new mongoose.Schema(
    {
        subCategory: { type: String, required: true, trim: true }, // display name
        category: { type: String, required: true, trim: true },    // references Category _id
        description: { type: String, default: '' },
        icon: { type: String, default: '' },
        predecessor: { type: String, default: '' },               // optional: another subCategory _id
        bonusRules: {
            type: [
                {
                    skillSet: { type: String, required: true },
                    reviewedTimes: { type: Number, default: 1 },
                    supervisorCheck: { type: String, default: 'Any' },
                    bonusAmount: { type: Number, default: 0 },
                },
            ],
            default: [],
        },
    },
    { timestamps: true, collection: 'hardwoodDB_subCategories' },
)

export const SubCategory = mongoose.models.SubCategory || mongoose.model('SubCategory', SubCategorySchema)
