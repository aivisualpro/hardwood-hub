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
  description?: string
  level?: string
  icon?: string
  isRequired?: boolean
}
interface SubCat {
  _id: string
  name: string
  Category: string
  description?: string
  icon?: string
  skills: SkillItem[]
}
interface Cat {
  _id: string
  name: string
  description?: string
  color?: string
  subCategories: SubCat[]
}

// ─── State ───────────────────────────────────────────────
const tree = ref<Cat[]>([])
const loading = ref(true)
const selectedCatId = ref<string | null>(null)
const expandedSubs = ref<Set<string>>(new Set())
const searchQuery = ref('')

// ─── Modal state ─────────────────────────────────────────
const showSkillModal = ref(false)
const savingSkill = ref(false)
const editSkillId = ref<string | null>(null)
const skillForm = ref({ skill: '', isRequired: false, category: '', subCategory: '' })

// ─── Fetch tree ──────────────────────────────────────────
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

// ─── Derived: selected category ──────────────────────────
const selectedCat = computed(() => tree.value.find(c => c._id === selectedCatId.value) ?? null)

// ─── Derived: filtered skills (search across selected cat) ─
const filteredSubs = computed(() => {
  if (!selectedCat.value) return []
  const q = searchQuery.value.toLowerCase()
  if (!q) return selectedCat.value.subCategories
  return selectedCat.value.subCategories
    .map(sub => ({
      ...sub,
      skills: sub.skills.filter(sk =>
        sk.name.toLowerCase().includes(q) || (sk.description || '').toLowerCase().includes(q),
      ),
    }))
    .filter(sub => sub.skills.length > 0 || sub.name.toLowerCase().includes(q))
})

// ─── Total skill count per category ──────────────────────
function catSkillCount(cat: Cat) {
  return cat.subCategories.reduce((sum, s) => sum + s.skills.length, 0)
}

// ─── Accordion toggle ────────────────────────────────────
function toggleSub(id: string) {
  if (expandedSubs.value.has(id)) expandedSubs.value.delete(id)
  else expandedSubs.value.add(id)
}

// ─── Palette for categories (cycles) ─────────────────────
const palette = [
  'from-violet-500/20 to-purple-500/10 border-violet-500/30',
  'from-cyan-500/20 to-sky-500/10 border-cyan-500/30',
  'from-emerald-500/20 to-green-500/10 border-emerald-500/30',
  'from-orange-500/20 to-amber-500/10 border-orange-500/30',
  'from-rose-500/20 to-pink-500/10 border-rose-500/30',
  'from-blue-500/20 to-indigo-500/10 border-blue-500/30',
]
const dotPalette = [
  'bg-violet-500', 'bg-cyan-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-rose-500', 'bg-blue-500',
]
const textPalette = [
  'text-violet-400', 'text-cyan-400', 'text-emerald-400',
  'text-orange-400', 'text-rose-400', 'text-blue-400',
]
function catGradient(idx: number) { return palette[idx % palette.length] }
function catDot(idx: number) { return dotPalette[idx % dotPalette.length] }
function catText(idx: number) { return textPalette[idx % textPalette.length] }

// ─── Level badge colors ───────────────────────────────────
const levelColors: Record<string, string> = {
  Beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Intermediate: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Advanced: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Expert: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

// ─── Modal: open create ───────────────────────────────────
function openCreateSkill(catId: string, subCatId: string) {
  editSkillId.value = null
  skillForm.value = { skill: '', isRequired: false, category: catId, subCategory: subCatId }
  showSkillModal.value = true
}

function openEditSkill(sk: SkillItem) {
  editSkillId.value = sk._id
  skillForm.value = { skill: sk.name, isRequired: sk.isRequired ?? false, category: sk.category, subCategory: sk.subCategory }
  showSkillModal.value = true
}

async function saveSkill() {
  if (!skillForm.value.skill.trim()) return toast.error('Skill name is required')
  savingSkill.value = true
  try {
    if (editSkillId.value) {
      await $fetch(`/api/skills/${editSkillId.value}`, { method: 'PUT', body: skillForm.value })
      toast.success('Skill updated')
    }
    else {
      await $fetch('/api/skills', { method: 'POST', body: skillForm.value })
      toast.success('Skill created')
    }
    showSkillModal.value = false
    await fetchTree()
  }
  catch (e: any) { toast.error('Save failed', { description: e?.message }) }
  finally { savingSkill.value = false }
}

async function deleteSkill(id: string) {
  try {
    await $fetch(`/api/skills/${id}`, { method: 'DELETE' })
    toast.success('Skill removed')
    await fetchTree()
  }
  catch (e: any) { toast.error('Delete failed', { description: e?.message }) }
}

// current cat index for palette
const selectedCatIndex = computed(() => tree.value.findIndex(c => c._id === selectedCatId.value))
</script>

<template>
  <div class="flex gap-0 h-full min-h-[calc(100vh-4rem)] -m-4 lg:-m-6">

    <!-- ══════════════════════ LEFT PANEL: Category sidebar ══════════════════════ -->
    <aside class="w-64 shrink-0 border-r border-border/60 bg-background flex flex-col overflow-hidden">
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
    <main class="flex-1 flex flex-col overflow-hidden">

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
      <div class="flex-1 overflow-y-auto p-5">

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
            class="rounded-xl border border-border/50 overflow-hidden bg-card shadow-xs transition-shadow hover:shadow-sm"
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
                <Icon :name="sub.icon || 'i-lucide-tag'" class="size-3.5" :class="catText(selectedCatIndex)" />
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold">{{ sub.name }}</p>
                <p v-if="sub.description" class="text-xs text-muted-foreground truncate">{{ sub.description }}</p>
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
              <div v-if="expandedSubs.has(sub._id)" class="border-t border-border/40 bg-muted/20">
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
                    class="group/card relative flex flex-col gap-2 rounded-lg border border-border/50 bg-background p-3.5 hover:shadow-md hover:border-border transition-all duration-150 cursor-default"
                  >
                    <!-- Skill icon circle -->
                    <div class="flex items-start justify-between gap-2">
                      <div
                        class="size-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br"
                        :class="catGradient(selectedCatIndex)"
                      >
                        <Icon :name="sk.icon || 'i-lucide-zap'" class="size-4" :class="catText(selectedCatIndex)" />
                      </div>
                      <!-- Action buttons (hover) -->
                      <div class="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <button
                          class="size-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          @click="openEditSkill(sk)"
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
                    </div>

                    <!-- Name -->
                    <p class="text-sm font-semibold leading-tight">{{ sk.name }}</p>

                    <!-- Description -->
                    <p v-if="sk.description" class="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{{ sk.description }}</p>

                    <!-- Level + Required badges -->
                    <div class="mt-auto pt-1 flex items-center gap-1.5 flex-wrap">
                      <span
                        class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                        :class="levelColors[sk.level || 'Intermediate'] || levelColors.Intermediate"
                      >
                        <span class="size-1.5 rounded-full bg-current opacity-70" />
                        {{ sk.level || 'Intermediate' }}
                      </span>
                      <span
                        v-if="sk.isRequired"
                        class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-rose-500/15 text-rose-400 border-rose-500/30"
                      >
                        <Icon name="i-lucide-star" class="size-2.5" />
                        Required
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </main>

    <!-- ══════════════════════ SKILL MODAL ══════════════════════ -->
    <Dialog v-model:open="showSkillModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editSkillId ? 'Edit Skill' : 'Add Skill' }}</DialogTitle>
          <DialogDescription>
            {{ editSkillId ? 'Update the skill details below.' : 'Create a new skill in this sub-category.' }}
          </DialogDescription>
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
            {{ editSkillId ? 'Save Changes' : 'Add Skill' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>
