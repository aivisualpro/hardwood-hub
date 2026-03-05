import mongoose from 'mongoose'

const SubCategorySchema = new mongoose.Schema(
    {
        subCategory: { type: String, required: true, trim: true }, // display name
        category: { type: String, required: true, trim: true },    // references Category _id
        description: { type: String, default: '' },
        icon: { type: String, default: '' },
        predecessor: { type: String, default: '' },               // optional: another subCategory _id
    },
    { timestamps: true, collection: 'hardwoodDB_subCategories' },
)

export const SubCategory = mongoose.models.SubCategory || mongoose.model('SubCategory', SubCategorySchema)
