// GET  /api/performance   — list all performance records (with resolved refs)
// POST /api/performance   — upsert a performance record (by employee+skill combo)
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

        // Upsert: if record for this employee+skill+reviewer already exists, update it
        const doc = await EmpSkillPerformance.findOneAndUpdate(
            { employee, skill, createdBy },
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
