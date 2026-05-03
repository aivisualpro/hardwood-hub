<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Employees Bonus Report', icon: 'i-lucide-trophy', description: 'Track employee skill bonuses across all categories' })

// ─── Types ───────────────────────────────────────────────
interface Employee { _id: string; employee: string; profileImage: string; position: string; status: string }
interface SkillNode { _id: string; name: string; isRequired: boolean }
interface SubCatNode { _id: string; name: string; skills: SkillNode[]; bonusRules: any[] }
interface CatNode { _id: string; name: string; color: string; subCategories: SubCatNode[] }
interface CustomBonusRecord { _id: string; employee: string; subCategory: string; bonusAmount: number; reason: string; createdBy: string | null; createdAt: string }
interface PerfRecord { _id: string; employee: string; skill: string; currentSkillLevel: string; createdBy: string; createdByName?: string; createdAt?: string }

// ─── State ───────────────────────────────────────────────
const employees = ref<Employee[]>([])
const tree = ref<CatNode[]>([])
const perfRecords = ref<PerfRecord[]>([])
const generalRules = ref<any[]>([])
const customBonuses = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const expandedRows = ref<Set<string>>(new Set())
const sortBy = ref<'name' | 'bonus' | 'progress'>('bonus')
const sortDir = ref<'asc' | 'desc'>('desc')

// ─── Fetch ───────────────────────────────────────────────
async function fetchAll() {
  loading.value = true
  try {
    const [empRes, treeRes, perfRes, rulesRes, customBonusesRes] = await Promise.all([
      $fetch<{ success: boolean, data: Employee[] }>('/api/employees'),
      $fetch<{ success: boolean, data: CatNode[] }>('/api/skills/tree'),
      $fetch<{ success: boolean, data: PerfRecord[] }>('/api/performance'),
      $fetch<{ success: boolean, data: any[] }>('/api/skill-bonus'),
      $fetch<{ status: string, data: any[] }>('/api/performance/custom-bonus'),
    ])
    employees.value = empRes.data.filter(e => e.status === 'Active')
    tree.value = treeRes.data
    perfRecords.value = perfRes.data
    generalRules.value = rulesRes.data
    customBonuses.value = customBonusesRes.data
  } catch (e: any) {
    toast.error('Failed to load data', { description: e?.message })
  } finally {
    loading.value = false
  }
}
onMounted(fetchAll)

// ─── Helpers ─────────────────────────────────────────────
function levelIndex(lvl: string) {
  return ['Needs Improvement', 'Proficient', 'Mastered'].indexOf(lvl)
}

function evaluateRules(rulesToCheck: any[], skillsInSub: any[], skillReviewsMap: Map<string, any[]>): number {
  let totalBonus = 0
  for (const rule of rulesToCheck) {
    const requiredLevelIdx = levelIndex(rule.skillSet)
    const requiredTimes = rule.reviewedTimes || 1
    const isUnique = rule.supervisorCheck === 'Unique'

    let ruleMet = true
    for (const sk of skillsInSub) {
      const reviews = skillReviewsMap.get(sk._id) || []
      const qualifying = reviews.filter(r => levelIndex(r.currentSkillLevel) >= requiredLevelIdx)
      if (qualifying.length < requiredTimes) { ruleMet = false; break }
      if (isUnique) {
        const uniqueReviewers = new Set(qualifying.map(r => r.createdBy))
        if (uniqueReviewers.size < requiredTimes) { ruleMet = false; break }
      }
    }
    if (ruleMet) totalBonus += (rule.bonusAmount || 0)
  }
  return totalBonus
}

// ─── Per-Employee Bonus Report ───────────────────────────
type SkillStatus = 'mastered' | 'proficient' | 'needs' | 'unreviewed'

interface SkillReviewInfo {
  reviewer: string
  level: string
  date: string
}

interface SkillStatusItem {
  id: string
  name: string
  status: SkillStatus
  reviews: SkillReviewInfo[]
}

interface EmpBonusData {
  employee: Employee
  totalBonus: number
  totalAssessed: number
  totalRuleCompliant: number
  totalSkills: number
  proficientCount: number
  masteredCount: number
  needsCount: number
  categories: {
    id: string; name: string; bonus: number; maxBonus: number; assessed: number; ruleCompliant: number; total: number
    subCategories: {
      id: string; name: string; bonus: number; customBonus: number; assessed: number; ruleCompliant: number; total: number
      hasOverride: boolean; proficient: number; mastered: number; needs: number
      ruleLevel: string // e.g. 'Proficient', 'Mastered', or '' if no rules
      rulesToUse: any[]
      skills: SkillStatusItem[]
    }[]
  }[]
}

const employeeBonusData = computed<EmpBonusData[]>(() => {
  if (!tree.value.length || !employees.value.length) return []

  const totalSystemSkills = tree.value.reduce((s, c) =>
    s + c.subCategories.reduce((s2, sub) => s2 + sub.skills.length, 0), 0)

  return employees.value.map(emp => {
    const empRecords = perfRecords.value.filter(r => r.employee === emp._id)

    // Build skill reviews map for this employee
    const skillReviewsMap = new Map<string, any[]>()
    for (const r of empRecords) {
      if (!skillReviewsMap.has(r.skill)) skillReviewsMap.set(r.skill, [])
      skillReviewsMap.get(r.skill)!.push(r)
    }

    // Highest perf per skill
    const highestMap = new Map<string, any>()
    for (const r of empRecords) {
      const existing = highestMap.get(r.skill)
      if (!existing || levelIndex(r.currentSkillLevel) > levelIndex(existing.currentSkillLevel)) {
        highestMap.set(r.skill, r)
      }
    }

    let totalBonus = 0
    let totalAssessed = 0
    let totalRuleCompliant = 0
    let proficientCount = 0
    let masteredCount = 0
    let needsCount = 0

    const categories = tree.value.map(cat => {
      let catBonus = 0
      let catMaxBonus = 0
      let catAssessed = 0
      let catRuleCompliant = 0
      let catTotal = 0

      const subCategories = cat.subCategories.map(sub => {
        const totalSub = sub.skills.length
        catTotal += totalSub
        let subProficient = 0
        let subMastered = 0
        let subAssessed = 0
        let subNeeds = 0

        // Build per-skill status for uptime bar
        const skillStatuses: SkillStatusItem[] = sub.skills.map(sk => {
          const h = highestMap.get(sk._id)
          let status: SkillStatus = 'unreviewed'
          if (h) {
            if (h.currentSkillLevel === 'Mastered') status = 'mastered'
            else if (h.currentSkillLevel === 'Proficient') status = 'proficient'
            else status = 'needs'
          }
          // Gather all reviews for this skill
          const rawReviews = skillReviewsMap.get(sk._id) || []
          const reviews: SkillReviewInfo[] = rawReviews.map(r => ({
            reviewer: r.createdByName || 'Unknown',
            level: r.currentSkillLevel || '',
            date: r.createdAt || '',
          }))
          return { id: sk._id, name: sk.name, status, reviews }
        })

        for (const sk of skillStatuses) {
          if (sk.status !== 'unreviewed') subAssessed++
          if (sk.status === 'mastered') subMastered++
          else if (sk.status === 'proficient') subProficient++
          else if (sk.status === 'needs') subNeeds++
        }

        // Determine applicable rules and target level
        const overrideRules = sub.bonusRules || []
        const rulesToUse = overrideRules.length > 0 ? overrideRules : generalRules.value

        // Calculate max bonus for this sub
        let subMaxBonus = 0
        for (const r of rulesToUse) {
          subMaxBonus += (r.bonusAmount || 0)
        }
        catMaxBonus += subMaxBonus

        // Calculate bonus
        let subBonus = 0
        if (totalSub > 0) {
          subBonus = evaluateRules(rulesToUse, sub.skills, skillReviewsMap)
        }

        // Determine rule-based completion: find the primary rule (highest bonus)
        // and count how many skills meet its minimum level requirement
        let ruleLevel = ''
        let subRuleCompliant = subAssessed // fallback: any assessed = compliant
        if (rulesToUse.length > 0) {
          // Use the rule with the highest bonus as the target
          const primaryRule = [...rulesToUse].sort((a, b) => (b.bonusAmount || 0) - (a.bonusAmount || 0))[0]!
          const requiredLevelIdx = levelIndex(primaryRule.skillSet)
          const requiredTimes = primaryRule.reviewedTimes || 1
          const isUnique = primaryRule.supervisorCheck === 'Unique'
          ruleLevel = primaryRule.skillSet || ''

          // Count skills that meet the rule's requirements
          subRuleCompliant = 0
          for (const sk of sub.skills) {
            const reviews = skillReviewsMap.get(sk._id) || []
            const qualifying = reviews.filter(r => levelIndex(r.currentSkillLevel) >= requiredLevelIdx)
            if (qualifying.length >= requiredTimes) {
              if (isUnique) {
                const uniqueReviewers = new Set(qualifying.map(r => r.createdBy))
                if (uniqueReviewers.size >= requiredTimes) subRuleCompliant++
              } else {
                subRuleCompliant++
              }
            }
          }
        }

        catBonus += subBonus
        catAssessed += subAssessed
        catRuleCompliant += subRuleCompliant
        proficientCount += subProficient
        masteredCount += subMastered
        needsCount += subNeeds

        const customBonusRecord = customBonuses.value.find((cb: CustomBonusRecord) => cb.employee === emp._id && cb.subCategory === sub._id)
        const subCustomBonus = customBonusRecord ? customBonusRecord.bonusAmount : 0

        catBonus += subCustomBonus

        return {
          id: sub._id,
          name: sub.name,
          bonus: subBonus,
          customBonus: subCustomBonus,
          assessed: subAssessed,
          ruleCompliant: subRuleCompliant,
          total: totalSub,
          hasOverride: overrideRules.length > 0,
          proficient: subProficient,
          mastered: subMastered,
          needs: subNeeds,
          ruleLevel,
          rulesToUse,
          skills: skillStatuses,
        }
      })

      totalBonus += catBonus
      totalAssessed += catAssessed
      totalRuleCompliant += catRuleCompliant

      return { id: cat._id, name: cat.name, bonus: catBonus, maxBonus: catMaxBonus, assessed: catAssessed, ruleCompliant: catRuleCompliant, total: catTotal, subCategories }
    })

    return {
      employee: emp,
      totalBonus,
      totalAssessed,
      totalRuleCompliant,
      totalSkills: totalSystemSkills,
      proficientCount,
      masteredCount,
      needsCount,
      categories,
    }
  })
})

// ─── Search & Sort ───────────────────────────────────────
const filteredData = computed(() => {
  let data = employeeBonusData.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    data = data.filter(d => d.employee.employee.toLowerCase().includes(q))
  }
  data = [...data].sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'bonus') cmp = a.totalBonus - b.totalBonus
    else if (sortBy.value === 'progress') cmp = a.totalAssessed - b.totalAssessed
    else cmp = a.employee.employee.localeCompare(b.employee.employee)
    return sortDir.value === 'desc' ? -cmp : cmp
  })
  return data
})

// ─── Summary ─────────────────────────────────────────────
const totalBonusAllEmployees = computed(() => employeeBonusData.value.reduce((s, d) => s + d.totalBonus, 0))
const avgBonus = computed(() => employeeBonusData.value.length ? totalBonusAllEmployees.value / employeeBonusData.value.length : 0)
const topEarner = computed(() => {
  if (!employeeBonusData.value.length) return null
  return [...employeeBonusData.value].sort((a, b) => b.totalBonus - a.totalBonus)[0]
})
const totalSystemSkills = computed(() => tree.value.reduce((s, c) =>
  s + c.subCategories.reduce((s2, sub) => s2 + sub.skills.length, 0), 0))

interface MaxPotentialSkill {
  name: string;
}

interface MaxPotentialSub {
  name: string;
  maxRule: number;
  source: 'override' | 'global';
  skills: MaxPotentialSkill[];
}

interface MaxPotentialCat {
  name: string;
  totalBonus: number;
  subCategories: MaxPotentialSub[];
}

const maxBonusSearchQuery = ref('')

const maxPotentialResult = computed(() => {
  let total = 0
  const categories: MaxPotentialCat[] = []

  if (!tree.value.length) return { total, categories }

  for (const cat of tree.value) {
    const pCat: MaxPotentialCat = { name: cat.name, totalBonus: 0, subCategories: [] }
    for (const sub of cat.subCategories) {
      if (sub.skills.length === 0) continue
      
      const hasOverride = sub.bonusRules && sub.bonusRules.length > 0
      const rules = hasOverride ? sub.bonusRules : generalRules.value
      
      let sumRules = 0
      for (const r of rules) {
        sumRules += (r.bonusAmount || 0)
      }
      
      if (sumRules > 0) {
        total += sumRules
        pCat.totalBonus += sumRules
        pCat.subCategories.push({
          name: sub.name,
          maxRule: sumRules,
          source: hasOverride ? 'override' : 'global',
          skills: sub.skills.map(s => ({ name: s.name }))
        })
      }
    }
    if (pCat.subCategories.length > 0) {
      pCat.subCategories.sort((a, b) => b.maxRule - a.maxRule)
      categories.push(pCat)
    }
  }
  
  categories.sort((a, b) => a.name.localeCompare(b.name))
  
  return { total, categories }
})

const filteredMaxPotentialCategories = computed(() => {
  const q = maxBonusSearchQuery.value.toLowerCase()
  if (!q) return maxPotentialResult.value.categories

  return maxPotentialResult.value.categories.map(cat => {
    // If category name matches, keep all its subs
    if (cat.name.toLowerCase().includes(q)) return cat
    
    // Otherwise filter subs
    const filteredSubs = cat.subCategories.map(sub => {
      // If sub matches, keep all its skills
      if (sub.name.toLowerCase().includes(q)) return sub
      
      // Otherwise filter skills
      const filteredSkills = sub.skills.filter(sk => sk.name.toLowerCase().includes(q))
      if (filteredSkills.length > 0) {
        return { ...sub, skills: filteredSkills }
      }
      return null
    }).filter(Boolean) as MaxPotentialSub[]

    if (filteredSubs.length > 0) {
      return { ...cat, subCategories: filteredSubs }
    }
    return null
  }).filter(Boolean) as MaxPotentialCat[]
})

const maxPotentialBonus = computed(() => maxPotentialResult.value.total)
const showMaxBonusModal = ref(false)

const expandedMaxBonusCats = ref<Set<string>>(new Set())

function toggleMaxBonusCat(catName: string) {
  if (expandedMaxBonusCats.value.has(catName)) {
    expandedMaxBonusCats.value.delete(catName)
  } else {
    expandedMaxBonusCats.value.add(catName)
  }
}

function toggleRow(empId: string) {
  if (expandedRows.value.has(empId)) expandedRows.value.delete(empId)
  else expandedRows.value.add(empId)
}

function toggleSort(col: 'name' | 'bonus' | 'progress') {
  if (sortBy.value === col) sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  else { sortBy.value = col; sortDir.value = 'desc' }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Expanded category accordion per employee ────────────
const expandedCats = ref<Set<string>>(new Set())
function toggleCat(empId: string, catId: string) {
  const key = `${empId}::${catId}`
  if (expandedCats.value.has(key)) expandedCats.value.delete(key)
  else expandedCats.value.add(key)
}

// Category color palette
const catPalette = [
  { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/20', dot: 'bg-violet-500', bar: 'bg-violet-500' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/20', dot: 'bg-cyan-500', bar: 'bg-cyan-500' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20', dot: 'bg-orange-500', bar: 'bg-orange-500' },
  { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20', dot: 'bg-rose-500', bar: 'bg-rose-500' },
  { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', dot: 'bg-blue-500', bar: 'bg-blue-500' },
]
function pal(idx: number) { return catPalette[idx % catPalette.length]! }

// Uptime bar color per skill status
const skillBarColor: Record<SkillStatus, string> = {
  mastered: 'bg-emerald-500',
  proficient: 'bg-blue-500',
  needs: 'bg-amber-500',
  unreviewed: 'bg-zinc-700',
}

// Sub-category overall status indicator (rule-aware)
function subStatus(sub: EmpBonusData['categories'][0]['subCategories'][0]): 'all-complete' | 'has-progress' | 'none' {
  if (sub.total === 0) return 'none'
  if (sub.ruleCompliant === sub.total) return 'all-complete'
  if (sub.assessed > 0) return 'has-progress'
  return 'none'
}

// ─── Custom Bonus logic (Sub-Category level) ────────────
const showCustomBonusModal = ref(false)
const customBonusEmp = ref<any>(null)
const customBonusSub = ref<any>(null)
const customBonusAmount = ref(0)
const customBonusReason = ref('')
const savingCustomBonus = ref(false)

function openCustomBonusModal(emp: any, sub: any) {
  customBonusEmp.value = emp
  customBonusSub.value = sub
  customBonusAmount.value = sub.customBonus || 0
  customBonusReason.value = ''
  showCustomBonusModal.value = true
}

async function saveCustomBonus() {
  if (customBonusAmount.value < 0) return
  savingCustomBonus.value = true
  try {
    const res = await $fetch<{status:string, data:any}>('/api/performance/custom-bonus', {
      method: 'POST',
      body: {
        employee: customBonusEmp.value._id,
        subCategory: customBonusSub.value.id,
        bonusAmount: customBonusAmount.value,
        reason: customBonusReason.value
      }
    })
    
    // Update local state
    const existing = customBonuses.value.find((cb: any) => cb.employee === customBonusEmp.value._id && cb.subCategory === customBonusSub.value.id)
    if (existing) {
      existing.bonusAmount = customBonusAmount.value
    } else {
      customBonuses.value.push(res.data)
    }
    showCustomBonusModal.value = false
    toast.success('Custom bonus updated')
  } catch(e:any) {
    toast.error('Failed to save', {description: e.message})
  } finally {
    savingCustomBonus.value = false
  }
}
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <div class="space-y-4 sm:space-y-6">

      <!-- ═══════ SUMMARY CARDS ═══════ -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
        <!-- Total Bonus Payout -->
        <div class="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-3 sm:p-5 relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-2 sm:p-3 opacity-15"><Icon name="i-lucide-trophy" class="size-14 sm:size-20 text-amber-500" /></div>
          <div class="relative z-10">
            <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">Total Payout</p>
            <p class="text-xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 sm:mt-2 tabular-nums">{{ fmt(totalBonusAllEmployees) }}</p>
            <p class="text-[9px] sm:text-[10px] text-amber-600/50 dark:text-amber-400/50 mt-0.5 sm:mt-1">All employees combined</p>
          </div>
        </div>

        <!-- Average Bonus -->
        <div class="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-3 sm:p-5 relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-2 sm:p-3 opacity-15"><Icon name="i-lucide-bar-chart-3" class="size-14 sm:size-20 text-blue-500" /></div>
          <div class="relative z-10">
            <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70">Avg / Employee</p>
            <p class="text-xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-1 sm:mt-2 tabular-nums">{{ fmt(avgBonus) }}</p>
            <p class="text-[9px] sm:text-[10px] text-blue-600/50 dark:text-blue-400/50 mt-0.5 sm:mt-1">{{ employees.length }} active</p>
          </div>
        </div>

        <!-- Top Earner -->
        <div class="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-3 sm:p-5 relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-2 sm:p-3 opacity-15"><Icon name="i-lucide-crown" class="size-14 sm:size-20 text-emerald-500" /></div>
          <div class="relative z-10">
            <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">Top Earner</p>
            <p class="text-sm sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 sm:mt-2 truncate">{{ topEarner?.employee.employee || '—' }}</p>
            <p class="text-[9px] sm:text-[10px] text-emerald-600/50 dark:text-emerald-400/50 mt-0.5 sm:mt-1">{{ topEarner ? fmt(topEarner.totalBonus) : '$0.00' }}</p>
          </div>
        </div>

        <!-- Total Skills -->
        <div class="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-3 sm:p-5 relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-2 sm:p-3 opacity-15"><Icon name="i-lucide-layers" class="size-14 sm:size-20 text-violet-500" /></div>
          <div class="relative z-10">
            <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-violet-600/70 dark:text-violet-400/70">Categories</p>
            <p class="text-xl sm:text-3xl font-black text-violet-600 dark:text-violet-400 mt-1 sm:mt-2 tabular-nums">{{ tree.length }}</p>
            <p class="text-[9px] sm:text-[10px] text-violet-600/50 dark:text-violet-400/50 mt-0.5 sm:mt-1">{{ totalSystemSkills }} skills</p>
          </div>
        </div>


        <!-- Max Potential Bonus (Shiny Animated Card) -->
        <div 
          role="button"
          tabindex="0"
          @click="showMaxBonusModal = true"
          @keydown.enter.space="showMaxBonusModal = true"
          class="cursor-pointer rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent p-3 sm:p-5 relative overflow-hidden group shadow-[0_0_15px_rgba(236,72,153,0.15)] hover:shadow-[0_0_25px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
        >
          <div class="absolute -inset-1 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-fuchsia-500/20 blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
          
          <div class="absolute top-0 right-0 p-2 sm:p-3 opacity-20 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 pointer-events-none">
            <Icon name="i-lucide-rocket" class="size-14 sm:size-20 text-pink-500" />
          </div>
          <div class="relative z-10">
            <p class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-pink-600/90 dark:text-pink-400/90 flex items-center gap-1.5">
              MAX POTENTIAL
              <Icon name="i-lucide-zap" class="size-3 text-pink-500 animate-pulse drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]" />
            </p>
            <p class="text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 mt-1 sm:mt-2 tabular-nums drop-shadow-sm">{{ fmt(maxPotentialBonus) }}</p>
            <p class="text-[9px] sm:text-[10px] text-pink-600/70 dark:text-pink-400/70 mt-0.5 sm:mt-1 font-medium">Per employee capacity</p>
          </div>
        </div>
      </div>

      <!-- ═══════ TOOLBAR ═══════ -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        <div class="relative flex-1 sm:max-w-sm">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5 sm:size-4" />
          <Input v-model="searchQuery" placeholder="Search employees..." class="pl-8 sm:pl-9 h-9 bg-muted/50 text-xs sm:text-sm" />
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground overflow-x-auto">
          <span class="font-medium shrink-0">Sort:</span>
          <button
            v-for="col in [{ key: 'bonus', label: 'Bonus' }, { key: 'progress', label: 'Progress' }, { key: 'name', label: 'Name' }]"
            :key="col.key"
            class="px-2.5 sm:px-3 py-1.5 rounded-lg border transition-all shrink-0"
            :class="sortBy === col.key
              ? 'bg-primary/10 text-primary border-primary/30 font-semibold'
              : 'border-border/40 hover:bg-muted hover:text-foreground'"
            @click="toggleSort(col.key as any)"
          >
            {{ col.label }}
            <Icon
              v-if="sortBy === col.key"
              :name="sortDir === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
              class="inline-block size-3 ml-0.5"
            />
          </button>
        </div>
      </div>

      <!-- ═══════ LOADING ═══════ -->
      <div v-if="loading" class="space-y-3 sm:space-y-4">
        <div v-for="i in 5" :key="i" class="h-16 sm:h-20 rounded-xl bg-muted/50 animate-pulse border border-border/30" />
      </div>

      <!-- ═══════ MAIN TABLE ═══════ -->
      <div v-else-if="filteredData.length" class="rounded-xl border border-border/50 overflow-hidden shadow-sm bg-card">
        <!-- Table header (desktop only) -->
        <div class="hidden sm:grid grid-cols-[1fr_120px_160px_120px_80px] gap-2 px-5 py-3 bg-muted/30 border-b border-border/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Employee</span>
          <span class="text-center">Progress</span>
          <span class="text-center">Skill Breakdown</span>
          <span class="text-right">Bonus Earned</span>
          <span class="text-center">Details</span>
        </div>

        <!-- Rows -->
        <div v-for="(row, idx) in filteredData" :key="row.employee._id" class="border-b border-border/20 last:border-0">
          <!-- Desktop row -->
          <div
            class="hidden sm:grid grid-cols-[1fr_120px_160px_120px_80px] gap-2 px-5 py-4 items-center transition-colors hover:bg-muted/10 cursor-pointer group"
            @click="toggleRow(row.employee._id)"
          >
            <!-- Employee info -->
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative shrink-0">
                <img
                  v-if="row.employee.profileImage"
                  :src="row.employee.profileImage"
                  :alt="row.employee.employee"
                  class="size-10 rounded-full object-cover ring-2 ring-background shadow-sm"
                />
                <div
                  v-else
                  class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-background shadow-sm"
                >
                  {{ row.employee.employee.charAt(0).toUpperCase() }}
                </div>
                <!-- Rank badge for top 3 -->
                <div
                  v-if="idx < 3 && sortBy === 'bonus' && sortDir === 'desc'"
                  class="absolute -top-1 -right-1 size-5 rounded-full flex items-center justify-center text-[9px] font-black shadow-md ring-1 ring-background"
                  :class="idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : 'bg-orange-400 text-white'"
                >
                  {{ idx + 1 }}
                </div>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-semibold truncate">{{ row.employee.employee }}</p>
                  <button @click.stop="navigateTo(`/my-profile?employee=${row.employee._id}`)" title="View Profile" class="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-1 rounded-md hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <Icon name="i-lucide-eye" class="size-3.5" />
                  </button>
                </div>
                <p class="text-[10px] text-muted-foreground truncate">{{ row.employee.position || 'Employee' }}</p>
              </div>
            </div>

            <!-- Progress bar -->
            <div class="flex flex-col items-center gap-1.5">
              <div class="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                <div class="h-full bg-emerald-500 transition-all duration-700" :style="{ width: `${row.totalSkills ? (row.masteredCount / row.totalSkills) * 100 : 0}%` }" />
                <div class="h-full bg-blue-500 transition-all duration-700" :style="{ width: `${row.totalSkills ? (row.proficientCount / row.totalSkills) * 100 : 0}%` }" />
              </div>
              <span class="text-[10px] text-muted-foreground font-medium tabular-nums">
                {{ row.totalAssessed }}/{{ row.totalSkills }}
              </span>
            </div>

            <!-- Skill breakdown -->
            <div class="flex items-center justify-center gap-3">
              <div class="flex items-center gap-1">
                <span class="size-2 rounded-full bg-emerald-500" />
                <span class="text-xs font-semibold text-emerald-500 tabular-nums">{{ row.masteredCount }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="size-2 rounded-full bg-blue-500" />
                <span class="text-xs font-semibold text-blue-500 tabular-nums">{{ row.proficientCount }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="size-2 rounded-full bg-muted-foreground/30" />
                <span class="text-xs font-medium text-muted-foreground tabular-nums">{{ row.totalAssessed - row.masteredCount - row.proficientCount }}</span>
              </div>
            </div>

            <!-- Bonus amount -->
            <div class="text-right">
              <div v-if="row.totalBonus > 0" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-sm tabular-nums">
                <Icon name="i-lucide-coins" class="size-3.5" />
                {{ fmt(row.totalBonus) }}
              </div>
              <span v-else class="text-xs text-muted-foreground/40 font-medium">$0.00</span>
            </div>

            <!-- Expand toggle -->
            <div class="flex items-center justify-center">
              <button class="size-7 rounded-lg flex items-center justify-center hover:bg-muted/60 transition-all">
                <Icon
                  name="i-lucide-chevron-right"
                  class="size-4 text-muted-foreground transition-transform duration-200"
                  :class="expandedRows.has(row.employee._id) ? 'rotate-90' : ''"
                />
              </button>
            </div>
          </div>

          <!-- Mobile card row -->
          <div
            class="sm:hidden px-3 py-3 transition-colors hover:bg-muted/10 cursor-pointer"
            @click="toggleRow(row.employee._id)"
          >
            <!-- Top: Avatar + Name + Bonus -->
            <div class="flex items-center gap-2.5">
              <div class="relative shrink-0">
                <img
                  v-if="row.employee.profileImage"
                  :src="row.employee.profileImage"
                  :alt="row.employee.employee"
                  class="size-10 rounded-full object-cover ring-2 ring-background shadow-sm"
                />
                <div
                  v-else
                  class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-background shadow-sm"
                >
                  {{ row.employee.employee.charAt(0).toUpperCase() }}
                </div>
                <div
                  v-if="idx < 3 && sortBy === 'bonus' && sortDir === 'desc'"
                  class="absolute -top-1 -right-1 size-4 rounded-full flex items-center justify-center text-[8px] font-black shadow-md ring-1 ring-background"
                  :class="idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : 'bg-orange-400 text-white'"
                >
                  {{ idx + 1 }}
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-sm font-semibold truncate">{{ row.employee.employee }}</p>
                  <button @click.stop="navigateTo(`/my-profile?employee=${row.employee._id}`)" title="View Profile" class="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-1 rounded-md hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <Icon name="i-lucide-eye" class="size-3.5" />
                  </button>
                </div>
                <p class="text-[10px] text-muted-foreground">{{ row.employee.position || 'Employee' }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div v-if="row.totalBonus > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-xs tabular-nums">
                  <Icon name="i-lucide-coins" class="size-3" />
                  {{ fmt(row.totalBonus) }}
                </div>
                <span v-else class="text-[10px] text-muted-foreground/40">$0.00</span>
                <Icon
                  name="i-lucide-chevron-right"
                  class="size-4 text-muted-foreground transition-transform duration-200 shrink-0"
                  :class="expandedRows.has(row.employee._id) ? 'rotate-90' : ''"
                />
              </div>
            </div>
            <!-- Bottom: Progress bar + skill dots -->
            <div class="flex items-center gap-2.5 mt-2 pl-[50px]">
              <div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden flex">
                <div class="h-full bg-emerald-500 transition-all duration-700" :style="{ width: `${row.totalSkills ? (row.masteredCount / row.totalSkills) * 100 : 0}%` }" />
                <div class="h-full bg-blue-500 transition-all duration-700" :style="{ width: `${row.totalSkills ? (row.proficientCount / row.totalSkills) * 100 : 0}%` }" />
              </div>
              <span class="text-[9px] text-muted-foreground tabular-nums shrink-0">{{ row.totalAssessed }}/{{ row.totalSkills }}</span>
              <div class="flex items-center gap-2 shrink-0">
                <div class="flex items-center gap-0.5">
                  <span class="size-1.5 rounded-full bg-emerald-500" />
                  <span class="text-[9px] font-semibold text-emerald-500 tabular-nums">{{ row.masteredCount }}</span>
                </div>
                <div class="flex items-center gap-0.5">
                  <span class="size-1.5 rounded-full bg-blue-500" />
                  <span class="text-[9px] font-semibold text-blue-500 tabular-nums">{{ row.proficientCount }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ═══════ EXPANDED DETAIL — Signal-style ═══════ -->
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 max-h-0"
            enter-to-class="opacity-100 max-h-[4000px]"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 max-h-[4000px]"
            leave-to-class="opacity-0 max-h-0"
          >
            <div v-if="expandedRows.has(row.employee._id)" class="overflow-hidden">
              <div class="px-3 sm:px-5 pb-3 sm:pb-5 pt-0">
                <div class="space-y-3">

                  <!-- ── Category accordion cards ── -->
                  <div
                    v-for="(cat, catIdx) in row.categories"
                    :key="cat.id"
                    class="rounded-xl border overflow-hidden transition-all hover:shadow-sm"
                    :class="pal(catIdx).border"
                  >
                    <!-- Category header (clickable accordion) -->
                    <div
                      role="button"
                      tabindex="0"
                      class="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer select-none hover:bg-muted/20 transition-colors"
                      @click.stop="toggleCat(row.employee._id, cat.id)"
                    >
                      <Icon
                        name="i-lucide-chevron-right"
                        class="size-3.5 text-muted-foreground transition-transform duration-200 shrink-0"
                        :class="expandedCats.has(`${row.employee._id}::${cat.id}`) ? 'rotate-90' : ''"
                      />
                      <div class="size-6 rounded-lg flex items-center justify-center shrink-0" :class="pal(catIdx).bg">
                        <Icon name="i-lucide-layers" class="size-3" :class="pal(catIdx).text" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <span class="text-xs sm:text-sm font-semibold" :class="pal(catIdx).text">{{ cat.name }}</span>
                        <span class="text-[9px] sm:text-[10px] text-muted-foreground ml-2">{{ cat.subCategories.length }} sub-categories</span>
                      </div>
                      <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                        <!-- Mini progress bar -->
                        <div class="hidden sm:flex items-center gap-1.5">
                          <div class="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              class="h-full rounded-full transition-all duration-700"
                              :class="pal(catIdx).bar"
                              :style="{ width: `${cat.total ? (cat.ruleCompliant / cat.total) * 100 : 0}%` }"
                            />
                          </div>
                          <span class="text-[9px] font-mono text-muted-foreground tabular-nums">{{ cat.assessed }}/{{ cat.total }}</span>
                        </div>
                        <div v-if="cat.bonus > 0 || cat.maxBonus > 0" class="flex items-center gap-2">
                          <!-- Earned / Max Bonus -->
                          <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-[10px] sm:text-xs tabular-nums">
                            <Icon name="i-lucide-coins" class="size-2.5" />
                            {{ fmt(cat.bonus) }} <span class="text-amber-500/60 font-medium text-[9px] sm:text-[10px]">/ {{ fmt(cat.maxBonus) }}</span>
                          </div>
                        </div>
                        <span v-else class="text-[10px] text-muted-foreground/30">$0.00</span>
                      </div>
                    </div>

                    <!-- Category expanded content — Signal uptime-style service cards -->
                    <Transition
                      enter-active-class="transition-all duration-200 ease-out"
                      enter-from-class="opacity-0 -translate-y-1"
                      enter-to-class="opacity-100 translate-y-0"
                      leave-active-class="transition-all duration-150 ease-in"
                      leave-from-class="opacity-100 translate-y-0"
                      leave-to-class="opacity-0 -translate-y-1"
                    >
                      <div v-if="expandedCats.has(`${row.employee._id}::${cat.id}`)" class="border-t border-border/20">
                        <div class="divide-y divide-border/15">
                          <div
                            v-for="sub in cat.subCategories"
                            :key="sub.id"
                            class="px-3 sm:px-5 py-3 sm:py-4 space-y-2.5 hover:bg-muted/5 transition-colors"
                          >
                            <!-- Service header row -->
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div class="flex items-center gap-2.5">
                                <span
                                  class="size-2.5 rounded-full shrink-0"
                                  :class="subStatus(sub) === 'all-complete'
                                    ? 'bg-emerald-500 ring-2 ring-emerald-500/30'
                                    : subStatus(sub) === 'has-progress'
                                      ? 'bg-blue-500 ring-2 ring-blue-500/30'
                                      : 'bg-zinc-600'"
                                />
                                <div>
                                  <h4 class="text-[13px] font-semibold">{{ sub.name }}</h4>
                                  <p class="text-[10px] font-mono text-muted-foreground/70">
                                    {{ sub.ruleCompliant }}/{{ sub.total }} skills
                                    <span v-if="sub.ruleLevel"> at {{ sub.ruleLevel }}+</span>
                                  </p>
                                </div>
                              </div>
                              <!-- Stats columns like Signal uptime cards -->
                              <div class="flex items-center gap-4 sm:gap-5 text-xs">
                                <div v-if="sub.mastered" class="text-center">
                                  <p class="font-semibold text-emerald-500 tabular-nums">{{ sub.mastered }}</p>
                                  <p class="text-[9px] text-muted-foreground">Mastered</p>
                                </div>
                                <div v-if="sub.proficient" class="text-center">
                                  <p class="font-semibold text-blue-500 tabular-nums">{{ sub.proficient }}</p>
                                  <p class="text-[9px] text-muted-foreground">Proficient</p>
                                </div>
                                <div v-if="sub.needs" class="text-center">
                                  <p class="font-semibold text-amber-500 tabular-nums">{{ sub.needs }}</p>
                                  <p class="text-[9px] text-muted-foreground">Needs Imp.</p>
                                </div>
                                <div class="text-center">
                                  <p
                                    class="font-semibold tabular-nums"
                                    :class="sub.total ? (sub.ruleCompliant === sub.total ? 'text-emerald-500' : 'text-foreground') : 'text-muted-foreground'"
                                  >
                                    {{ sub.total ? Math.round((sub.ruleCompliant / sub.total) * 100) : 0 }}%
                                  </p>
                                  <p class="text-[9px] text-muted-foreground">Complete</p>
                                </div>
                                <!-- Custom Bonus Button (Sub-Category level) -->
                                <button
                                  @click.stop="openCustomBonusModal(row.employee, sub)"
                                  class="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-violet-500 font-bold border text-[10px] transition-all group/btn"
                                  :class="sub.customBonus > 0 ? 'bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20' : 'border-transparent hover:bg-violet-500/10 text-violet-500/50 hover:text-violet-500'"
                                  title="Add Custom Bonus"
                                >
                                  <Icon name="i-lucide-plus-circle" class="size-3" />
                                  <span v-if="sub.customBonus > 0">+{{ fmt(sub.customBonus) }}</span>
                                  <span v-else class="opacity-0 group-hover/btn:opacity-100 max-w-0 group-hover/btn:max-w-[100px] transition-all duration-300 overflow-hidden overflow-ellipsis whitespace-nowrap">Bonus</span>
                                </button>
                                <div v-if="sub.bonus > 0" class="text-center">
                                  <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 tabular-nums text-[11px]">
                                    <Icon name="i-lucide-coins" class="size-2.5" />
                                    {{ fmt(sub.bonus) }}
                                  </span>
                                </div>
                                <div v-if="sub.hasOverride" class="shrink-0">
                                  <span class="inline-flex items-center gap-0.5 text-[8px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20">
                                    <Icon name="i-lucide-sparkles" class="size-2" />
                                    Custom
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <!-- Per-rule status cards -->
                            <div v-if="sub.rulesToUse && sub.rulesToUse.length" class="space-y-1.5">
                              <div v-for="(rule, ri) in sub.rulesToUse" :key="ri" class="flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors"
                                :class="(() => {
                                  // Check if this specific rule is met
                                  const requiredLevelIdx = levelIndex(rule.skillSet)
                                  const requiredTimes = rule.reviewedTimes || 1
                                  const isUnique = rule.supervisorCheck === 'Unique'
                                  let met = true
                                  for (const sk of sub.skills) {
                                    const reviews = sk.reviews || []
                                    const qualifying = reviews.filter(r => levelIndex(r.level) >= requiredLevelIdx)
                                    if (qualifying.length < requiredTimes) { met = false; break }
                                    if (isUnique && new Set(qualifying.map(r => r.reviewer)).size < requiredTimes) { met = false; break }
                                  }
                                  return met
                                    ? 'bg-emerald-500/5 border-emerald-500/20'
                                    : 'bg-muted/20 border-border/30'
                                })()"
                              >
                                <!-- Status dot -->
                                <span
                                  class="size-2.5 rounded-full shrink-0 ring-2"
                                  :class="(() => {
                                    const requiredLevelIdx = levelIndex(rule.skillSet)
                                    const requiredTimes = rule.reviewedTimes || 1
                                    const isUnique = rule.supervisorCheck === 'Unique'
                                    let met = true
                                    for (const sk of sub.skills) {
                                      const reviews = sk.reviews || []
                                      const qualifying = reviews.filter(r => levelIndex(r.level) >= requiredLevelIdx)
                                      if (qualifying.length < requiredTimes) { met = false; break }
                                      if (isUnique && new Set(qualifying.map(r => r.reviewer)).size < requiredTimes) { met = false; break }
                                    }
                                    return met ? 'bg-emerald-500 ring-emerald-500/30' : 'bg-zinc-600 ring-zinc-600/30'
                                  })()"
                                />
                                <!-- Rule description -->
                                <div class="flex-1 min-w-0">
                                  <div class="flex items-center gap-1.5 text-xs">
                                    <span class="font-semibold" :class="rule.skillSet === 'Mastered' ? 'text-emerald-500' : rule.skillSet === 'Proficient' ? 'text-blue-500' : 'text-amber-500'">{{ rule.skillSet }}</span>
                                    <span class="text-muted-foreground">—</span>
                                    <span class="text-muted-foreground">{{ rule.reviewedTimes || 1 }} review{{ (rule.reviewedTimes || 1) > 1 ? 's' : '' }} by {{ rule.supervisorCheck === 'Unique' ? 'unique supervisors' : 'any supervisor' }}</span>
                                  </div>
                                  <!-- Per-skill progress for this rule -->
                                  <div class="flex flex-col gap-0.5 mt-1">
                                    <div v-for="sk in sub.skills" :key="sk.id" class="flex items-center gap-1.5 text-[9px]">
                                      <span
                                        class="size-1.5 rounded-full shrink-0"
                                        :class="(() => {
                                          const requiredLevelIdx = levelIndex(rule.skillSet)
                                          const requiredTimes = rule.reviewedTimes || 1
                                          const isUnique = rule.supervisorCheck === 'Unique'
                                          const reviews = sk.reviews || []
                                          const qualifying = reviews.filter(r => levelIndex(r.level) >= requiredLevelIdx)
                                          if (qualifying.length < requiredTimes) return 'bg-zinc-600'
                                          if (isUnique && new Set(qualifying.map(r => r.reviewer)).size < requiredTimes) return 'bg-zinc-600'
                                          return 'bg-emerald-500'
                                        })()"
                                      />
                                      <span class="text-muted-foreground">{{ sk.name }}</span>
                                    </div>
                                  </div>
                                </div>
                                <!-- Bonus amount -->
                                <span class="text-amber-500 font-bold text-xs tabular-nums shrink-0">{{ fmt(rule.bonusAmount || 0) }}</span>
                                <span v-if="sub.hasOverride" class="text-[7px] uppercase tracking-wider text-violet-500 font-semibold shrink-0">Custom</span>
                              </div>
                            </div>

                            <!-- Skill status bar (1 segment per actual skill) -->
                            <div v-if="sub.skills.length" class="flex gap-[2px]">
                              <div
                                v-for="sk in sub.skills"
                                :key="sk.id"
                                class="h-7 flex-1 rounded-[3px] transition-all duration-500 relative group/bar cursor-default"
                                :class="skillBarColor[sk.status]"
                              >
                                <!-- Tooltip on hover -->
                                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 rounded-lg bg-popover border border-border shadow-xl opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20 min-w-[220px] max-w-[360px]">
                                  <!-- Skill name header -->
                                  <div class="px-3 py-1.5 border-b border-border/50">
                                    <p class="text-[11px] font-semibold">{{ sk.name }}</p>
                                    <p class="text-[9px] capitalize" :class="sk.status === 'mastered' ? 'text-emerald-500' : sk.status === 'proficient' ? 'text-blue-500' : sk.status === 'needs' ? 'text-amber-500' : 'text-muted-foreground'">{{ sk.status === 'needs' ? 'Needs Improvement' : sk.status }}</p>
                                  </div>
                                  <!-- Reviewer list -->
                                  <div v-if="sk.reviews.length" class="px-3 py-1.5 space-y-1">
                                    <div v-for="(rev, ri) in sk.reviews" :key="ri" class="flex items-center gap-2 text-[10px]">
                                      <div
                                        class="size-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                                        :class="rev.level === 'Mastered' ? 'bg-emerald-500/20 text-emerald-500' : rev.level === 'Proficient' ? 'bg-blue-500/20 text-blue-500' : 'bg-amber-500/20 text-amber-500'"
                                      >
                                        {{ rev.reviewer.charAt(0).toUpperCase() }}
                                      </div>
                                      <span class="flex-1 truncate font-medium">{{ rev.reviewer }}</span>
                                      <span class="text-muted-foreground/60 shrink-0 tabular-nums">{{ fmtDate(rev.date) }}</span>
                                    </div>
                                  </div>
                                  <div v-else class="px-3 py-2 text-[10px] text-muted-foreground/50 italic">
                                    No reviews yet
                                  </div>
                                </div>
                              </div>
                            </div>
                            <!-- Timeline labels under bar -->
                            <div v-if="sub.skills.length > 1" class="flex justify-between text-[9px] text-muted-foreground/40">
                              <span>{{ sub.skills[0]?.name }}</span>
                              <span>{{ sub.skills[sub.skills.length - 1]?.name }}</span>
                            </div>
                            <div v-else-if="sub.skills.length === 1" class="text-[9px] text-muted-foreground/40">
                              {{ sub.skills[0]?.name }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Transition>
                  </div>

                  <!-- Expanded footer -->
                  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-2 px-1">
                    <div class="flex items-center gap-2 text-xs pl-2 sm:pl-0">
                      <span class="text-muted-foreground">Total:</span>
                      <span class="font-bold text-amber-500 text-sm tabular-nums">{{ fmt(row.totalBonus) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- ═══════ EMPTY ═══════ -->
      <div v-else-if="!loading" class="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
        <div class="size-16 sm:size-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center mb-4 sm:mb-5">
          <Icon name="i-lucide-trophy" class="size-7 sm:size-10 text-amber-500" />
        </div>
        <h3 class="text-lg sm:text-xl font-bold mb-2">No bonus data available</h3>
        <p class="text-xs sm:text-sm text-muted-foreground max-w-sm">
          Start assessing employees on the Employee Performance page to see bonus calculations here.
        </p>
      </div>

      <!-- ═══════ LEGEND ═══════ -->
      <div v-if="!loading && filteredData.length" class="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[9px] sm:text-[10px] text-muted-foreground py-2">
        <div class="flex items-center gap-1.5">
          <span class="size-2 sm:size-2.5 rounded-sm bg-emerald-500" />
          Mastered
        </div>
        <div class="flex items-center gap-1.5">
          <span class="size-2 sm:size-2.5 rounded-sm bg-blue-500" />
          Proficient
        </div>
        <div class="flex items-center gap-1.5">
          <span class="size-2 sm:size-2.5 rounded-sm bg-amber-500" />
          Needs Imp.
        </div>
        <div class="flex items-center gap-1.5">
          <span class="size-2 sm:size-2.5 rounded-sm bg-zinc-700" />
          Unreviewed
        </div>
        <div class="flex items-center gap-1.5">
          <span class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20 text-[7px] sm:text-[8px] font-semibold">
            <Icon name="i-lucide-sparkles" class="size-1.5 sm:size-2" />
            Custom
          </span>
          Override rules
        </div>
      </div>
    </div>

    <!-- ═══════ MAX POTENTIAL MODAL ═══════ -->
    <Dialog v-model:open="showMaxBonusModal">
      <DialogContent class="sm:max-w-2xl bg-gradient-to-b from-card to-background p-0 overflow-hidden border-pink-500/20 shadow-[0_0_50px_-12px_rgba(236,72,153,0.25)]">
        <!-- Header with shiny background -->
        <div class="relative px-6 py-8 overflow-hidden bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent border-b border-pink-500/10">
          <div class="absolute -inset-1 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-fuchsia-500/20 blur-2xl opacity-50 pointer-events-none"></div>
          <div class="relative z-10 flex flex-col items-center text-center gap-3">
            <div class="size-16 rounded-3xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shadow-inner">
              <Icon name="i-lucide-rocket" class="size-8 text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)] animate-bounce" />
            </div>
            <div>
              <DialogTitle class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 drop-shadow-sm flex items-center justify-center gap-2">
                Max Potential Calculation
                <Icon name="i-lucide-sparkles" class="size-5 text-purple-400" />
              </DialogTitle>
              <DialogDescription class="mt-1.5 text-sm text-pink-600/70 dark:text-pink-400/70 max-w-sm mx-auto">
                A detailed breakdown of how the {{ fmt(maxPotentialBonus) }} per-employee capability ceiling is calculated across all active skills.
              </DialogDescription>
            </div>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="px-6 py-4 border-b border-border/50 bg-background/50 relative z-10">
          <div class="relative">
            <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input v-model="maxBonusSearchQuery" placeholder="Search categories, sub-categories, or skills..." class="pl-9 h-10 bg-muted/30 border-pink-500/20 focus-visible:ring-pink-500/30" />
          </div>
        </div>

        <!-- Scrollable breakdown -->
        <div class="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-5 relative z-10">
          <!-- Categories -->
          <div v-for="cat in filteredMaxPotentialCategories" :key="cat.name" class="space-y-3">
            <!-- Category Header -->
            <div 
              class="flex items-center justify-between pb-1.5 border-b border-border/40 cursor-pointer group"
              @click="toggleMaxBonusCat(cat.name)"
            >
              <h3 class="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider group-hover:text-pink-500 transition-colors">
                <Icon 
                  name="i-lucide-chevron-right" 
                  class="size-4 text-muted-foreground transition-transform duration-200" 
                  :class="maxBonusSearchQuery || expandedMaxBonusCats.has(cat.name) ? 'rotate-90' : ''"
                />
                <Icon name="i-lucide-layers" class="size-4 text-pink-500" />
                {{ cat.name }}
              </h3>
              <span class="text-xs font-black text-amber-500 tabular-nums bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">+{{ fmt(cat.totalBonus) }}</span>
            </div>

            <!-- Sub Categories -->
            <div 
              v-show="maxBonusSearchQuery || expandedMaxBonusCats.has(cat.name)"
              class="space-y-3 pl-1 sm:pl-3"
            >
              <div v-for="sub in cat.subCategories" :key="sub.name" class="rounded-xl border border-border/50 bg-muted/10 overflow-hidden shadow-sm hover:shadow-md hover:border-pink-500/30 transition-all duration-300">
                <div class="flex items-center gap-3 p-3 bg-muted/20 border-b border-border/50 group">
                  <div class="size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors" :class="sub.source === 'override' ? 'bg-violet-500/10 border border-violet-500/20 text-violet-500 group-hover:bg-violet-500/20' : 'bg-muted border border-border/40 text-muted-foreground group-hover:text-foreground'">
                      <Icon :name="sub.source === 'override' ? 'i-lucide-zap' : 'i-lucide-tag'" class="size-4" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-semibold truncate text-foreground">{{ sub.name }}</p>
                    <p class="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span v-if="sub.source === 'override'" class="text-violet-500 font-medium">Custom Override Rule</span>
                      <span v-else>Global Bonus Rule</span>
                    </p>
                  </div>
                  <div class="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-600 dark:text-pink-400 tabular-nums">
                     <span class="text-[11px] font-bold leading-none">+{{ fmt(sub.maxRule) }}</span>
                  </div>
                </div>
                
                <!-- Skills -->
                <div class="p-3 bg-background/50">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    <div v-for="sk in sub.skills" :key="sk.name" class="flex items-start gap-2">
                      <span class="size-1.5 rounded-full bg-pink-500/40 shrink-0 mt-1.5"></span>
                      <span class="text-[11px] text-muted-foreground/90 leading-tight">{{ sk.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!filteredMaxPotentialCategories.length" class="flex flex-col items-center justify-center py-8 text-center">
            <div class="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <Icon name="i-lucide-search-x" class="size-5 text-muted-foreground" />
            </div>
            <p class="text-sm font-medium">No matching items found</p>
            <p class="text-xs text-muted-foreground mt-1">Try a different search term</p>
          </div>
        </div>

        <!-- Footer Total -->
        <div class="px-6 py-4 border-t border-border/50 bg-muted/10 flex items-center justify-between z-10 relative">
          <p class="text-sm font-medium text-muted-foreground">Total Potential</p>
          <p class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 drop-shadow-sm tabular-nums">{{ fmt(maxPotentialBonus) }}</p>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ═══════ CUSTOM BONUS MODAL ═══════ -->
    <Dialog v-model:open="showCustomBonusModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-award" class="size-5 text-violet-500" />
            Custom Bonus Award
          </DialogTitle>
          <DialogDescription>
            Add an additional manual bonus for <span class="font-bold text-foreground">{{ customBonusEmp?.employee }}</span> in the <span class="font-bold text-foreground">{{ customBonusSub?.name }}</span> sub-category.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="flex flex-col gap-2">
            <Label>Bonus Amount (USD)</Label>
            <div class="relative">
              <Icon name="i-lucide-dollar-sign" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                type="number"
                v-model.number="customBonusAmount"
                class="pl-9 text-lg font-bold text-amber-500 h-12"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <Label>Reason / Note (Optional)</Label>
            <Textarea
              v-model="customBonusReason"
              placeholder="E.g. Exceptional performance during the week..."
              class="resize-none"
              rows="3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showCustomBonusModal = false" :disabled="savingCustomBonus">Cancel</Button>
          <Button @click="saveCustomBonus" class="bg-violet-500 hover:bg-violet-600 text-white" :disabled="savingCustomBonus">
            <Icon v-if="savingCustomBonus" name="i-lucide-loader-2" class="size-4 animate-spin mr-2" />
            <Icon v-else name="i-lucide-check" class="size-4 mr-2" />
            Save Bonus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
