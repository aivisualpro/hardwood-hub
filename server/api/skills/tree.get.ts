// GET /api/skills/tree — returns categories with nested subCategories and skills
import { connectDB } from '../../utils/mongoose'
import { Category } from '../../models/Category'
import { SubCategory } from '../../models/SubCategory'
import { Skill } from '../../models/Skill'

export default defineEventHandler(async () => {
    await connectDB()

    const categories = await Category.find().sort({ category: 1 }).lean<any[]>()
    const subCategories = await SubCategory.find().sort({ subCategory: 1 }).lean<any[]>()
    const skills = await Skill.find().sort({ skill: 1 }).lean<any[]>()

    // Build tree: Category → SubCategories (matched by category _id string) → Skills
    const tree = categories.map((cat: any) => {
        const catId = String(cat._id)

        const catSubs = subCategories.filter(
            (sub: any) => String(sub.category) === catId,
        )

        return {
            _id: catId,
            name: cat.category, // actual field in DB is 'category'
            description: cat.description || '',
            icon: cat.icon || '',
            color: cat.color || '',
            info: cat.info || '',
            subCategories: catSubs.map((sub: any) => {
                const subId = String(sub._id)
                const subSkills = skills.filter(
                    (sk: any) => String(sk.subCategory) === subId,
                )
                return {
                    _id: subId,
                    name: sub.subCategory, // actual field in DB is 'subCategory'
                    description: sub.description || '',
                    icon: sub.icon || '',
                    category: catId,
                    predecessor: sub.predecessor || '',
                    predecessorName: sub.predecessor
                        ? (subCategories.find((s: any) => String(s._id) === String(sub.predecessor))?.subCategory ?? '')
                        : '',
                    bonusRules: sub.bonusRules || [],
                    skills: subSkills.map((sk: any) => ({
                        _id: String(sk._id),
                        name: sk.skill,         // normalised to 'name' for frontend
                        isRequired: sk.isRequired || false,
                        category: catId,
                        subCategory: subId,
                        info: sk.info || '',
                    })),
                }
            }),
        }
    })

    return { success: true, data: tree }
})
