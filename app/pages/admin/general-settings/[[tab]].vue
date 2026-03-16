<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'General Settings', icon: 'i-lucide-settings', description: 'Configure system-wide preferences' })

// ─── Types ───────────────────────────────────────────────
interface SkillBonusRecord {
  _id: string
  skillSet: string
  reviewedTimes: number
  supervisorCheck: string
  bonusAmount: number
}

interface WorkspaceRecord {
  _id: string
  name: string
  logo: string
  plan: string
  allowedMenus: string[]
  menuPermissions: Record<string, string[]>
  isLocked: boolean
}

// ─── Route-based tab ─────────────────────────────────────
const route = useRoute()
const activeTab = computed(() => {
  const slug = route.params.tab as string | undefined
  return slug || 'skill-bonus'
})

// Redirect /admin/general-settings → /admin/general-settings/skill-bonus
if (!route.params.tab) {
  navigateTo('/admin/general-settings/skill-bonus', { replace: true })
}
const records = ref<SkillBonusRecord[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const showMobileSidebar = ref(false)

const SKILL_LEVELS = ['Needs Improvement', 'Proficient', 'Mastered'] as const
const SUPERVISOR_OPTIONS = ['Any', 'Unique'] as const

const emptyForm = () => ({
  skillSet: '',
  reviewedTimes: 1,
  supervisorCheck: 'Any',
  bonusAmount: 0,
})
const form = ref(emptyForm())

// ─── Workspace State ─────────────────────────────────────
const workspaces = ref<WorkspaceRecord[]>([])
const loadingWp = ref(true)
const showWpModal = ref(false)
const savingWp = ref(false)
const editingWpId = ref<string | null>(null)

const emptyWpForm = () => ({
  name: '',
  logo: 'i-lucide-building',
  plan: '',
  allowedMenus: [] as string[],
  menuPermissions: {} as Record<string, string[]>
})
const wpForm = ref(emptyWpForm())

const tabs = [
  { id: 'skill-bonus', label: 'Skill Bonus', icon: 'i-lucide-trophy' },
  { id: 'workspaces', label: 'Workspaces', icon: 'i-lucide-network' },
]

// ─── Fetch ───────────────────────────────────────────────
async function fetchRecords() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: SkillBonusRecord[] }>('/api/skill-bonus')
    records.value = res.data
  }
  catch (e: any) {
    toast.error('Failed to load skill bonus records', { description: e?.message })
  }
  finally { loading.value = false }
}

async function fetchWorkspaces() {
  loadingWp.value = true
  try {
    const res = await $fetch<{ success: boolean, data: WorkspaceRecord[] }>('/api/workspaces')
    workspaces.value = res.data
  }
  catch (e: any) {
    toast.error('Failed to load workspaces', { description: e?.message })
  }
  finally { loadingWp.value = false }
}

onMounted(() => {
  fetchRecords()
  fetchWorkspaces()
})

// ─── Open modals ─────────────────────────────────────────
function openCreate() {
  form.value = emptyForm()
  editingId.value = null
  showCreateModal.value = true
}

function openEdit(rec: SkillBonusRecord) {
  form.value = {
    skillSet: rec.skillSet,
    reviewedTimes: rec.reviewedTimes,
    supervisorCheck: rec.supervisorCheck,
    bonusAmount: rec.bonusAmount,
  }
  editingId.value = rec._id
  showCreateModal.value = true
}

// ─── Save (create or update) ─────────────────────────────
async function saveRecord() {
  if (!form.value.skillSet) return toast.error('Skill Set is required')
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/skill-bonus/${editingId.value}`, { method: 'PUT', body: form.value })
      toast.success('Record updated')
    }
    else {
      await $fetch('/api/skill-bonus', { method: 'POST', body: form.value })
      toast.success('Record created')
    }
    showCreateModal.value = false
    await fetchRecords()
  }
  catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  }
  finally { saving.value = false }
}

// ─── Delete ──────────────────────────────────────────────
async function deleteRecord(id: string) {
  const idx = records.value.findIndex(r => r._id === id)
  if (idx === -1) return
  const snapshot = records.value[idx]!
  records.value.splice(idx, 1)
  try {
    await $fetch(`/api/skill-bonus/${id}`, { method: 'DELETE' })
    toast.success('Record deleted')
  }
  catch (e: any) {
    records.value.splice(idx, 0, snapshot)
    toast.error('Delete failed', { description: e?.message })
  }
}

// ─── Workspace Modal Utils ───────────────────────────────
function openWpCreate() {
  wpForm.value = emptyWpForm()
  editingWpId.value = null
  showWpModal.value = true
}

function openWpEdit(rec: WorkspaceRecord) {
  wpForm.value = {
    name: rec.name,
    logo: rec.logo,
    plan: rec.plan,
    allowedMenus: [...rec.allowedMenus],
    menuPermissions: JSON.parse(JSON.stringify(rec.menuPermissions || {}))
  }
  editingWpId.value = rec._id
  showWpModal.value = true
}

async function saveWorkspace() {
  if (!wpForm.value.name) return toast.error('Workspace name is required')
  savingWp.value = true
  try {
    if (editingWpId.value) {
      await $fetch(`/api/workspaces/${editingWpId.value}`, { method: 'PUT', body: wpForm.value })
      toast.success('Workspace updated')
    }
    else {
      await $fetch('/api/workspaces', { method: 'POST', body: wpForm.value })
      toast.success('Workspace created')
    }
    showWpModal.value = false
    await fetchWorkspaces()
    await refreshNuxtData('workspaces-list')
  }
  catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  }
  finally { savingWp.value = false }
}

async function deleteWorkspace(id: string) {
  try {
    await $fetch(`/api/workspaces/${id}`, { method: 'DELETE' })
    toast.success('Workspace deleted')
    await fetchWorkspaces()
    await refreshNuxtData('workspaces-list')
  } catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
  }
}

// ─── Level color helpers ─────────────────────────────────
function levelColor(lvl: string) {
  if (lvl === 'Mastered') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (lvl === 'Proficient') return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  if (lvl === 'Needs Improvement') return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return 'bg-muted text-muted-foreground border-border/40'
}

import { navMenu, navMenuConcepts, navMenuBottom } from '~/constants/menus'

// ─── Route Capabilities (which CRUD ops each route supports) ─────
const ROUTE_CAPS: Record<string, { ops: string[], icon: string }> = {
  '/admin/dashboard': { ops: ['read'], icon: 'i-lucide-layout-dashboard' },
  '/admin/skills': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-graduation-cap' },
  '/admin/activities': { ops: ['read'], icon: 'i-lucide-activity' },
  '/hr/employees': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-users' },
  '/hr/employee-performance': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-bar-chart-3' },
  '/hr/employees-bonus-report': { ops: ['read'], icon: 'i-lucide-trophy' },
  '/tasks': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-layout-dashboard' },
  '/project-communication': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-message-square' },
  '/daily-production': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-clipboard-list' },
  '/email': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-mail' },
  '/sales/quotes': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-file-text' },
  '/sales/invoices': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-receipt' },
  '/sales/orders': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-shopping-cart' },
  '/sales/customers': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-users' },
  '/reports/sales': { ops: ['read'], icon: 'i-lucide-trending-up' },
  '/reports/financial': { ops: ['read'], icon: 'i-lucide-pie-chart' },
  '/admin/general-settings': { ops: ['read', 'update'], icon: 'i-lucide-settings' },
  '/external/stain-sign-off': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-stamp' },
}

const OP_META: Record<string, { label: string, color: string, icon: string }> = {
  create: { label: 'Create', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/25', icon: 'i-lucide-plus' },
  read:   { label: 'View',   color: 'bg-blue-500/15 text-blue-500 border-blue-500/30 hover:bg-blue-500/25',    icon: 'i-lucide-eye' },
  update: { label: 'Edit',   color: 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25', icon: 'i-lucide-pencil' },
  delete: { label: 'Delete', color: 'bg-red-500/15 text-red-500 border-red-500/30 hover:bg-red-500/25',         icon: 'i-lucide-trash-2' },
}

function getCaps(routeId: string) {
  return ROUTE_CAPS[routeId] || { ops: ['read'], icon: 'i-lucide-circle' }
}
function isViewOnly(routeId: string) {
  const c = getCaps(routeId)
  return c.ops.length === 1 && c.ops[0] === 'read'
}
function hasPerm(menuId: string, op: string) {
  return wpForm.value.menuPermissions[menuId]?.includes(op) || false
}
function togglePerm(menuId: string, op: string) {
  if (!wpForm.value.menuPermissions[menuId]) wpForm.value.menuPermissions[menuId] = []
  const perms = wpForm.value.menuPermissions[menuId]
  const idx = perms.indexOf(op)
  if (idx >= 0) {
    if (op === 'read') return
    perms.splice(idx, 1)
  } else {
    perms.push(op)
  }
}
function toggleMenu(menuId: string) {
  const idx = wpForm.value.allowedMenus.indexOf(menuId)
  if (idx >= 0) {
    wpForm.value.allowedMenus.splice(idx, 1)
    delete wpForm.value.menuPermissions[menuId]
  } else {
    wpForm.value.allowedMenus.push(menuId)
    wpForm.value.menuPermissions[menuId] = [...getCaps(menuId).ops]
  }
}

const availableMenus = computed(() => {
  const menus: { id: string, title: string, group: string }[] = []
  
  navMenu.forEach(group => {
    group.items.forEach((item: any) => {
      menus.push({ id: item.link, title: item.title, group: group.heading || 'Admin' })
    })
  })
  
  navMenuConcepts.items.forEach((item: any) => {
    menus.push({ id: item.link, title: item.title, group: navMenuConcepts.heading })
  })
  
  navMenuBottom.forEach((item: any) => {
    menus.push({ id: item.link, title: item.title, group: 'System Controls' })
  })
  
  return menus
})

const menusByGroup = computed(() => {
  const map = new Map<string, typeof availableMenus.value>()
  for (const m of availableMenus.value) {
    if (!map.has(m.group)) map.set(m.group, [])
    map.get(m.group)!.push(m)
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
})

function hasAllInGroup(groupItems: any[]) {
   return groupItems.every(i => wpForm.value.allowedMenus.includes(i.id))
}
function toggleGroup(groupItems: any[]) {
   if (hasAllInGroup(groupItems)) {
      wpForm.value.allowedMenus = wpForm.value.allowedMenus.filter(m => !groupItems.some(i => i.id === m))
      for (const i of groupItems) delete wpForm.value.menuPermissions[i.id]
   } else {
      for (const i of groupItems) {
         if (!wpForm.value.allowedMenus.includes(i.id)) {
            wpForm.value.allowedMenus.push(i.id)
            wpForm.value.menuPermissions[i.id] = [...getCaps(i.id).ops]
         }
      }
   }
}

const WpIconsList = [
  'i-lucide-shield-check',
  'i-lucide-hard-hat',
  'i-lucide-user',
  'i-lucide-users',
  'i-lucide-clipboard-list',
  'i-lucide-landmark',
  'i-lucide-activity',
  'i-lucide-building',
  'i-lucide-box',
  'i-lucide-briefcase',
]
</script>
<template>
  <div class="flex gap-0 -m-4 lg:-m-6 h-[calc(100vh-theme(spacing.16))] overflow-hidden">

    <!-- ══════════════════════ MOBILE SIDEBAR OVERLAY ══════════════════════ -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showMobileSidebar"
        class="md:hidden fixed inset-0 bg-black/50 z-40"
        @click="showMobileSidebar = false"
      />
    </Transition>

    <!-- ══════════════════════ LEFT PANEL: Tabs sidebar ══════════════════════ -->
    <aside
      class="shrink-0 border-r border-border/60 bg-background flex flex-col h-full transition-transform duration-200 z-50"
      :class="[
        'w-56',
        showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        'fixed md:relative inset-y-0 left-0 md:inset-auto'
      ]"
    >
      <div class="px-4 py-3.5 sm:py-4 border-b border-border/60 flex items-center justify-between">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Settings</p>
        <button class="md:hidden size-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground" @click="showMobileSidebar = false">
          <Icon name="i-lucide-x" class="size-4" />
        </button>
      </div>
      <nav class="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
          :class="activeTab === tab.id
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'"
          @click="navigateTo(`/admin/general-settings/${tab.id}`); showMobileSidebar = false"
        >
          <Icon :name="tab.icon" class="size-4 shrink-0" />
          <span class="text-sm font-medium">{{ tab.label }}</span>
        </button>
      </nav>
    </aside>

    <!-- ══════════════════════ RIGHT PANEL ══════════════════════ -->
    <main class="flex-1 flex flex-col min-h-0 h-full">

      <!-- Top toolbar -->
      <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 border-b border-border/60 bg-background/80 backdrop-blur-sm shrink-0">
        <!-- Mobile sidebar toggle -->
        <button
          class="md:hidden size-8 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted text-muted-foreground shrink-0"
          @click="showMobileSidebar = true"
        >
          <Icon name="i-lucide-panel-left" class="size-4" />
        </button>

        <div class="flex items-center gap-1.5 sm:gap-2">
          <Icon :name="tabs.find(t => t.id === activeTab)?.icon ?? 'i-lucide-settings'" class="size-4 sm:size-5 text-primary" />
          <h2 class="text-sm sm:text-base font-semibold">{{ tabs.find(t => t.id === activeTab)?.label }}</h2>
        </div>
        <div class="flex-1" />
        <Button v-if="activeTab === 'skill-bonus'" size="sm" class="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3" @click="openCreate">
          <Icon name="i-lucide-plus" class="mr-1 sm:mr-1.5 size-3 sm:size-3.5" />
          <span class="hidden xs:inline">Add Rule</span>
          <span class="xs:hidden">Add</span>
        </Button>
        <Button v-if="activeTab === 'workspaces'" size="sm" class="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3" @click="openWpCreate">
          <Icon name="i-lucide-plus" class="mr-1 sm:mr-1.5 size-3 sm:size-3.5" />
          <span class="hidden xs:inline">Add Workspace</span>
          <span class="xs:hidden">Add</span>
        </Button>
      </div>

      <!-- Content area -->
      <div class="flex-1 overflow-y-auto p-3 sm:p-5">

        <!-- ═══════ SKILL BONUS TAB ═══════ -->
        <template v-if="activeTab === 'skill-bonus'">

          <!-- Loading -->
          <div v-if="loading" class="space-y-3">
            <div class="h-10 bg-muted/60 rounded-lg animate-pulse" />
            <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-lg animate-pulse" />
          </div>

          <!-- Empty state -->
          <div v-else-if="records.length === 0" class="flex flex-col items-center justify-center py-16 sm:py-24 gap-3 sm:gap-4 text-center px-4">
            <div class="size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center">
              <Icon name="i-lucide-trophy" class="size-6 sm:size-8 text-amber-400" />
            </div>
            <h3 class="text-base sm:text-lg font-semibold">No Skill Bonus Rules</h3>
            <p class="text-xs sm:text-sm text-muted-foreground max-w-sm">
              Define bonus rules for skill assessments. Set reviewed times, results, and bonus amounts for each skill level.
            </p>
            <Button size="sm" @click="openCreate">
              <Icon name="i-lucide-plus" class="mr-1.5 size-3.5 sm:size-4" />
              Create First Rule
            </Button>
          </div>

          <!-- Data table -->
          <div v-else class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm" style="min-width: 520px">
                <thead>
                  <tr class="border-b border-border/50 bg-muted/30">
                    <th class="text-left px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">Skill Set</th>
                    <th class="text-center px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">Reviewed</th>
                    <th class="text-center px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">Supervisor</th>
                    <th class="text-right px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">Bonus</th>
                    <th class="w-16 sm:w-20 px-3 sm:px-4 py-2.5 sm:py-3" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="r in records"
                    :key="r._id"
                    class="group border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <!-- Skill Set -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3">
                      <span
                        class="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border"
                        :class="levelColor(r.skillSet)"
                      >
                        {{ r.skillSet }}
                      </span>
                    </td>

                    <!-- Reviewed Times -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                      <span class="inline-flex items-center justify-center size-6 sm:size-7 rounded-lg bg-muted/60 text-xs sm:text-sm font-bold border border-border/30">
                        {{ r.reviewedTimes }}
                      </span>
                    </td>

                    <!-- Supervisor Check -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                      <span
                        class="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border"
                        :class="r.supervisorCheck === 'Unique'
                          ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                          : 'bg-muted/60 text-muted-foreground border-border/40'"
                      >
                        <Icon :name="r.supervisorCheck === 'Unique' ? 'i-lucide-fingerprint' : 'i-lucide-users'" class="size-2.5 sm:size-3" />
                        {{ r.supervisorCheck || '—' }}
                      </span>
                    </td>

                    <!-- Bonus Amount -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3 text-right">
                      <span class="text-sm sm:text-base font-bold text-emerald-400">${{ r.bonusAmount.toFixed(2) }}</span>
                    </td>

                    <!-- Actions -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3">
                      <div class="flex items-center gap-0.5 sm:gap-1 justify-end sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          class="size-6 sm:size-7 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          @click="openEdit(r)"
                        >
                          <Icon name="i-lucide-pencil" class="size-3 sm:size-3.5" />
                        </button>
                        <button
                          class="size-6 sm:size-7 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          @click="deleteRecord(r._id)"
                        >
                          <Icon name="i-lucide-trash-2" class="size-3 sm:size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Summary cards -->
          <div v-if="records.length > 0" class="mt-3 sm:mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              <div class="size-8 sm:size-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
                <Icon name="i-lucide-trophy" class="size-4 sm:size-5 text-emerald-400" />
              </div>
              <div>
                <p class="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Rules</p>
                <p class="text-base sm:text-lg font-bold">{{ records.length }}</p>
              </div>
            </div>
            <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              <div class="size-8 sm:size-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
                <Icon name="i-lucide-dollar-sign" class="size-4 sm:size-5 text-blue-400" />
              </div>
              <div>
                <p class="text-[10px] sm:text-xs text-muted-foreground font-medium">Max Bonus</p>
                <p class="text-base sm:text-lg font-bold text-emerald-400">${{ Math.max(...records.map(r => r.bonusAmount)).toFixed(2) }}</p>
              </div>
            </div>
            <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              <div class="size-8 sm:size-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 flex items-center justify-center">
                <Icon name="i-lucide-layers" class="size-4 sm:size-5 text-violet-400" />
              </div>
              <div>
                <p class="text-[10px] sm:text-xs text-muted-foreground font-medium">Skill Levels</p>
                <p class="text-base sm:text-lg font-bold">{{ new Set(records.map(r => r.skillSet)).size }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- ═══════ WORKSPACES TAB ═══════ -->
        <template v-else-if="activeTab === 'workspaces'">
          <div v-if="loadingWp" class="space-y-3">
             <div class="h-10 bg-muted/60 rounded-lg animate-pulse" />
             <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-lg animate-pulse" />
          </div>

          <div v-else-if="workspaces.length === 0" class="flex flex-col items-center justify-center py-16 sm:py-24 gap-3 sm:gap-4 text-center px-4">
            <div class="size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Icon name="i-lucide-network" class="size-6 sm:size-8 text-primary" />
            </div>
            <h3 class="text-base sm:text-lg font-semibold">No Workspaces Found</h3>
            <p class="text-xs sm:text-sm text-muted-foreground max-w-sm">
              Create different workspaces to limit access to certain dashboard modules for your team.
            </p>
            <Button size="sm" @click="openWpCreate">
              <Icon name="i-lucide-plus" class="mr-1.5 size-3.5 sm:size-4" />
              Create Workspace
            </Button>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            <div 
              v-for="wp in workspaces" 
              :key="wp._id"
              class="relative rounded-xl border border-border/50 bg-card p-4 sm:p-5 group flex flex-col min-h-[140px] sm:min-h-[160px]"
            >
              <div v-if="wp.isLocked" class="absolute top-3 right-3 sm:top-4 sm:right-4" title="Admin Workspace is locked.">
                 <Icon name="i-lucide-lock" class="size-3.5 sm:size-4 text-amber-500/70" />
              </div>
              
              <div class="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div class="size-10 sm:size-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Icon :name="wp.logo || 'i-lucide-building'" class="size-5 sm:size-6 text-primary" />
                </div>
                <div>
                  <h3 class="font-bold text-sm sm:text-base line-clamp-1">{{ wp.name }}</h3>
                  <p class="text-[10px] sm:text-xs text-muted-foreground">{{ wp.plan || 'Workspace' }}</p>
                </div>
              </div>

              <div class="mt-auto">
                 <!-- Actions -->
                 <div class="flex items-center gap-1.5 sm:gap-2 pt-3 sm:pt-4 border-t border-border/50">
                    <Button variant="secondary" size="sm" class="flex-1 text-xs sm:text-sm h-8 sm:h-9" @click="openWpEdit(wp)">
                      <Icon name="i-lucide-settings-2" class="mr-1 sm:mr-1.5 size-3 sm:size-3.5" /> Configure
                    </Button>
                    <Button 
                      v-if="!wp.isLocked"
                      variant="outline" 
                      size="sm" 
                      class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      @click="deleteWorkspace(wp._id)"
                    >
                      <Icon name="i-lucide-trash-2" class="size-3.5" />
                    </Button>
                 </div>
              </div>
            </div>
          </div>
        </template>

      </div>
    </main>

    <!-- ═══════ CREATE / EDIT MODAL ═══════ -->
    <Dialog v-model:open="showCreateModal">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Edit Skill Bonus Rule' : 'Add Skill Bonus Rule' }}</DialogTitle>
          <DialogDescription>
            {{ editingId ? 'Update the bonus rule details.' : 'Define a new bonus rule for a skill level.' }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-5 py-3">
          <!-- Skill Set -->
          <div class="flex flex-col gap-1.5">
            <Label for="sb-skillset">Skill Set</Label>
            <Select v-model="form.skillSet">
              <SelectTrigger id="sb-skillset">
                <SelectValue placeholder="Select a skill level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="lvl in SKILL_LEVELS" :key="lvl" :value="lvl">{{ lvl }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Reviewed Times & Bonus Amount -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="sb-reviewed">Reviewed Times</Label>
              <Input id="sb-reviewed" v-model.number="form.reviewedTimes" type="number" min="0" placeholder="e.g. 2" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="sb-bonus">Bonus Amount ($)</Label>
              <Input id="sb-bonus" v-model.number="form.bonusAmount" type="number" min="0" step="0.01" placeholder="e.g. 0.04" />
            </div>
          </div>


          <!-- Supervisor Check -->
          <div class="flex flex-col gap-1.5">
            <Label for="sb-supervisor">Supervisor Check</Label>
            <Select v-model="form.supervisorCheck">
              <SelectTrigger id="sb-supervisor">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in SUPERVISOR_OPTIONS" :key="opt" :value="opt">{{ opt }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showCreateModal = false">Cancel</Button>
          <Button :disabled="saving" @click="saveRecord">
            <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            {{ editingId ? 'Save Changes' : 'Add Rule' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ═══════ WORKSPACE MODAL ═══════ -->
    <Dialog v-model:open="showWpModal">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ editingWpId ? 'Configure Workspace' : 'Add Workspace' }}</DialogTitle>
          <DialogDescription>
             Define the scope of this workspace and toggle exactly which modules its members can access.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-5 py-3 overflow-y-auto max-h-[65vh] pr-2">
          
          <div class="grid grid-cols-2 gap-4">
            <!-- Name -->
            <div class="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <Label for="wp-name">Workspace Name</Label>
              <Input id="wp-name" v-model="wpForm.name" placeholder="Management Team" />
            </div>
            <!-- Plan Label -->
            <div class="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <Label for="wp-plan">Badge / Plan Name</Label>
              <Input id="wp-plan" v-model="wpForm.plan" placeholder="Full Access" />
            </div>
          </div>

          <!-- Logo -->
          <div class="flex flex-col gap-2">
            <Label>Workspace Icon</Label>
            <div class="flex flex-wrap gap-2">
               <button
                 v-for="icon in WpIconsList" :key="icon"
                 class="size-10 rounded-lg border flex items-center justify-center transition-all"
                 :class="wpForm.logo === icon ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted'"
                 @click="wpForm.logo = icon"
               >
                 <Icon :name="icon" class="size-5" />
               </button>
            </div>
          </div>

          <Separator class="my-1" />

          <!-- Permissions Builder -->
          <div class="flex flex-col gap-4">
             <div>
                <Label class="text-base font-semibold">Menu Access & Permissions</Label>
                <p class="text-xs text-muted-foreground mt-0.5 mb-4">Toggle modules on/off and configure granular CRUD permissions for each route.</p>
             </div>

             <!-- Render all grouped menus -->
             <div class="grid grid-cols-1 gap-5">
                <div v-for="g in menusByGroup" :key="g.group" class="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                   <div class="px-4 py-2.5 bg-muted/30 border-b border-border/50 flex items-center justify-between">
                      <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ g.group }}</span>
                      <button class="text-[10px] font-medium text-primary hover:underline uppercase" @click="toggleGroup(g.items)">
                         {{ hasAllInGroup(g.items) ? 'Deselect All' : 'Select All' }}
                      </button>
                   </div>
                   <div class="divide-y divide-border/30 bg-card">
                      <div 
                         v-for="item in g.items" 
                         :key="item.id" 
                         class="transition-all duration-200"
                         :class="wpForm.allowedMenus.includes(item.id) ? 'bg-card' : 'bg-muted/10 opacity-50'"
                      >
                         <!-- Menu toggle row -->
                         <div 
                           class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                           @click="toggleMenu(item.id)"
                         >
                           <div 
                             class="size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                             :class="wpForm.allowedMenus.includes(item.id) ? 'bg-primary/10 border border-primary/20' : 'bg-muted border border-border/50'"
                           >
                             <Icon :name="getCaps(item.id).icon" class="size-4" :class="wpForm.allowedMenus.includes(item.id) ? 'text-primary' : 'text-muted-foreground'" />
                           </div>
                           <div class="flex-1 min-w-0">
                             <span class="font-medium text-sm" :class="wpForm.allowedMenus.includes(item.id) ? 'text-foreground' : 'text-muted-foreground'">{{ item.title }}</span>
                             <p v-if="isViewOnly(item.id) && wpForm.allowedMenus.includes(item.id)" class="text-[10px] text-blue-500/70 mt-0.5 flex items-center gap-1">
                               <Icon name="i-lucide-lock" class="size-2.5" />
                               View only — no editable actions
                             </p>
                           </div>
                           <div class="shrink-0">
                             <div 
                               class="size-5 rounded-md border-2 flex items-center justify-center transition-all"
                               :class="wpForm.allowedMenus.includes(item.id) ? 'bg-primary border-primary' : 'border-border'"
                             >
                               <Icon v-if="wpForm.allowedMenus.includes(item.id)" name="i-lucide-check" class="size-3 text-primary-foreground" />
                             </div>
                           </div>
                         </div>

                         <!-- CRUD Permission pills (shown when active & has multiple ops) -->
                         <div 
                           v-if="wpForm.allowedMenus.includes(item.id) && !isViewOnly(item.id)" 
                           class="px-4 pb-3 pt-0 ml-11"
                         >
                           <div class="flex flex-wrap gap-1.5">
                             <button
                               v-for="op in getCaps(item.id).ops"
                               :key="op"
                               class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer"
                               :class="hasPerm(item.id, op) 
                                 ? OP_META[op]?.color 
                                 : 'bg-muted/30 text-muted-foreground/40 border-border/30 hover:bg-muted/50'"
                               :title="op === 'read' ? 'View is always enabled' : `Toggle ${OP_META[op]?.label ?? op}`"
                               @click.stop="togglePerm(item.id, op)"
                             >
                               <Icon :name="OP_META[op]?.icon ?? 'i-lucide-circle'" class="size-2.5" />
                               {{ OP_META[op]?.label ?? op }}
                               <Icon v-if="op === 'read'" name="i-lucide-lock" class="size-2 opacity-50" />
                             </button>
                           </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" @click="showWpModal = false">Cancel</Button>
          <Button :disabled="savingWp" @click="saveWorkspace">
            <Icon v-if="savingWp" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            {{ editingWpId ? 'Save Configuration' : 'Create Workspace' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>
