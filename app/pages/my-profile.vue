<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()

const route = useRoute()
const viewingEmployeeId = computed(() => route.query.employee as string | undefined)

const userCookie = useCookie<{ _id: string, employee: string, email: string, profileImage: string, position: string } | null>('hardwood_user')
const currentUserId = computed(() => userCookie.value?._id)

// If viewing another employee, fetch their profile; otherwise use logged-in user
const { data: fetchedEmployee } = viewingEmployeeId.value
  ? await useFetch<{ success: boolean, data: any }>(`/api/employees/${viewingEmployeeId.value}`, {
      lazy: true,
      transform: (res: any) => res.data || null
    })
  : { data: ref(null) }

const profileUserId = computed(() => viewingEmployeeId.value || currentUserId.value)
const userProfile = computed<any>(() => {
  if (viewingEmployeeId.value && fetchedEmployee.value) {
    return fetchedEmployee.value
  }
  return userCookie.value
})
const isViewingOther = computed(() => !!viewingEmployeeId.value && viewingEmployeeId.value !== currentUserId.value)

setHeader({ 
  title: isViewingOther.value ? `${userProfile.value?.employee || 'Employee'}'s Profile` : 'My Profile', 
  icon: 'i-lucide-user-circle', 
  description: isViewingOther.value ? 'Viewing employee profile and skill progress' : 'View your profile and track skill growth'
})

const activeTab = ref('summary')

// Data fetching — filter performance records for the target employee
const { data: recordsData, pending: loadingRecords } = await useFetch('/api/performance', {
  lazy: true,
  transform: (res: any) => res.data?.filter((r: any) => r.employee === profileUserId.value) || []
})

const { data: treeData, pending: loadingTree } = await useFetch('/api/skills/tree', {
  lazy: true,
  transform: (res: any) => res.data || []
})

const { data: bonusRulesData, pending: loadingRules } = await useFetch('/api/skill-bonus', {
  lazy: true,
  transform: (res: any) => res.data || []
})

// Fetch custom bonuses (sub-category level)
const customBonuses = ref<any[]>([])
async function fetchCustomBonuses() {
  try {
    const res = await $fetch<{ status: string, data: any[] }>('/api/performance/custom-bonus')
    customBonuses.value = res.data || []
  } catch { /* ignore */ }
}
onMounted(fetchCustomBonuses)

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
  const generalRules = bonusRulesData.value || []

  // Create skill reviews map
  const skillReviewsMap = new Map<string, any[]>()
  for (const r of (recordsData.value || [])) {
     if (!skillReviewsMap.has(r.skill)) skillReviewsMap.set(r.skill, [])
     skillReviewsMap.get(r.skill)!.push(r)
  }

  // Helper: evaluate a set of rules against skills in a sub-category
  function evaluateRules(rulesToCheck: any[], skillsInSub: any[]): number {
    let totalBonus = 0
    for (const rule of rulesToCheck) {
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
        totalBonus += (rule.bonusAmount || 0)
      }
    }
    return totalBonus
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

      // Calculate Bonus Earned:
      // 1. If sub-category has its own bonusRules override → use those exclusively
      // 2. Otherwise → fall back to general skill-bonus rules
      let subBonus = 0
      if (totalSkills > 0) {
        const subOverrideRules = sub.bonusRules || []
        const rulesToUse = subOverrideRules.length > 0 ? subOverrideRules : generalRules
        subBonus = evaluateRules(rulesToUse, skillsInSub)
      }

      // Custom bonus for this employee + sub-category
      const cbRecord = customBonuses.value.find((cb: any) => cb.employee === profileUserId.value && cb.subCategory === sub._id)
      const customBonusAmt = cbRecord ? cbRecord.bonusAmount : 0

      report.push({
         id: sub._id,
         name: sub.name,
         categoryName: cat.name,
         totalSkills,
         cntProficient,
         cntMastered,
         bonusEarned: subBonus,
         customBonus: customBonusAmt,
         hasOverride: (sub.bonusRules || []).length > 0
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
    catGroup.totalCategoryBonus += item.bonusEarned + (item.customBonus || 0)
  }
  
  return Array.from(grouped.values()).sort((a,b) => a.name.localeCompare(b.name))
})

const totalBonusEarned = computed(() => {
  return bonusReport.value.reduce((sum, item) => sum + item.bonusEarned + (item.customBonus || 0), 0)
})

// ─── Custom Bonus Modal (Profile) ─────────────────────
const showProfileCustomBonusModal = ref(false)
const profileCustomBonusSub = ref<any>(null)
const profileCustomBonusAmount = ref(0)
const profileCustomBonusReason = ref('')
const savingProfileCustomBonus = ref(false)

function openProfileCustomBonusModal(sub: any) {
  profileCustomBonusSub.value = sub
  profileCustomBonusAmount.value = sub.customBonus || 0
  profileCustomBonusReason.value = ''
  showProfileCustomBonusModal.value = true
}

async function saveProfileCustomBonus() {
  if (profileCustomBonusAmount.value < 0) return
  savingProfileCustomBonus.value = true
  try {
    const res = await $fetch<{ status: string, data: any }>('/api/performance/custom-bonus', {
      method: 'POST',
      body: {
        employee: profileUserId.value,
        subCategory: profileCustomBonusSub.value.id,
        bonusAmount: profileCustomBonusAmount.value,
        reason: profileCustomBonusReason.value,
      }
    })
    // Update local state
    const existing = customBonuses.value.find((cb: any) => cb.employee === profileUserId.value && cb.subCategory === profileCustomBonusSub.value.id)
    if (existing) {
      existing.bonusAmount = profileCustomBonusAmount.value
    } else {
      customBonuses.value.push(res.data)
    }
    showProfileCustomBonusModal.value = false
    toast.success('Custom bonus updated')
  } catch (e: any) {
    toast.error('Failed to save', { description: e?.message })
  } finally {
    savingProfileCustomBonus.value = false
  }
}

const expandedCategories = ref<Set<string>>(new Set())

function toggleCategory(catName: string) {
  if (expandedCategories.value.has(catName)) {
    expandedCategories.value.delete(catName)
  } else {
    expandedCategories.value.add(catName)
  }
}

const tabs = computed(() => {
  const base = [
    { id: 'summary', label: 'Progress Summary', icon: 'i-lucide-pie-chart' },
    { id: 'skills', label: isViewingOther.value ? 'Skill Review' : 'My Skill Review', icon: 'i-lucide-clipboard-check' },
    { id: 'growth', label: isViewingOther.value ? 'Growth Rate' : 'My Growth Rate', icon: 'i-lucide-trending-up' },
    { id: 'bonus', label: 'Bonus Report', icon: 'i-lucide-award' },
    { id: 'distribution', label: 'Bonus Distribution', icon: 'i-lucide-hand-coins' },
  ]
  if (!isViewingOther.value) {
    base.push({ id: 'theme', label: 'Theme', icon: 'i-lucide-paintbrush' })
  }
  return base
})

// ─── Bonus Distribution ──────────────────────────────────
const distributionRecords = ref<any[]>([])
const loadingDistribution = ref(false)
const syncingDistribution = ref(false)
const awardingId = ref<string | null>(null)
const showAwardModal = ref(false)
const awardTarget = ref<any>(null)
const awardAmount = ref(0)
const awardNotes = ref('')

async function fetchDistribution() {
  if (!profileUserId.value) return
  loadingDistribution.value = true
  try {
    const res = await $fetch<{ status: string, data: any[] }>(`/api/bonus-distribution/${profileUserId.value}`)
    distributionRecords.value = res.data
  } catch (e: any) {
    // Silently handle — tab may not have been visited yet
  } finally {
    loadingDistribution.value = false
  }
}

async function syncDistribution() {
  if (!profileUserId.value || !bonusReport.value.length) return
  syncingDistribution.value = true
  try {
    // Build records from the bonus report
    const records: { subCategory: string; subCategoryName: string; categoryName: string; bonusType: 'skill' | 'custom'; earnedAmount: number }[] = bonusReport.value
      .filter(item => item.bonusEarned > 0 || item.hasOverride)
      .map(item => ({
        subCategory: item.id,
        subCategoryName: item.name,
        categoryName: item.categoryName,
        bonusType: 'skill' as const,
        earnedAmount: item.bonusEarned,
      }))

    // Also include custom bonuses
    const customBonusesRes = await $fetch<{ status: string, data: any[] }>('/api/performance/custom-bonus')
    const customBonuses = customBonusesRes?.data || []
    const empCustom = customBonuses.filter((cb: any) => cb.employee === profileUserId.value && cb.bonusAmount > 0)
    
    for (const cb of empCustom) {
      // Find the sub-category name from the tree
      let subName = ''
      let catName = ''
      for (const cat of (treeData.value || [])) {
        for (const sub of cat.subCategories) {
          if (sub._id === cb.subCategory) {
            subName = sub.name
            catName = cat.name
            break
          }
        }
      }
      records.push({
        subCategory: cb.subCategory,
        subCategoryName: subName,
        categoryName: catName,
        bonusType: 'custom' as const,
        earnedAmount: cb.bonusAmount,
      })
    }

    if (records.length > 0) {
      await $fetch(`/api/bonus-distribution/${profileUserId.value}`, {
        method: 'POST',
        body: { action: 'sync', records }
      })
    }
    await fetchDistribution()
    toast.success('Distribution synced', { description: `${records.length} bonus records updated` })
  } catch (e: any) {
    toast.error('Sync failed', { description: e?.message })
  } finally {
    syncingDistribution.value = false
  }
}

function openAwardModal(record: any) {
  awardTarget.value = record
  awardAmount.value = record.earnedAmount
  awardNotes.value = ''
  showAwardModal.value = true
}

async function confirmAward() {
  if (!awardTarget.value) return
  awardingId.value = awardTarget.value._id
  try {
    const userCk = userCookie.value
    await $fetch(`/api/bonus-distribution/${profileUserId.value}`, {
      method: 'POST',
      body: {
        action: 'award',
        distributionId: awardTarget.value._id,
        awardedAmount: awardAmount.value,
        awardedBy: userCk?._id || null,
        awardedByName: userCk?.employee || 'System',
        notes: awardNotes.value,
      }
    })
    showAwardModal.value = false
    await fetchDistribution()
    toast.success('Bonus marked as awarded')
  } catch (e: any) {
    toast.error('Failed to award', { description: e?.message })
  } finally {
    awardingId.value = null
  }
}

async function unmarkAward(record: any) {
  awardingId.value = record._id
  try {
    await $fetch(`/api/bonus-distribution/${profileUserId.value}`, {
      method: 'POST',
      body: { action: 'unmark', distributionId: record._id }
    })
    await fetchDistribution()
    toast.success('Award reverted to earned')
  } catch (e: any) {
    toast.error('Failed to unmark', { description: e?.message })
  } finally {
    awardingId.value = null
  }
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function fmtDistDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const distributionSummary = computed(() => {
  const total = distributionRecords.value.reduce((s, r) => s + (r.earnedAmount || 0), 0)
  const awarded = distributionRecords.value.filter(r => r.status === 'awarded').reduce((s, r) => s + (r.awardedAmount || 0), 0)
  const pending = total - awarded
  const awardedCount = distributionRecords.value.filter(r => r.status === 'awarded').length
  const pendingCount = distributionRecords.value.filter(r => r.status === 'earned').length
  return { total, awarded, pending, awardedCount, pendingCount }
})

// Group distribution records by category
const distributionByCategory = computed(() => {
  const map = new Map<string, { name: string, records: any[] }>()
  for (const rec of distributionRecords.value) {
    const catName = rec.categoryName || 'Uncategorized'
    if (!map.has(catName)) map.set(catName, { name: catName, records: [] })
    map.get(catName)!.records.push(rec)
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
})

// Auto-fetch distribution when the tab becomes active
watch(activeTab, (val) => {
  if (val === 'distribution' && distributionRecords.value.length === 0) {
    fetchDistribution()
  }
})

// ─── Gmail Integration ───────────────────────────────────
const gmailConnected = ref(false)
const gmailEmail = ref('')
const gmailLoading = ref(false)

async function checkGmailStatus() {
  try {
    const res = await $fetch<{ success: boolean, connected: boolean, email: string }>('/api/gmail/status')
    gmailConnected.value = res.connected
    gmailEmail.value = res.email
  } catch { /* ignore */ }
}

async function connectGmail() {
  gmailLoading.value = true
  try {
    const res = await $fetch<{ success: boolean, url: string }>('/api/gmail/auth-url')
    // Redirect to Google consent in same window
    window.location.href = res.url
  } catch (e: any) {
    toast.error('Failed to start Gmail connection', { description: e?.data?.message || e?.message })
    gmailLoading.value = false
  }
}

async function disconnectGmail() {
  gmailLoading.value = true
  try {
    await $fetch('/api/gmail/disconnect', { method: 'POST' })
    gmailConnected.value = false
    gmailEmail.value = ''
    toast.success('Gmail disconnected')
  } catch (e: any) {
    toast.error('Failed to disconnect', { description: e?.message })
  } finally {
    gmailLoading.value = false
  }
}

// Check on mount + handle redirect params
onMounted(async () => {
  await checkGmailStatus()
  const route = useRoute()
  if (route.query.gmailConnected === 'true') {
    await checkGmailStatus()
    toast.success('Gmail connected successfully!', { description: gmailEmail.value })
    // Clean up URL
    navigateTo(route.path + (route.query.employee ? `?employee=${route.query.employee}` : ''), { replace: true })
  }
  if (route.query.gmailError) {
    toast.error('Gmail connection failed', { description: String(route.query.gmailError) })
    navigateTo(route.path + (route.query.employee ? `?employee=${route.query.employee}` : ''), { replace: true })
  }
})
</script>

<template>
  <div class="px-3 py-4 sm:px-5 sm:py-6 space-y-5 sm:space-y-8 max-w-7xl mx-auto h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <!-- Back button when viewing another employee -->
    <button
      v-if="isViewingOther"
      class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
      @click="navigateTo('/hr/employees')"
    >
      <Icon name="i-lucide-arrow-left" class="size-4 group-hover:-translate-x-0.5 transition-transform" />
      Back to Employees
    </button>

    <!-- Header banner -->
    <div class="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none" />
      <div class="px-4 py-5 sm:px-8 sm:py-8 flex flex-col items-center gap-4 sm:gap-6 relative z-10 md:flex-row md:items-start">
        <div class="size-20 sm:size-28 rounded-full bg-background border-4 border-background shadow-lg overflow-hidden shrink-0">
          <img v-if="userProfile?.profileImage" :src="userProfile.profileImage" :alt="userProfile.employee" class="size-full object-cover" />
          <div v-else class="size-full bg-primary/20 flex items-center justify-center text-2xl sm:text-3xl font-bold text-primary">
            {{ userProfile?.employee?.charAt(0).toUpperCase() || 'U' }}
          </div>
        </div>
        <div class="flex-1 text-center md:text-left">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">{{ userProfile?.employee || 'Unknown User' }}</h1>
          <p class="text-muted-foreground mt-1 text-sm sm:text-base break-all">{{ userProfile?.email || 'No email' }}</p>
          <div class="mt-3 sm:mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs sm:text-sm font-medium">
            <Icon name="i-lucide-briefcase" class="size-3.5 sm:size-4" />
            {{ userProfile?.position || 'Employee' }}
          </div>
        </div>
        <!-- Gmail connection card (only on own profile) -->
        <div v-if="!isViewingOther" class="mt-3 md:mt-0 md:ml-auto shrink-0">
          <div 
            class="flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-sm transition-all"
            :class="gmailConnected 
              ? 'bg-emerald-500/5 border-emerald-500/20' 
              : 'bg-muted/30 border-border/50'"
          >
            <div class="size-9 rounded-lg flex items-center justify-center shrink-0" :class="gmailConnected ? 'bg-emerald-500/15' : 'bg-muted'">
              <Icon name="i-lucide-mail" class="size-4.5" :class="gmailConnected ? 'text-emerald-500' : 'text-muted-foreground'" />
            </div>
            <div class="min-w-0">
              <p class="text-[10px] font-bold uppercase tracking-wider" :class="gmailConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'">Gmail</p>
              <p v-if="gmailConnected" class="text-xs font-medium text-foreground truncate max-w-[180px]">{{ gmailEmail }}</p>
              <p v-else class="text-xs text-muted-foreground">Not connected</p>
            </div>
            <Button 
              v-if="gmailConnected" 
              variant="ghost" 
              size="sm" 
              class="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" 
              :disabled="gmailLoading"
              @click="disconnectGmail"
            >
              <Icon v-if="gmailLoading" name="i-lucide-loader-2" class="size-3 animate-spin mr-1" />
              Disconnect
            </Button>
            <Button 
              v-else 
              size="sm" 
              class="h-7 px-3 text-xs shrink-0 shadow-sm" 
              :disabled="gmailLoading"
              @click="connectGmail"
            >
              <Icon v-if="gmailLoading" name="i-lucide-loader-2" class="size-3 animate-spin mr-1" />
              <Icon v-else name="i-lucide-link" class="size-3 mr-1" />
              Connect
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Layout: Horizontal tabs on mobile, Sidebar + Content on desktop -->
    <div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 sm:gap-6">
      
      <!-- Tab navigation: horizontal scroll on mobile, vertical sidebar on desktop -->
      <nav class="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left font-medium transition-all duration-200 border whitespace-nowrap text-sm sm:text-base"
          :class="activeTab === tab.id 
            ? 'bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]' 
            : 'bg-card text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'"
          @click="activeTab = tab.id"
        >
          <Icon :name="tab.icon" class="size-4 sm:size-5 shrink-0" />
          {{ tab.label }}
        </button>
      </nav>

      <!-- Content Area -->
      <div class="min-h-[300px] sm:min-h-[400px]">
        
        <!-- Loading -->
        <div v-if="loadingRecords || loadingTree || loadingRules" class="flex flex-col items-center justify-center h-full py-16 sm:py-20 text-muted-foreground gap-4">
          <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
          <p class="text-sm sm:text-base">Loading your profile data...</p>
        </div>

        <template v-else>
          <!-- 1. Progress Summary Tab -->
          <div v-if="activeTab === 'summary'" class="space-y-4 sm:space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <h2 class="text-xl sm:text-2xl font-bold">Progress Summary</h2>
            
            <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <!-- Total -->
              <div class="rounded-xl border border-border/50 bg-card p-3.5 sm:p-5 relative overflow-hidden group">
                <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <p class="text-xs sm:text-sm font-medium text-muted-foreground">Total Skills</p>
                <div class="mt-1.5 sm:mt-2 flex items-baseline gap-2">
                  <span class="text-2xl sm:text-4xl font-black">{{ totalSystemSkills }}</span>
                </div>
              </div>

              <!-- Mastered -->
              <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 sm:p-5 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-2 sm:p-4 opacity-20"><Icon name="i-lucide-award" class="size-10 sm:size-16 text-emerald-500" /></div>
                <p class="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 relative z-10">Mastered</p>
                <div class="mt-1.5 sm:mt-2 flex items-baseline gap-2 relative z-10">
                  <span class="text-2xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400">{{ summaryCounts.mastered }}</span>
                </div>
              </div>

              <!-- Proficient -->
              <div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 sm:p-5 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-2 sm:p-4 opacity-20"><Icon name="i-lucide-check-circle-2" class="size-10 sm:size-16 text-blue-500" /></div>
                <p class="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 relative z-10">Proficient</p>
                <div class="mt-1.5 sm:mt-2 flex items-baseline gap-2 relative z-10">
                  <span class="text-2xl sm:text-4xl font-black text-blue-600 dark:text-blue-400">{{ summaryCounts.proficient }}</span>
                </div>
              </div>

              <!-- Needs Improvement -->
              <div class="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 sm:p-5 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-2 sm:p-4 opacity-20"><Icon name="i-lucide-arrow-up-circle" class="size-10 sm:size-16 text-amber-500" /></div>
                <p class="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 relative z-10">Needs Imp.</p>
                <div class="mt-1.5 sm:mt-2 flex items-baseline gap-2 relative z-10">
                  <span class="text-2xl sm:text-4xl font-black text-amber-600 dark:text-amber-400">{{ summaryCounts.needsImp }}</span>
                </div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="rounded-xl border border-border/50 bg-card p-4 sm:p-6">
              <h3 class="text-xs sm:text-sm font-medium mb-3 sm:mb-4">Overall Completion</h3>
              <div class="w-full h-3 sm:h-4 rounded-full bg-muted overflow-hidden flex">
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
              <div class="mt-2 sm:mt-3 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>0%</span>
                <span class="font-medium text-foreground">
                  {{ totalSystemSkills ? Math.round(((summaryCounts.mastered + summaryCounts.proficient) / totalSystemSkills) * 100) : 0 }}% Proficient or higher
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <!-- 2. My Growth Rate Tab -->
          <div v-else-if="activeTab === 'growth'" class="space-y-4 sm:space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <h2 class="text-xl sm:text-2xl font-bold">My Growth Rate</h2>
            <div class="rounded-xl border border-border/50 bg-card p-4 sm:p-6">
              
              <div v-if="timelineEvents.length === 0" class="py-10 sm:py-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <div class="size-14 sm:size-16 rounded-full bg-muted flex items-center justify-center">
                  <Icon name="i-lucide-sprout" class="size-6 sm:size-8 text-muted-foreground/50" />
                </div>
                <p class="text-sm sm:text-base">No growth events recorded yet.</p>
              </div>

              <div v-else class="relative border-l-2 border-border/60 ml-2 sm:ml-3 md:ml-6 space-y-6 sm:space-y-8 pb-4">
                <div v-for="day in timelineEvents" :key="day.date" class="relative pl-5 sm:pl-6 md:pl-8">
                  <!-- Date marker -->
                  <div class="absolute -left-[9px] top-1 size-4 rounded-full bg-background border-2 border-primary ring-4 ring-background" />
                  
                  <h3 class="font-semibold text-base sm:text-lg text-foreground mb-3 sm:mb-4">{{ day.date }}</h3>
                  
                  <div class="space-y-2.5 sm:space-y-3">
                    <div 
                      v-for="item in day.items" 
                      :key="item._id"
                      class="rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4 transition-all hover:bg-muted/40"
                    >
                      <div class="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-semibold truncate">{{ item.skillName }}</p>
                          <div class="flex items-center gap-1.5 sm:gap-2 mt-1">
                            <span class="text-[10px] sm:text-xs text-muted-foreground truncate">{{ item.categoryName }}</span>
                            <Icon name="i-lucide-chevron-right" class="size-2.5 sm:size-3 text-muted-foreground/40 shrink-0" />
                            <span class="text-[10px] sm:text-xs text-muted-foreground truncate">{{ item.subCategoryName }}</span>
                          </div>
                        </div>
                        <div class="shrink-0 flex items-center gap-3 sm:gap-4">
                          <!-- The level badge -->
                          <div class="px-2 sm:px-2.5 py-1 rounded-full border text-[10px] sm:text-xs font-bold"
                            :class="item.currentSkillLevel === 'Mastered' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-blue-500/10 text-blue-500 border-blue-500/20'"
                          >
                            Achieved {{ item.currentSkillLevel }}
                          </div>
                          <!-- Reviewer -->
                          <div class="text-[9px] sm:text-[10px] text-muted-foreground text-right">
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
          <div v-else-if="activeTab === 'bonus'" class="space-y-4 sm:space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <h2 class="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Icon name="i-lucide-award" class="text-amber-500" />
                Bonus Report
              </h2>
              
              <div class="flex items-center gap-3 px-3 sm:px-4 py-2 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-sm self-start sm:self-auto">
                <div class="size-7 sm:size-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Icon name="i-lucide-coins" class="size-3.5 sm:size-4 text-amber-500" />
                </div>
                <div>
                  <p class="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">Total Earned</p>
                  <p class="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 leading-none">${{ Number(totalBonusEarned).toFixed(2) }}</p>
                </div>
              </div>
            </div>
            
            <div class="space-y-3 sm:space-y-4">
              <div v-if="bonusReportByCategory.length === 0" class="p-8 sm:p-12 text-center text-muted-foreground rounded-xl border border-border/50 bg-card">
                <p class="text-sm sm:text-base">No skills reviewed yet.</p>
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
                  class="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 hover:bg-muted/30 transition-colors cursor-pointer select-none"
                  @click="toggleCategory(catGroup.name)"
                >
                  <div class="flex items-center gap-2 sm:gap-3 w-full">
                    <Icon 
                      name="i-lucide-chevron-right" 
                      class="size-3.5 sm:size-4 text-muted-foreground transition-transform duration-200 shrink-0"
                      :class="expandedCategories.has(catGroup.name) ? 'rotate-90' : ''"
                    />
                    <div class="size-7 sm:size-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <Icon name="i-lucide-layers" class="size-3.5 sm:size-4 text-primary" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <h3 class="font-semibold text-base sm:text-lg truncate">{{ catGroup.name }}</h3>
                      <p class="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{{ catGroup.subCategories.length }} Sub-Categories</p>
                    </div>
                    <div v-if="catGroup.totalCategoryBonus > 0" class="shrink-0 text-right">
                      <p class="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-amber-500/80 mb-0.5 hidden sm:block">Category Bonus</p>
                      <span class="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-xs sm:text-sm">
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
                        <table class="w-full text-xs sm:text-sm" style="min-width: 500px;">
                          <thead>
                            <tr class="bg-muted/20 border-b border-border/40">
                              <th class="px-3 sm:px-5 py-2.5 sm:py-3 text-left font-semibold text-[10px] sm:text-xs tracking-wider uppercase text-muted-foreground">Sub-Category</th>
                              <th class="px-3 sm:px-5 py-2.5 sm:py-3 text-center font-semibold text-[10px] sm:text-xs tracking-wider uppercase text-muted-foreground">Total</th>
                              <th class="px-3 sm:px-5 py-2.5 sm:py-3 text-center font-semibold text-[10px] sm:text-xs tracking-wider uppercase text-blue-500">Prof.</th>
                              <th class="px-3 sm:px-5 py-2.5 sm:py-3 text-center font-semibold text-[10px] sm:text-xs tracking-wider uppercase text-emerald-500">Mast.</th>
                              <th class="px-3 sm:px-5 py-2.5 sm:py-3 text-center font-semibold text-[10px] sm:text-xs tracking-wider uppercase text-amber-500">Bonus</th>
                              <th class="px-3 sm:px-5 py-2.5 sm:py-3 text-center font-semibold text-[10px] sm:text-xs tracking-wider uppercase text-violet-500">Custom</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-border/30">
                            <tr v-for="row in catGroup.subCategories" :key="row.id" class="hover:bg-muted/10 transition-colors">
                              <td class="px-3 sm:px-5 py-2.5 sm:py-3">
                                <div class="flex items-center gap-1.5 sm:gap-2">
                                  <p class="font-medium truncate">{{ row.name }}</p>
                                  <span v-if="row.hasOverride" class="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20 shrink-0" title="Using custom bonus rules for this sub-category">
                                    <Icon name="i-lucide-sparkles" class="size-2 sm:size-2.5" />
                                    Custom
                                  </span>
                                </div>
                              </td>
                              <td class="px-3 sm:px-5 py-2.5 sm:py-3 text-center font-semibold text-muted-foreground">
                                {{ row.totalSkills }}
                              </td>
                              <td class="px-3 sm:px-5 py-2.5 sm:py-3 text-center">
                                <span v-if="row.cntProficient" class="inline-flex size-5 sm:size-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20 text-[10px] sm:text-xs">
                                  {{ row.cntProficient }}
                                </span>
                                <span v-else class="text-muted-foreground/30 font-medium">-</span>
                              </td>
                              <td class="px-3 sm:px-5 py-2.5 sm:py-3 text-center">
                                <span v-if="row.cntMastered" class="inline-flex size-5 sm:size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20 text-[10px] sm:text-xs">
                                  {{ row.cntMastered }}
                                </span>
                                <span v-else class="text-muted-foreground/30 font-medium">-</span>
                              </td>
                              <td class="px-3 sm:px-5 py-2.5 sm:py-3 text-center">
                                <div v-if="row.bonusEarned > 0" class="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-[10px] sm:text-xs">
                                  <Icon name="i-lucide-coins" class="size-2.5 sm:size-3" />
                                  ${{ Number(row.bonusEarned).toFixed(2) }}
                                </div>
                                <span v-else class="text-muted-foreground/30 font-medium text-[10px] sm:text-xs">Unmet</span>
                              </td>
                              <td class="px-3 sm:px-5 py-2.5 sm:py-3 text-center">
                                <button
                                  @click.stop="openProfileCustomBonusModal(row)"
                                  class="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-violet-500 font-bold border text-[10px] transition-all group/btn"
                                  :class="row.customBonus > 0 ? 'bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20' : 'border-transparent hover:bg-violet-500/10 text-violet-500/50 hover:text-violet-500'"
                                  title="Add Custom Bonus"
                                >
                                  <Icon name="i-lucide-plus-circle" class="size-3" />
                                  <span v-if="row.customBonus > 0">${{ Number(row.customBonus).toFixed(2) }}</span>
                                  <span v-else class="opacity-0 group-hover/btn:opacity-100 max-w-0 group-hover/btn:max-w-[80px] transition-all duration-300 overflow-hidden whitespace-nowrap">Add</span>
                                </button>
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

          <!-- 4. Skill Review Tab -->
          <div v-else-if="activeTab === 'skills'" class="animate-in slide-in-from-right-4 fade-in duration-300">
            <ProfileSkillReview
              :profile-user-id="profileUserId!"
              :is-viewing-other="isViewingOther"
              :tree-data="treeData || []"
              :records-data="recordsData || []"
            />
          </div>

          <!-- 5. Bonus Distribution Tab -->
          <div v-else-if="activeTab === 'distribution'" class="space-y-4 sm:space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <h2 class="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Icon name="i-lucide-hand-coins" class="text-primary" />
                Bonus Distribution
              </h2>
              <button
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                :disabled="syncingDistribution"
                @click="syncDistribution"
              >
                <Icon :name="syncingDistribution ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw'" class="size-4" :class="syncingDistribution ? 'animate-spin' : ''" />
                {{ syncingDistribution ? 'Syncing...' : 'Sync from Bonus Report' }}
              </button>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-3 sm:p-4">
                <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">Total Earned</p>
                <p class="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">{{ fmtCurrency(distributionSummary.total) }}</p>
                <p class="text-[9px] text-amber-600/50 dark:text-amber-400/50 mt-0.5">{{ distributionRecords.length }} entries</p>
              </div>
              <div class="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-3 sm:p-4">
                <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">Awarded</p>
                <p class="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{{ fmtCurrency(distributionSummary.awarded) }}</p>
                <p class="text-[9px] text-emerald-600/50 dark:text-emerald-400/50 mt-0.5">{{ distributionSummary.awardedCount }} paid out</p>
              </div>
              <div class="rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-3 sm:p-4">
                <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-orange-600/70 dark:text-orange-400/70">Pending</p>
                <p class="text-xl sm:text-2xl font-black text-orange-600 dark:text-orange-400 mt-1 tabular-nums">{{ fmtCurrency(distributionSummary.pending) }}</p>
                <p class="text-[9px] text-orange-600/50 dark:text-orange-400/50 mt-0.5">{{ distributionSummary.pendingCount }} awaiting</p>
              </div>
              <div class="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-3 sm:p-4">
                <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70">Award Rate</p>
                <p class="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
                  {{ distributionRecords.length ? Math.round((distributionSummary.awardedCount / distributionRecords.length) * 100) : 0 }}%
                </p>
                <p class="text-[9px] text-blue-600/50 dark:text-blue-400/50 mt-0.5">completion</p>
              </div>
            </div>

            <!-- Loading -->
            <div v-if="loadingDistribution" class="space-y-3">
              <div v-for="i in 3" :key="i" class="h-16 rounded-xl bg-muted/50 animate-pulse border border-border/30" />
            </div>

            <!-- Empty State -->
            <div v-else-if="!distributionRecords.length" class="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border/50 bg-card">
              <div class="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Icon name="i-lucide-hand-coins" class="size-7 text-primary" />
              </div>
              <h3 class="font-bold text-lg mb-1">No distribution records yet</h3>
              <p class="text-sm text-muted-foreground max-w-sm mb-4">
                Click "Sync from Bonus Report" to pull in all earned bonuses and start tracking distributions.
              </p>
            </div>

            <!-- Distribution Records by Category -->
            <div v-else class="space-y-4">
              <div v-for="catGroup in distributionByCategory" :key="catGroup.name" class="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
                <!-- Category Header -->
                <div class="flex items-center justify-between px-4 sm:px-5 py-3 bg-muted/20 border-b border-border/30">
                  <div class="flex items-center gap-2.5">
                    <div class="size-7 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Icon name="i-lucide-layers" class="size-3.5 text-primary" />
                    </div>
                    <h3 class="font-semibold text-sm sm:text-base">{{ catGroup.name }}</h3>
                    <span class="text-[10px] text-muted-foreground">{{ catGroup.records.length }} items</span>
                  </div>
                </div>

                <!-- Records -->
                <div class="divide-y divide-border/20">
                  <div
                    v-for="rec in catGroup.records"
                    :key="rec._id"
                    class="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted/10 transition-colors"
                  >
                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-semibold truncate">{{ rec.subCategoryName }}</p>
                        <span
                          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border"
                          :class="rec.bonusType === 'custom'
                            ? 'bg-violet-500/10 text-violet-500 border-violet-500/20'
                            : 'bg-blue-500/10 text-blue-500 border-blue-500/20'"
                        >
                          <Icon :name="rec.bonusType === 'custom' ? 'i-lucide-sparkles' : 'i-lucide-trophy'" class="size-2" />
                          {{ rec.bonusType === 'custom' ? 'Custom' : 'Skill' }}
                        </span>
                      </div>
                      <div v-if="rec.status === 'awarded'" class="flex items-center gap-2 mt-1">
                        <span class="text-[10px] text-emerald-500 font-medium">Awarded by {{ rec.awardedByName }}</span>
                        <span class="text-[10px] text-muted-foreground">on {{ fmtDistDate(rec.awardedAt) }}</span>
                        <span v-if="rec.notes" class="text-[10px] text-muted-foreground italic truncate max-w-[200px]">— {{ rec.notes }}</span>
                      </div>
                    </div>

                    <!-- Amounts -->
                    <div class="flex items-center gap-3 sm:gap-4 shrink-0">
                      <div class="text-right">
                        <p class="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Earned</p>
                        <p class="text-sm font-bold text-amber-500 tabular-nums">{{ fmtCurrency(rec.earnedAmount) }}</p>
                      </div>
                      <Icon name="i-lucide-arrow-right" class="size-3.5 text-muted-foreground/40" />
                      <div class="text-right">
                        <p class="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Awarded</p>
                        <p
                          class="text-sm font-bold tabular-nums"
                          :class="rec.status === 'awarded' ? 'text-emerald-500' : 'text-muted-foreground/30'"
                        >
                          {{ rec.status === 'awarded' ? fmtCurrency(rec.awardedAmount) : '$0.00' }}
                        </p>
                      </div>

                      <!-- Status badge + action -->
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border"
                          :class="rec.status === 'awarded'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-orange-500/10 text-orange-500 border-orange-500/20'"
                        >
                          <Icon :name="rec.status === 'awarded' ? 'i-lucide-check-circle-2' : 'i-lucide-clock'" class="size-3" />
                          {{ rec.status === 'awarded' ? 'Awarded' : 'Pending' }}
                        </span>
                        <button
                          v-if="rec.status === 'earned'"
                          class="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                          title="Mark as Awarded"
                          :disabled="awardingId === rec._id"
                          @click="openAwardModal(rec)"
                        >
                          <Icon :name="awardingId === rec._id ? 'i-lucide-loader-2' : 'i-lucide-check'" class="size-3.5" :class="awardingId === rec._id ? 'animate-spin' : ''" />
                        </button>
                        <button
                          v-else
                          class="size-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-colors"
                          title="Revert to Pending"
                          :disabled="awardingId === rec._id"
                          @click="unmarkAward(rec)"
                        >
                          <Icon :name="awardingId === rec._id ? 'i-lucide-loader-2' : 'i-lucide-undo-2'" class="size-3.5" :class="awardingId === rec._id ? 'animate-spin' : ''" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 6. Theme Tab -->
          <div v-else-if="activeTab === 'theme'" class="space-y-4 sm:space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <h2 class="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Icon name="i-lucide-paintbrush" class="text-primary" />
              Customize Theme
            </h2>
            <div class="rounded-xl border border-border/50 bg-card p-4 sm:p-6 max-w-xl">
              <ThemeCustomize />
            </div>
          </div>
        </template>
        
      </div>
    </div>

    <!-- Award Confirmation Modal -->
    <Dialog v-model:open="showAwardModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-hand-coins" class="size-5 text-emerald-500" />
            Award Bonus
          </DialogTitle>
          <DialogDescription>
            Mark this bonus as awarded for <span class="font-bold text-foreground">{{ awardTarget?.subCategoryName }}</span>.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="flex flex-col gap-2">
            <Label>Awarded Amount (USD)</Label>
            <div class="relative">
              <Icon name="i-lucide-dollar-sign" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                type="number"
                v-model.number="awardAmount"
                class="pl-9 text-lg font-bold text-emerald-500 h-12"
                min="0"
                step="0.01"
              />
            </div>
            <p class="text-[10px] text-muted-foreground">Earned amount: {{ fmtCurrency(awardTarget?.earnedAmount || 0) }}</p>
          </div>
          <div class="flex flex-col gap-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              v-model="awardNotes"
              placeholder="E.g. Paid via payroll on 05/01..."
              class="resize-none"
              rows="2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showAwardModal = false" :disabled="!!awardingId">Cancel</Button>
          <Button @click="confirmAward" class="bg-emerald-600 hover:bg-emerald-700 text-white" :disabled="!!awardingId">
            <Icon v-if="awardingId" name="i-lucide-loader-2" class="size-4 animate-spin mr-2" />
            <Icon v-else name="i-lucide-check" class="size-4 mr-2" />
            {{ awardingId ? 'Awarding...' : 'Confirm Award' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Custom Bonus Modal (Profile) -->
    <Dialog v-model:open="showProfileCustomBonusModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-award" class="size-5 text-violet-500" />
            Custom Bonus Award
          </DialogTitle>
          <DialogDescription>
            Add a custom bonus for <span class="font-bold text-foreground">{{ userProfile?.employee }}</span> in the <span class="font-bold text-foreground">{{ profileCustomBonusSub?.name }}</span> sub-category.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="flex flex-col gap-2">
            <Label>Bonus Amount (USD)</Label>
            <div class="relative">
              <Icon name="i-lucide-dollar-sign" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                type="number"
                v-model.number="profileCustomBonusAmount"
                class="pl-9 text-lg font-bold text-amber-500 h-12"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <Label>Reason / Note (Optional)</Label>
            <Textarea
              v-model="profileCustomBonusReason"
              placeholder="E.g. Exceptional performance during the week..."
              class="resize-none"
              rows="3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showProfileCustomBonusModal = false" :disabled="savingProfileCustomBonus">Cancel</Button>
          <Button @click="saveProfileCustomBonus" class="bg-violet-500 hover:bg-violet-600 text-white" :disabled="savingProfileCustomBonus">
            <Icon v-if="savingProfileCustomBonus" name="i-lucide-loader-2" class="size-4 animate-spin mr-2" />
            <Icon v-else name="i-lucide-check" class="size-4 mr-2" />
            Save Bonus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
