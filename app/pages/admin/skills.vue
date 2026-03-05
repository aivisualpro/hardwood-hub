<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Skills', icon: 'i-lucide-graduation-cap', description: 'Manage skill categories and competencies' })

// ─── Types ───────────────────────────────────────────────
interface SkillItem {
  _id: string
  name: string
  category: string
  subCategory: string
  isRequired?: boolean
}
interface SubCat {
  _id: string
  name: string
  category: string
  predecessor?: string
  predecessorName?: string
  skills: SkillItem[]
}
interface Cat {
  _id: string
  name: string
  color?: string
  subCategories: SubCat[]
}

// ─── State ───────────────────────────────────────────────
const tree = ref<Cat[]>([])
const loading = ref(true)
const selectedCatId = ref<string | null>(null)
const expandedSubs = ref<Set<string>>(new Set())
const searchQuery = ref('')

// ─── Modal state (create only) ───────────────────────────
const showSkillModal = ref(false)
const savingSkill = ref(false)
const skillForm = ref({ skill: '', isRequired: false, category: '', subCategory: '' })

// ─── Inline edit state ───────────────────────────────────
const editingSkillId = ref<string | null>(null)
const editingForm = ref({ skill: '', isRequired: false })

// ─── Predecessor picker state ─────────────────────────────
const editingPredecessorSubId = ref<string | null>(null)
const predecessorSearch = ref('')

// ─── Initial load ────────────────────────────────────────
async function fetchTree() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: Cat[] }>('/api/skills/tree')
    tree.value = res.data
    if (res.data.length && !selectedCatId.value) {
      const firstCat = res.data[0]
      if (firstCat) {
        selectedCatId.value = firstCat._id
        const firstSub = firstCat.subCategories[0]
        if (firstSub) expandedSubs.value.add(firstSub._id)
      }
    }
  }
  catch (e: any) {
    toast.error('Failed to load skills', { description: e?.message })
  }
  finally { loading.value = false }
}

onMounted(fetchTree)

// ─── Optimistic tree helpers ──────────────────────────────
function findSkill(id: string) {
  for (const cat of tree.value) {
    for (const sub of cat.subCategories) {
      const skill = sub.skills.find(s => s._id === id)
      if (skill) return { cat, sub, skill }
    }
  }
  return null
}

function findSub(id: string) {
  for (const cat of tree.value) {
    const sub = cat.subCategories.find(s => s._id === id)
    if (sub) return { cat, sub }
  }
  return null
}

// ─── Derived state ────────────────────────────────────────
const selectedCat = computed(() => tree.value.find(c => c._id === selectedCatId.value) ?? null)

const filteredSubs = computed(() => {
  if (!selectedCat.value) return []
  const q = searchQuery.value.toLowerCase()
  if (!q) return selectedCat.value.subCategories
  return selectedCat.value.subCategories
    .map(sub => ({
      ...sub,
      skills: sub.skills.filter(sk => sk.name.toLowerCase().includes(q)),
    }))
    .filter(sub => sub.skills.length > 0 || sub.name.toLowerCase().includes(q))
})

function catSkillCount(cat: Cat) {
  return cat.subCategories.reduce((sum, s) => sum + s.skills.length, 0)
}

const allSubs = computed(() =>
  tree.value.flatMap(cat =>
    cat.subCategories.map(sub => ({
      _id: sub._id,
      name: sub.name,
      categoryName: cat.name,
    }))
  ).sort((a, b) => a.name.localeCompare(b.name))
)

const filteredPredecessors = computed(() => {
  const q = predecessorSearch.value.toLowerCase()
  if (!q) return allSubs.value
  return allSubs.value.filter(
    s => s.name.toLowerCase().includes(q) || s.categoryName.toLowerCase().includes(q),
  )
})

// ─── Accordion toggle ────────────────────────────────────
function toggleSub(id: string) {
  if (expandedSubs.value.has(id)) expandedSubs.value.delete(id)
  else expandedSubs.value.add(id)
}

// ─── Palette ─────────────────────────────────────────────
const palette = [
  'from-violet-500/20 to-purple-500/10 border-violet-500/30',
  'from-cyan-500/20 to-sky-500/10 border-cyan-500/30',
  'from-emerald-500/20 to-green-500/10 border-emerald-500/30',
  'from-orange-500/20 to-amber-500/10 border-orange-500/30',
  'from-rose-500/20 to-pink-500/10 border-rose-500/30',
  'from-blue-500/20 to-indigo-500/10 border-blue-500/30',
]
const dotPalette = ['bg-violet-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-blue-500']
const textPalette = ['text-violet-400', 'text-cyan-400', 'text-emerald-400', 'text-orange-400', 'text-rose-400', 'text-blue-400']
function catGradient(idx: number) { return palette[idx % palette.length] }
function catDot(idx: number) { return dotPalette[idx % dotPalette.length] }
function catText(idx: number) { return textPalette[idx % textPalette.length] }
const selectedCatIndex = computed(() => tree.value.findIndex(c => c._id === selectedCatId.value))

// ══════════════════════════════════════════════════════════
// OPTIMISTIC MUTATIONS — UI updates instantly, API fires in BG
// ══════════════════════════════════════════════════════════

// ─── CREATE skill ─────────────────────────────────────────
function openCreateSkill(catId: string, subCatId: string) {
  skillForm.value = { skill: '', isRequired: false, category: catId, subCategory: subCatId }
  showSkillModal.value = true
}

async function saveSkill() {
  if (!skillForm.value.skill.trim()) return toast.error('Skill name is required')
  savingSkill.value = true

  // Optimistic: close modal immediately, add placeholder
  const tempId = `temp-${Date.now()}`
  const newSkill: SkillItem = {
    _id: tempId,
    name: skillForm.value.skill,
    isRequired: skillForm.value.isRequired,
    category: skillForm.value.category,
    subCategory: skillForm.value.subCategory,
  }
  const targetSub = findSub(skillForm.value.subCategory)
  if (targetSub) targetSub.sub.skills.push(newSkill)
  showSkillModal.value = false

  try {
    const res = await $fetch<{ success: boolean, data: any }>('/api/skills', {
      method: 'POST',
      body: skillForm.value,
    })
    // Replace temp _id with real one from server
    if (targetSub) {
      const idx = targetSub.sub.skills.findIndex(s => s._id === tempId)
      if (idx !== -1 && res.data?._id) targetSub.sub.skills[idx]!._id = res.data._id
    }
    toast.success('Skill added')
  }
  catch (e: any) {
    // Revert: remove the temp skill
    if (targetSub) {
      const idx = targetSub.sub.skills.findIndex(s => s._id === tempId)
      if (idx !== -1) targetSub.sub.skills.splice(idx, 1)
    }
    showSkillModal.value = true
    toast.error('Failed to create skill', { description: e?.message })
  }
  finally { savingSkill.value = false }
}

// ─── INLINE EDIT skill ───────────────────────────────────
function startInlineEdit(sk: SkillItem) {
  editingSkillId.value = sk._id
  editingForm.value = { skill: sk.name, isRequired: sk.isRequired ?? false }
}

function cancelInlineEdit() {
  editingSkillId.value = null
}

async function saveInlineEdit(id: string) {
  if (!editingForm.value.skill.trim()) return toast.error('Skill name is required')

  const found = findSkill(id)
  if (!found) return

  // Snapshot for revert
  const prev = { name: found.skill.name, isRequired: found.skill.isRequired }

  // Optimistic: update local state instantly, close editor
  found.skill.name = editingForm.value.skill
  found.skill.isRequired = editingForm.value.isRequired
  editingSkillId.value = null

  try {
    await $fetch(`/api/skills/${id}`, { method: 'PUT', body: editingForm.value })
    toast.success('Skill updated', { duration: 2000 })
  }
  catch (e: any) {
    // Revert local state
    found.skill.name = prev.name
    found.skill.isRequired = prev.isRequired
    editingSkillId.value = id // reopen editor
    toast.error('Update failed', { description: e?.message })
  }
}

// ─── DELETE skill ─────────────────────────────────────────
async function deleteSkill(id: string) {
  const found = findSkill(id)
  if (!found) return

  // Snapshot for revert
  const snapshot = { ...found.skill }
  const idx = found.sub.skills.findIndex(s => s._id === id)

  // Optimistic: remove immediately
  found.sub.skills.splice(idx, 1)

  try {
    await $fetch(`/api/skills/${id}`, { method: 'DELETE' })
    toast.success('Skill removed', { duration: 2000 })
  }
  catch (e: any) {
    // Revert
    found.sub.skills.splice(idx, 0, snapshot)
    toast.error('Delete failed', { description: e?.message })
  }
}

// ─── SET predecessor ──────────────────────────────────────
async function savePredecessor(subId: string, predecessorId: string | null) {
  const found = findSub(subId)
  if (!found) return

  // Snapshot for revert
  const prev = { predecessor: found.sub.predecessor, predecessorName: found.sub.predecessorName }

  // Optimistic: update local state + close picker immediately
  found.sub.predecessor = predecessorId ?? ''
  found.sub.predecessorName = predecessorId
    ? (allSubs.value.find(s => s._id === predecessorId)?.name ?? '')
    : ''
  editingPredecessorSubId.value = null
  predecessorSearch.value = ''

  try {
    await $fetch(`/api/subcategories/${subId}`, {
      method: 'PUT',
      body: { predecessor: predecessorId ?? '' },
    })
    toast.success(predecessorId ? 'Predecessor set' : 'Predecessor removed', { duration: 2000 })
  }
  catch (e: any) {
    // Revert
    found.sub.predecessor = prev.predecessor
    found.sub.predecessorName = prev.predecessorName
    toast.error('Failed to update predecessor', { description: e?.message })
  }
}
</script>
<template>
  <div class="flex gap-0 -m-4 lg:-m-6 h-[calc(100vh-theme(spacing.16))] overflow-hidden">

    <!-- ══════════════════════ LEFT PANEL: Category sidebar ══════════════════════ -->
    <aside class="w-64 shrink-0 border-r border-border/60 bg-background flex flex-col h-full">
      <!-- Header -->
      <div class="px-4 py-4 border-b border-border/60">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Categories</p>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="p-3 flex flex-col gap-2">
        <div v-for="i in 5" :key="i" class="h-10 rounded-lg bg-muted animate-pulse" />
      </div>

      <!-- Category list -->
      <nav v-else class="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        <button
          v-for="(cat, idx) in tree"
          :key="cat._id"
          class="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 relative"
          :class="selectedCatId === cat._id
            ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
          @click="selectedCatId = cat._id"
        >
          <!-- Color dot -->
          <span
            class="size-2 rounded-full shrink-0 transition-transform duration-150 group-hover:scale-110"
            :class="catDot(idx)"
          />
          <span class="flex-1 text-sm font-medium truncate">{{ cat.name }}</span>
          <!-- Skill count badge -->
          <span
            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 transition-all"
            :class="selectedCatId === cat._id
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-muted text-muted-foreground border-border/40'"
          >
            {{ catSkillCount(cat) }}
          </span>
        </button>

        <!-- Empty state -->
        <div v-if="!tree.length" class="flex flex-col items-center justify-center py-12 gap-3 px-4 text-center">
          <div class="size-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="i-lucide-layers" class="size-5 text-muted-foreground" />
          </div>
          <p class="text-xs text-muted-foreground">No categories yet</p>
        </div>
      </nav>
    </aside>

    <!-- ══════════════════════ RIGHT PANEL: Skills content ══════════════════════ -->
    <main class="flex-1 flex flex-col min-h-0 h-full">

      <!-- Top toolbar -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <!-- Category pill -->
        <div
          v-if="selectedCat"
          class="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium bg-gradient-to-r shrink-0"
          :class="catGradient(selectedCatIndex)"
        >
          <span class="size-2 rounded-full" :class="catDot(selectedCatIndex)" />
          <span :class="catText(selectedCatIndex)">{{ selectedCat.name }}</span>
        </div>

        <!-- Search -->
        <div class="relative flex-1 max-w-xs">
          <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          <Input v-model="searchQuery" placeholder="Search skills…" class="pl-9 h-9 bg-muted/50 border-border/50" />
        </div>

        <div class="flex-1" />

        <!-- Sub-stats -->
        <div v-if="selectedCat" class="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <Icon name="i-lucide-layers-2" class="size-3.5" />
            {{ selectedCat.subCategories.length }} sub-categories
          </span>
          <span class="flex items-center gap-1.5">
            <Icon name="i-lucide-star" class="size-3.5" />
            {{ catSkillCount(selectedCat) }} skills
          </span>
        </div>
      </div>

      <!-- Skills content area -->
      <div class="p-5 flex-1 overflow-y-auto">

        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col gap-4">
          <div v-for="i in 3" :key="i" class="rounded-xl border border-border/50 overflow-hidden animate-pulse">
            <div class="h-12 bg-muted/60" />
            <div class="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              <div v-for="j in 4" :key="j" class="h-20 rounded-lg bg-muted/40" />
            </div>
          </div>
        </div>

        <!-- No category selected -->
        <div v-else-if="!selectedCat" class="flex flex-col items-center justify-center h-full gap-4 text-center py-24">
          <div class="size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Icon name="i-lucide-graduation-cap" class="size-8 text-primary" />
          </div>
          <h3 class="text-lg font-semibold">Select a category</h3>
          <p class="text-sm text-muted-foreground max-w-xs">Choose a skill category from the left panel to view and manage its sub-categories and skills.</p>
        </div>

        <!-- No results for search -->
        <div v-else-if="filteredSubs.length === 0 && searchQuery" class="flex flex-col items-center justify-center py-24 gap-3">
          <Icon name="i-lucide-search-x" class="size-10 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">No skills match "<strong>{{ searchQuery }}</strong>"</p>
          <Button variant="ghost" size="sm" @click="searchQuery = ''">Clear search</Button>
        </div>

        <!-- SubCategory accordions -->
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="sub in filteredSubs"
            :key="sub._id"
            class="rounded-xl border border-border/50 bg-card shadow-xs transition-shadow hover:shadow-sm"
          >
            <!-- Accordion header -->
            <div
              role="button"
              tabindex="0"
              class="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors group cursor-pointer select-none"
              @click="toggleSub(sub._id)"
              @keydown.enter.space.prevent="toggleSub(sub._id)"
            >
              <!-- Expand icon -->
              <Icon
                name="i-lucide-chevron-right"
                class="size-4 text-muted-foreground transition-transform duration-200 shrink-0"
                :class="expandedSubs.has(sub._id) ? 'rotate-90' : ''"
              />

              <!-- Sub icon -->
              <div
                class="size-7 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br"
                :class="catGradient(selectedCatIndex)"
              >
                <Icon name="i-lucide-tag" class="size-3.5" :class="catText(selectedCatIndex)" />
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold">{{ sub.name }}</p>
                <!-- Predecessor label (view mode) -->
                <p v-if="sub.predecessorName && editingPredecessorSubId !== sub._id" class="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Icon name="i-lucide-arrow-right" class="size-3 shrink-0" />
                  <span class="truncate">{{ sub.predecessorName }}</span>
                </p>
              </div>

              <!-- Predecessor picker trigger -->
              <div
                role="button"
                tabindex="0"
                class="relative shrink-0"
                @click.stop
                @keydown.enter.stop
              >
                <!-- Trigger button -->
                <div
                  class="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer"
                  :class="sub.predecessor
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                    : 'opacity-0 group-hover:opacity-100 bg-muted/60 text-muted-foreground border-border/40 hover:bg-muted'"
                  @click.stop="editingPredecessorSubId = editingPredecessorSubId === sub._id ? null : sub._id; predecessorSearch = ''"
                >
                  <Icon name="i-lucide-git-branch" class="size-3" />
                  <span class="max-w-[100px] truncate">
                    {{ sub.predecessorName || 'Predecessor' }}
                  </span>
                </div>

                <!-- Dropdown panel -->
                <Transition
                  enter-active-class="transition-all duration-150 ease-out"
                  enter-from-class="opacity-0 scale-95 -translate-y-1"
                  enter-to-class="opacity-100 scale-100 translate-y-0"
                  leave-active-class="transition-all duration-100 ease-in"
                  leave-from-class="opacity-100 scale-100 translate-y-0"
                  leave-to-class="opacity-0 scale-95 -translate-y-1"
                >
                  <div
                    v-if="editingPredecessorSubId === sub._id"
                    class="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
                  >
                    <!-- Search -->
                    <div class="p-2 border-b border-border/50">
                      <div class="relative">
                        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                          v-model="predecessorSearch"
                          placeholder="Search sub-categories…"
                          class="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-muted/50 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                          @click.stop
                        />
                      </div>
                    </div>

                    <!-- Options list -->
                    <div class="max-h-56 overflow-y-auto py-1">
                      <!-- Clear predecessor -->
                      <div
                        v-if="sub.predecessor"
                        class="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                        @click.stop="savePredecessor(sub._id, null)"
                      >
                        <Icon name="i-lucide-x" class="size-3.5 text-destructive/70" />
                        <span class="italic">Remove predecessor</span>
                      </div>

                      <!-- Sub-category options (exclude self) -->
                      <div
                        v-for="opt in filteredPredecessors.filter(s => s._id !== sub._id)"
                        :key="opt._id"
                        class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/50"
                        :class="sub.predecessor === opt._id ? 'bg-primary/10' : ''"
                        @click.stop="savePredecessor(sub._id, opt._id)"
                      >
                        <Icon
                          name="i-lucide-check"
                          class="size-3.5 shrink-0 transition-opacity"
                          :class="sub.predecessor === opt._id ? 'text-primary opacity-100' : 'opacity-0'"
                        />
                        <div class="min-w-0">
                          <p class="text-xs font-medium truncate">{{ opt.name }}</p>
                          <p class="text-[10px] text-muted-foreground/70">{{ opt.categoryName }}</p>
                        </div>
                      </div>

                      <!-- Empty search state -->
                      <div v-if="filteredPredecessors.filter(s => s._id !== sub._id).length === 0" class="px-3 py-4 text-xs text-muted-foreground text-center">
                        No results
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>

              <!-- Skill count -->
              <span class="text-xs font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border/40 shrink-0">
                {{ sub.skills.length }} skill{{ sub.skills.length !== 1 ? 's' : '' }}
              </span>

              <!-- Add skill (visible on hover) -->
              <div
                role="button"
                tabindex="0"
                class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 shrink-0 cursor-pointer"
                @click.stop="openCreateSkill(selectedCat!._id, sub._id)"
                @keydown.enter.stop="openCreateSkill(selectedCat!._id, sub._id)"
              >
                <Icon name="i-lucide-plus" class="size-3" />
                Add
              </div>
            </div>

            <!-- Accordion body: Skills grid -->
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition-all duration-150 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div v-if="expandedSubs.has(sub._id)" class="border-t border-border/40 bg-muted/20 overflow-hidden">
                <!-- Empty sub-category -->
                <div v-if="sub.skills.length === 0" class="flex flex-col items-center justify-center py-8 gap-2">
                  <Icon name="i-lucide-sparkles" class="size-6 text-muted-foreground/50" />
                  <p class="text-xs text-muted-foreground">No skills yet in this sub-category</p>
                  <Button size="sm" variant="outline" class="mt-1" @click="openCreateSkill(selectedCat!._id, sub._id)">
                    <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
                    Add first skill
                  </Button>
                </div>

                  <!-- Skills grid -->
                  <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
                    <div
                      v-for="sk in sub.skills"
                      :key="sk._id"
                      class="group/card relative flex flex-col gap-2.5 rounded-lg border bg-background p-3.5 transition-all duration-150"
                      :class="editingSkillId === sk._id
                        ? 'border-primary/40 shadow-md ring-1 ring-primary/20'
                        : 'border-border/50 hover:shadow-md hover:border-border'"
                    >
                      <!-- ── VIEW MODE ── -->
                      <template v-if="editingSkillId !== sk._id">
                        <!-- Action buttons (top-right, hover) -->
                        <div class="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                          <button
                            class="size-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            @click="startInlineEdit(sk)"
                          >
                            <Icon name="i-lucide-pencil" class="size-3" />
                          </button>
                          <button
                            class="size-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            @click="deleteSkill(sk._id)"
                          >
                            <Icon name="i-lucide-trash-2" class="size-3" />
                          </button>
                        </div>

                        <!-- Skill text -->
                        <p class="text-sm leading-relaxed pr-12">{{ sk.name }}</p>

                        <!-- Required badge -->
                        <div v-if="sk.isRequired" class="mt-auto">
                          <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-rose-500/15 text-rose-400 border-rose-500/30">
                            <Icon name="i-lucide-star" class="size-2.5" />
                            Required
                          </span>
                        </div>
                      </template>

                      <!-- ── EDIT MODE (inline) ── -->
                      <template v-else>
                        <!-- Editable skill text -->
                        <textarea
                          v-model="editingForm.skill"
                          rows="3"
                          class="w-full resize-none rounded-md border border-input bg-muted/40 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                          placeholder="Skill description…"
                        />

                        <!-- Required toggle -->
                        <div class="flex items-center justify-between">
                          <span class="text-xs text-muted-foreground font-medium">Required</span>
                          <button
                            type="button"
                            role="switch"
                            :aria-checked="editingForm.isRequired"
                            class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
                            :class="editingForm.isRequired ? 'bg-primary' : 'bg-muted'"
                            @click="editingForm.isRequired = !editingForm.isRequired"
                          >
                            <span
                              class="pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
                              :class="editingForm.isRequired ? 'translate-x-4' : 'translate-x-0'"
                            />
                          </button>
                        </div>

                        <!-- Save / Cancel -->
                        <div class="flex gap-2 pt-0.5">
                          <button
                            class="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            @click="saveInlineEdit(sk._id)"
                          >
                            <Icon name="i-lucide-check" class="size-3" />
                            Save
                          </button>
                          <button
                            class="flex-1 text-xs font-medium py-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                            @click="cancelInlineEdit()"
                          >
                            Cancel
                          </button>
                        </div>
                      </template>
                    </div>
                  </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </main>

    <!-- ══════════════════════ CREATE SKILL MODAL ══════════════════════ -->
    <Dialog v-model:open="showSkillModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Skill</DialogTitle>
          <DialogDescription>Create a new skill in this sub-category.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <Label for="skill-name">Skill Name</Label>
            <Input id="skill-name" v-model="skillForm.skill" placeholder="e.g. Hardwood Flooring Installation" />
          </div>

          <!-- isRequired toggle -->
          <div class="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
            <div>
              <p class="text-sm font-medium">Required Skill</p>
              <p class="text-xs text-muted-foreground">Mark this as a mandatory competency</p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="skillForm.isRequired"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="skillForm.isRequired ? 'bg-primary' : 'bg-muted'"
              @click="skillForm.isRequired = !skillForm.isRequired"
            >
              <span
                class="pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200"
                :class="skillForm.isRequired ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showSkillModal = false">Cancel</Button>
          <Button :disabled="savingSkill" @click="saveSkill">
            <Icon v-if="savingSkill" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            Add Skill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>
