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
  isLocked: boolean
}

// ─── State ───────────────────────────────────────────────
const activeTab = ref('skill-bonus')
const records = ref<SkillBonusRecord[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)

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
  allowedMenus: [] as string[]
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
    allowedMenus: [...rec.allowedMenus]
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
    
    // Refresh the page to reload the dynamic sidebar
    if (editingWpId.value) {
      setTimeout(() => location.reload(), 500)
    }
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
   } else {
      for (const i of groupItems) {
         if (!wpForm.value.allowedMenus.includes(i.id)) {
            wpForm.value.allowedMenus.push(i.id)
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

    <!-- ══════════════════════ LEFT PANEL: Tabs sidebar ══════════════════════ -->
    <aside class="w-56 shrink-0 border-r border-border/60 bg-background flex flex-col h-full">
      <div class="px-4 py-4 border-b border-border/60">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Settings</p>
      </div>
      <nav class="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
          :class="activeTab === tab.id
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'"
          @click="activeTab = tab.id"
        >
          <Icon :name="tab.icon" class="size-4 shrink-0" />
          <span class="text-sm font-medium">{{ tab.label }}</span>
        </button>
      </nav>
    </aside>

    <!-- ══════════════════════ RIGHT PANEL ══════════════════════ -->
    <main class="flex-1 flex flex-col min-h-0 h-full">

      <!-- Top toolbar -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-border/60 bg-background/80 backdrop-blur-sm shrink-0">
        <div class="flex items-center gap-2">
          <Icon :name="tabs.find(t => t.id === activeTab)?.icon ?? 'i-lucide-settings'" class="size-5 text-primary" />
          <h2 class="text-base font-semibold">{{ tabs.find(t => t.id === activeTab)?.label }}</h2>
        </div>
        <div class="flex-1" />
        <Button v-if="activeTab === 'skill-bonus'" size="sm" @click="openCreate">
          <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
          Add Rule
        </Button>
        <Button v-if="activeTab === 'workspaces'" size="sm" @click="openWpCreate">
          <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
          Add Workspace
        </Button>
      </div>

      <!-- Content area -->
      <div class="flex-1 overflow-y-auto p-5">

        <!-- ═══════ SKILL BONUS TAB ═══════ -->
        <template v-if="activeTab === 'skill-bonus'">

          <!-- Loading -->
          <div v-if="loading" class="space-y-3">
            <div class="h-10 bg-muted/60 rounded-lg animate-pulse" />
            <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-lg animate-pulse" />
          </div>

          <!-- Empty state -->
          <div v-else-if="records.length === 0" class="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div class="size-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center">
              <Icon name="i-lucide-trophy" class="size-8 text-amber-400" />
            </div>
            <h3 class="text-lg font-semibold">No Skill Bonus Rules</h3>
            <p class="text-sm text-muted-foreground max-w-sm">
              Define bonus rules for skill assessments. Set reviewed times, results, and bonus amounts for each skill level.
            </p>
            <Button @click="openCreate">
              <Icon name="i-lucide-plus" class="mr-1.5 size-4" />
              Create First Rule
            </Button>
          </div>

          <!-- Data table -->
          <div v-else class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border/50 bg-muted/30">
                  <th class="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Skill Set</th>
                  <th class="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Reviewed Times</th>
                  <th class="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Supervisor Check</th>
                  <th class="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Bonus Amount</th>
                  <th class="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in records"
                  :key="r._id"
                  class="group border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <!-- Skill Set -->
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
                      :class="levelColor(r.skillSet)"
                    >
                      {{ r.skillSet }}
                    </span>
                  </td>

                  <!-- Reviewed Times -->
                  <td class="px-4 py-3 text-center">
                    <span class="inline-flex items-center justify-center size-7 rounded-lg bg-muted/60 text-sm font-bold border border-border/30">
                      {{ r.reviewedTimes }}
                    </span>
                  </td>


                  <!-- Supervisor Check -->
                  <td class="px-4 py-3 text-center">
                    <span
                      class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                      :class="r.supervisorCheck === 'Unique'
                        ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                        : 'bg-muted/60 text-muted-foreground border-border/40'"
                    >
                      <Icon :name="r.supervisorCheck === 'Unique' ? 'i-lucide-fingerprint' : 'i-lucide-users'" class="size-3" />
                      {{ r.supervisorCheck || '—' }}
                    </span>
                  </td>

                  <!-- Bonus Amount -->
                  <td class="px-4 py-3 text-right">
                    <span class="text-base font-bold text-emerald-400">${{ r.bonusAmount.toFixed(2) }}</span>
                  </td>

                  <!-- Actions -->
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        class="size-7 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        @click="openEdit(r)"
                      >
                        <Icon name="i-lucide-pencil" class="size-3.5" />
                      </button>
                      <button
                        class="size-7 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        @click="deleteRecord(r._id)"
                      >
                        <Icon name="i-lucide-trash-2" class="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Summary cards -->
          <div v-if="records.length > 0" class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
              <div class="size-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
                <Icon name="i-lucide-trophy" class="size-5 text-emerald-400" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground font-medium">Total Rules</p>
                <p class="text-lg font-bold">{{ records.length }}</p>
              </div>
            </div>
            <div class="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
              <div class="size-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
                <Icon name="i-lucide-dollar-sign" class="size-5 text-blue-400" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground font-medium">Max Bonus</p>
                <p class="text-lg font-bold text-emerald-400">${{ Math.max(...records.map(r => r.bonusAmount)).toFixed(2) }}</p>
              </div>
            </div>
            <div class="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
              <div class="size-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 flex items-center justify-center">
                <Icon name="i-lucide-layers" class="size-5 text-violet-400" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground font-medium">Skill Levels</p>
                <p class="text-lg font-bold">{{ new Set(records.map(r => r.skillSet)).size }}</p>
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

          <div v-else-if="workspaces.length === 0" class="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div class="size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Icon name="i-lucide-network" class="size-8 text-primary" />
            </div>
            <h3 class="text-lg font-semibold">No Workspaces Found</h3>
            <p class="text-sm text-muted-foreground max-w-sm">
              Create different workspaces to limit access to certain dashboard modules for your team.
            </p>
            <Button @click="openWpCreate">
              <Icon name="i-lucide-plus" class="mr-1.5 size-4" />
              Create Workspace
            </Button>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div 
              v-for="wp in workspaces" 
              :key="wp._id"
              class="relative rounded-xl border border-border/50 bg-card p-5 group flex flex-col min-h-[160px]"
            >
              <div v-if="wp.isLocked" class="absolute top-4 right-4" title="Admin Workspace is locked.">
                 <Icon name="i-lucide-lock" class="size-4 text-amber-500/70" />
              </div>
              
              <div class="flex items-center gap-4 mb-4">
                <div class="size-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Icon :name="wp.logo || 'i-lucide-building'" class="size-6 text-primary" />
                </div>
                <div>
                  <h3 class="font-bold text-base line-clamp-1">{{ wp.name }}</h3>
                  <p class="text-xs text-muted-foreground">{{ wp.plan || 'Workspace' }}</p>
                </div>
              </div>

              <div class="mt-auto">
                 <!-- Actions -->
                 <div class="flex items-center gap-2 pt-4 border-t border-border/50">
                    <Button variant="secondary" size="sm" class="flex-1" @click="openWpEdit(wp)">
                      <Icon name="i-lucide-settings-2" class="mr-1.5 size-3.5" /> Configure
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
                <Label class="text-base font-semibold">Dashboard Menu Visibility</Label>
                <p class="text-xs text-muted-foreground mt-0.5 mb-4">Toggle switches to allow these modules to render in the sidebar for this workspace.</p>
             </div>

             <!-- Render all grouped menus -->
             <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div v-for="g in menusByGroup" :key="g.group" class="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                   <div class="px-4 py-2 bg-muted/30 border-b border-border/50 flex items-center justify-between">
                      <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ g.group }}</span>
                      <button class="text-[10px] font-medium text-primary hover:underline uppercase" @click="toggleGroup(g.items)">
                         {{ hasAllInGroup(g.items) ? 'Deselect All' : 'Select All' }}
                      </button>
                   </div>
                   <div class="p-2 flex flex-col gap-1 text-sm bg-card">
                      <label 
                         v-for="item in g.items" 
                         :key="item.id" 
                         class="group flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                         <span class="font-medium text-foreground group-hover:text-primary transition-colors select-none">{{ item.title }}</span>
                         <input 
                            type="checkbox" 
                            :value="item.id" 
                            v-model="wpForm.allowedMenus" 
                            class="size-4 rounded border-input bg-background text-primary focus:ring-primary focus:ring-offset-background"
                          />
                      </label>
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
