<script setup lang="ts">
import { computed, ref } from 'vue'

const { setHeader } = usePageHeader()
setHeader({ title: 'My Profile', icon: 'i-lucide-user-circle', description: 'View your profile and track skill growth' })

const userCookie = useCookie<{ _id: string, employee: string, email: string, profileImage: string, position: string } | null>('hardwood_user')
const currentUserId = computed(() => userCookie.value?._id)
const userProfile = computed(() => userCookie.value)

const activeTab = ref('summary')

// Data fetching
const { data: recordsData, pending: loadingRecords } = await useFetch('/api/performance', {
  lazy: true,
  transform: (res: any) => res.data?.filter((r: any) => r.employee === currentUserId.value) || []
})

const { data: treeData, pending: loadingTree } = await useFetch('/api/skills/tree', {
  lazy: true,
  transform: (res: any) => res.data || []
})

const { data: bonusRulesData, pending: loadingRules } = await useFetch('/api/skill-bonus', {
  lazy: true,
  transform: (res: any) => res.data || []
})

// Utilities
function levelIndex(lvl: string) {
  return ['Needs Improvement', 'Proficient', 'Mastered'].indexOf(lvl)
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Highest Performance per skill (over multiple reviewers) ────────
const highestPerfMap = computed(() => {
  const map = new Map<string, any>()
  if (!recordsData.value) return map
  for (const r of recordsData.value) {
    const existing = map.get(r.skill)
    if (!existing || levelIndex(r.currentSkillLevel) > levelIndex(existing.currentSkillLevel)) {
      map.set(r.skill, r)
    }
  }
  return map
})

// ─── Progress Summary (Total Skills, Needs Imp, Proficient, Mastered) ────────
const summaryCounts = computed(() => {
  const counts = { needsImp: 0, proficient: 0, mastered: 0, totalAssessed: 0 }
  for (const r of highestPerfMap.value.values()) {
    counts.totalAssessed++
    if (r.currentSkillLevel === 'Mastered') counts.mastered++
    else if (r.currentSkillLevel === 'Proficient') counts.proficient++
    else counts.needsImp++
  }
  return counts
})

const totalSystemSkills = computed(() => {
  if (!treeData.value) return 0
  return treeData.value.reduce((sum: number, cat: any) => 
    sum + cat.subCategories.reduce((s2: number, sub: any) => s2 + sub.skills.length, 0), 0)
})

// ─── Growth Timeline ────────
const timelineEvents = computed(() => {
  if (!recordsData.value) return []
  const map = new Map<string, any[]>()
  
  // Only show progress events
  const gains = recordsData.value.filter((r: any) => r.currentSkillLevel === 'Proficient' || r.currentSkillLevel === 'Mastered')
  
  // Sort oldest to newest for chronological growth, or newest to oldest. Let's do newest to oldest
  const sorted = [...gains].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  for(const r of sorted) {
    const dateStr = formatDate(r.createdAt)
    if(!map.has(dateStr)) map.set(dateStr, [])
    map.get(dateStr)!.push(r)
  }
  
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
})

// ─── Bonus Report ────────
const bonusReport = computed(() => {
  if (!treeData.value) return []
  const rules = bonusRulesData.value || []

  // Create skill reviews map
  const skillReviewsMap = new Map<string, any[]>()
  for (const r of (recordsData.value || [])) {
     if (!skillReviewsMap.has(r.skill)) skillReviewsMap.set(r.skill, [])
     skillReviewsMap.get(r.skill)!.push(r)
  }

  const report = []

  for (const cat of treeData.value) {
    for (const sub of cat.subCategories) {
      const skillsInSub = sub.skills
      const totalSkills = skillsInSub.length
      
      let cntProficient = 0
      let cntMastered = 0

      // Calculate Proficient/Mastered based on highest map
      for (const sk of skillsInSub) {
         const highestR = highestPerfMap.value.get(sk._id)
         if (highestR) {
           if (highestR.currentSkillLevel === 'Mastered') cntMastered++
           else if (highestR.currentSkillLevel === 'Proficient') cntProficient++
         }
      }

      // Calculate Bonus Earned based on Rules
      let maxBonus = 0
      if (totalSkills > 0) {
        for (const rule of rules) {
           const requiredLevelIdx = levelIndex(rule.skillSet)
           const requiredTimes = rule.reviewedTimes || 1
           const isUnique = rule.supervisorCheck === 'Unique'

           let ruleMet = true
           for (const sk of skillsInSub) {
              const reviews = skillReviewsMap.get(sk._id) || []
              const qualifying = reviews.filter(r => levelIndex(r.currentSkillLevel) >= requiredLevelIdx)
              
              if (qualifying.length < requiredTimes) {
                 ruleMet = false
                 break
              }

              if (isUnique) {
                 const uniqueReviewers = new Set(qualifying.map(r => r.createdBy))
                 if (uniqueReviewers.size < requiredTimes) {
                    ruleMet = false
                    break
                 }
              }
           }

           if (ruleMet) {
              maxBonus = Math.max(maxBonus, rule.bonusAmount || 0)
           }
        }
      }

      report.push({
         id: sub._id,
         name: sub.name,
         categoryName: cat.name,
         totalSkills,
         cntProficient,
         cntMastered,
         bonusEarned: maxBonus
      })
    }
  }

  return report.sort((a,b) => {
    if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName)
    return a.name.localeCompare(b.name)
  })
})

const bonusReportByCategory = computed(() => {
  const grouped = new Map<string, { id: string, name: string, totalCategoryBonus: number, subCategories: any[] }>()
  
  for (const item of bonusReport.value) {
    if (!grouped.has(item.categoryName)) {
      grouped.set(item.categoryName, {
        id: item.categoryName,
        name: item.categoryName,
        totalCategoryBonus: 0,
        subCategories: []
      })
    }
    const catGroup = grouped.get(item.categoryName)!
    catGroup.subCategories.push(item)
    catGroup.totalCategoryBonus += item.bonusEarned
  }
  
  return Array.from(grouped.values()).sort((a,b) => a.name.localeCompare(b.name))
})

const totalBonusEarned = computed(() => {
  return bonusReport.value.reduce((sum, item) => sum + item.bonusEarned, 0)
})

const expandedCategories = ref<Set<string>>(new Set())

function toggleCategory(catName: string) {
  if (expandedCategories.value.has(catName)) {
    expandedCategories.value.delete(catName)
  } else {
    expandedCategories.value.add(catName)
  }
}

const tabs = [
  { id: 'summary', label: 'Progress Summary', icon: 'i-lucide-pie-chart' },
  { id: 'growth', label: 'My Growth Rate', icon: 'i-lucide-trending-up' },
  { id: 'bonus', label: 'Bonus Report', icon: 'i-lucide-award' },
]
</script>

<template>
  <div class="px-5 py-6 space-y-8 max-w-7xl mx-auto h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <!-- Header banner -->
    <div class="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none" />
      <div class="px-8 py-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
        <div class="size-28 rounded-full bg-background border-4 border-background shadow-lg overflow-hidden shrink-0">
          <img v-if="userProfile?.profileImage" :src="userProfile.profileImage" :alt="userProfile.employee" class="size-full object-cover" />
          <div v-else class="size-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
            {{ userProfile?.employee?.charAt(0).toUpperCase() || 'U' }}
          </div>
        </div>
        <div class="flex-1 text-center md:text-left mt-2">
          <h1 class="text-3xl font-bold tracking-tight">{{ userProfile?.employee || 'Unknown User' }}</h1>
          <p class="text-muted-foreground mt-1">{{ userProfile?.email || 'No email' }}</p>
          <div class="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Icon name="i-lucide-briefcase" class="size-4" />
            {{ userProfile?.position || 'Employee' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Main Layout: Sidebar + Content -->
    <div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
      
      <!-- Sub-Sidebar Tabs -->
      <nav class="flex flex-col gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex items-center gap-3 px-4 py-3 rounded-xl text-left font-medium transition-all duration-200 border"
          :class="activeTab === tab.id 
            ? 'bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]' 
            : 'bg-card text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'"
          @click="activeTab = tab.id"
        >
          <Icon :name="tab.icon" class="size-5 shrink-0" />
          {{ tab.label }}
        </button>
      </nav>

      <!-- Content Area -->
      <div class="min-h-[400px]">
        
        <!-- Loading -->
        <div v-if="loadingRecords || loadingTree || loadingRules" class="flex flex-col items-center justify-center h-full py-20 text-muted-foreground gap-4">
          <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
          <p>Loading your profile data...</p>
        </div>

        <template v-else>
          <!-- 1. Progress Summary Tab -->
          <div v-if="activeTab === 'summary'" class="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <h2 class="text-2xl font-bold">Progress Summary</h2>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <!-- Total -->
              <div class="rounded-xl border border-border/50 bg-card p-5 relative overflow-hidden group">
                <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <p class="text-sm font-medium text-muted-foreground">Total Skills</p>
                <div class="mt-2 flex items-baseline gap-2">
                  <span class="text-4xl font-black">{{ totalSystemSkills }}</span>
                </div>
              </div>

              <!-- Mastered -->
              <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-20"><Icon name="i-lucide-award" class="size-16 text-emerald-500" /></div>
                <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400 relative z-10">Mastered</p>
                <div class="mt-2 flex items-baseline gap-2 relative z-10">
                  <span class="text-4xl font-black text-emerald-600 dark:text-emerald-400">{{ summaryCounts.mastered }}</span>
                </div>
              </div>

              <!-- Proficient -->
              <div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-20"><Icon name="i-lucide-check-circle-2" class="size-16 text-blue-500" /></div>
                <p class="text-sm font-medium text-blue-600 dark:text-blue-400 relative z-10">Proficient</p>
                <div class="mt-2 flex items-baseline gap-2 relative z-10">
                  <span class="text-4xl font-black text-blue-600 dark:text-blue-400">{{ summaryCounts.proficient }}</span>
                </div>
              </div>

              <!-- Needs Improvement -->
              <div class="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-20"><Icon name="i-lucide-arrow-up-circle" class="size-16 text-amber-500" /></div>
                <p class="text-sm font-medium text-amber-600 dark:text-amber-400 relative z-10">Needs Imp.</p>
                <div class="mt-2 flex items-baseline gap-2 relative z-10">
                  <span class="text-4xl font-black text-amber-600 dark:text-amber-400">{{ summaryCounts.needsImp }}</span>
                </div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="rounded-xl border border-border/50 bg-card p-6">
              <h3 class="text-sm font-medium mb-4">Overall Completion</h3>
              <div class="w-full h-4 rounded-full bg-muted overflow-hidden flex">
                <div 
                  class="h-full bg-emerald-500 transition-all duration-1000" 
                  :style="{ width: `${totalSystemSkills ? (summaryCounts.mastered / totalSystemSkills)*100 : 0}%` }"
                  title="Mastered"
                />
                <div 
                  class="h-full bg-blue-500 transition-all duration-1000" 
                  :style="{ width: `${totalSystemSkills ? (summaryCounts.proficient / totalSystemSkills)*100 : 0}%` }"
                  title="Proficient"
                />
                <div 
                  class="h-full bg-amber-500 transition-all duration-1000" 
                  :style="{ width: `${totalSystemSkills ? (summaryCounts.needsImp / totalSystemSkills)*100 : 0}%` }"
                  title="Needs Improvement"
                />
              </div>
              <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span class="font-medium text-foreground">
                  {{ totalSystemSkills ? Math.round(((summaryCounts.mastered + summaryCounts.proficient) / totalSystemSkills) * 100) : 0 }}% Proficient or higher
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <!-- 2. My Growth Rate Tab -->
          <div v-else-if="activeTab === 'growth'" class="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <h2 class="text-2xl font-bold">My Growth Rate</h2>
            <div class="rounded-xl border border-border/50 bg-card p-6">
              
              <div v-if="timelineEvents.length === 0" class="py-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <div class="size-16 rounded-full bg-muted flex items-center justify-center">
                  <Icon name="i-lucide-sprout" class="size-8 text-muted-foreground/50" />
                </div>
                <p>No growth events recorded yet.</p>
              </div>

              <div v-else class="relative border-l-2 border-border/60 ml-3 md:ml-6 space-y-8 pb-4">
                <div v-for="day in timelineEvents" :key="day.date" class="relative pl-6 md:pl-8">
                  <!-- Date marker -->
                  <div class="absolute -left-[9px] top-1 size-4 rounded-full bg-background border-2 border-primary ring-4 ring-background" />
                  
                  <h3 class="font-semibold text-lg text-foreground mb-4">{{ day.date }}</h3>
                  
                  <div class="space-y-3">
                    <div 
                      v-for="item in day.items" 
                      :key="item._id"
                      class="rounded-lg border border-border/50 bg-muted/20 p-4 transition-all hover:bg-muted/40"
                    >
                      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div class="flex-1">
                          <p class="text-sm font-semibold">{{ item.skillName }}</p>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs text-muted-foreground">{{ item.categoryName }}</span>
                            <Icon name="i-lucide-chevron-right" class="size-3 text-muted-foreground/40" />
                            <span class="text-xs text-muted-foreground">{{ item.subCategoryName }}</span>
                          </div>
                        </div>
                        <div class="shrink-0 flex items-center gap-4">
                          <!-- The level badge -->
                          <div class="px-2.5 py-1 rounded-full border text-xs font-bold"
                            :class="item.currentSkillLevel === 'Mastered' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-blue-500/10 text-blue-500 border-blue-500/20'"
                          >
                            Achieved {{ item.currentSkillLevel }}
                          </div>
                          <!-- Reviewer -->
                          <div class="text-[10px] text-muted-foreground text-right">
                            Reviewed by<br/>
                            <span class="font-medium text-foreground">{{ item.createdByName }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Bonus Report Tab -->
          <div v-else-if="activeTab === 'bonus'" class="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 class="text-2xl font-bold flex items-center gap-2">
                <Icon name="i-lucide-award" class="text-amber-500" />
                Bonus Report
              </h2>
              
              <div class="flex items-center gap-3 px-4 py-2 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-sm">
                <div class="size-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Icon name="i-lucide-coins" class="size-4 text-amber-500" />
                </div>
                <div>
                  <p class="text-[10px] font-medium uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">Total Earned</p>
                  <p class="text-xl font-black text-amber-600 dark:text-amber-400 leading-none">${{ Number(totalBonusEarned).toFixed(2) }}</p>
                </div>
              </div>
            </div>
            
            <div class="space-y-4">
              <div v-if="bonusReportByCategory.length === 0" class="p-12 text-center text-muted-foreground rounded-xl border border-border/50 bg-card">
                <p>No skills reviewed yet.</p>
              </div>
              
              <div 
                v-for="catGroup in bonusReportByCategory" 
                :key="catGroup.id"
                class="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm transition-all"
              >
                <!-- Accordion Header -->
                <div 
                  role="button"
                  tabindex="0"
                  class="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer select-none"
                  @click="toggleCategory(catGroup.name)"
                >
                  <div class="flex items-center gap-3 w-full">
                    <Icon 
                      name="i-lucide-chevron-right" 
                      class="size-4 text-muted-foreground transition-transform duration-200"
                      :class="expandedCategories.has(catGroup.name) ? 'rotate-90' : ''"
                    />
                    <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <Icon name="i-lucide-layers" class="size-4 text-primary" />
                    </div>
                    <div class="flex-1">
                      <h3 class="font-semibold text-lg">{{ catGroup.name }}</h3>
                      <p class="text-xs text-muted-foreground mt-0.5">{{ catGroup.subCategories.length }} Sub-Categories</p>
                    </div>
                    <div v-if="catGroup.totalCategoryBonus > 0" class="shrink-0 text-right">
                      <p class="text-[10px] font-medium uppercase tracking-wider text-amber-500/80 mb-0.5">Category Bonus</p>
                      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-sm">
                        +${{ Number(catGroup.totalCategoryBonus).toFixed(2) }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Accordion Body -->
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="grid-rows-[0fr] opacity-0"
                  enter-to-class="grid-rows-[1fr] opacity-100"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="grid-rows-[1fr] opacity-100"
                  leave-to-class="grid-rows-[0fr] opacity-0"
                >
                  <div v-show="expandedCategories.has(catGroup.name)" class="grid" :class="expandedCategories.has(catGroup.name) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                    <div class="overflow-hidden border-t border-border/50">
                      <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                          <thead>
                            <tr class="bg-muted/20 border-b border-border/40">
                              <th class="px-5 py-3 text-left font-semibold text-xs tracking-wider uppercase text-muted-foreground">Sub-Category</th>
                              <th class="px-5 py-3 text-center font-semibold text-xs tracking-wider uppercase text-muted-foreground">Total Skills</th>
                              <th class="px-5 py-3 text-center font-semibold text-xs tracking-wider uppercase text-blue-500">Proficient</th>
                              <th class="px-5 py-3 text-center font-semibold text-xs tracking-wider uppercase text-emerald-500">Mastered</th>
                              <th class="px-5 py-3 text-center font-semibold text-xs tracking-wider uppercase text-amber-500">Bonus Earned</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-border/30">
                            <tr v-for="row in catGroup.subCategories" :key="row.id" class="hover:bg-muted/10 transition-colors">
                              <td class="px-5 py-3">
                                <p class="font-medium">{{ row.name }}</p>
                              </td>
                              <td class="px-5 py-3 text-center font-semibold text-muted-foreground">
                                {{ row.totalSkills }}
                              </td>
                              <td class="px-5 py-3 text-center">
                                <span v-if="row.cntProficient" class="inline-flex size-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20 text-xs">
                                  {{ row.cntProficient }}
                                </span>
                                <span v-else class="text-muted-foreground/30 font-medium">-</span>
                              </td>
                              <td class="px-5 py-3 text-center">
                                <span v-if="row.cntMastered" class="inline-flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20 text-xs">
                                  {{ row.cntMastered }}
                                </span>
                                <span v-else class="text-muted-foreground/30 font-medium">-</span>
                              </td>
                              <td class="px-5 py-3 text-center">
                                <div v-if="row.bonusEarned > 0" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-xs">
                                  <Icon name="i-lucide-coins" class="size-3" />
                                  ${{ Number(row.bonusEarned).toFixed(2) }}
                                </div>
                                <span v-else class="text-muted-foreground/30 font-medium text-xs">Unmet</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
        </template>
        
      </div>
    </div>
  </div>
</template>
