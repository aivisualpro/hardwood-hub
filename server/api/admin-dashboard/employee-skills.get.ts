import { Employee } from '../../models/Employee'
import { EmpSkillPerformance } from '../../models/EmpSkillPerformance'
import { Category } from '../../models/Category'
import { SubCategory } from '../../models/SubCategory'
import { Skill } from '../../models/Skill'
import { connectDB } from '../../utils/mongoose'

/**
 * GET /api/admin-dashboard/employee-skills?employeeId=xxx
 *
 * Returns a detailed skill breakdown for one employee, organised by
 * category → subcategory → skill, including the latest reviewer and date.
 */
export default defineEventHandler(async (event) => {
  await connectDB()

  const { employeeId } = getQuery(event)
  if (!employeeId) {
    throw createError({ statusCode: 400, message: 'employeeId query param is required' })
  }

  const [
    employee,
    reviews,
    allCategories,
    allSubCategories,
    allSkills,
    allEmployees,
  ] = await Promise.all([
    Employee.findById(employeeId).lean<any>(),
    EmpSkillPerformance.find({ employee: employeeId }).sort({ createdAt: -1 }).lean<any[]>(),
    Category.find().lean<any[]>(),
    SubCategory.find().lean<any[]>(),
    Skill.find().lean<any[]>(),
    Employee.find({}, { _id: 1, employee: 1, profileImage: 1 }).lean<any[]>(),
  ])

  if (!employee) {
    throw createError({ statusCode: 404, message: 'Employee not found' })
  }

  // Lookup maps
  const catMap = Object.fromEntries(allCategories.map((c: any) => [String(c._id), c]))
  const subMap = Object.fromEntries(allSubCategories.map((s: any) => [String(s._id), s]))
  const empMap = Object.fromEntries(allEmployees.map((e: any) => [String(e._id), e]))

  const LEVELS = ['Needs Improvement', 'Proficient', 'Mastered']

  // Build best-level + latest review per skill
  const skillBestLevel = new Map<string, { level: string, reviewerName: string, reviewerImage: string, reviewedAt: string, notes: string }>()
  for (const r of reviews) {
    const skillId = String(r.skill)
    const existing = skillBestLevel.get(skillId)
    if (!existing || LEVELS.indexOf(r.currentSkillLevel) > LEVELS.indexOf(existing.level)) {
      const reviewer = empMap[String(r.createdBy)]
      skillBestLevel.set(skillId, {
        level: r.currentSkillLevel,
        reviewerName: reviewer?.employee || 'Unknown',
        reviewerImage: reviewer?.profileImage || '',
        reviewedAt: r.createdAt?.toISOString?.() || String(r.createdAt),
        notes: r.notes || '',
      })
    }
  }

  // Group by category → subcategory → skills
  interface SkillDetail {
    _id: string
    name: string
    level: 'Mastered' | 'Proficient' | 'Needs Improvement' | 'Unassessed'
    isRequired: boolean
    reviewerName: string
    reviewerImage: string
    reviewedAt: string
    notes: string
  }

  interface SubCategoryGroup {
    name: string
    skills: SkillDetail[]
  }

  interface CategoryGroup {
    _id: string
    name: string
    subCategories: SubCategoryGroup[]
    mastered: number
    proficient: number
    needsImp: number
    unassessed: number
    total: number
  }

  const categoryGroupMap = new Map<string, CategoryGroup>()

  for (const skill of allSkills) {
    const sub = subMap[String(skill.subCategory)]
    const cat = sub ? catMap[String(sub.category)] : null
    if (!cat) continue

    const catId = String(cat._id)
    const catName = cat.category || 'Uncategorized'
    const subName = sub?.subCategory || 'General'

    if (!categoryGroupMap.has(catId)) {
      categoryGroupMap.set(catId, {
        _id: catId,
        name: catName,
        subCategories: [],
        mastered: 0,
        proficient: 0,
        needsImp: 0,
        unassessed: 0,
        total: 0,
      })
    }

    const catGroup = categoryGroupMap.get(catId)!
    let subGroup = catGroup.subCategories.find(s => s.name === subName)
    if (!subGroup) {
      subGroup = { name: subName, skills: [] }
      catGroup.subCategories.push(subGroup)
    }

    const review = skillBestLevel.get(String(skill._id))
    const level = review?.level || 'Unassessed'

    subGroup.skills.push({
      _id: String(skill._id),
      name: skill.skill,
      level: level as any,
      isRequired: skill.isRequired || false,
      reviewerName: review?.reviewerName || '',
      reviewerImage: review?.reviewerImage || '',
      reviewedAt: review?.reviewedAt || '',
      notes: review?.notes || '',
    })

    catGroup.total++
    if (level === 'Mastered') catGroup.mastered++
    else if (level === 'Proficient') catGroup.proficient++
    else if (level === 'Needs Improvement') catGroup.needsImp++
    else catGroup.unassessed++
  }

  // Sort: categories alphabetically, skills by level (Mastered first)
  const levelOrder: Record<string, number> = { Mastered: 0, Proficient: 1, 'Needs Improvement': 2, Unassessed: 3 }
  const categories = Array.from(categoryGroupMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(cat => ({
      ...cat,
      subCategories: cat.subCategories
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(sub => ({
          ...sub,
          skills: sub.skills.sort((a, b) => (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9)),
        })),
    }))

  // Flat skill list for table view
  const allSkillsList = categories.flatMap(cat =>
    cat.subCategories.flatMap(sub =>
      sub.skills.map(skill => ({
        ...skill,
        categoryName: cat.name,
        subCategoryName: sub.name,
      })),
    ),
  )

  // Summary counts
  const summary = {
    mastered: allSkillsList.filter(s => s.level === 'Mastered').length,
    proficient: allSkillsList.filter(s => s.level === 'Proficient').length,
    needsImp: allSkillsList.filter(s => s.level === 'Needs Improvement').length,
    unassessed: allSkillsList.filter(s => s.level === 'Unassessed').length,
    total: allSkillsList.length,
  }

  return {
    success: true,
    data: {
      employee: {
        _id: String(employee._id),
        name: employee.employee || 'Unknown',
        position: employee.position || '',
        image: employee.profileImage || '',
      },
      summary,
      categories,
      skills: allSkillsList,
    },
  }
})
