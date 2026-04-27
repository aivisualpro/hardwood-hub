<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Skills', icon: 'i-lucide-graduation-cap', description: 'Manage skill categories and competencies' })

const { canCreate, canUpdate, canDelete } = usePermissions('/admin/skills')

// ─── Types ───────────────────────────────────────────────
interface SkillItem {
  _id: string
  name: string
  category: string
  subCategory: string
  isRequired?: boolean
  info?: string
}
interface BonusRule {
  skillSet: string
  reviewedTimes: number
  supervisorCheck: string
  bonusAmount: number
}
interface SubCat {
  _id: string
  name: string
  category: string
  predecessor?: string
  predecessorName?: string
  bonusRules: BonusRule[]
  skills: SkillItem[]
}
interface Cat {
  _id: string
  name: string
  color?: string
  info?: string
  subCategories: SubCat[]
}

// ─── State ───────────────────────────────────────────────
const tree = ref<Cat[]>([])
const loading = ref(true)
const selectedCatId = ref<string | null>(null)
const expandedSubs = ref<Set<string>>(new Set())
const searchQuery = ref('')
const showMobileSidebar = ref(false)

const route = useRoute()
const router = useRouter()

watch(selectedCatId, (newId) => {
  if (newId) {
    const cat = tree.value.find(c => c._id === newId)
    if (cat) {
      if (route.query.category !== cat.name) {
        router.replace({ query: { ...route.query, category: cat.name } })
      }
      setHeader({ title: `Skills — ${cat.name}`, icon: 'i-lucide-graduation-cap', description: 'Manage skill categories and competencies' })
    }
  }
})

// ─── Modal state (create only) ───────────────────────────
const showSkillModal = ref(false)
const savingSkill = ref(false)
const skillForm = ref({ skill: '', isRequired: false, category: '', subCategory: '' })

// ─── PDF INFO state (Category) ─────────
const showCatInfoModal = ref(false)
const activeCatId = ref<string | null>(null)
const catPdfUrl = ref('') // could be data: URL or http
const savingCatPdf = ref(false)

function openCatInfo(cat: Cat) {
  activeCatId.value = cat._id
  catPdfUrl.value = cat.info || ''
  showCatInfoModal.value = true
}

function onCatPdfSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.type !== 'application/pdf') {
    toast.error('Only PDF files are allowed')
    target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = (re) => {
    catPdfUrl.value = re.target?.result as string
  }
  reader.readAsDataURL(file)
}

async function saveCatPdf() {
  if (!activeCatId.value) return
  savingCatPdf.value = true
  try {
    let finalUrl = catPdfUrl.value
    if (finalUrl && finalUrl.startsWith('data:')) {
      toast.loading('Uploading PDF...', { id: 'category-pdf-upload' })
      const sigRes = await $fetch<any>('/api/upload/cloudinary-signature', {
        params: { folder: 'hardwood-hub/categories' }
      })
      const fd = new FormData()
      fd.append('file', finalUrl)
      fd.append('api_key', sigRes.apiKey)
      fd.append('timestamp', String(sigRes.timestamp))
      fd.append('signature', sigRes.signature)
      fd.append('folder', sigRes.folder)

      const clRes = await $fetch<any>(`https://api.cloudinary.com/v1_1/${sigRes.cloudName}/auto/upload`, {
        method: 'POST',
        body: fd
      })
      if (clRes && clRes.secure_url) {
        finalUrl = clRes.secure_url
      }
      toast.dismiss('category-pdf-upload')
    }
    
    await $fetch(`/api/categories/${activeCatId.value}`, {
      method: 'PUT',
      body: { info: finalUrl }
    })
    
    // Update local tree
    const targetCat = tree.value.find(c => c._id === activeCatId.value)
    if (targetCat) targetCat.info = finalUrl
    
    toast.success('Category PDF saved')
    showCatInfoModal.value = false
  } catch(e: any) {
    toast.error('Failed to save PDF', { description: e.message })
    toast.dismiss('category-pdf-upload')
  } finally {
    savingCatPdf.value = false
  }
}

// ─── Skill Info State ──────────────────
const showSkillInfoModal = ref(false)
const activeSkillId = ref<string | null>(null)
const skillInfoText = ref('')
const savingSkillInfo = ref(false)

function openSkillInfo(sk: SkillItem) {
  activeSkillId.value = sk._id
  skillInfoText.value = sk.info || ''
  showSkillInfoModal.value = true
}

async function saveSkillInfo() {
  if (!activeSkillId.value) return
  savingSkillInfo.value = true
  try {
    const found = findSkill(activeSkillId.value)
    if (found) {
      found.skill.info = skillInfoText.value
    }
    
    await $fetch(`/api/skills/${activeSkillId.value}`, {
      method: 'PUT',
      body: { info: skillInfoText.value }
    })
    toast.success('Skill info saved')
    showSkillInfoModal.value = false
  } catch(e: any) {
    toast.error('Failed to save skill info', { description: e.message })
  } finally {
    savingSkillInfo.value = false
  }
}

// ─── Inline edit state ───────────────────────────────────
const editingSkillId = ref<string | null>(null)
const editingForm = ref({ skill: '', isRequired: false })

// ─── Predecessor picker state ─────────────────────────────
const editingPredecessorSubId = ref<string | null>(null)
const predecessorSearch = ref('')

// ─── Sub-category creation state ──────────────────────────
const showSubCatModal = ref(false)
const savingSubCat = ref(false)
const subCatForm = ref({ name: '' })

// ─── Inline edit state for sub-category name ──────────────
const editingSubCatId = ref<string | null>(null)
const editingSubCatName = ref('')

function startEditSubCat(sub: SubCat) {
  editingSubCatId.value = sub._id
  editingSubCatName.value = sub.name
}

function cancelEditSubCat() {
  editingSubCatId.value = null
  editingSubCatName.value = ''
}

async function saveEditSubCat(subId: string) {
  const newName = editingSubCatName.value.trim()
  if (!newName) return toast.error('Sub-category name is required')

  const found = findSub(subId)
  if (!found) return

  const prev = found.sub.name
  found.sub.name = newName
  editingSubCatId.value = null

  try {
    await $fetch(`/api/subcategories/${subId}`, { method: 'PUT', body: { name: newName } })
    toast.success('Sub-category renamed', { duration: 2000 })
  } catch (e: any) {
    found.sub.name = prev
    editingSubCatId.value = subId
    editingSubCatName.value = newName
    toast.error('Failed to rename sub-category', { description: e?.message })
  }
}

// ─── Inline edit state for category name ──────────────────
const editingCatId = ref<string | null>(null)
const editingCatName = ref('')

function startEditCat(cat: Cat) {
  editingCatId.value = cat._id
  editingCatName.value = cat.name
}

function cancelEditCat() {
  editingCatId.value = null
  editingCatName.value = ''
}

async function saveEditCat(catId: string) {
  const newName = editingCatName.value.trim()
  if (!newName) return toast.error('Category name is required')

  const cat = tree.value.find(c => c._id === catId)
  if (!cat) return

  const prev = cat.name
  cat.name = newName
  editingCatId.value = null

  try {
    await $fetch(`/api/categories/${catId}`, { method: 'PUT', body: { name: newName } })
    toast.success('Category renamed', { duration: 2000 })
  } catch (e: any) {
    cat.name = prev
    editingCatId.value = catId
    editingCatName.value = newName
    toast.error('Failed to rename category', { description: e?.message })
  }
}

function openCreateSubCat() {
  subCatForm.value = { name: '' }
  showSubCatModal.value = true
}

async function saveSubCat() {
  if (!subCatForm.value.name.trim()) return toast.error('Sub-category name is required')
  if (!selectedCatId.value) return toast.error('Please select a category first')
  savingSubCat.value = true

  // Optimistic: close modal immediately, add placeholder
  const tempId = `temp-sub-${Date.now()}`
  const newSub: SubCat = {
    _id: tempId,
    name: subCatForm.value.name,
    category: selectedCatId.value,
    predecessor: '',
    predecessorName: '',
    bonusRules: [],
    skills: [],
  }
  const cat = tree.value.find(c => c._id === selectedCatId.value)
  if (cat) cat.subCategories.push(newSub)
  showSubCatModal.value = false

  try {
    const res = await $fetch<{ success: boolean, data: any }>('/api/subcategories', {
      method: 'POST',
      body: { name: subCatForm.value.name, Category: selectedCatId.value },
    })
    // Replace temp _id with real one from server
    if (cat) {
      const idx = cat.subCategories.findIndex(s => s._id === tempId)
      if (idx !== -1 && res.data?._id) cat.subCategories[idx]!._id = res.data._id
    }
    toast.success('Sub-category added')
  } catch (e: any) {
    // Revert: remove the temp sub-category
    if (cat) {
      const idx = cat.subCategories.findIndex(s => s._id === tempId)
      if (idx !== -1) cat.subCategories.splice(idx, 1)
    }
    showSubCatModal.value = true
    toast.error('Failed to create sub-category', { description: e?.message })
  } finally {
    savingSubCat.value = false
  }
}

// ─── Delete category ──────────────────────────────────────
async function deleteCat(catId: string) {
  const idx = tree.value.findIndex(c => c._id === catId)
  if (idx === -1) return
  const cat = tree.value[idx]
  if (cat && cat.subCategories.length > 0) return toast.error('Cannot delete a category with sub-categories')

  // Snapshot for revert
  const snapshot = cat

  // Optimistic: remove immediately
  tree.value.splice(idx, 1)
  if (selectedCatId.value === catId) {
    selectedCatId.value = tree.value.length ? (tree.value[0]?._id ?? null) : null
  }

  try {
    await $fetch(`/api/categories/${catId}`, { method: 'DELETE' })
    toast.success('Category removed', { duration: 2000 })
  } catch (e: any) {
    // Revert
    if (snapshot) tree.value.splice(idx, 0, snapshot)
    selectedCatId.value = catId
    toast.error('Failed to delete category', { description: e?.message })
  }
}

// ─── Delete sub-category ──────────────────────────────────
async function deleteSubCat(subId: string) {
  const found = findSub(subId)
  if (!found) return
  if (found.sub.skills.length > 0) return toast.error('Cannot delete a sub-category with skills')

  // Snapshot for revert
  const idx = found.cat.subCategories.findIndex(s => s._id === subId)
  const snapshot = found.cat.subCategories[idx]

  // Optimistic: remove immediately
  found.cat.subCategories.splice(idx, 1)

  try {
    await $fetch(`/api/subcategories/${subId}`, { method: 'DELETE' })
    toast.success('Sub-category removed', { duration: 2000 })
  } catch (e: any) {
    // Revert
    if (snapshot) found.cat.subCategories.splice(idx, 0, snapshot)
    toast.error('Failed to delete sub-category', { description: e?.message })
  }
}

// ─── Bonus Rules state ────────────────────────────────────
const SKILL_LEVELS = ['Needs Improvement', 'Proficient', 'Mastered'] as const
const SUPERVISOR_OPTIONS = ['Any', 'Unique'] as const
const showBonusModal = ref(false)
const bonusSubId = ref<string | null>(null)
const bonusRules = ref<BonusRule[]>([])
const savingBonus = ref(false)

function openBonusRules(sub: SubCat) {
  bonusSubId.value = sub._id
  bonusRules.value = JSON.parse(JSON.stringify(sub.bonusRules || []))
  showBonusModal.value = true
}

function addBonusRule() {
  bonusRules.value.push({ skillSet: '', reviewedTimes: 1, supervisorCheck: 'Any', bonusAmount: 0 })
}

function removeBonusRule(idx: number) {
  bonusRules.value.splice(idx, 1)
}

async function saveBonusRules() {
  if (!bonusSubId.value) return
  // Validate
  for (const r of bonusRules.value) {
    if (!r.skillSet) return toast.error('Each rule needs a Skill Set')
  }
  savingBonus.value = true
  const found = findSub(bonusSubId.value)
  const prev = found ? JSON.parse(JSON.stringify(found.sub.bonusRules)) : []

  // Optimistic
  if (found) found.sub.bonusRules = JSON.parse(JSON.stringify(bonusRules.value))
  showBonusModal.value = false

  try {
    await $fetch(`/api/subcategories/${bonusSubId.value}`, {
      method: 'PUT',
      body: { bonusRules: bonusRules.value },
    })
    toast.success('Bonus rules saved', { duration: 2000 })
  } catch (e: any) {
    if (found) found.sub.bonusRules = prev
    showBonusModal.value = true
    toast.error('Failed to save bonus rules', { description: e?.message })
  } finally {
    savingBonus.value = false
  }
}

// ─── Initial load ────────────────────────────────────────
async function fetchTree() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: Cat[] }>('/api/skills/tree')
    tree.value = res.data
    const queryCat = route.query.category as string | undefined
    if (res.data.length && !selectedCatId.value) {
      if (queryCat) {
        const found = res.data.find(c => c._id === queryCat || c.name === queryCat)
        if (found) {
          selectedCatId.value = found._id
        } else {
          selectedCatId.value = res.data[0]!._id
        }
      } else {
        const firstCat = res.data[0]
        if (firstCat) {
          selectedCatId.value = firstCat._id
          // Sub-category accordions are closed by default per user request
        }
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
  skillForm.value = { skill: '', isRequired: true, category: catId, subCategory: subCatId }
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

    <!-- ══════════════════════ LEFT PANEL: Category sidebar ══════════════════════ -->
    <aside
      class="shrink-0 border-r border-border/60 bg-background flex flex-col h-full transition-transform duration-200 z-50"
      :class="[
        'w-64',
        showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        'fixed md:relative inset-y-0 left-0 md:inset-auto'
      ]"
    >
      <!-- Header -->
      <div class="px-4 py-3.5 sm:py-4 border-b border-border/60 flex items-center justify-between">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Categories</p>
        <button class="md:hidden size-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground" @click="showMobileSidebar = false">
          <Icon name="i-lucide-x" class="size-4" />
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="p-3 flex flex-col gap-2">
        <div v-for="i in 5" :key="i" class="h-10 rounded-lg bg-muted animate-pulse" />
      </div>

      <!-- Category list -->
      <nav v-else class="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        <!-- Category: EDIT MODE -->
        <div
          v-for="(cat, idx) in tree"
          :key="cat._id"
          class="group w-full rounded-lg transition-all duration-150 relative"
        >
          <!-- Inline edit mode -->
          <div v-if="editingCatId === cat._id" class="flex flex-col gap-1.5 p-2 rounded-lg ring-1 ring-primary/30 bg-primary/5">
            <input
              v-model="editingCatName"
              class="w-full text-sm font-medium bg-background rounded-md border border-input px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="Category name…"
              @keydown.enter="saveEditCat(cat._id)"
              @keydown.escape="cancelEditCat()"
              @click.stop
            />
            <div class="flex gap-1.5">
              <button
                class="flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                @click.stop="saveEditCat(cat._id)"
              >
                <Icon name="i-lucide-check" class="size-3" />
                Save
              </button>
              <button
                class="flex-1 text-xs font-medium py-1 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                @click.stop="cancelEditCat()"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- Normal view mode -->
          <button
            v-else
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
            :class="selectedCatId === cat._id
              ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
            @click="selectedCatId = cat._id; showMobileSidebar = false"
          >
            <!-- Color dot -->
            <span
              class="size-2 rounded-full shrink-0 transition-transform duration-150 group-hover:scale-110"
              :class="catDot(idx)"
            />
            <span class="flex-1 text-sm font-medium truncate">{{ cat.name }}</span>

            <!-- Edit button (on hover) -->
            <button
              v-if="canUpdate()"
              class="size-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
              @click.stop="startEditCat(cat)"
            >
              <Icon name="i-lucide-pencil" class="size-3" />
            </button>

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
        </div>

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
      <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <!-- Mobile sidebar toggle -->
        <button
          class="md:hidden size-8 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted text-muted-foreground shrink-0"
          @click="showMobileSidebar = true"
        >
          <Icon name="i-lucide-panel-left" class="size-4" />
        </button>

        <!-- Category pill -->
        <div
          v-if="selectedCat"
          class="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border text-xs sm:text-sm font-medium bg-gradient-to-r shrink-0"
          :class="catGradient(selectedCatIndex)"
        >
          <span class="size-1.5 sm:size-2 rounded-full" :class="catDot(selectedCatIndex)" />
          <span :class="catText(selectedCatIndex)" class="max-w-[80px] sm:max-w-none truncate">{{ selectedCat.name }}</span>
        </div>

        <!-- Search -->
        <div class="relative flex-1 max-w-[180px] sm:max-w-xs">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5 sm:size-4" />
          <Input v-model="searchQuery" placeholder="Search…" class="pl-8 sm:pl-9 h-8 sm:h-9 bg-muted/50 border-border/50 text-xs sm:text-sm" />
        </div>

        <!-- Add Sub Category button -->
        <Button
          v-if="canCreate() && selectedCat"
          size="sm"
          variant="outline"
          class="shrink-0 gap-1 sm:gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
          @click="openCreateSubCat"
        >
          <Icon name="i-lucide-plus" class="size-3 sm:size-3.5" />
          <span class="hidden xs:inline">Add Sub Category</span>
          <span class="xs:hidden">Sub Cat</span>
        </Button>

        <!-- Add Category PDF Button -->
        <Button
          v-if="canUpdate() && selectedCat && !selectedCat.info"
          size="sm"
          variant="outline"
          class="shrink-0 gap-1 sm:gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:text-primary text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 ml-1"
          @click="openCatInfo(selectedCat)"
          title="Upload Category PDF"
        >
          <Icon name="i-lucide-upload" class="size-3 sm:size-3.5" />
          <span class="hidden xs:inline">Upload PDF</span>
          <span class="xs:hidden">PDF</span>
        </Button>

        <!-- View Category PDF Button -->
        <Button
          v-if="selectedCat && selectedCat.info"
          size="sm"
          variant="default"
          class="shrink-0 gap-1 sm:gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 ml-1"
          @click="openCatInfo(selectedCat)"
          title="View PDF Document"
        >
          <Icon name="i-lucide-file-text" class="size-3 sm:size-3.5" />
          <span class="hidden xs:inline">View PDF</span>
          <span class="xs:hidden">PDF</span>
        </Button>

        <!-- Delete Category Button -->
        <Button
          v-if="canDelete() && selectedCat && selectedCat.subCategories.length === 0"
          size="sm"
          variant="outline"
          class="shrink-0 gap-1 sm:gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 ml-1"
          @click="deleteCat(selectedCat._id)"
          title="Delete Category"
        >
          <Icon name="i-lucide-trash-2" class="size-3 sm:size-3.5" />
          <span class="hidden xs:inline">Delete Category</span>
          <span class="xs:hidden">Delete</span>
        </Button>

        <div class="flex-1" />

        <!-- Sub-stats -->
        <div v-if="selectedCat" class="hidden lg:flex items-center gap-4 text-xs text-muted-foreground">
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
      <div class="p-3 sm:p-5 flex-1 overflow-y-auto">

        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col gap-3 sm:gap-4">
          <div v-for="i in 3" :key="i" class="rounded-xl border border-border/50 overflow-hidden animate-pulse">
            <div class="h-11 sm:h-12 bg-muted/60" />
            <div class="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div v-for="j in 4" :key="j" class="h-16 sm:h-20 rounded-lg bg-muted/40" />
            </div>
          </div>
        </div>

        <!-- No category selected -->
        <div v-else-if="!selectedCat" class="flex flex-col items-center justify-center h-full gap-3 sm:gap-4 text-center py-16 sm:py-24 px-4">
          <div class="size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Icon name="i-lucide-graduation-cap" class="size-6 sm:size-8 text-primary" />
          </div>
          <h3 class="text-base sm:text-lg font-semibold">Select a category</h3>
          <p class="text-xs sm:text-sm text-muted-foreground max-w-xs">Choose a skill category from the <span class="md:hidden">menu</span><span class="hidden md:inline">left panel</span> to view and manage its sub-categories and skills.</p>
          <Button class="md:hidden" size="sm" variant="outline" @click="showMobileSidebar = true">
            <Icon name="i-lucide-panel-left" class="size-3.5 mr-1.5" />
            Open Categories
          </Button>
        </div>

        <!-- No results for search -->
        <div v-else-if="filteredSubs.length === 0 && searchQuery" class="flex flex-col items-center justify-center py-16 sm:py-24 gap-3">
          <Icon name="i-lucide-search-x" class="size-8 sm:size-10 text-muted-foreground" />
          <p class="text-xs sm:text-sm text-muted-foreground">No skills match "<strong>{{ searchQuery }}</strong>"</p>
          <Button variant="ghost" size="sm" @click="searchQuery = ''">Clear search</Button>
        </div>

        <!-- SubCategory accordions -->
        <div v-else class="flex flex-col gap-2.5 sm:gap-3">
          <div
            v-for="sub in filteredSubs"
            :key="sub._id"
            class="rounded-xl border border-border/50 bg-card shadow-xs transition-shadow hover:shadow-sm"
          >
            <!-- Accordion header -->
            <div
              role="button"
              tabindex="0"
              class="w-full flex items-center flex-wrap sm:flex-nowrap gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 text-left hover:bg-muted/30 transition-colors group cursor-pointer select-none"
              @click="toggleSub(sub._id)"
              @keydown.enter.space.prevent="toggleSub(sub._id)"
            >
              <!-- Expand icon -->
              <Icon
                name="i-lucide-chevron-right"
                class="size-3.5 sm:size-4 text-muted-foreground transition-transform duration-200 shrink-0"
                :class="expandedSubs.has(sub._id) ? 'rotate-90' : ''"
              />

              <!-- Sub icon -->
              <div
                class="size-6 sm:size-7 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br"
                :class="catGradient(selectedCatIndex)"
              >
                <Icon name="i-lucide-tag" class="size-3 sm:size-3.5" :class="catText(selectedCatIndex)" />
              </div>

              <div class="flex-1 min-w-0">
                <!-- Sub-category name: EDIT MODE -->
                <div v-if="editingSubCatId === sub._id" class="flex items-center gap-1.5" @click.stop>
                  <input
                    v-model="editingSubCatName"
                    class="flex-1 min-w-0 text-xs sm:text-sm font-semibold bg-background rounded-md border border-input px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="Sub-category name…"
                    @keydown.enter="saveEditSubCat(sub._id)"
                    @keydown.escape="cancelEditSubCat()"
                    @keydown.space.stop
                    @click.stop
                  />
                  <button
                    class="size-6 rounded flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
                    @click.stop="saveEditSubCat(sub._id)"
                  >
                    <Icon name="i-lucide-check" class="size-3" />
                  </button>
                  <button
                    class="size-6 rounded flex items-center justify-center bg-muted text-muted-foreground hover:bg-muted/80 transition-colors shrink-0"
                    @click.stop="cancelEditSubCat()"
                  >
                    <Icon name="i-lucide-x" class="size-3" />
                  </button>
                </div>

                <!-- Sub-category name: VIEW MODE -->
                <template v-else>
                  <p class="text-xs sm:text-sm font-semibold truncate">{{ sub.name }}</p>
                  <!-- Predecessor label (view mode) -->
                  <p v-if="sub.predecessorName && editingPredecessorSubId !== sub._id" class="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Icon name="i-lucide-arrow-right" class="size-2.5 sm:size-3 shrink-0" />
                    <span class="truncate">{{ sub.predecessorName }}</span>
                  </p>
                </template>
              </div>

              <!-- Bonus Rule button -->
              <div
                role="button"
                tabindex="0"
                class="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border transition-all cursor-pointer shrink-0"
                :class="sub.bonusRules?.length
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'sm:opacity-0 sm:group-hover:opacity-100 bg-muted/60 text-muted-foreground border-border/40 hover:bg-muted'"
                @click.stop="openBonusRules(sub)"
                @keydown.enter.stop="openBonusRules(sub)"
              >
                <Icon name="i-lucide-trophy" class="size-2.5 sm:size-3" />
                <span v-if="sub.bonusRules?.length">{{ sub.bonusRules.length }} rule{{ sub.bonusRules.length !== 1 ? 's' : '' }}</span>
                <span v-else>Bonus</span>
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
                  class="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border transition-all cursor-pointer"
                  :class="sub.predecessor
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                    : 'sm:opacity-0 sm:group-hover:opacity-100 bg-muted/60 text-muted-foreground border-border/40 hover:bg-muted'"
                  @click.stop="editingPredecessorSubId = editingPredecessorSubId === sub._id ? null : sub._id; predecessorSearch = ''"
                >
                  <Icon name="i-lucide-git-branch" class="size-2.5 sm:size-3" />
                  <span class="max-w-[60px] sm:max-w-[100px] truncate">
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
                    class="absolute right-0 sm:right-0 left-0 sm:left-auto top-full mt-1.5 z-50 w-[calc(100vw-2rem)] sm:w-72 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
                  >
                    <!-- Search -->
                    <div class="p-2 border-b border-border/50">
                      <div class="relative">
                        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                          v-model="predecessorSearch"
                          placeholder="Search sub-categories…"
                          class="w-full pl-8 pr-3 py-2 sm:py-1.5 text-sm sm:text-xs rounded-md bg-muted/50 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                          @click.stop
                        />
                      </div>
                    </div>

                    <!-- Options list -->
                    <div class="max-h-56 overflow-y-auto py-1">
                      <!-- Clear predecessor -->
                      <div
                        v-if="sub.predecessor"
                        class="flex items-center gap-2 px-3 py-2.5 sm:py-2 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                        @click.stop="savePredecessor(sub._id, null)"
                      >
                        <Icon name="i-lucide-x" class="size-3.5 text-destructive/70" />
                        <span class="italic">Remove predecessor</span>
                      </div>

                      <!-- Sub-category options (exclude self) -->
                      <div
                        v-for="opt in filteredPredecessors.filter(s => s._id !== sub._id)"
                        :key="opt._id"
                        class="flex items-center gap-2 px-3 py-2.5 sm:py-2 cursor-pointer transition-colors hover:bg-muted/50"
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
              <span class="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-muted text-muted-foreground border border-border/40 shrink-0">
                {{ sub.skills.length }}<span class="hidden sm:inline"> skill{{ sub.skills.length !== 1 ? 's' : '' }}</span>
              </span>

              <!-- Edit sub-category name (visible on hover) -->
              <div
                v-if="canUpdate() && editingSubCatId !== sub._id"
                role="button"
                tabindex="0"
                class="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-muted/60 text-muted-foreground border border-border/40 hover:bg-muted shrink-0 cursor-pointer"
                @click.stop="startEditSubCat(sub)"
                @keydown.enter.stop="startEditSubCat(sub)"
              >
                <Icon name="i-lucide-pencil" class="size-2.5 sm:size-3" />
                <span class="hidden sm:inline">Edit</span>
              </div>

              <!-- Delete sub-category (visible on hover, only if no skills) -->
              <div
                v-if="canDelete() && sub.skills.length === 0"
                role="button"
                tabindex="0"
                class="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 shrink-0 cursor-pointer"
                @click.stop="deleteSubCat(sub._id)"
                @keydown.enter.stop="deleteSubCat(sub._id)"
              >
                <Icon name="i-lucide-trash-2" class="size-2.5 sm:size-3" />
                <span class="hidden sm:inline">Delete</span>
              </div>

              <!-- Add skill (visible on hover) -->
              <div
                v-if="canCreate()"
                role="button"
                tabindex="0"
                class="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 shrink-0 cursor-pointer"
                @click.stop="openCreateSkill(selectedCat!._id, sub._id)"
                @keydown.enter.stop="openCreateSkill(selectedCat!._id, sub._id)"
              >
                <Icon name="i-lucide-plus" class="size-2.5 sm:size-3" />
                <span class="hidden sm:inline">Add</span>
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
                <div v-if="sub.skills.length === 0" class="flex flex-col items-center justify-center py-6 sm:py-8 gap-2">
                  <Icon name="i-lucide-sparkles" class="size-5 sm:size-6 text-muted-foreground/50" />
                  <p class="text-[10px] sm:text-xs text-muted-foreground">No skills yet in this sub-category</p>
                  <Button v-if="canCreate()" size="sm" variant="outline" class="mt-1 text-xs" @click="openCreateSkill(selectedCat!._id, sub._id)">
                    <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
                    Add first skill
                  </Button>
                </div>

                  <!-- Skills grid -->
                  <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 p-3 sm:p-4">
                    <div
                      v-for="sk in sub.skills"
                      :key="sk._id"
                      class="group/card relative flex flex-col gap-2 sm:gap-2.5 rounded-lg border bg-background p-3 sm:p-3.5 transition-all duration-150"
                      :class="editingSkillId === sk._id
                        ? 'border-primary/40 shadow-md ring-1 ring-primary/20'
                        : 'border-border/50 hover:shadow-md hover:border-border'"
                    >
                      <!-- ── VIEW MODE ── -->
                      <template v-if="editingSkillId !== sk._id">
                        <!-- Skill text -->
                        <p class="text-xs sm:text-sm leading-relaxed pb-6">{{ sk.name }}</p>

                        <!-- Action buttons (bottom-right, hover) -->
                        <div v-if="canUpdate() || canDelete()" class="absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 flex gap-0.5 sm:gap-1 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity">
                          <button
                            class="size-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Skill Info"
                            @click="openSkillInfo(sk)"
                          >
                            <Icon name="i-lucide-info" class="size-3" :class="sk.info ? 'text-primary' : ''" />
                          </button>
                          <button
                            v-if="canUpdate()"
                            class="size-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            @click="startInlineEdit(sk)"
                          >
                            <Icon name="i-lucide-pencil" class="size-3" />
                          </button>
                          <button
                            v-if="canDelete()"
                            class="size-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            @click="deleteSkill(sk._id)"
                          >
                            <Icon name="i-lucide-trash-2" class="size-3" />
                          </button>
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
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <textarea
              id="skill-name"
              v-model="skillForm.skill"
              rows="4"
              class="w-full resize-none rounded-md border border-input bg-muted/40 px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
              placeholder="e.g. Hardwood Flooring Installation"
            />
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

    <!-- ══════════════════════ BONUS RULES MODAL ══════════════════════ -->
    <Dialog v-model:open="showBonusModal">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bonus Rules Override</DialogTitle>
          <DialogDescription>
            Define custom bonus rules for this sub-category. These will override the general skill bonus settings.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2 max-h-[55vh] overflow-y-auto pr-1">
          <!-- Empty state -->
          <div v-if="bonusRules.length === 0" class="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div class="size-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
              <Icon name="i-lucide-trophy" class="size-6 text-emerald-400" />
            </div>
            <p class="text-sm text-muted-foreground">No custom rules yet. Add one to override the global settings.</p>
          </div>

          <!-- Rules list -->
          <div
            v-for="(rule, idx) in bonusRules"
            :key="idx"
            class="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3 relative"
          >
            <!-- Remove button -->
            <button
              class="absolute top-3 right-3 size-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              @click="removeBonusRule(idx)"
            >
              <Icon name="i-lucide-trash-2" class="size-3.5" />
            </button>

            <div class="flex items-center gap-2">
              <div class="size-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <span class="text-[10px] font-bold text-emerald-400">{{ idx + 1 }}</span>
              </div>
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rule {{ idx + 1 }}</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <!-- Skill Set -->
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Skill Set <span class="text-destructive">*</span></Label>
                <Select v-model="rule.skillSet">
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="lvl in SKILL_LEVELS" :key="lvl" :value="lvl">{{ lvl }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Reviewed Times -->
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Reviewed Times</Label>
                <Input v-model.number="rule.reviewedTimes" type="number" min="0" placeholder="1" />
              </div>

              <!-- Supervisor Check -->
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Supervisor Check</Label>
                <Select v-model="rule.supervisorCheck">
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in SUPERVISOR_OPTIONS" :key="opt" :value="opt">{{ opt }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Bonus Amount -->
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Bonus Amount ($)</Label>
                <Input v-model.number="rule.bonusAmount" type="number" min="0" step="0.01" placeholder="0.00" />
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" @click="addBonusRule">
            <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
            Add Rule
          </Button>
          <div class="flex gap-2">
            <Button variant="outline" @click="showBonusModal = false">Cancel</Button>
            <Button :disabled="savingBonus" @click="saveBonusRules">
              <Icon v-if="savingBonus" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
              Save Rules
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ══════════════════════ CREATE SUB-CATEGORY MODAL ══════════════════════ -->
    <Dialog v-model:open="showSubCatModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Sub Category</DialogTitle>
          <DialogDescription>Create a new sub-category under <strong>{{ selectedCat?.name }}</strong>.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <Label for="subcat-name">Sub Category Name</Label>
            <Input
              id="subcat-name"
              v-model="subCatForm.name"
              placeholder="e.g. Floor Preparation"
              @keydown.enter="saveSubCat"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showSubCatModal = false">Cancel</Button>
          <Button :disabled="savingSubCat" @click="saveSubCat">
            <Icon v-if="savingSubCat" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            Add Sub Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>



    <!-- ══════════════════════ CATEGORY PDF MODAL ══════════════════════ -->
    <Dialog v-model:open="showCatInfoModal">
      <DialogContent class="sm:max-w-4xl h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader class="shrink-0">
          <DialogTitle>Category Documentation</DialogTitle>
          <DialogDescription>Upload and preview the official PDF guide for this category.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2 flex-1 min-h-0 overflow-hidden">
          <div class="shrink-0">
             <Input type="file" accept="application/pdf" @change="onCatPdfSelected" class="file:bg-primary file:text-primary-foreground file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 file:text-xs file:font-semibold cursor-pointer border-border/50 text-sm" />
          </div>
          
          <div v-if="catPdfUrl" class="w-full flex-1 border border-border/50 rounded-xl overflow-hidden relative shadow-inner bg-muted/20">
            <iframe :src="catPdfUrl.includes('#') ? catPdfUrl + '&toolbar=0&navpanes=0&scrollbar=0' : catPdfUrl + '#toolbar=0&navpanes=0&scrollbar=0'" class="w-full h-full pointer-events-auto" style="overflow: hidden;" frameborder="0"></iframe>
          </div>
          <div v-else class="w-full flex-1 border-2 border-dashed border-muted flex flex-col gap-3 items-center justify-center rounded-xl bg-muted/5 transition-colors hover:bg-muted/10">
            <div class="size-16 rounded-full bg-muted/50 flex flex-col items-center justify-center mb-2 shadow-sm">
               <Icon name="i-lucide-file-text" class="size-8 text-muted-foreground/50" />
            </div>
            <span class="text-[15px] font-semibold text-foreground">No Document Available</span>
            <span class="text-xs font-medium text-muted-foreground max-w-[200px] text-center">Click the file upload button above to select a PDF</span>
          </div>
        </div>

        <DialogFooter class="flex items-center justify-between shrink-0 pt-4 border-t border-border/40 mt-2">
            <div class="flex gap-2">
              <Button variant="destructive" size="sm" v-if="catPdfUrl" @click="catPdfUrl = ''" class="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border-0 shadow-none">
                 <Icon name="i-lucide-trash-2" class="mr-1.5 size-3.5" />
                 Clear PDF
              </Button>
              <Button variant="outline" size="sm" v-if="catPdfUrl" as="a" :href="catPdfUrl" download="Category_Documentation.pdf" target="_blank" class="text-primary hover:text-primary">
                 <Icon name="i-lucide-download" class="mr-1.5 size-3.5" />
                 Download
              </Button>
            </div>
            <div class="flex gap-2">
              <Button variant="outline" @click="showCatInfoModal = false">Cancel</Button>
              <Button :disabled="savingCatPdf" @click="saveCatPdf" class="min-w-[140px] shadow-md relative overflow-hidden group">
                <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                <Icon v-if="savingCatPdf" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin relative z-10" />
                <span class="relative z-10 font-semibold">{{ catPdfUrl ? 'Save & Upload PDF' : 'Save Changes' }}</span>
              </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ══════════════════════ SKILL INFO MODAL ══════════════════════ -->
    <Dialog v-model:open="showSkillInfoModal">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Skill Information</DialogTitle>
          <DialogDescription>Provide detailed description or rich text info for this skill.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-2 py-2">
          <ClientOnly>
            <div class="h-[400px] overflow-y-auto rounded-md border border-input">
              <SimpleEditor v-model="skillInfoText" />
            </div>
            <template #fallback>
              <textarea
                v-model="skillInfoText"
                rows="10"
                class="w-full h-[400px] resize-none rounded-md border border-input bg-muted/40 px-3 py-2.5 text-sm leading-relaxed"
                placeholder="Loading editor..."
              />
            </template>
          </ClientOnly>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showSkillInfoModal = false">Cancel</Button>
          <Button :disabled="savingSkillInfo" @click="saveSkillInfo">
            <Icon v-if="savingSkillInfo" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            Save Info
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>
