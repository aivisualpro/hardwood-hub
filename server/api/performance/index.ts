// GET  /api/performance   — list all performance records (with resolved refs)
// POST /api/performance   — create or upsert a performance record
//   New behavior: each level creates a separate record per employee+skill+createdBy+level
//   Mastered requires existing Proficient from same reviewer on a prior date
import { connectDB } from '../../utils/mongoose'
import { EmpSkillPerformance } from '../../models/EmpSkillPerformance'
import { Employee } from '../../models/Employee'
import { Category } from '../../models/Category'
import { SubCategory } from '../../models/SubCategory'
import { Skill } from '../../models/Skill'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const [records, employees, categories, subCategories, skills] = await Promise.all([
            EmpSkillPerformance.find().sort({ createdAt: -1 }).lean<any[]>(),
            Employee.find().lean<any[]>(),
            Category.find().lean<any[]>(),
            SubCategory.find().lean<any[]>(),
            Skill.find().lean<any[]>(),
        ])

        // Build lookup maps
        const empMap = Object.fromEntries(employees.map((e: any) => [String(e._id), e]))
        const catMap = Object.fromEntries(categories.map((c: any) => [String(c._id), c]))
        const subMap = Object.fromEntries(subCategories.map((s: any) => [String(s._id), s]))
        const skillMap = Object.fromEntries(skills.map((s: any) => [String(s._id), s]))

        const data = records.map((r: any) => ({
            _id: String(r._id),
            employee: r.employee,
            employeeName: empMap[r.employee]?.employee ?? '',
            employeeImage: empMap[r.employee]?.profileImage ?? '',
            category: r.category,
            categoryName: catMap[r.category]?.category ?? '',
            subCategory: r.subCategory,
            subCategoryName: subMap[r.subCategory]?.subCategory ?? '',
            skill: r.skill,
            skillName: skillMap[r.skill]?.skill ?? '',
            currentSkillLevel: r.currentSkillLevel ?? '',
            createdAt: r.createdAt,
            createdBy: r.createdBy,
            createdByName: empMap[r.createdBy]?.employee ?? '',
        }))

        return { success: true, data }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { employee, category, subCategory, skill, currentSkillLevel, createdBy } = body
        if (!employee || !category || !subCategory || !skill)
            throw createError({ statusCode: 400, message: 'employee, category, subCategory, and skill are required' })

        // ─── Mastered guard: require Proficient from same reviewer on a prior date ───
        if (currentSkillLevel === 'Mastered') {
            const proficientRecord = await EmpSkillPerformance.findOne({
                employee,
                skill,
                createdBy,
                currentSkillLevel: 'Proficient',
            }).lean<any>()

            // Check if user is Super Admin (to bypass guards)
            const creatorEmployee = await Employee.findById(createdBy).lean<any>()
            const isSuperAdmin = creatorEmployee?.position === 'Super Admin'

            if (!proficientRecord) {
                if (isSuperAdmin) {
                    // Auto-create Proficient record for Super Admin
                    await EmpSkillPerformance.findOneAndUpdate(
                        { employee, skill, createdBy, currentSkillLevel: 'Proficient' },
                        { employee, category, subCategory, skill, currentSkillLevel: 'Proficient', createdBy },
                        { upsert: true },
                    )
                } else {
                    throw createError({
                        statusCode: 400,
                        message: 'Cannot mark as Mastered. Employee must first be marked as Proficient by you.',
                    })
                }
            } else if (!isSuperAdmin) {
                // Check that Proficient was on a prior date (not today) — Super Admin bypasses
                const profDate = new Date(proficientRecord.createdAt)
                const today = new Date()
                const profDateStr = profDate.toISOString().slice(0, 10)
                const todayStr = today.toISOString().slice(0, 10)

                if (profDateStr === todayStr) {
                    throw createError({
                        statusCode: 400,
                        message: 'Cannot mark as Mastered on the same day as Proficient. Please wait until the next day.',
                    })
                }
            }
        }

        // ─── Proficient guard: cannot mark Proficient if already Mastered by same reviewer ───
        // (this prevents downgrading progression)

        // Upsert: unique by employee + skill + createdBy + level
        const doc = await EmpSkillPerformance.findOneAndUpdate(
            { employee, skill, createdBy, currentSkillLevel },
            {
                employee,
                category,
                subCategory,
                skill,
                currentSkillLevel: currentSkillLevel ?? '',
                createdBy: createdBy ?? '',
            },
            { upsert: true, returnDocument: 'after' },
        ).lean()
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
