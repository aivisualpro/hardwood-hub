<script setup lang="ts">
import { toast } from 'vue-sonner'

// Don't use standard layout with sidebar
definePageMeta({ layout: 'blank' })

// ─── Types ───────────────────────────────────────────────
interface StainSignOffRecord {
  clientName: string
  email: string
  stainColorAdditive: string[]
  isStainSamplesThrough: boolean
  isScreensNotAnAccurate: boolean
  isWoodNaturalProduct: boolean
  isAnyChangesColorsYourExpense: boolean
  isMaplePineOther: boolean
  specialNotes: string
  isSigned: boolean
  signature: string | null
}

// ─── State ───────────────────────────────────────────────
const submitted = ref(false)
const saving = ref(false)

const emptyForm = (): StainSignOffRecord => ({
  clientName: '',
  email: '',
  stainColorAdditive: [],
  isStainSamplesThrough: false,
  isScreensNotAnAccurate: false,
  isWoodNaturalProduct: false,
  isAnyChangesColorsYourExpense: false,
  isMaplePineOther: false,
  specialNotes: '',
  isSigned: false,
  signature: null,
})
const hasDrawnSignature = ref(false)
const form = ref(emptyForm())

// ─── Stain Options ───────────────────────────────────────
const STAIN_OPTIONS = [
  'CLEAR', '1 COAT WHITENER', '2 COATS WHITENER', '3 COATS WHITENER',
  '1 COAT AMBERIZER', '2 COATS AMBERIZER', '3 COATS AMBERIZER',
  'AGED BARREL', 'ANTIQUE BROWN', 'CHERRY', 'CHESTNUT', 'CLASSIC GRAY',
  'COFFEE BROWN', 'COLONIAL MAPLE', 'DARK GRAY', 'DARK WALNUT',
  'EARLY AMERICAN', 'EBONY', 'ENGLISH CHESTNUT', 'ESPRESSO', 'FRUITWOOD',
  'GOLDEN BROWN', 'GOLDEN OAK', 'GOLDEN PECAN', 'GUNSTOCK',
  'HERITAGE BROWN', 'JACOBEAN', 'MEDIUM BROWN', 'NEUTRAL', 'NUTMEG',
  'PROVINCIAL', 'RED MAHOGANY', 'ROYAL MAHOGANY', 'ROSEWOOD',
  'RUSTIC BEIGE', 'SEDONA RED', 'SILVERED GRAY', 'SPECIAL WALNUT',
  'SPICE BROWN', 'TRUE BLACK', 'WARM GRAY', 'WEATHERED OAK', 'MIX',
] as const

const stainSearch = ref('')
const filteredStains = computed(() => {
  if (!stainSearch.value.trim()) return STAIN_OPTIONS
  const q = stainSearch.value.toLowerCase()
  return STAIN_OPTIONS.filter(s => s.toLowerCase().includes(q))
})

// ─── Agreement Checkboxes ────────────────────────────────
const AGREEMENT_ITEMS = [
  { key: 'isStainSamplesThrough', label: 'I have been shown stain samples through a sample board or samples applied to your floor.' },
  { key: 'isScreensNotAnAccurate', label: 'You acknowledge that digital photos or images viewed on cell phones, cameras, or screens are not an accurate representation of stain colors. Final stain selection must be made from physical samples provided and may vary from the finished product.' },
  { key: 'isWoodNaturalProduct', label: 'You acknowledge that wood is a natural product, and due to its nature, there will be variances in color from board to board and species to species.' },
  { key: 'isAnyChangesColorsYourExpense', label: 'Once a stain selection has been confirmed through this document and you have signed off, any changes to colors will be at your expense, this will involve resanding your floor.' },
  { key: 'isMaplePineOther', label: 'Maple, pine, and other closed-cell woods will not accept the stain evenly and will have a blotchy appearance.' },
] as const

// ─── Sections ────────────────────────────────────────────
const activeSectionIdx = ref(0)
const isScrollingProgrammatically = ref(false)

const sections = computed(() => [
  {
    id: 'client-info',
    title: 'Client Information',
    icon: 'i-lucide-user-circle',
    description: 'Enter your name and email address',
    color: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    iconColor: 'text-blue-400',
  },
  {
    id: 'stain-selection',
    title: 'Stain Color / Additive',
    icon: 'i-lucide-palette',
    description: 'Select agreed upon stain colors and additives',
    color: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    iconColor: 'text-amber-400',
  },
  {
    id: 'terms',
    title: 'Terms & Acknowledgements',
    icon: 'i-lucide-shield-check',
    description: 'By signing this you agree to the following terms',
    color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  {
    id: 'notes',
    title: 'Special Notes',
    icon: 'i-lucide-message-square-text',
    description: 'Additional notes or requirements',
    color: 'from-violet-500/20 to-violet-500/5 border-violet-500/30',
    iconColor: 'text-violet-400',
  },
  {
    id: 'signature',
    title: 'Signature',
    icon: 'i-lucide-pen-tool',
    description: 'Your signature to confirm stain selection',
    color: 'from-rose-500/20 to-rose-500/5 border-rose-500/30',
    iconColor: 'text-rose-400',
  },
])

// ─── Scroll-Spy & Navigation ─────────────────────────────
const scrollContainer = ref<HTMLElement | null>(null)
const sectionRefs = ref<Record<string, HTMLElement | null>>({})
const navPillsRef = ref<HTMLElement | null>(null)

function setSectionRef(id: string, el: any) {
  sectionRefs.value[id] = el as HTMLElement
}

function scrollToSection(idx: number) {
  const section = sections.value[idx]
  if (!section) return
  const el = sectionRefs.value[section.id]
  const container = window // since it's the whole page body
  if (!el) return
  isScrollingProgrammatically.value = true
  activeSectionIdx.value = idx
  // calculate offset — sticky header is ~140px
  const headerOffset = 180
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
  window.scrollTo({ top, behavior: 'smooth' })
  // Reset the flag after animation completes
  setTimeout(() => { isScrollingProgrammatically.value = false }, 600)
  // Also scroll the nav pill into view
  scrollPillIntoView(idx)
}

function scrollPillIntoView(idx: number) {
  const navEl = navPillsRef.value
  if (!navEl) return
  const pills = navEl.querySelectorAll('[data-pill]')
  const pill = pills[idx] as HTMLElement
  if (!pill) return
  pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}

// IntersectionObserver scroll-spy
let observer: IntersectionObserver | null = null

function setupScrollSpy() {
  if (observer) observer.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      if (isScrollingProgrammatically.value) return
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-section-id')
          const idx = sections.value.findIndex(s => s.id === id)
          if (idx >= 0 && idx !== activeSectionIdx.value) {
            activeSectionIdx.value = idx
            scrollPillIntoView(idx)
          }
        }
      }
    },
    {
      root: null,
      rootMargin: '-30% 0px -60% 0px',
      threshold: 0,
    }
  )

  // Observe all section elements
  for (const section of sections.value) {
    const el = sectionRefs.value[section.id]
    if (el) observer.observe(el)
  }
}

onMounted(() => {
  nextTick(() => {
    setupScrollSpy()
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

// ─── Progress ────────────────────────────────────────────
function isSectionDone(sectionId: string) {
  const f = form.value
  switch (sectionId) {
    case 'client-info': return !!f.clientName && !!f.email
    case 'stain-selection': return f.stainColorAdditive.length > 0
    case 'terms': return f.isStainSamplesThrough && f.isScreensNotAnAccurate && f.isWoodNaturalProduct && f.isAnyChangesColorsYourExpense && f.isMaplePineOther
    case 'notes': return true // optional
    case 'signature': return f.isSigned
    default: return false
  }
}

const completedSections = computed(() => sections.value.filter(s => isSectionDone(s.id)).length)
const progressPercent = computed(() => sections.value.length > 0 ? Math.round((completedSections.value / sections.value.length) * 100) : 0)

const allTermsAccepted = computed(() =>
  form.value.isStainSamplesThrough &&
  form.value.isScreensNotAnAccurate &&
  form.value.isWoodNaturalProduct &&
  form.value.isAnyChangesColorsYourExpense &&
  form.value.isMaplePineOther
)

// ─── Stain toggle ────────────────────────────────────────
function toggleStain(stain: string) {
  const arr = form.value.stainColorAdditive
  const idx = arr.indexOf(stain)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(stain)
}

// ─── Signature Pad ───────────────────────────────────────
const isDrawing = ref(false)
const canvasReady = ref(false)
const penColor = ref('#000000')
const penColors = ['#000000', '#2563eb', '#dc2626', '#16a34a']

function getCanvas(): HTMLCanvasElement | null {
  return document.querySelector('canvas')
}

function getCtx() {
  return getCanvas()?.getContext('2d') || null
}

function initCanvas() {
  const canvas = getCanvas()
  if (!canvas) return false
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.scale(dpr, dpr)
  // Fill with white background so strokes are always visible
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, rect.width, rect.height)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = 2.5
  ctx.strokeStyle = penColor.value
  canvasReady.value = true
  return true
}

function startDraw(e: MouseEvent | TouchEvent) {
  if (!canvasReady.value) {
    if (!initCanvas()) return
  }
  isDrawing.value = true
  const ctx = getCtx()
  if (!ctx) return
  ctx.strokeStyle = penColor.value
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  const { x, y } = getPos(e)
  ctx.moveTo(x, y)
}

function draw(e: MouseEvent | TouchEvent) {
  if (!isDrawing.value) return
  e.preventDefault()
  const ctx = getCtx()
  if (!ctx) return
  const { x, y } = getPos(e)
  ctx.lineTo(x, y)
  ctx.stroke()
}

function endDraw() {
  if (!isDrawing.value) return
  isDrawing.value = false
  hasDrawnSignature.value = true
  form.value.isSigned = true
  const canvas = getCanvas()
  if (canvas) {
    form.value.signature = canvas.toDataURL('image/png')
  }
}

function getPos(e: MouseEvent | TouchEvent) {
  const canvas = getCanvas()!
  const rect = canvas.getBoundingClientRect()
  const touch = 'touches' in e ? e.touches[0] || (e as TouchEvent).changedTouches[0] : null
  return {
    x: (touch ? touch.clientX : (e as MouseEvent).clientX) - rect.left,
    y: (touch ? touch.clientY : (e as MouseEvent).clientY) - rect.top,
  }
}

function clearSignature() {
  const canvas = getCanvas()
  if (!canvas) return
  const ctx = getCtx()
  if (!ctx) return
  const rect = canvas.getBoundingClientRect()
  // Re-fill with white
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, rect.width, rect.height)
  hasDrawnSignature.value = false
  form.value.isSigned = false
  form.value.signature = null
}

// ─── API ─────────────────────────────────────────────────
async function saveRecord() {
  if (!form.value.clientName) return toast.error('Name is required')
  if (!form.value.email) return toast.error('Email is required')
  if (form.value.stainColorAdditive.length === 0) return toast.error('Please select at least one stain color')
  if (!allTermsAccepted.value) return toast.error('All terms must be accepted')
  if (!form.value.isSigned) return toast.error('Signature is required')
  
  saving.value = true
  try {
    await $fetch('/api/public/stain-sign-off', { method: 'POST', body: form.value })
    submitted.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e: any) {
    toast.error('Submission failed', { description: e?.message || 'Please try again later' })
  } finally {
    saving.value = false
  }
}

</script>

<template>
  <div class="min-h-screen bg-muted/20 dark:bg-zinc-950 pb-20">

    <!-- ═════════ SUCCESS STATE ═════════ -->
    <div v-if="submitted" class="min-h-screen flex items-center justify-center p-6">
      <div class="max-w-md w-full text-center space-y-6 animate-in slide-in-from-bottom-8 fade-in duration-700">
        <div class="size-24 mx-auto rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center -mb-2 shadow-xl shadow-emerald-500/10">
          <Icon name="i-lucide-check" class="size-12 text-emerald-500" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">Sign Off Successful</h1>
        <p class="text-muted-foreground leading-relaxed">
          Thank you, <strong class="text-foreground">{{ form.clientName }}</strong>. Your stain sign-off has been completely processed. 
          A confirmation copy will be emailed to <strong class="text-foreground">{{ form.email }}</strong> shortly.
        </p>
        <div class="pt-6 border-t border-border/50">
          <p class="text-xs text-muted-foreground/60">Hardwood Hub Client Portal</p>
        </div>
      </div>
    </div>

    <!-- ═════════ FORM VIEW ═════════ -->
    <div v-else class="max-w-4xl mx-auto animate-in fade-in duration-500 bg-background/50 sm:bg-transparent min-h-screen shadow-2xl sm:shadow-none shadow-black/5">
      
      <!-- Public Brand Header -->
      <div class="px-6 py-8 flex flex-col items-center justify-center text-center">
        <div class="size-12 sm:size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Icon name="i-lucide-box" class="size-6 sm:size-8 text-primary" />
        </div>
        <h2 class="text-2xl sm:text-3xl font-black tracking-tight font-display mb-1">Stain Sign Off</h2>
        <p class="text-sm text-muted-foreground">Please review and select your final stain preferences.</p>
      </div>

      <!-- Sticky Masthead -->
      <div class="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-y border-border/50 shadow-sm">
        <div class="px-4 sm:px-6 py-4 flex items-center gap-4">
          <!-- Progress Ring -->
          <div class="relative size-12 sm:size-14 shrink-0 transition-transform hover:scale-105 duration-300">
            <svg class="size-12 sm:size-14 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4" class="text-muted/30" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4"
                class="text-primary transition-all duration-700 ease-out"
                :stroke-dasharray="`${progressPercent * 1.76} 176`"
                stroke-linecap="round"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-xs font-bold">{{ progressPercent }}%</span>
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Progress</p>
            <p class="text-sm font-semibold truncate">{{ completedSections }} of {{ sections.length }} complete</p>
          </div>

          <div class="flex items-center gap-2">
            <Button :disabled="saving || progressPercent < 100" size="default" class="h-10 px-6 sm:px-8 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all rounded-full" @click="saveRecord">
              <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
              {{ saving ? 'Submitting...' : 'Submit Form' }}
            </Button>
          </div>
        </div>

        <!-- Section Nav Pills (scroll-spy driven) -->
        <div ref="navPillsRef" class="px-4 sm:px-6 pb-4 flex gap-2 overflow-x-auto scrollbar-none masked-overflow">
          <button
            v-for="(section, idx) in sections"
            :key="section.id"
            data-pill
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-300 shrink-0 select-none"
            :class="activeSectionIdx === idx
              ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]'
              : isSectionDone(section.id)
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted'"
            @click="scrollToSection(idx)"
          >
            <Icon v-if="isSectionDone(section.id) && activeSectionIdx !== idx" name="i-lucide-check-circle-2" class="size-3" />
            <Icon v-else :name="section.icon" class="size-3" />
            {{ section.title }}
          </button>
        </div>
      </div>

      <!-- ─── All Sections (vertical timeline) ─── -->
      <div class="px-4 sm:px-8 pt-8 sm:pt-12 relative max-w-4xl mx-auto">

        <!-- Timeline connector line (desktop only) -->
        <div class="hidden sm:block absolute left-[42px] top-16 bottom-16 w-[2px] bg-gradient-to-b from-border/80 via-border/50 to-border/10 rounded-full" />

        <div class="space-y-6 sm:space-y-10">
          <div
            v-for="(section, idx) in sections"
            :key="section.id"
            :ref="(el: any) => setSectionRef(section.id, el)"
            :data-section-id="section.id"
            class="relative"
          >
            <!-- Timeline dot (desktop only) -->
            <div
              class="hidden sm:flex absolute -left-[4px] top-6 z-10 size-6 rounded-full border-[3px] items-center justify-center transition-all duration-500"
              :class="isSectionDone(section.id)
                ? 'bg-emerald-500 border-background text-primary-foreground shadow-lg shadow-emerald-500/30'
                : activeSectionIdx === idx
                  ? 'bg-primary border-background text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-primary/10'
                  : 'bg-muted border-background text-transparent'"
            >
              <Icon v-if="isSectionDone(section.id)" name="i-lucide-check" class="size-3.5" />
              <div v-else-if="activeSectionIdx === idx" class="size-2 rounded-full bg-white animate-pulse" />
            </div>

            <!-- Section Card -->
            <div
              class="rounded-2xl border bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-500 sm:ml-8 hover:shadow-xl hover:shadow-black/5"
              :class="[
                isSectionDone(section.id) ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-border/50',
                activeSectionIdx === idx ? 'ring-2 ring-primary/30 shadow-2xl shadow-primary/5 -translate-y-1' : ''
              ]"
            >
              <!-- Section Header -->
              <div class="px-4 sm:px-6 py-4 sm:py-5 flex items-start gap-3 sm:gap-4 border-b border-border/30 bg-muted/10">
                <div
                  class="size-10 sm:size-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 border"
                  :class="section.color"
                >
                  <Icon :name="section.icon" :class="['size-5 sm:size-6', section.iconColor]" />
                </div>
                <div class="flex-1 min-w-0 self-center">
                  <div class="flex items-baseline gap-2 mb-0.5">
                    <span class="text-[10px] font-black text-muted-foreground/40 tabular-nums font-mono leading-none tracking-tight">{{ String(idx + 1).padStart(2, '0') }}</span>
                    <h3 class="font-bold text-base sm:text-lg leading-none tracking-tight">{{ section.title }}</h3>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ section.description }}</p>
                </div>
                <div
                  class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full transition-colors self-center border"
                  :class="isSectionDone(section.id) ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border/50'"
                >
                  <Icon :name="isSectionDone(section.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle-dashed'" class="size-3" />
                  {{ isSectionDone(section.id) ? 'Done' : 'Pending' }}
                </div>
              </div>

              <!-- Section Content -->
              <div class="p-4 sm:p-6 space-y-5 sm:space-y-6">

                <!-- ── Client Info ── -->
                <template v-if="section.id === 'client-info'">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    <div class="flex flex-col gap-2">
                      <Label for="ss-client" class="flex items-center gap-1.5 font-bold text-sm">
                        Full Name <span class="text-destructive">*</span>
                      </Label>
                      <Input id="ss-client" v-model="form.clientName" placeholder="e.g. John Doe" class="h-11 sm:h-12 border-border/80 focus:ring-primary shadow-sm rounded-xl px-4" />
                    </div>
                    <div class="flex flex-col gap-2">
                      <Label for="ss-email" class="flex items-center gap-1.5 font-bold text-sm">
                        Email Address <span class="text-destructive">*</span>
                      </Label>
                      <Input id="ss-email" v-model="form.email" type="email" placeholder="john@example.com" class="h-11 sm:h-12 border-border/80 focus:ring-primary shadow-sm rounded-xl px-4" />
                    </div>
                  </div>
                </template>

                <!-- ── Stain Selection ── -->
                <template v-if="section.id === 'stain-selection'">
                  <div class="flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-3 bg-primary/5 border border-primary/10 rounded-xl p-3">
                      <div class="flex items-center gap-2">
                        <Icon name="i-lucide-palette" class="size-4 text-primary" />
                        <span class="text-sm font-semibold">Select all agreed stain colors</span>
                      </div>
                      <span v-if="form.stainColorAdditive.length" class="text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                        {{ form.stainColorAdditive.length }} selected
                      </span>
                    </div>
                    <!-- Search -->
                    <div class="relative max-w-sm">
                      <Icon name="i-lucide-search" class="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input v-model="stainSearch" placeholder="Search exact stain name..." class="pl-10 h-11 border-border/80 shadow-sm rounded-full text-sm" />
                    </div>
                    <!-- Selected chips preview -->
                    <div v-if="form.stainColorAdditive.length" class="flex flex-wrap gap-2 p-3 bg-muted/20 rounded-xl border border-border/40">
                      <span v-for="s in form.stainColorAdditive" :key="s" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-sm shadow-primary/20 animate-in zoom-in-95 duration-200">
                        {{ s }}
                        <button class="hover:bg-black/20 rounded-full p-0.5 transition-colors cursor-pointer" @click.stop="toggleStain(s)">
                          <Icon name="i-lucide-x" class="size-3" />
                        </button>
                      </span>
                    </div>
                    <!-- Color grid -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 max-h-[360px] overflow-y-auto pr-2 scrollbar-thumb-muted">
                      <button
                        v-for="stain in filteredStains"
                        :key="stain"
                        class="flex flex-row sm:flex-col items-center sm:items-start sm:justify-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-5 rounded-xl border font-bold transition-all duration-200 text-left"
                        :class="form.stainColorAdditive.includes(stain)
                          ? 'bg-amber-500 shadow-md shadow-amber-500/20 text-primary-foreground border-transparent scale-[1.02]'
                          : 'bg-card text-foreground border-border/60 hover:border-amber-500/50 hover:bg-amber-500/5 hover:shadow-md hover:-translate-y-0.5'"
                        @click="toggleStain(stain)"
                      >
                        <div
                          class="size-5 sm:size-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                          :class="form.stainColorAdditive.includes(stain) ? 'bg-primary-foreground border-primary-foreground text-amber-500' : 'border-border/60 text-transparent'"
                        >
                          <Icon name="i-lucide-check" class="size-3 sm:size-4" />
                        </div>
                        <span class="text-xs sm:text-sm leading-tight">{{ stain }}</span>
                      </button>
                    </div>
                  </div>
                </template>

                <!-- ── Terms & Acknowledgements ── -->
                <template v-if="section.id === 'terms'">
                  <div class="flex flex-col gap-2">
                    <p class="text-sm text-muted-foreground mb-4">Please read and acknowledge each of the following terms regarding the finishing process.</p>

                    <div class="space-y-3">
                      <label
                        v-for="item in AGREEMENT_ITEMS"
                        :key="item.key"
                        class="flex items-start gap-4 p-4 sm:p-5 rounded-xl border transition-all duration-300 cursor-pointer group"
                        :class="(form as any)[item.key]
                          ? 'bg-emerald-500 hover:bg-emerald-600 border-transparent shadow-lg shadow-emerald-500/20'
                          : 'bg-card border-border/80 hover:bg-muted/50 hover:border-emerald-500/40'"
                      >
                        <div class="pt-1 shrink-0">
                          <div
                            class="size-6 sm:size-7 rounded-md border-[2.5px] flex items-center justify-center transition-transform duration-300 transform"
                            :class="(form as any)[item.key]
                              ? 'bg-primary-foreground border-primary-foreground text-emerald-500 scale-110'
                              : 'border-border/60 group-hover:border-emerald-500/50 bg-background'"
                          >
                            <Icon name="i-lucide-check" class="size-4" :class="(form as any)[item.key] ? 'opacity-100' : 'opacity-0'" />
                          </div>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-[13px] sm:text-sm font-medium leading-relaxed transition-colors" :class="(form as any)[item.key] ? 'text-primary-foreground' : 'text-foreground'">
                            {{ item.label }}
                          </p>
                        </div>
                        <input type="checkbox" v-model="(form as any)[item.key]" class="sr-only" />
                      </label>
                    </div>
                  </div>
                </template>

                <!-- ── Special Notes ── -->
                <template v-if="section.id === 'notes'">
                  <div class="flex flex-col gap-3">
                    <Textarea
                      id="ss-notes"
                      v-model="form.specialNotes"
                      rows="5"
                      placeholder="Are there any special agreements, mix ratios, or other notes? (Optional)"
                      class="bg-background resize-none text-sm p-4 rounded-xl border-border/80 focus:ring-primary shadow-sm"
                    />
                  </div>
                </template>

                <!-- ── Signature ── -->
                <template v-if="section.id === 'signature'">
                  <div class="flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl border border-border/40">
                      <div class="flex items-center gap-2">
                        <Icon name="i-lucide-pen-tool" class="size-4 text-foreground/70" />
                        <span class="text-sm font-semibold">Draw your signature</span>
                      </div>
                      <!-- Pen Color Picker -->
                      <div class="flex items-center gap-2">
                        <button
                          v-for="color in penColors"
                          :key="color"
                          class="size-6 sm:size-7 rounded-full border-[3px] transition-all duration-200 cursor-pointer shadow-sm"
                          :style="{ backgroundColor: color }"
                          :class="penColor === color ? 'border-primary/30 scale-110 ring-4 ring-primary/10' : 'border-white hover:scale-105'"
                          @click="penColor = color"
                        />
                      </div>
                    </div>

                    <!-- Canvas -->
                    <div class="rounded-2xl border-[3px] overflow-hidden relative shadow-inner bg-white" :class="hasDrawnSignature ? 'border-emerald-500 border-solid' : 'border-border/60 border-dashed'">
                      <canvas
                        class="w-full h-[220px] sm:h-[280px] cursor-crosshair touch-none bg-white"
                        style="background: #ffffff;"
                        @mousedown="startDraw"
                        @mousemove="draw"
                        @mouseup="endDraw"
                        @mouseleave="endDraw"
                        @touchstart.passive="startDraw"
                        @touchmove="draw"
                        @touchend="endDraw"
                      />
                      <div v-if="!hasDrawnSignature" class="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                        <div class="bg-black/5 backdrop-blur-[1px] px-6 py-3 rounded-full border border-black/5 text-gray-400 font-bold tracking-widest uppercase text-sm flex items-center gap-2">
                          <Icon name="i-lucide-mouse-pointer-2" class="size-4" />
                          Sign Here
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center justify-between mt-2">
                      <div class="text-xs font-semibold px-3 py-1 rounded-full" :class="hasDrawnSignature ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'">
                        {{ hasDrawnSignature ? '✓ Signature logged' : 'Signature required to submit' }}
                      </div>
                      <Button variant="ghost" size="sm" class="h-9 px-4 font-bold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full" @click="clearSignature">
                        <Icon name="i-lucide-eraser" class="mr-2 size-4" />
                        Clear Canvas
                      </Button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- BIG BOTTOM SUBMIT SECTION -->
        <div class="mt-12 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div class="rounded-3xl bg-card border-none shadow-2xl p-6 sm:p-10 text-center relative overflow-hidden group">
            <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background opacity-50 z-0" />
            <div class="relative z-10 flex flex-col items-center">
              <div class="size-16 rounded-full flex items-center justify-center mb-5 transition-colors duration-500" :class="progressPercent === 100 ? 'bg-emerald-500 text-primary-foreground shadow-lg shadow-emerald-500/30' : 'bg-muted text-muted-foreground'">
                <Icon :name="progressPercent === 100 ? 'i-lucide-check-check' : 'i-lucide-lock'" class="size-8" />
              </div>
              <h2 class="text-2xl font-black tracking-tight mb-2">Ready to submit?</h2>
              <p class="text-muted-foreground mb-8 max-w-sm mx-auto">
                {{ progressPercent === 100 ? 'All sections are complete. You may now submit your stain sign-off.' : `You must complete all sections before submitting. Currently at ${progressPercent}%.` }}
              </p>
              
              <Button :disabled="saving || progressPercent < 100" class="h-14 px-12 text-base font-black rounded-full w-full sm:w-auto transition-all duration-300 group-hover:shadow-xl group-hover:shadow-primary/20" :class="progressPercent === 100 ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'" @click="saveRecord">
                <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" />
                {{ saving ? 'Processing...' : 'Submit Sign Off' }}
              </Button>
              <div class="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                 <Icon name="i-lucide-shield-check" class="size-3" /> Secure digital signature
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.masked-overflow {
  mask-image: linear-gradient(to right, black 90%, transparent 100%);
}
.font-display {
  font-family: inherit; /* Inherit global font */
}
</style>
