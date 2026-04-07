<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{
  profileUserId: string
  isViewingOther: boolean
  treeData: any[]
  recordsData: any[]
}>()

const LEVELS = ['Needs Improvement', 'Proficient', 'Mastered'] as const

const userCookie = useCookie<{ _id: string, employee: string } | null>('hardwood_user')
const currentUserId = computed(() => userCookie.value?._id)

// Local mutable copy of records for optimistic updates
const localRecords = ref<any[]>([...props.recordsData])
watch(() => props.recordsData, (v) => { localRecords.value = [...v] }, { deep: true })

const expandedCats = ref<Set<string>>(new Set())

// ─── Derived maps ────────────────────────────────────────
const highestPerfMap = computed(() => {
  const map = new Map<string, any>()
  for (const r of localRecords.value) {
    const existing = map.get(r.skill)
    if (!existing || lvlIdx(r.currentSkillLevel) > lvlIdx(existing.currentSkillLevel)) {
      map.set(r.skill, r)
    }
  }
  return map
})

const myPerfLevelMap = computed(() => {
  const map = new Map<string, any>()
  const myId = currentUserId.value
  for (const r of localRecords.value) {
    if (r.createdBy === myId) {
      const key = `${r.skill}::${r.currentSkillLevel}`
      const existing = map.get(key)
      if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
        map.set(key, r)
      }
    }
  }
  return map
})

// All reviewers who have reviewed each skill grouped
const skillReviewerMap = computed(() => {
  const map = new Map<string, any[]>()
  for (const r of localRecords.value) {
    if (!map.has(r.skill)) map.set(r.skill, [])
    map.get(r.skill)!.push(r)
  }
  return map
})

// ─── Helpers ─────────────────────────────────────────────
function lvlIdx(lvl: string) { return LEVELS.indexOf(lvl as any) }
function hasMyLevel(skillId: string, level: string) { return myPerfLevelMap.value.has(`${skillId}::${level}`) }
function getMyLevelDate(skillId: string, level: string) {
  const rec = myPerfLevelMap.value.get(`${skillId}::${level}`)
  return rec ? rec.createdAt : null
}
function canMarkMastered(skillId: string) {
  const d = getMyLevelDate(skillId, 'Proficient')
  if (!d) return false
  return new Date(d).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)
}
function getSkillStatus(skillId: string): 'mastered' | 'proficient' | 'needs' | 'unreviewed' {
  const rec = highestPerfMap.value.get(skillId)
  if (!rec) return 'unreviewed'
  if (rec.currentSkillLevel === 'Mastered') return 'mastered'
  if (rec.currentSkillLevel === 'Proficient') return 'proficient'
  return 'needs'
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Stats ───────────────────────────────────────────────
const totalSkills = computed(() => {
  return props.treeData.reduce((sum: number, cat: any) =>
    sum + cat.subCategories.reduce((s2: number, sub: any) => s2 + sub.skills.length, 0), 0)
})

const overallStats = computed(() => {
  const counts = { mastered: 0, proficient: 0, needs: 0, unreviewed: 0 }
  for (const cat of props.treeData) {
    for (const sub of cat.subCategories) {
      for (const sk of sub.skills) {
        const status = getSkillStatus(sk._id)
        counts[status]++
      }
    }
  }
  return counts
})

const overallPct = computed(() => {
  if (!totalSkills.value) return 0
  return Math.round(((overallStats.value.mastered + overallStats.value.proficient) / totalSkills.value) * 100)
})

function subCatStats(sub: any) {
  const total = sub.skills.length
  let mastered = 0, proficient = 0, needs = 0
  for (const sk of sub.skills) {
    const s = getSkillStatus(sk._id)
    if (s === 'mastered') mastered++
    else if (s === 'proficient') proficient++
    else if (s === 'needs') needs++
  }
  return { total, mastered, proficient, needs, reviewed: mastered + proficient + needs }
}

function catStats(cat: any) {
  let total = 0, reviewed = 0
  for (const sub of cat.subCategories) {
    const s = subCatStats(sub)
    total += s.total
    reviewed += s.reviewed
  }
  return { total, reviewed, pct: total ? Math.round((reviewed / total) * 100) : 0 }
}

function toggleCat(id: string) {
  if (expandedCats.value.has(id)) expandedCats.value.delete(id)
  else expandedCats.value.add(id)
}

// Expand first category by default
onMounted(() => {
  if (props.treeData.length) expandedCats.value.add(props.treeData[0]._id)
})

// ─── Palette ─────────────────────────────────────────────
const catPalette = [
  { border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-400', dot: 'bg-violet-500' },
  { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-500' },
  { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-500' },
  { border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-500' },
  { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
]
function pal(i: number) { return catPalette[i % catPalette.length]! }

const statusBarColor: Record<string, string> = {
  mastered: 'bg-emerald-500',
  proficient: 'bg-blue-500',
  needs: 'bg-amber-500',
  unreviewed: 'bg-zinc-700',
}

const levelBtnClass: Record<typeof LEVELS[number], { active: string, idle: string }> = {
  'Needs Improvement': {
    active: 'bg-amber-600 text-white border-amber-700 ring-2 ring-amber-500/40 shadow-md shadow-amber-500/10',
    idle: 'border-border/50 bg-zinc-800/40 text-zinc-400 hover:bg-amber-500/15 hover:text-amber-400 hover:border-amber-500/40',
  },
  'Proficient': {
    active: 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-500/40 shadow-md shadow-blue-500/10',
    idle: 'border-border/50 bg-zinc-800/40 text-zinc-400 hover:bg-blue-500/15 hover:text-blue-400 hover:border-blue-500/40',
  },
  'Mastered': {
    active: 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/40 shadow-md shadow-emerald-500/10',
    idle: 'border-border/50 bg-zinc-800/40 text-zinc-400 hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/40',
  },
}

// ─── Mark skill ──────────────────────────────────────────
async function markSkill(skill: any, level: string, catId: string) {
  if (props.isViewingOther) return
  const myId = currentUserId.value
  if (!myId) return toast.error('You must be logged in')

  if (level === 'Mastered') {
    if (!hasMyLevel(skill._id, 'Proficient')) {
      toast.error('Must be Proficient first')
      return
    }
    if (!canMarkMastered(skill._id)) {
      toast.error('Can mark Mastered starting tomorrow')
      return
    }
  }

  // Toggle off if already marked
  const existingKey = `${skill._id}::${level}`
  const existingRec = myPerfLevelMap.value.get(existingKey)
  if (existingRec) {
    if (level === 'Proficient' && hasMyLevel(skill._id, 'Mastered')) {
      toast.error('Remove Mastered first')
      return
    }
    // Delete
    const idx = localRecords.value.findIndex(r => r._id === existingRec._id)
    if (idx !== -1) localRecords.value.splice(idx, 1)
    try {
      await $fetch(`/api/performance/${existingRec._id}`, { method: 'DELETE' })
      toast.success('Removed', { duration: 1500 })
    } catch (e: any) {
      localRecords.value.push(existingRec)
      toast.error('Failed', { description: e?.message })
    }
    return
  }

  // Find the sub-category from tree
  const subCatId = skill.subCategory
  const tempId = `temp-${Date.now()}`
  const tempRecord = {
    _id: tempId,
    employee: props.profileUserId,
    skill: skill._id,
    skillName: skill.name,
    category: catId,
    subCategory: subCatId,
    currentSkillLevel: level,
    createdAt: new Date().toISOString(),
    createdBy: myId,
    createdByName: userCookie.value?.employee ?? '',
  }
  localRecords.value.push(tempRecord)

  try {
    const res = await $fetch<{ success: boolean, data: any }>('/api/performance', {
      method: 'POST',
      body: {
        employee: props.profileUserId,
        category: catId,
        subCategory: subCatId,
        skill: skill._id,
        currentSkillLevel: level,
        createdBy: myId,
      },
    })
    const temp = localRecords.value.find(r => r._id === tempId)
    if (temp && res.data?._id) temp._id = String(res.data._id)
    toast.success(`Marked as ${level}`, { duration: 1500 })
  } catch (e: any) {
    const idx = localRecords.value.findIndex(r => r._id === tempId)
    if (idx !== -1) localRecords.value.splice(idx, 1)
    toast.error('Failed', { description: e?.data?.message || e?.message })
  }
}
</script>

<template>
  <div class="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">

    <!-- ═══ Overall Status Card (Signal-style) ═══ -->
    <div class="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 pointer-events-none" />
      <div class="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 relative z-10">
        <div class="flex items-center gap-4 flex-1">
          <div class="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Icon name="i-lucide-activity" class="size-7 text-emerald-500" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground font-medium">Overall Skill Completion</p>
            <p class="text-3xl font-black" :class="overallPct >= 80 ? 'text-emerald-500' : overallPct >= 50 ? 'text-blue-500' : 'text-amber-500'">
              {{ overallPct }}%
            </p>
          </div>
        </div>
        <!-- Legend -->
        <div class="flex items-center gap-4 text-xs text-muted-foreground">
          <div class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-emerald-500" /> Mastered ({{ overallStats.mastered }})</div>
          <div class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-blue-500" /> Proficient ({{ overallStats.proficient }})</div>
          <div class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-amber-500" /> Needs Imp. ({{ overallStats.needs }})</div>
          <div class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-zinc-700" /> Unreviewed ({{ overallStats.unreviewed }})</div>
        </div>
      </div>
    </div>

    <!-- ═══ Category Cards ═══ -->
    <div class="space-y-3">
      <div
        v-for="(cat, catIdx) in treeData"
        :key="cat._id"
        class="rounded-xl border bg-card shadow-xs overflow-hidden transition-all hover:shadow-sm"
        :class="pal(catIdx).border"
      >
        <!-- Category Header -->
        <div
          role="button" tabindex="0"
          class="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-muted/20 transition-colors group"
          @click="toggleCat(cat._id)"
        >
          <Icon
            name="i-lucide-chevron-right"
            class="size-4 text-muted-foreground transition-transform duration-200 shrink-0"
            :class="expandedCats.has(cat._id) ? 'rotate-90' : ''"
          />
          <div class="size-8 rounded-lg flex items-center justify-center shrink-0" :class="pal(catIdx).bg">
            <Icon name="i-lucide-layers" class="size-4" :class="pal(catIdx).text" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold" :class="pal(catIdx).text">{{ cat.name }}</p>
            <p class="text-[10px] text-muted-foreground mt-0.5">
              {{ cat.subCategories.length }} sub-categories · {{ catStats(cat).reviewed }}/{{ catStats(cat).total }} reviewed
            </p>
          </div>
          <!-- Progress bar -->
          <div class="flex items-center gap-2 shrink-0">
            <div class="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div class="h-full rounded-full transition-all duration-700" :class="pal(catIdx).dot" :style="{ width: `${catStats(cat).pct}%` }" />
            </div>
            <span class="text-[10px] font-bold min-w-[2rem] text-right" :class="pal(catIdx).text">{{ catStats(cat).pct }}%</span>
          </div>
        </div>

        <!-- Sub-categories (expanded) -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div v-if="expandedCats.has(cat._id)" class="border-t border-border/30">
            <div
              v-for="sub in cat.subCategories"
              :key="sub._id"
              class="border-b border-border/15 last:border-0"
            >
              <!-- Sub-category service card (Signal-style) -->
              <div class="px-5 py-4 space-y-3">
                <!-- Header row -->
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div class="flex items-center gap-2.5">
                    <span
                      class="size-2.5 rounded-full shrink-0"
                      :class="subCatStats(sub).reviewed === subCatStats(sub).total && subCatStats(sub).total > 0
                        ? 'bg-emerald-500 ring-2 ring-emerald-500/30'
                        : subCatStats(sub).reviewed > 0
                          ? 'bg-blue-500 ring-2 ring-blue-500/30'
                          : 'bg-zinc-600'"
                    />
                    <div>
                      <h3 class="text-sm font-semibold">{{ sub.name }}</h3>
                      <p class="text-[10px] font-mono text-muted-foreground/70">{{ subCatStats(sub).reviewed }}/{{ subCatStats(sub).total }} skills reviewed</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-5 text-xs">
                    <div class="text-center" v-if="subCatStats(sub).mastered">
                      <p class="font-semibold text-emerald-500">{{ subCatStats(sub).mastered }}</p>
                      <p class="text-muted-foreground">Mastered</p>
                    </div>
                    <div class="text-center" v-if="subCatStats(sub).proficient">
                      <p class="font-semibold text-blue-500">{{ subCatStats(sub).proficient }}</p>
                      <p class="text-muted-foreground">Proficient</p>
                    </div>
                    <div class="text-center" v-if="subCatStats(sub).needs">
                      <p class="font-semibold text-amber-500">{{ subCatStats(sub).needs }}</p>
                      <p class="text-muted-foreground">Needs Imp.</p>
                    </div>
                    <div class="text-center">
                      <p class="font-semibold" :class="subCatStats(sub).total ? (subCatStats(sub).reviewed === subCatStats(sub).total ? 'text-emerald-500' : 'text-foreground') : 'text-muted-foreground'">
                        {{ subCatStats(sub).total ? Math.round((subCatStats(sub).reviewed / subCatStats(sub).total) * 100) : 0 }}%
                      </p>
                      <p class="text-muted-foreground">Complete</p>
                    </div>
                  </div>
                </div>

                <!-- Uptime bar (Signal-style) — one segment per skill -->
                <div class="flex gap-[2px]" v-if="sub.skills.length">
                  <div
                    v-for="sk in sub.skills"
                    :key="sk._id"
                    class="h-7 flex-1 rounded-[3px] transition-all duration-500 relative group/bar cursor-default"
                    :class="statusBarColor[getSkillStatus(sk._id)]"
                    :title="`${sk.name}: ${getSkillStatus(sk._id)}`"
                  >
                    <!-- Tooltip on hover -->
                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-popover border border-border shadow-lg text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20">
                      {{ sk.name }}
                    </div>
                  </div>
                </div>
                <div v-if="sub.skills.length" class="flex justify-between text-[9px] text-muted-foreground/40">
                  <span>{{ sub.skills[0]?.name }}</span>
                  <span>{{ sub.skills[sub.skills.length - 1]?.name }}</span>
                </div>

                <!-- Individual skill rows with review buttons -->
                <div class="space-y-0 mt-1">
                  <div
                    v-for="sk in sub.skills"
                    :key="sk._id"
                    class="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5 px-3 -mx-1 rounded-lg hover:bg-muted/20 transition-colors group/row border-b border-border/10 last:border-0"
                  >
                    <!-- Skill name + reviewer chips -->
                    <div class="flex-1 min-w-0">
                      <p class="text-[13px] font-medium leading-tight">{{ sk.name }}</p>
                      <!-- Show existing reviews from all reviewers -->
                      <div v-if="skillReviewerMap.get(sk._id)?.length" class="flex flex-wrap items-center gap-1 mt-1">
                        <span
                          v-for="rev in skillReviewerMap.get(sk._id)"
                          :key="rev._id"
                          class="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border"
                          :class="rev.currentSkillLevel === 'Mastered'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : rev.currentSkillLevel === 'Proficient'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'"
                        >
                          <Icon name="i-lucide-user" class="size-2" />
                          {{ rev.createdByName || 'Unknown' }}
                        </span>
                      </div>
                    </div>

                    <!-- Level buttons -->
                    <div v-if="!isViewingOther" class="flex items-stretch gap-0 shrink-0">
                      <template v-for="(level, li) in LEVELS" :key="level">
                        <div v-if="li > 0" class="flex items-center">
                          <div
                            class="w-3 h-[2px] transition-colors duration-300"
                            :class="hasMyLevel(sk._id, level) ? (level === 'Mastered' ? 'bg-emerald-500' : level === 'Proficient' ? 'bg-blue-500' : 'bg-amber-500') : 'bg-border/30'"
                          />
                        </div>
                        <button
                          class="relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 min-w-[88px] cursor-pointer"
                          :class="[
                            hasMyLevel(sk._id, level)
                              ? levelBtnClass[level].active
                              : level === 'Mastered' && !canMarkMastered(sk._id)
                                ? 'border-border/30 bg-zinc-800/60 text-zinc-600 cursor-not-allowed'
                                : levelBtnClass[level].idle,
                          ]"
                          @click="markSkill(sk, level, cat._id)"
                        >
                          <!-- Check badge -->
                          <div
                            v-if="hasMyLevel(sk._id, level)"
                            class="absolute -top-1.5 -right-1.5 size-4 rounded-full flex items-center justify-center"
                            :class="level === 'Mastered' ? 'bg-emerald-500' : level === 'Proficient' ? 'bg-blue-500' : 'bg-amber-500'"
                          >
                            <Icon name="i-lucide-check" class="size-2.5 text-white" />
                          </div>
                          <!-- Lock badge -->
                          <div v-else-if="level === 'Mastered' && !canMarkMastered(sk._id)" class="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-muted border border-border flex items-center justify-center">
                            <Icon name="i-lucide-lock" class="size-2.5 text-muted-foreground/60" />
                          </div>
                          <span class="text-[10px] font-bold leading-none">
                            {{ level === 'Needs Improvement' ? 'Needs Imp.' : level }}
                          </span>
                          <span v-if="hasMyLevel(sk._id, level)" class="text-[8px] font-medium leading-none opacity-70">
                            {{ formatDate(getMyLevelDate(sk._id, level)!) }}
                          </span>
                          <span v-else-if="level === 'Mastered' && !canMarkMastered(sk._id) && hasMyLevel(sk._id, 'Proficient')" class="text-[7px] leading-none opacity-40 flex items-center gap-0.5">
                            <Icon name="i-lucide-clock" class="size-2" /> Tomorrow
                          </span>
                        </button>
                      </template>
                    </div>

                    <!-- Read-only badge when viewing other -->
                    <div v-else class="shrink-0">
                      <span
                        v-if="highestPerfMap.get(sk._id)"
                        class="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                        :class="highestPerfMap.get(sk._id).currentSkillLevel === 'Mastered'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : highestPerfMap.get(sk._id).currentSkillLevel === 'Proficient'
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'"
                      >
                        {{ highestPerfMap.get(sk._id).currentSkillLevel }}
                      </span>
                      <span v-else class="text-[10px] text-muted-foreground/40">Not reviewed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
