import { Employee } from '../../models/Employee'
import { EmpSkillPerformance } from '../../models/EmpSkillPerformance'
import { Category } from '../../models/Category'
import { SubCategory } from '../../models/SubCategory'
import { Skill } from '../../models/Skill'
import { connectDB } from '../../utils/mongoose'

// GET /api/admin-dashboard/stats — HR intelligence dashboard (workspace-aware)
export default defineEventHandler(async (event) => {
  await connectDB()

  const session = (event.context as any).session
  const currentUserId = session?._id || ''

  // ── Date range filter (optional query params) ─────────────
  const query = getQuery(event)
  const fromParam = query.from as string | undefined
  const toParam = query.to as string | undefined
  const fromDate = fromParam ? new Date(fromParam) : undefined
  const toDate = toParam ? new Date(toParam) : undefined

  // ── Core data (shared across all views) ──────────────────
  const [
    allEmployees,
    rawPerformance,
    allCategories,
    allSubCategories,
    allSkills,
  ] = await Promise.all([
    Employee.find().lean<any[]>(),
    EmpSkillPerformance.find().sort({ createdAt: -1 }).lean<any[]>(),
    Category.find().lean<any[]>(),
    SubCategory.find().lean<any[]>(),
    Skill.find().lean<any[]>(),
  ])

  // Apply date range filter if provided
  const allPerformance = (fromDate || toDate)
    ? rawPerformance.filter((r: any) => {
        const d = new Date(r.createdAt)
        if (fromDate && d < fromDate) return false
        if (toDate && d > toDate) return false
        return true
      })
    : rawPerformance

  // Build lookup maps
  const empMap = Object.fromEntries(allEmployees.map((e: any) => [String(e._id), e]))
  const catMap = Object.fromEntries(allCategories.map((c: any) => [String(c._id), c]))
  const subMap = Object.fromEntries(allSubCategories.map((s: any) => [String(s._id), s]))
  const skillMap = Object.fromEntries(allSkills.map((s: any) => [String(s._id), s]))
  const LEVELS = ['Needs Improvement', 'Proficient', 'Mastered']

  // ══════════════════════════════════════════════════════════
  // ADMIN VIEW — HR Intelligence & People Analytics
  // ══════════════════════════════════════════════════════════

  // 1. Per-employee skill mastery summary
  const employeeSkillMap = new Map<string, Map<string, string>>()
  for (const r of allPerformance) {
    const empId = String(r.employee)
    if (!employeeSkillMap.has(empId)) employeeSkillMap.set(empId, new Map())
    const skillLevels = employeeSkillMap.get(empId)!
    const existing = skillLevels.get(String(r.skill))
    if (!existing || LEVELS.indexOf(r.currentSkillLevel) > LEVELS.indexOf(existing)) {
      skillLevels.set(String(r.skill), r.currentSkillLevel)
    }
  }

  const totalSkillsInSystem = allSkills.length

  // Build employee performance profiles
  const employeeProfiles = allEmployees
    .filter((e: any) => e.status === 'Active')
    .map((e: any) => {
      const empId = String(e._id)
      const skills = employeeSkillMap.get(empId) || new Map()
      let mastered = 0, proficient = 0, needsImp = 0
      for (const level of skills.values()) {
        if (level === 'Mastered') mastered++
        else if (level === 'Proficient') proficient++
        else needsImp++
      }
      const assessed = mastered + proficient + needsImp
      const completionPercent = totalSkillsInSystem > 0 ? Math.round((assessed / totalSkillsInSystem) * 100) : 0
      const proficiencyPercent = assessed > 0 ? Math.round(((mastered + proficient) / assessed) * 100) : 0

      return {
        _id: empId,
        name: e.employee || 'Unknown',
        position: e.position || '',
        image: e.profileImage || '',
        mastered,
        proficient,
        needsImp,
        assessed,
        unassessed: totalSkillsInSystem - assessed,
        completionPercent,
        proficiencyPercent,
      }
    })
    .sort((a, b) => b.completionPercent - a.completionPercent)

  // 2. Supervisor leaderboard (who's reviewing the most)
  const supervisorReviewCounts = new Map<string, { total: number, uniqueEmployees: Set<string>, thisMonth: number }>()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  for (const r of allPerformance) {
    const supId = String(r.createdBy)
    if (!supervisorReviewCounts.has(supId)) {
      supervisorReviewCounts.set(supId, { total: 0, uniqueEmployees: new Set(), thisMonth: 0 })
    }
    const entry = supervisorReviewCounts.get(supId)!
    entry.total++
    entry.uniqueEmployees.add(String(r.employee))
    if (new Date(r.createdAt) >= thirtyDaysAgo) entry.thisMonth++
  }

  const supervisorLeaderboard = Array.from(supervisorReviewCounts.entries())
    .map(([supId, data]) => ({
      _id: supId,
      name: empMap[supId]?.employee || 'Unknown',
      image: empMap[supId]?.profileImage || '',
      position: empMap[supId]?.position || '',
      totalReviews: data.total,
      uniqueEmployees: data.uniqueEmployees.size,
      reviewsThisMonth: data.thisMonth,
    }))
    .sort((a, b) => b.totalReviews - a.totalReviews)
    .slice(0, 10)

  // 3. Skill gap analysis — categories with lowest mastery
  const categoryMastery = new Map<string, { name: string, totalSkills: number, mastered: number, proficient: number, needsImp: number }>()
  for (const skill of allSkills) {
    const sub = subMap[String(skill.subCategory)]
    const cat = sub ? catMap[String(sub.category)] : null
    const catId = cat ? String(cat._id) : 'uncategorized'
    const catName = cat?.category || 'Uncategorized'

    if (!categoryMastery.has(catId)) {
      categoryMastery.set(catId, { name: catName, totalSkills: 0, mastered: 0, proficient: 0, needsImp: 0 })
    }
    const entry = categoryMastery.get(catId)!
    entry.totalSkills++

    // Count how many active employees have mastered this skill
    let skillMastered = 0, skillProficient = 0, skillNeedsImp = 0
    for (const [empId, skillLevels] of employeeSkillMap) {
      const level = skillLevels.get(String(skill._id))
      if (level === 'Mastered') skillMastered++
      else if (level === 'Proficient') skillProficient++
      else if (level === 'Needs Improvement') skillNeedsImp++
    }
    entry.mastered += skillMastered
    entry.proficient += skillProficient
    entry.needsImp += skillNeedsImp
  }

  const skillGapAnalysis = Array.from(categoryMastery.values())
    .map(c => {
      const activeCount = allEmployees.filter((e: any) => e.status === 'Active').length
      const maxPossible = c.totalSkills * activeCount
      const masteryRate = maxPossible > 0 ? Math.round((c.mastered / maxPossible) * 100) : 0
      return { ...c, masteryRate }
    })
    .sort((a, b) => a.masteryRate - b.masteryRate)

  // 4. Recent review activity (last 20)
  const recentActivity = allPerformance.slice(0, 20).map((r: any) => ({
    employeeName: empMap[String(r.employee)]?.employee || 'Unknown',
    employeeImage: empMap[String(r.employee)]?.profileImage || '',
    reviewerName: empMap[String(r.createdBy)]?.employee || 'Unknown',
    reviewerImage: empMap[String(r.createdBy)]?.profileImage || '',
    skillName: skillMap[String(r.skill)]?.skill || 'Unknown',
    categoryName: catMap[String(r.category)]?.category || '',
    level: r.currentSkillLevel,
    createdAt: r.createdAt,
  }))

  // 5. Overall org stats
  const activeCount = allEmployees.filter((e: any) => e.status === 'Active').length
  let orgMastered = 0, orgProficient = 0, orgNeedsImp = 0
  for (const [, skillLevels] of employeeSkillMap) {
    for (const level of skillLevels.values()) {
      if (level === 'Mastered') orgMastered++
      else if (level === 'Proficient') orgProficient++
      else orgNeedsImp++
    }
  }

  // 6. Monthly review trend (last 6 months)
  const monthlyTrend: { month: string, reviews: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthKey = d.toISOString().slice(0, 7)
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const count = allPerformance.filter((r: any) => {
      const rDate = new Date(r.createdAt).toISOString().slice(0, 7)
      return rDate === monthKey
    }).length
    monthlyTrend.push({ month: label, reviews: count })
  }

  // ══════════════════════════════════════════════════════════
  // SUPERVISOR VIEW — Their review activity
  // ══════════════════════════════════════════════════════════
  const supReviews = allPerformance.filter((r: any) => String(r.createdBy) === currentUserId)

  // Per-employee breakdown
  const supEmployeeMap = new Map<string, {
    mastered: number, proficient: number, needsImp: number,
    totalReviews: number, uniqueSkills: Set<string>, lastDate: string
  }>()

  for (const r of supReviews) {
    const empId = String(r.employee)
    if (!supEmployeeMap.has(empId)) {
      supEmployeeMap.set(empId, { mastered: 0, proficient: 0, needsImp: 0, totalReviews: 0, uniqueSkills: new Set(), lastDate: '' })
    }
    const entry = supEmployeeMap.get(empId)!
    entry.totalReviews++
    entry.uniqueSkills.add(String(r.skill))
    if (r.currentSkillLevel === 'Mastered') entry.mastered++
    else if (r.currentSkillLevel === 'Proficient') entry.proficient++
    else entry.needsImp++
    const rd = r.createdAt?.toISOString?.() || String(r.createdAt)
    if (rd > entry.lastDate) entry.lastDate = rd
  }

  const supEmployees = Array.from(supEmployeeMap.entries()).map(([empId, data]) => ({
    _id: empId,
    name: empMap[empId]?.employee || 'Unknown',
    image: empMap[empId]?.profileImage || '',
    position: empMap[empId]?.position || '',
    mastered: data.mastered,
    proficient: data.proficient,
    needsImp: data.needsImp,
    totalReviews: data.totalReviews,
    uniqueSkills: data.uniqueSkills.size,
    lastReviewDate: data.lastDate,
    completionPercent: totalSkillsInSystem > 0 ? Math.round((data.uniqueSkills.size / totalSkillsInSystem) * 100) : 0,
  })).sort((a, b) => b.totalReviews - a.totalReviews)

  // Heatmap (90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const heatmapMap = new Map<string, number>()
  for (const r of supReviews) {
    if (new Date(r.createdAt) >= ninetyDaysAgo) {
      const dateKey = new Date(r.createdAt).toISOString().slice(0, 10)
      heatmapMap.set(dateKey, (heatmapMap.get(dateKey) || 0) + 1)
    }
  }
  const heatmap = Array.from(heatmapMap.entries()).map(([date, count]) => ({ date, count }))

  const supReviewsThisWeek = supReviews.filter((r: any) => new Date(r.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length

  // ══════════════════════════════════════════════════════════
  // CREW MEMBER VIEW — Their personal skill data
  // ══════════════════════════════════════════════════════════
  const crewSkills = employeeSkillMap.get(currentUserId) || new Map()
  let crewMastered = 0, crewProficient = 0, crewNeedsImp = 0
  for (const level of crewSkills.values()) {
    if (level === 'Mastered') crewMastered++
    else if (level === 'Proficient') crewProficient++
    else crewNeedsImp++
  }

  // Crew growth events
  const crewReviews = allPerformance
    .filter((r: any) => String(r.employee) === currentUserId)
    .filter((r: any) => r.currentSkillLevel === 'Proficient' || r.currentSkillLevel === 'Mastered')
    .slice(0, 20)
    .map((r: any) => ({
      skillName: skillMap[String(r.skill)]?.skill || 'Unknown Skill',
      categoryName: catMap[String(r.category)]?.category || '',
      level: r.currentSkillLevel,
      reviewerName: empMap[String(r.createdBy)]?.employee || 'Unknown',
      date: r.createdAt,
    }))

  // Crew per-category breakdown
  const crewCategoryBreakdown: { name: string, mastered: number, proficient: number, needsImp: number, total: number }[] = []
  for (const cat of allCategories) {
    const catSkills = allSkills.filter((s: any) => {
      const sub = subMap[String(s.subCategory)]
      return sub && String(sub.category) === String(cat._id)
    })
    let m = 0, p = 0, n = 0
    for (const s of catSkills) {
      const level = crewSkills.get(String(s._id))
      if (level === 'Mastered') m++
      else if (level === 'Proficient') p++
      else if (level === 'Needs Improvement') n++
    }
    if (catSkills.length > 0) {
      crewCategoryBreakdown.push({ name: cat.category, mastered: m, proficient: p, needsImp: n, total: catSkills.length })
    }
  }

  return {
    success: true,
    data: {
      admin: {
        orgStats: {
          totalEmployees: allEmployees.length,
          activeEmployees: activeCount,
          totalSkills: totalSkillsInSystem,
          totalCategories: allCategories.length,
          totalReviews: allPerformance.length,
          orgMastered,
          orgProficient,
          orgNeedsImp,
        },
        employeeProfiles,
        supervisorLeaderboard,
        skillGapAnalysis,
        recentActivity,
        monthlyTrend,
      },
      supervisor: {
        totalEmployeesReviewed: supEmployeeMap.size,
        totalReviews: supReviews.length,
        reviewsThisWeek: supReviewsThisWeek,
        employees: supEmployees,
        heatmap,
      },
      crew: {
        summary: { mastered: crewMastered, proficient: crewProficient, needsImprovement: crewNeedsImp, totalAssessed: crewMastered + crewProficient + crewNeedsImp },
        totalSkills: totalSkillsInSystem,
        growthEvents: crewReviews,
        categoryBreakdown: crewCategoryBreakdown,
      },
    },
  }
})
