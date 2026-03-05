import mongoose from 'mongoose'

const EmpSkillPerformanceSchema = new mongoose.Schema(
    {
        employee: { type: String, required: true, trim: true },       // Employee _id
        category: { type: String, required: true, trim: true },       // Category _id
        subCategory: { type: String, required: true, trim: true },    // SubCategory _id
        skill: { type: String, required: true, trim: true },          // Skill _id
        currentSkillLevel: { type: String, default: '' },
        createdBy: { type: String, default: '' },                     // Employee _id (who created)
    },
    { timestamps: true, collection: 'hardwoodDB_EmpSkillPerformance' },
)

export const EmpSkillPerformance = mongoose.models.EmpSkillPerformance || mongoose.model('EmpSkillPerformance', EmpSkillPerformanceSchema)
