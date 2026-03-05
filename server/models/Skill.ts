import mongoose from 'mongoose'

const SkillSchema = new mongoose.Schema(
    {
        skill: { type: String, required: true, trim: true },
        isRequired: { type: Boolean, default: false },
        category: { type: String, required: true, trim: true },    // Category _id
        subCategory: { type: String, required: true, trim: true }, // SubCategory _id
    },
    { timestamps: true, collection: 'hardwoodDB_Skills' },
)

export const Skill = mongoose.models.Skill || mongoose.model('Skill', SkillSchema)
