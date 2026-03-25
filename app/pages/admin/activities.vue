<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Activities', icon: 'i-lucide-activity', description: 'Monitor every action across the platform' })

// ─── State ──────────────────────────────────────────
const activities = ref<any[]>([])
const loading = ref(true)
const pagination = ref({ page: 1, limit: 50, total: 0, totalPages: 0 })
const filterUsers = ref<string[]>([])
const filterModules = ref<string[]>([])

const selectedUser = ref('all')
const selectedModule = ref('all')
const selectedAction = ref('all')
const searchQuery = ref('')

const actionOptions = ['all', 'create', 'update', 'delete', 'login', 'logout', 'assess', 'import']

// ─── Fetch ──────────────────────────────────────────
async function fetchActivities(page = 1) {
  loading.value = true
  try {
    const params: Record<string, string> = {
      page: String(page),
      limit: '50',
    }
    if (selectedUser.value !== 'all') params.user = selectedUser.value
    if (selectedModule.value !== 'all') params.module = selectedModule.value
    if (selectedAction.value !== 'all') params.action = selectedAction.value
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim()

    const query = new URLSearchParams(params).toString()
    const res = await $fetch<any>(`/api/activities?${query}`)
    activities.value = res.data
    pagination.value = res.pagination
    filterUsers.value = res.filters.users || []
    filterModules.value = res.filters.modules || []
  } catch (e: any) {
    toast.error('Failed to load activities', { description: e?.message })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchActivities()
  // Mark all as read when page is visited
  try {
    await $fetch('/api/activities/mark-as-read', { method: 'POST' })
  } catch {}
})

watch([selectedUser, selectedModule, selectedAction], () => fetchActivities(1))

let searchTimeout: any = null
function onSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => fetchActivities(1), 400)
}

// ─── Helpers ────────────────────────────────────────
function timeAgo(date: string) {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fullDate(date: string) {
  return new Date(date).toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function actionIcon(action: string) {
  const map: Record<string, string> = {
    create: 'i-lucide-plus-circle',
    update: 'i-lucide-pencil',
    delete: 'i-lucide-trash-2',
    login: 'i-lucide-log-in',
    logout: 'i-lucide-log-out',
    assess: 'i-lucide-clipboard-check',
    import: 'i-lucide-upload',
    view: 'i-lucide-eye',
  }
  return map[action] || 'i-lucide-zap'
}

function actionColor(action: string) {
  const map: Record<string, string> = {
    create: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    update: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    delete: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    login: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    logout: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    assess: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    import: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  }
  return map[action] || 'text-muted-foreground bg-muted/30 border-border/30'
}

function actionBadgeColor(action: string) {
  const map: Record<string, string> = {
    create: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    update: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    delete: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    login: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    logout: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    assess: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    import: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  }
  return map[action] || 'bg-muted text-muted-foreground border-border/40'
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

// ─── Group by date ──────────────────────────────────
const groupedActivities = computed(() => {
  const groups: { label: string, items: any[] }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  let currentLabel = ''

  for (const act of activities.value) {
    const d = new Date(act.createdAt)
    d.setHours(0, 0, 0, 0)
    let label = ''

    if (d.getTime() === today.getTime()) label = 'Today'
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday'
    else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    if (label !== currentLabel) {
      groups.push({ label, items: [] })
      currentLabel = label
    }
    groups[groups.length - 1]?.items.push(act)
  }
  return groups
})

// ─── Stats ──────────────────────────────────────────
const stats = computed(() => {
  const total = pagination.value.total
  const creates = activities.value.filter(a => a.action === 'create').length
  const updates = activities.value.filter(a => a.action === 'update').length
  const deletes = activities.value.filter(a => a.action === 'delete').length
  return { total, creates, updates, deletes }
})
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <div class="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

      <!-- ─── Stats Bar ─── -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
          <div class="size-8 sm:size-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Icon name="i-lucide-activity" class="size-4 sm:size-5 text-primary" />
          </div>
          <div>
            <p class="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Total Events</p>
            <p class="text-base sm:text-lg font-bold">{{ stats.total.toLocaleString() }}</p>
          </div>
        </div>
        <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
          <div class="size-8 sm:size-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Icon name="i-lucide-plus-circle" class="size-4 sm:size-5 text-emerald-400" />
          </div>
          <div>
            <p class="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Created</p>
            <p class="text-base sm:text-lg font-bold text-emerald-400">{{ stats.creates }}</p>
          </div>
        </div>
        <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
          <div class="size-8 sm:size-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Icon name="i-lucide-pencil" class="size-4 sm:size-5 text-blue-400" />
          </div>
          <div>
            <p class="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Updated</p>
            <p class="text-base sm:text-lg font-bold text-blue-400">{{ stats.updates }}</p>
          </div>
        </div>
        <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
          <div class="size-8 sm:size-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Icon name="i-lucide-trash-2" class="size-4 sm:size-5 text-rose-400" />
          </div>
          <div>
            <p class="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Deleted</p>
            <p class="text-base sm:text-lg font-bold text-rose-400">{{ stats.deletes }}</p>
          </div>
        </div>
      </div>

      <!-- ─── Filter Bar ─── -->
      <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <!-- Search -->
        <div class="relative flex-1 min-w-0 basis-full sm:basis-auto sm:min-w-[200px]">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Search activities..."
            class="pl-8 sm:pl-9 bg-background/50 h-8 sm:h-9 text-xs sm:text-sm"
            @input="onSearch"
          />
        </div>

        <!-- User Filter -->
        <Select v-model="selectedUser">
          <SelectTrigger class="w-full xs:w-auto xs:min-w-[130px] sm:w-[160px] h-8 sm:h-9 text-xs sm:text-sm">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem v-for="u in filterUsers" :key="u" :value="u">{{ u }}</SelectItem>
          </SelectContent>
        </Select>

        <!-- Module Filter -->
        <Select v-model="selectedModule">
          <SelectTrigger class="w-full xs:w-auto xs:min-w-[140px] sm:w-[180px] h-8 sm:h-9 text-xs sm:text-sm">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem v-for="m in filterModules" :key="m" :value="m">{{ m }}</SelectItem>
          </SelectContent>
        </Select>

        <!-- Action Filter -->
        <Select v-model="selectedAction">
          <SelectTrigger class="w-full xs:w-auto xs:min-w-[120px] sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="a in actionOptions" :key="a" :value="a">
              {{ a === 'all' ? 'All Actions' : a.charAt(0).toUpperCase() + a.slice(1) }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Refresh -->
        <Button variant="outline" size="sm" class="h-8 sm:h-9 w-8 sm:w-9 p-0" @click="fetchActivities(1)">
          <Icon name="i-lucide-refresh-cw" class="size-3.5 sm:size-4" />
        </Button>
      </div>

      <!-- ─── Loading ─── -->
      <div v-if="loading" class="space-y-3 sm:space-y-4">
        <div v-for="i in 6" :key="i" class="rounded-xl border border-border/30 bg-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <div class="size-8 sm:size-10 rounded-full bg-muted/40 animate-pulse shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-3 sm:h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
            <div class="h-2.5 sm:h-3 w-1/2 bg-muted/30 rounded animate-pulse" />
          </div>
          <div class="h-2.5 sm:h-3 w-12 sm:w-16 bg-muted/30 rounded animate-pulse shrink-0" />
        </div>
      </div>

      <!-- ─── Empty State ─── -->
      <div v-else-if="activities.length === 0" class="rounded-xl border border-border/50 bg-card p-12 sm:p-24 flex flex-col items-center justify-center text-center">
        <div class="size-14 sm:size-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-4 sm:mb-5">
          <Icon name="i-lucide-eye-off" class="size-7 sm:size-10 text-primary" />
        </div>
        <h3 class="text-base sm:text-xl font-bold mb-1.5 sm:mb-2">No activities recorded yet</h3>
        <p class="text-xs sm:text-sm text-muted-foreground max-w-sm">
          Activities will appear here automatically as users interact with the application. Every create, update, delete, login, and more will be tracked.
        </p>
      </div>

      <!-- ─── Activity Feed ─── -->
      <div v-else class="space-y-4 sm:space-y-6">
        <div v-for="group in groupedActivities" :key="group.label">
          <!-- Date Header -->
          <div class="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div class="h-px flex-1 bg-border/40" />
            <span class="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-muted/30 border border-border/30 whitespace-nowrap">
              {{ group.label }}
            </span>
            <div class="h-px flex-1 bg-border/40" />
          </div>

          <!-- Timeline -->
          <div class="relative">
            <!-- Vertical line -->
            <div class="absolute left-[16px] sm:left-[22px] top-0 bottom-0 w-px bg-border/30" />

            <div class="space-y-0.5 sm:space-y-1">
              <div
                v-for="act in group.items"
                :key="act._id"
                class="relative flex items-start gap-2.5 sm:gap-4 pl-10 sm:pl-14 pr-2 sm:pr-4 py-2.5 sm:py-3 rounded-lg hover:bg-muted/10 transition-colors group"
              >
                <!-- Avatar as Timeline Node -->
                <div class="absolute left-0 sm:left-1 top-2.5 sm:top-3 z-10">
                  <div
                    class="size-8 sm:size-[42px] rounded-full border-2 flex items-center justify-center overflow-hidden"
                    :class="actionColor(act.action)"
                  >
                    <img
                      v-if="act.userImage"
                      :src="act.userImage"
                      :alt="act.user"
                      class="size-full rounded-full object-cover"
                    />
                    <span v-else class="text-[9px] sm:text-[11px] font-bold">
                      {{ getInitials(act.user) }}
                    </span>
                  </div>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start gap-1.5 sm:gap-2 flex-wrap">
                    <!-- User Name -->
                    <span class="font-semibold text-xs sm:text-sm shrink-0">{{ act.user }}</span>

                    <!-- Description -->
                    <p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {{ act.description.replace(act.user, '').trim() }}
                    </p>
                  </div>

                  <!-- Target Info (who it was done to) -->
                  <div v-if="act.targetName" class="mt-0.5 sm:mt-1 ml-0">
                    <span class="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-foreground/70">
                      <Icon name="i-lucide-arrow-right" class="size-2.5 sm:size-3 text-muted-foreground/50" />
                      <span class="font-medium truncate max-w-[150px] sm:max-w-none">{{ act.targetName }}</span>
                    </span>
                  </div>

                  <!-- Tags -->
                  <div class="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5 flex-wrap">
                    <span
                      class="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider"
                      :class="actionBadgeColor(act.action)"
                    >
                      <Icon :name="actionIcon(act.action)" class="size-2.5 sm:size-3" />
                      {{ act.action }}
                    </span>
                    <span class="text-[9px] sm:text-[10px] font-medium text-muted-foreground px-1.5 sm:px-2 py-0.5 rounded-full bg-muted/30 border border-border/30 truncate max-w-[80px] sm:max-w-none">
                      {{ act.module }}
                    </span>
                    <span v-if="act.targetId" class="text-[9px] sm:text-[10px] text-muted-foreground/60 font-mono hidden sm:inline">
                      {{ act.targetId.substring(0, 8) }}
                    </span>
                  </div>
                </div>

                <!-- Time -->
                <div class="text-right shrink-0">
                  <span class="text-[10px] sm:text-xs text-muted-foreground font-medium" :title="fullDate(act.createdAt)">
                    {{ timeAgo(act.createdAt) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── Pagination ─── -->
        <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-1.5 sm:gap-2 pt-3 sm:pt-4">
          <Button
            variant="outline"
            size="sm"
            class="h-8 text-xs sm:text-sm"
            :disabled="pagination.page <= 1"
            @click="fetchActivities(pagination.page - 1)"
          >
            <Icon name="i-lucide-chevron-left" class="size-3.5 sm:size-4 mr-0.5 sm:mr-1" />
            <span class="hidden xs:inline">Prev</span>
          </Button>
          <span class="text-xs sm:text-sm text-muted-foreground px-2 sm:px-3 whitespace-nowrap">
            {{ pagination.page }} / {{ pagination.totalPages }}
          </span>
          <Button
            variant="outline"
            size="sm"
            class="h-8 text-xs sm:text-sm"
            :disabled="pagination.page >= pagination.totalPages"
            @click="fetchActivities(pagination.page + 1)"
          >
            <span class="hidden xs:inline">Next</span>
            <Icon name="i-lucide-chevron-right" class="size-3.5 sm:size-4 ml-0.5 sm:ml-1" />
          </Button>
        </div>
      </div>

    </div>
  </div>
</template>
