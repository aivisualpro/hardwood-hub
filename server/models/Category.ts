import mongoose from 'mongoose'

const CategorySchema = new mongoose.Schema(
    {
        category: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        icon: { type: String, default: '' },
        color: { type: String, default: '' },
    },
    { timestamps: true, collection: 'hardwoodDB_Categories' },
)

export const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema)
