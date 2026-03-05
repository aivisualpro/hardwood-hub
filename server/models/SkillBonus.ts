import mongoose from 'mongoose'

const SkillBonusSchema = new mongoose.Schema(
    {
        skillSet: { type: String, required: true, trim: true },          // e.g. "Mastered", "Proficient"
        reviewedTimes: { type: Number, default: 1 },
        supervisorCheck: { type: String, default: '', trim: true },      // e.g. "Unique", "Any"
        bonusAmount: { type: Number, default: 0 },
    },
    { timestamps: true, collection: 'hardwoodDB_SkillBonus' },
)

export const SkillBonus = mongoose.models.SkillBonus || mongoose.model('SkillBonus', SkillBonusSchema)
