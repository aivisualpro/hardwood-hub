<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Stain Sign Off', icon: 'i-lucide-stamp', description: 'Client stain color selection and sign-off form' })

const { canCreate, canUpdate, canDelete } = usePermissions('/external/stain-sign-off')

// ─── Types ───────────────────────────────────────────────
interface StainSignOffRecord {
  _id: string
  clientName: string | null
  email: string | null
  stainColorAdditive: string[]
  isStainSamplesThrough: boolean
  isScreensNotAnAccurate: boolean
  isWoodNaturalProduct: boolean
  isAnyChangesColorsYourExpense: boolean
  isMaplePineOther: boolean
  specialNotes: string | null
  isSigned: boolean
  signature: string | null
  createdBy: string | null
  createdAt: string
}

// ─── State ───────────────────────────────────────────────
const activeTab = ref('list')
const records = ref<StainSignOffRecord[]>([])
const loading = ref(true)
const saving = ref(false)
const editingId = ref<string | null>(null)

function emptyForm() {
  return {
    clientName: '',
    email: '',
    stainColorAdditive: [] as string[],
    isStainSamplesThrough: false,
    isScreensNotAnAccurate: false,
    isWoodNaturalProduct: false,
    isAnyChangesColorsYourExpense: false,
    isMaplePineOther: false,
    specialNotes: '',
    isSigned: false,
    signature: null as string | null,
    createdBy: '',
  }
}
const hasDrawnSignature = ref(false)
const form = ref(emptyForm())

// ─── Stain Options ───────────────────────────────────────
const STAIN_OPTIONS = [
  'CLEAR',
  '1 COAT WHITENER',
  '2 COATS WHITENER',
  '3 COATS WHITENER',
  '1 COAT AMBERIZER',
  '2 COATS AMBERIZER',
  '3 COATS AMBERIZER',
  'AGED BARREL',
  'ANTIQUE BROWN',
  'CHERRY',
  'CHESTNUT',
  'CLASSIC GRAY',
  'COFFEE BROWN',
  'COLONIAL MAPLE',
  'DARK GRAY',
  'DARK WALNUT',
  'EARLY AMERICAN',
  'EBONY',
  'ENGLISH CHESTNUT',
  'ESPRESSO',
  'FRUITWOOD',
  'GOLDEN BROWN',
  'GOLDEN OAK',
  'GOLDEN PECAN',
  'GUNSTOCK',
  'HERITAGE BROWN',
  'JACOBEAN',
  'MEDIUM BROWN',
  'NEUTRAL',
  'NUTMEG',
  'PROVINCIAL',
  'RED MAHOGANY',
  'ROYAL MAHOGANY',
  'ROSEWOOD',
  'RUSTIC BEIGE',
  'SEDONA RED',
  'SILVERED GRAY',
  'SPECIAL WALNUT',
  'SPICE BROWN',
  'TRUE BLACK',
  'WARM GRAY',
  'WEATHERED OAK',
  'MIX',
] as const

const stainSearch = ref('')
const filteredStains = computed(() => {
  if (!stainSearch.value.trim())
    return STAIN_OPTIONS
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
    description: 'Enter client name and email address',
    color: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    iconColor: 'text-blue-400',
  },
  {
    id: 'stain-selection',
    title: 'Stain Color / Additive',
    icon: 'i-lucide-palette',
    description: 'Select all stain colors and additives used',
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
    description: 'Notes about the finishing process or mix ratios',
    color: 'from-violet-500/20 to-violet-500/5 border-violet-500/30',
    iconColor: 'text-violet-400',
  },
  {
    id: 'signature',
    title: 'Signature',
    icon: 'i-lucide-pen-tool',
    description: 'Client signature to confirm stain selection',
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
  if (!section)
    return
  const el = sectionRefs.value[section.id]
  const container = scrollContainer.value
  if (!el || !container)
    return
  isScrollingProgrammatically.value = true
  activeSectionIdx.value = idx
  // calculate offset — sticky header is ~140px
  const headerOffset = 160
  const top = el.offsetTop - headerOffset
  container.scrollTo({ top, behavior: 'smooth' })
  // Reset the flag after animation completes
  setTimeout(() => { isScrollingProgrammatically.value = false }, 600)
  // Also scroll the nav pill into view
  scrollPillIntoView(idx)
}

function scrollPillIntoView(idx: number) {
  const navEl = navPillsRef.value
  if (!navEl)
    return
  const pills = navEl.querySelectorAll('[data-pill]')
  const pill = pills[idx] as HTMLElement
  if (!pill)
    return
  pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}

// IntersectionObserver scroll-spy
let observer: IntersectionObserver | null = null

function setupScrollSpy() {
  if (observer)
    observer.disconnect()
  const container = scrollContainer.value
  if (!container)
    return

  observer = new IntersectionObserver(
    (entries) => {
      if (isScrollingProgrammatically.value)
        return
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
      root: container,
      rootMargin: '-30% 0px -60% 0px',
      threshold: 0,
    },
  )

  // Observe all section elements
  for (const section of sections.value) {
    const el = sectionRefs.value[section.id]
    if (el)
      observer.observe(el)
  }
}

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
  form.value.isStainSamplesThrough
  && form.value.isScreensNotAnAccurate
  && form.value.isWoodNaturalProduct
  && form.value.isAnyChangesColorsYourExpense
  && form.value.isMaplePineOther,
)

// ─── Stain toggle ────────────────────────────────────────
function toggleStain(stain: string) {
  const arr = form.value.stainColorAdditive
  const idx = arr.indexOf(stain)
  if (idx >= 0)
    arr.splice(idx, 1)
  else arr.push(stain)
}

// ─── Signature Pad ───────────────────────────────────────
const isDrawing = ref(false)
const sessionSignatureDrawn = ref(false)
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
  if (!canvas)
    return false
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0)
    return false
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return false
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
    if (!initCanvas())
      return
  }
  isDrawing.value = true
  sessionSignatureDrawn.value = true
  hasDrawnSignature.value = true
  form.value.isSigned = true
  const ctx = getCtx()
  if (!ctx)
    return
  ctx.strokeStyle = penColor.value
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  const { x, y } = getPos(e)
  ctx.moveTo(x, y)
}

function draw(e: MouseEvent | TouchEvent) {
  if (!isDrawing.value)
    return
  e.preventDefault()
  const ctx = getCtx()
  if (!ctx)
    return
  const { x, y } = getPos(e)
  ctx.lineTo(x, y)
  ctx.stroke()
}

function endDraw() {
  if (!isDrawing.value)
    return
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
  if (!canvas)
    return
  const ctx = getCtx()
  if (!ctx)
    return
  const rect = canvas.getBoundingClientRect()
  // Re-fill with white
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, rect.width, rect.height)
  hasDrawnSignature.value = false
  sessionSignatureDrawn.value = false
  form.value.isSigned = false
  form.value.signature = null
}

watch(activeTab, (tab) => {
  if (tab === 'form') {
    nextTick(() => {
      setupScrollSpy()
    })
  }
  else {
    observer?.disconnect()
  }
})

// ─── API ─────────────────────────────────────────────────
async function fetchRecords() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: StainSignOffRecord[] }>('/api/stain-sign-off')
    records.value = res.data
  }
  catch (e: any) {
    toast.error('Failed to load records', { description: e?.message })
  }
  finally {
    loading.value = false
  }
}

onMounted(fetchRecords)

function openCreate() {
  form.value = emptyForm()
  editingId.value = null
  activeSectionIdx.value = 0
  hasDrawnSignature.value = false
  sessionSignatureDrawn.value = false
  canvasReady.value = false
  activeTab.value = 'form'
}

function openEdit(rec: StainSignOffRecord) {
  const base = emptyForm()
  const merged = { ...base, ...rec }
  if (!Array.isArray(merged.stainColorAdditive)) {
    merged.stainColorAdditive = merged.stainColorAdditive ? [merged.stainColorAdditive] : []
  }
  form.value = merged as any
  editingId.value = rec._id
  activeSectionIdx.value = 0
  hasDrawnSignature.value = !!merged.isSigned
  sessionSignatureDrawn.value = false
  activeTab.value = 'form'
}

function cancelEdit() {
  activeTab.value = 'list'
  editingId.value = null
}

async function saveRecord() {
  if (!form.value.clientName)
    return toast.error('Client Name is required')
  if (!form.value.email)
    return toast.error('Email is required')
  if (form.value.stainColorAdditive.length === 0)
    return toast.error('Please select at least one stain color')
  if (!allTermsAccepted.value)
    return toast.error('All terms must be accepted')
  if (!form.value.isSigned)
    return toast.error('Signature is required')
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/stain-sign-off/${editingId.value}`, { method: 'PUT', body: form.value })
      toast.success('Sign-off updated successfully')
    }
    else {
      await $fetch('/api/stain-sign-off', { method: 'POST', body: form.value })
      toast.success('Sign-off submitted successfully')
    }
    await fetchRecords()
    activeTab.value = 'list'
  }
  catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  }
  finally {
    saving.value = false
  }
}

async function deleteRecord(id: string) {
  // eslint-disable-next-line no-alert
  if (!confirm('Are you sure you want to delete this sign-off?'))
    return
  try {
    const idx = records.value.findIndex(r => r._id === id)
    if (idx !== -1)
      records.value.splice(idx, 1)
    await $fetch(`/api/stain-sign-off/${id}`, { method: 'DELETE' })
    toast.success('Sign-off deleted')
  }
  catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
    await fetchRecords()
  }
}

function formatShortDate(d: string) {
  if (!d)
    return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Summary Stats ───────────────────────────────────────
const todayCount = computed(() => {
  const today = new Date().toDateString()
  return records.value.filter(r => new Date(r.createdAt).toDateString() === today).length
})
const totalRecords = computed(() => records.value.length)
const signedCount = computed(() => records.value.filter(r => r.isSigned).length)

// ─── Share / Card Options ────────────────────────────────
const showShareDialog = ref(false)
const publicUrl = ref('')
const isNativeShareSupported = ref(false)
const generatingCard = ref(false)

onMounted(() => {
  publicUrl.value = `${window.location.origin}/public/stain-sign-off`
  if (navigator && 'share' in navigator) {
    isNativeShareSupported.value = true
  }
})

// Draw a beautiful 1080x1080 image to share or download
async function generateAwesomeCard(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return resolve(null)

    // Background Gradient (Sleek Dark)
    const grad = ctx.createRadialGradient(540, 540, 0, 540, 540, 800)
    grad.addColorStop(0, '#27272a') // zinc-800
    grad.addColorStop(1, '#09090b') // zinc-950
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1080, 1080)

    // Inner Amber Borders
    ctx.strokeStyle = '#d97706' // amber-600
    ctx.lineWidth = 6
    ctx.strokeRect(40, 40, 1000, 1000)
    ctx.strokeStyle = '#fbbf24' // amber-400
    ctx.lineWidth = 1.5
    ctx.strokeRect(52, 52, 976, 976)

    // Hardwood Hub Top Title
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '4px'
    ctx.fillText('HARDWOOD HUB', 540, 140)

    // Main Headers
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 76px system-ui, -apple-system, sans-serif'
    ctx.letterSpacing = 'normal'
    ctx.fillText('Stain Sign Off', 540, 240)

    ctx.fillStyle = '#a1a1aa'
    ctx.font = '34px system-ui, -apple-system, sans-serif'
    ctx.fillText('Client Color Selection Document', 540, 305)

    // Draw White Box for QR
    const qrSize = 460
    const qrX = 540 - qrSize / 2
    const qrY = 380
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48, 24)
    ctx.fill()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 15

    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      // Clear shadow and draw QR code
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize)

      // Footer call to action
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 32px system-ui, -apple-system, sans-serif'
      ctx.fillText('SCAN TO REVIEW & SIGN', 540, 930)

      ctx.fillStyle = '#71717a'
      ctx.font = '26px system-ui, -apple-system, sans-serif'
      ctx.fillText(publicUrl.value, 540, 980)

      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/png')
    }
    img.onerror = () => resolve(null)
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(publicUrl.value)}&margin=0&color=09090b`
  })
}

async function downloadCard() {
  generatingCard.value = true
  try {
    const blob = await generateAwesomeCard()
    if (!blob)
      throw new Error('Could not generate card.')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Hardwood-Stain-SignOff.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Card downloaded successfully')
  }
  catch (e: any) {
    toast.error('Failed to download card', { description: e?.message })
  }
  finally {
    generatingCard.value = false
  }
}

async function nativeShare() {
  if (navigator.share) {
    try {
      const blob = await generateAwesomeCard()
      let filesArray: File[] = []
      if (blob) {
        filesArray = [new File([blob], 'Stain-SignOff.png', { type: 'image/png' })]
      }

      const shareData: any = {
        title: 'Hardwood Stain Sign Off',
        text: 'Please scan or click the link to review and sign your stain selection.',
        url: publicUrl.value,
      }

      if (filesArray.length && navigator.canShare && navigator.canShare({ files: filesArray })) {
        shareData.files = filesArray
      }

      await navigator.share(shareData)
    }
    catch (e) {
      console.error('Error sharing', e)
    }
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(publicUrl.value)
    toast.success('Link copied to clipboard')
  }
  catch {
    toast.error('Failed to copy link')
  }
}
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))]" :class="activeTab === 'list' ? 'overflow-y-auto' : 'overflow-hidden'">
    <!-- ═════════ LIST VIEW ═════════ -->
    <div v-if="activeTab === 'list'" class="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-lg sm:text-2xl font-bold tracking-tight">
            Stain Sign Off
          </h1>
          <p class="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">
            Manage client stain color selections and sign-off documents
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" class="h-8 sm:h-9 text-xs sm:text-sm font-semibold border-primary/20 text-primary hover:bg-primary/5" @click="showShareDialog = true">
            <Icon name="i-lucide-qr-code" class="mr-1 sm:mr-2 size-3.5 sm:size-4" />
            <span class="hidden sm:inline">Share Link</span>
            <span class="sm:hidden">Share</span>
          </Button>
          <Button v-if="canCreate()" size="sm" class="h-8 sm:h-9 text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" @click="openCreate">
            <Icon name="i-lucide-plus" class="mr-1 sm:mr-2 size-3.5 sm:size-4" />
            <span class="hidden sm:inline">New Sign Off</span>
            <span class="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-3 gap-2 sm:gap-4">
        <div class="rounded-xl border border-border/50 bg-card p-2.5 sm:p-4 flex items-center gap-2 sm:gap-4">
          <div class="size-8 sm:size-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Icon name="i-lucide-file-signature" class="size-3.5 sm:size-5 text-blue-400" />
          </div>
          <div class="min-w-0">
            <p class="text-[9px] sm:text-xs text-muted-foreground font-medium truncate">
              Today
            </p>
            <p class="text-lg sm:text-xl font-bold">
              {{ todayCount }}
            </p>
          </div>
        </div>
        <div class="rounded-xl border border-border/50 bg-card p-2.5 sm:p-4 flex items-center gap-2 sm:gap-4">
          <div class="size-8 sm:size-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Icon name="i-lucide-check-circle-2" class="size-3.5 sm:size-5 text-emerald-400" />
          </div>
          <div class="min-w-0">
            <p class="text-[9px] sm:text-xs text-muted-foreground font-medium truncate">
              Signed
            </p>
            <p class="text-lg sm:text-xl font-bold">
              {{ signedCount }}
            </p>
          </div>
        </div>
        <div class="rounded-xl border border-border/50 bg-card p-2.5 sm:p-4 flex items-center gap-2 sm:gap-4">
          <div class="size-8 sm:size-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Icon name="i-lucide-archive" class="size-3.5 sm:size-5 text-amber-400" />
          </div>
          <div class="min-w-0">
            <p class="text-[9px] sm:text-xs text-muted-foreground font-medium truncate">
              Total
            </p>
            <p class="text-lg sm:text-xl font-bold">
              {{ totalRecords }}
            </p>
          </div>
        </div>
      </div>

      <!-- Records Table -->
      <div class="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div v-if="loading" class="p-8 sm:p-12 flex justify-center text-muted-foreground gap-3 items-center">
          <Icon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" /> Loading...
        </div>
        <div v-else-if="records.length === 0" class="p-12 sm:p-24 flex flex-col items-center justify-center text-center px-4">
          <div class="size-16 sm:size-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-4 sm:mb-5">
            <Icon name="i-lucide-stamp" class="size-7 sm:size-10 text-primary" />
          </div>
          <h3 class="text-lg sm:text-xl font-bold mb-2">
            No sign-offs yet
          </h3>
          <p class="text-xs sm:text-sm text-muted-foreground max-w-sm mb-4 sm:mb-6">
            Create your first stain sign-off document to start tracking client color selections.
          </p>
          <Button v-if="canCreate()" size="lg" @click="openCreate">
            <Icon name="i-lucide-plus" class="mr-2 size-4" />
            Create First Sign Off
          </Button>
        </div>
        <div v-else>
          <!-- Desktop table -->
          <div class="hidden sm:block overflow-x-auto">
            <table class="w-full text-sm text-left whitespace-nowrap">
              <thead>
                <tr class="bg-muted/40 border-b border-border/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                  <th class="px-5 py-3">
                    Date
                  </th>
                  <th class="px-5 py-3">
                    Client
                  </th>
                  <th class="px-5 py-3">
                    Email
                  </th>
                  <th class="px-5 py-3">
                    Stain Colors
                  </th>
                  <th class="px-5 py-3 text-center">
                    Signed
                  </th>
                  <th class="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/30">
                <tr v-for="r in records" :key="r._id" class="hover:bg-muted/20 transition-colors cursor-pointer group" @click="openEdit(r)">
                  <td class="px-5 py-3 text-muted-foreground">
                    {{ formatShortDate(r.createdAt) }}
                  </td>
                  <td class="px-5 py-3 font-semibold">
                    {{ r.clientName || '—' }}
                  </td>
                  <td class="px-5 py-3 text-muted-foreground">
                    {{ r.email || '—' }}
                  </td>
                  <td class="px-5 py-3">
                    <div class="flex flex-wrap gap-1 max-w-[250px]">
                      <span v-for="stain in (r.stainColorAdditive || []).slice(0, 3)" :key="stain" class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                        {{ stain }}
                      </span>
                      <span v-if="(r.stainColorAdditive || []).length > 3" class="text-[10px] text-muted-foreground">
                        +{{ r.stainColorAdditive.length - 3 }}
                      </span>
                      <span v-if="!r.stainColorAdditive?.length" class="text-muted-foreground/50">—</span>
                    </div>
                  </td>
                  <td class="px-5 py-3 text-center">
                    <span v-if="r.isSigned" class="inline-flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <Icon name="i-lucide-check" class="size-3.5" />
                    </span>
                    <span v-else class="inline-flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
                      <Icon name="i-lucide-minus" class="size-3.5" />
                    </span>
                  </td>
                  <td class="px-5 py-3 text-right" @click.stop>
                    <Button v-if="canUpdate()" variant="ghost" size="sm" class="h-8 px-2" @click="openEdit(r)">
                      <Icon name="i-lucide-pencil" class="size-4" />
                    </Button>
                    <Button v-if="canDelete()" variant="ghost" size="sm" class="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" @click="deleteRecord(r._id)">
                      <Icon name="i-lucide-trash-2" class="size-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Mobile cards -->
          <div class="sm:hidden divide-y divide-border/30">
            <div v-for="r in records" :key="r._id" class="px-3 py-3 hover:bg-muted/20 transition-colors cursor-pointer" @click="openEdit(r)">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold truncate">
                    {{ r.clientName || '—' }}
                  </p>
                  <p class="text-[10px] text-muted-foreground mt-0.5">
                    {{ formatShortDate(r.createdAt) }} · {{ r.email || 'No email' }}
                  </p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span v-if="r.isSigned" class="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <Icon name="i-lucide-check" class="size-2.5" />
                  </span>
                  <div class="flex items-center gap-0.5" @click.stop>
                    <Button v-if="canUpdate()" variant="ghost" size="sm" class="size-7 p-0" @click="openEdit(r)">
                      <Icon name="i-lucide-pencil" class="size-3.5" />
                    </Button>
                    <Button v-if="canDelete()" variant="ghost" size="sm" class="size-7 p-0 text-destructive" @click="deleteRecord(r._id)">
                      <Icon name="i-lucide-trash-2" class="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <div class="flex flex-wrap gap-1 mt-2">
                <span v-for="stain in (r.stainColorAdditive || []).slice(0, 4)" :key="stain" class="px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-semibold border border-amber-500/20">
                  {{ stain }}
                </span>
                <span v-if="(r.stainColorAdditive || []).length > 4" class="text-[9px] text-muted-foreground self-center">
                  +{{ r.stainColorAdditive.length - 4 }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═════════ FORM VIEW ═════════ -->
    <div v-else ref="scrollContainer" class="max-w-4xl mx-auto pb-12 h-[calc(100vh-theme(spacing.16))] overflow-y-auto scroll-smooth">
      <!-- Sticky Masthead -->
      <div class="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div class="px-3 sm:px-6 py-3 sm:py-5 flex items-center gap-3 sm:gap-5">
          <!-- Progress Ring -->
          <div class="relative size-12 sm:size-16 shrink-0">
            <svg class="size-12 sm:size-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4" class="text-muted/30" />
              <circle
                cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4"
                class="text-primary transition-all duration-500"
                :stroke-dasharray="`${progressPercent * 1.76} 176`"
                stroke-linecap="round"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-[10px] sm:text-sm font-bold">{{ progressPercent }}%</span>
          </div>

          <div class="flex-1 min-w-0">
            <h1 class="text-base sm:text-xl font-bold tracking-tight truncate">
              <span class="hidden sm:inline">Stain Sign Off Form</span>
              <span class="sm:hidden">Stain Sign Off</span>
              <span class="text-muted-foreground font-normal text-xs sm:text-base ml-1">{{ editingId ? '(editing)' : '(new)' }}</span>
            </h1>
            <p class="text-[10px] sm:text-sm text-muted-foreground mt-0.5">
              {{ completedSections }}/{{ sections.length }} sections completed
            </p>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" class="h-8 sm:h-9 px-2 sm:px-3 text-xs" @click="cancelEdit">
              <Icon name="i-lucide-arrow-left" class="mr-0.5 sm:mr-1.5 size-3.5" />
              <span class="hidden sm:inline">Back</span>
            </Button>
            <Button :disabled="saving" size="sm" class="h-8 sm:h-9 px-2.5 sm:px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90" @click="saveRecord">
              <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-1 sm:mr-2 size-3.5 sm:size-4 animate-spin" />
              <Icon v-else name="i-lucide-save" class="mr-0.5 sm:mr-1.5 size-3.5" />
              {{ editingId ? 'Save' : 'Submit' }}
            </Button>
          </div>
        </div>

        <!-- Section Nav Pills (scroll-spy driven) -->
        <div ref="navPillsRef" class="px-3 sm:px-6 pb-3 sm:pb-4 flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none">
          <button
            v-for="(section, idx) in sections"
            :key="section.id"
            data-pill
            class="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 min-h-[30px] sm:min-h-0"
            :class="activeSectionIdx === idx
              ? 'bg-primary/10 text-primary border-primary/40 shadow-sm shadow-primary/5 scale-[1.02]'
              : isSectionDone(section.id)
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted'"
            @click="scrollToSection(idx)"
          >
            <Icon :name="isSectionDone(section.id) ? 'i-lucide-check-circle-2' : section.icon" class="size-3" />
            {{ section.title }}
          </button>
        </div>
      </div>

      <!-- ─── All Sections (vertical timeline) ─── -->
      <div class="px-3 sm:px-6 pt-4 sm:pt-6 relative">
        <!-- Timeline connector line (desktop only) -->
        <div class="hidden sm:block absolute left-[38px] top-8 bottom-8 w-px bg-gradient-to-b from-border/80 via-border/50 to-border/20" />

        <div class="space-y-4 sm:space-y-6">
          <div
            v-for="(section, idx) in sections"
            :key="section.id"
            :ref="(el: any) => setSectionRef(section.id, el)"
            :data-section-id="section.id"
            class="relative"
          >
            <!-- Timeline dot (desktop only) -->
            <div
              class="hidden sm:flex absolute -left-[9px] top-5 z-10 size-[18px] rounded-full border-2 items-center justify-center transition-all duration-300"
              :class="isSectionDone(section.id)
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                : activeSectionIdx === idx
                  ? 'bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/30'
                  : 'bg-background border-border/60 text-muted-foreground/30'"
            >
              <Icon v-if="isSectionDone(section.id)" name="i-lucide-check" class="size-2.5" />
              <div v-else class="size-1.5 rounded-full bg-current" />
            </div>

            <!-- Section Card -->
            <div
              class="rounded-xl border bg-card overflow-hidden transition-all duration-300 sm:ml-4"
              :class="[
                isSectionDone(section.id) ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-border/50',
                activeSectionIdx === idx ? 'ring-1 ring-primary/20 shadow-sm' : '',
              ]"
            >
              <!-- Section Header -->
              <div class="px-3 sm:px-5 py-3 sm:py-4 flex items-start gap-2.5 sm:gap-4">
                <div
                  class="size-8 sm:size-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 border"
                  :class="section.color"
                >
                  <Icon :name="section.icon" class="size-4 sm:size-5" :class="[section.iconColor]" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-[9px] font-bold text-muted-foreground/50 tabular-nums">{{ String(idx + 1).padStart(2, '0') }}</span>
                    <h3 class="font-bold text-sm sm:text-base">
                      {{ section.title }}
                    </h3>
                  </div>
                  <p class="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    {{ section.description }}
                  </p>
                </div>
                <span
                  class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest shrink-0 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                  :class="isSectionDone(section.id) ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/60 text-muted-foreground'"
                >
                  {{ isSectionDone(section.id) ? '✓ Done' : 'Pending' }}
                </span>
              </div>

              <!-- Section Content -->
              <div class="px-3 sm:px-5 pb-4 sm:pb-6 space-y-4 sm:space-y-5">
                <!-- ── Client Info ── -->
                <template v-if="section.id === 'client-info'">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div class="flex flex-col gap-1.5">
                      <Label for="ss-client" class="flex items-center gap-1.5">
                        <Icon name="i-lucide-user" class="size-3.5 text-muted-foreground" />
                        Client Name <span class="text-destructive">*</span>
                      </Label>
                      <Input id="ss-client" v-model="form.clientName" placeholder="Enter client name" class="h-9 sm:h-10" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="ss-email" class="flex items-center gap-1.5">
                        <Icon name="i-lucide-mail" class="size-3.5 text-muted-foreground" />
                        Email
                      </Label>
                      <Input id="ss-email" v-model="form.email" type="email" placeholder="client@email.com" class="h-9 sm:h-10" />
                    </div>
                  </div>
                </template>

                <!-- ── Stain Selection ── -->
                <template v-if="section.id === 'stain-selection'">
                  <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between gap-3">
                      <Label class="flex items-center gap-1.5">
                        <Icon name="i-lucide-palette" class="size-3.5 text-muted-foreground" />
                        Select stain colors <span class="text-destructive">*</span>
                      </Label>
                      <span v-if="form.stainColorAdditive.length" class="text-[10px] sm:text-xs font-semibold text-primary">
                        {{ form.stainColorAdditive.length }} selected
                      </span>
                    </div>
                    <!-- Search -->
                    <div class="relative">
                      <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input v-model="stainSearch" placeholder="Search stains..." class="pl-9 h-8 sm:h-9 text-xs sm:text-sm" />
                    </div>
                    <!-- Selected chips preview -->
                    <div v-if="form.stainColorAdditive.length" class="flex flex-wrap gap-1.5">
                      <span v-for="s in form.stainColorAdditive" :key="s" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/30 text-[10px] sm:text-xs font-semibold">
                        {{ s }}
                        <button class="hover:text-destructive transition-colors cursor-pointer" @click.stop="toggleStain(s)">
                          <Icon name="i-lucide-x" class="size-2.5 sm:size-3" />
                        </button>
                      </span>
                    </div>
                    <!-- Color grid -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2 max-h-[280px] sm:max-h-[320px] overflow-y-auto pr-1">
                      <button
                        v-for="stain in filteredStains"
                        :key="stain"
                        class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg border text-[10px] sm:text-xs font-medium transition-all duration-150 text-left min-h-[36px] sm:min-h-0"
                        :class="form.stainColorAdditive.includes(stain)
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40 shadow-sm shadow-amber-500/5'
                          : 'bg-card text-muted-foreground border-border/50 hover:border-amber-500/30 hover:bg-muted/30'"
                        @click="toggleStain(stain)"
                      >
                        <span
                          class="size-3 sm:size-3.5 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-colors"
                          :class="form.stainColorAdditive.includes(stain) ? 'bg-amber-500 border-amber-500 text-white' : 'border-border/60'"
                        >
                          <Icon v-if="form.stainColorAdditive.includes(stain)" name="i-lucide-check" class="size-2" />
                        </span>
                        {{ stain }}
                      </button>
                    </div>
                  </div>
                </template>

                <!-- ── Terms & Acknowledgements ── -->
                <template v-if="section.id === 'terms'">
                  <div class="flex flex-col gap-1">
                    <Label class="flex items-center gap-1.5 mb-3">
                      <Icon name="i-lucide-shield-check" class="size-3.5 text-muted-foreground" />
                      By signing this I agree to the following terms <span class="text-destructive">*</span>
                    </Label>

                    <div class="space-y-2 sm:space-y-3">
                      <label
                        v-for="item in AGREEMENT_ITEMS"
                        :key="item.key"
                        class="flex items-start gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 rounded-xl border transition-all duration-200 cursor-pointer group min-h-[48px]"
                        :class="(form as any)[item.key]
                          ? 'bg-emerald-500/5 border-emerald-500/30 shadow-sm'
                          : 'bg-card border-border/50 hover:bg-muted/30 hover:border-primary/30'"
                      >
                        <div class="pt-0.5 shrink-0">
                          <div
                            class="size-5 sm:size-6 rounded-md border-2 flex items-center justify-center transition-all duration-200"
                            :class="(form as any)[item.key]
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                              : 'border-border/60 group-hover:border-primary/40'"
                          >
                            <Icon v-if="(form as any)[item.key]" name="i-lucide-check" class="size-3 sm:size-3.5" />
                          </div>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-xs sm:text-sm leading-relaxed text-muted-foreground" :class="(form as any)[item.key] && 'text-foreground'">
                            {{ item.label }}
                          </p>
                        </div>
                        <input v-model="(form as any)[item.key]" type="checkbox" class="sr-only">
                      </label>
                    </div>

                    <!-- Status indicator -->
                    <div class="mt-3 flex items-center gap-2 text-xs" :class="allTermsAccepted ? 'text-emerald-500' : 'text-muted-foreground'">
                      <Icon :name="allTermsAccepted ? 'i-lucide-check-circle-2' : 'i-lucide-circle-alert'" class="size-3.5" />
                      {{ allTermsAccepted ? 'All terms accepted' : `${AGREEMENT_ITEMS.filter(i => (form as any)[i.key]).length} of ${AGREEMENT_ITEMS.length} terms accepted` }}
                    </div>
                  </div>
                </template>

                <!-- ── Special Notes ── -->
                <template v-if="section.id === 'notes'">
                  <div class="flex flex-col gap-1.5">
                    <Label for="ss-notes" class="flex items-center gap-1.5">
                      <Icon name="i-lucide-message-square-text" class="size-3.5 text-muted-foreground" />
                      Any special notes about the finishing process or mix ratios
                    </Label>
                    <Textarea
                      id="ss-notes"
                      v-model="form.specialNotes"
                      rows="4"
                      placeholder="Enter any special notes about the process, specific mix ratios, timelines, etc..."
                      class="bg-background/50 resize-none text-sm"
                    />
                  </div>
                </template>

                <!-- ── Signature ── -->
                <template v-if="section.id === 'signature'">
                  <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between gap-3">
                      <Label class="flex items-center gap-1.5">
                        <Icon name="i-lucide-pen-tool" class="size-3.5 text-muted-foreground" />
                        Signature <span class="text-destructive">*</span>
                      </Label>
                      <!-- Pen Color Picker -->
                      <div class="flex items-center gap-1.5 sm:gap-2">
                        <button
                          v-for="color in penColors"
                          :key="color"
                          class="size-5 sm:size-6 rounded-full border-2 transition-all duration-150 cursor-pointer"
                          :style="{ backgroundColor: color }"
                          :class="penColor === color ? 'border-foreground scale-110 ring-2 ring-foreground/20' : 'border-border/60 hover:scale-105'"
                          @click="penColor = color"
                        />
                      </div>
                    </div>

                    <!-- Canvas -->
                    <div class="rounded-xl border-2 border-dashed overflow-hidden relative" :class="hasDrawnSignature ? 'border-emerald-500/40' : 'border-border/60'">
                      <canvas
                        class="w-full h-[180px] sm:h-[220px] cursor-crosshair touch-none"
                        style="background: #ffffff;"
                        @mousedown="startDraw"
                        @mousemove="draw"
                        @mouseup="endDraw"
                        @mouseleave="endDraw"
                        @touchstart.passive="startDraw"
                        @touchmove="draw"
                        @touchend="endDraw"
                      />
                      <div v-if="!hasDrawnSignature" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p class="text-sm text-gray-400 font-medium">
                          Draw your signature here
                        </p>
                      </div>
                      <div v-else-if="hasDrawnSignature && !sessionSignatureDrawn && form.signature" class="absolute inset-0 bg-white flex items-center justify-center pointer-events-none">
                        <img :src="form.signature" alt="Client Signature" class="w-full h-full object-contain mix-blend-multiply">
                      </div>
                      <div v-else-if="hasDrawnSignature && !sessionSignatureDrawn" class="absolute inset-0 flex items-center justify-center pointer-events-none bg-white/95">
                        <div class="text-center">
                          <div class="size-10 sm:size-12 rounded-full border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                            <Icon name="i-lucide-check-circle-2" class="size-5 sm:size-6 text-emerald-500" />
                          </div>
                          <p class="text-sm sm:text-base text-emerald-600 font-bold tracking-tight">
                            Signature on File
                          </p>
                          <p class="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                            Stored securely in the system
                          </p>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center justify-between">
                      <p class="text-[10px] sm:text-xs text-muted-foreground">
                        {{ hasDrawnSignature ? 'Signature captured' : 'Please sign above to confirm' }}
                      </p>
                      <Button variant="outline" size="sm" class="h-7 sm:h-8 px-2.5 text-xs" @click="clearSignature">
                        <Icon name="i-lucide-eraser" class="mr-1 size-3" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Summary Bar -->
        <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mt-6 sm:mt-8">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div
              class="size-8 sm:size-10 rounded-full flex items-center justify-center shrink-0"
              :class="progressPercent === 100 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted/60 text-muted-foreground'"
            >
              <Icon :name="progressPercent === 100 ? 'i-lucide-check-circle-2' : 'i-lucide-circle-dashed'" class="size-4 sm:size-5" />
            </div>
            <div>
              <p class="text-xs sm:text-sm font-semibold">
                {{ progressPercent === 100 ? 'All sections completed!' : `${completedSections} of ${sections.length} sections filled` }}
              </p>
              <p class="text-[10px] sm:text-xs text-muted-foreground">
                {{ progressPercent === 100 ? 'Ready to submit.' : 'Fill remaining sections.' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button variant="outline" class="flex-1 sm:flex-none h-8 sm:h-9 text-xs sm:text-sm" @click="cancelEdit">
              Cancel
            </Button>
            <Button :disabled="saving" class="flex-1 sm:flex-none h-8 sm:h-9 text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90" @click="saveRecord">
              <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-1.5 sm:mr-2 size-3.5 sm:size-4 animate-spin" />
              {{ editingId ? 'Save' : 'Submit' }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═════════ SHARE DIALOG / AWESOME CARD ═════════ -->
    <Dialog :open="showShareDialog" @update:open="showShareDialog = $event">
      <DialogContent class="sm:max-w-md p-0 overflow-hidden border-border/50 bg-zinc-950 text-zinc-50 outline-none">
        <!-- The visual "Card" representation inside the dialog -->
        <div class="relative bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 sm:p-10 flex flex-col items-center justify-center text-center isolate overflow-hidden">
          <!-- Outer subtle borders -->
          <div class="absolute inset-2 sm:inset-3 border-2 border-amber-600/60 rounded-[1.5rem] pointer-events-none" />
          <div class="absolute inset-[13px] sm:inset-[17px] border border-amber-400/30 rounded-[1.2rem] pointer-events-none" />

          <!-- Top Brand -->
          <p class="text-amber-400 font-bold uppercase tracking-[0.2em] text-xs sm:text-sm mt-2 mb-6">
            Hardwood Hub
          </p>

          <!-- Title -->
          <div class="mb-8 z-10">
            <h2 class="text-3xl sm:text-4xl font-black tracking-tight text-white mb-1">
              Stain Sign Off
            </h2>
            <p class="text-[11px] sm:text-xs text-zinc-400 font-medium">
              Client Color Selection Document
            </p>
          </div>

          <!-- QR Code Container -->
          <div class="relative w-48 h-48 sm:w-56 sm:h-56 bg-white rounded-3xl p-3 shadow-2xl shadow-black/50 z-10 mb-8 mx-auto flex items-center justify-center transition-transform hover:scale-105">
            <img
              v-if="publicUrl"
              :src="`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}&margin=0&color=09090b`"
              alt="QR Code"
              class="w-full h-full mix-blend-multiply object-contain"
            >
          </div>

          <!-- Bottom Instruction -->
          <div class="z-10 bg-zinc-900/50 backdrop-blur block px-4 py-2 rounded-full border border-white/5 shadow-inner">
            <p class="text-[10px] sm:text-xs text-zinc-300 font-bold tracking-wider uppercase">
              Scan to review & sign
            </p>
          </div>
        </div>

        <!-- Action Buttons Area -->
        <div class="bg-card text-foreground p-6 flex flex-col items-center gap-5 border-t border-border/50">
          <div class="text-center w-full">
            <h3 class="text-sm font-semibold mb-1">
              Share this card
            </h3>
            <p class="text-xs text-muted-foreground w-full">
              Send via your favorite app or download it.
            </p>
          </div>

          <!-- Quick Actions -->
          <div v-if="publicUrl" class="flex items-center justify-center gap-2 sm:gap-3 w-full flex-wrap">
            <Button variant="outline" size="icon" class="rounded-full size-10 sm:size-11 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all cursor-pointer shadow-sm" :disabled="generatingCard" title="Download High-Res Card" @click="downloadCard">
              <Icon v-if="generatingCard" name="i-lucide-loader-2" class="size-4 sm:size-5 animate-spin" />
              <Icon v-else name="i-lucide-download" class="size-4 sm:size-5" />
            </Button>
            <Button v-if="isNativeShareSupported" variant="outline" size="icon" class="rounded-full size-10 sm:size-11 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all cursor-pointer shadow-sm" title="Native Share Image" @click="nativeShare">
              <Icon name="i-lucide-share-2" class="size-4 sm:size-5" />
            </Button>
          </div>

          <!-- Link Output -->
          <div class="w-full flex items-center gap-2">
            <div class="flex-1 min-w-0 bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-xs sm:text-sm text-muted-foreground truncate cursor-pointer hover:bg-muted transition-colors" title="Click to copy" @click="copyLink">
              {{ publicUrl }}
            </div>
            <Button size="icon" variant="secondary" class="shrink-0 rounded-lg size-8 sm:size-9" @click="copyLink">
              <Icon name="i-lucide-copy" class="size-3.5 sm:size-4" />
            </Button>
          </div>

          <!-- Close Action -->
          <Button variant="outline" class="w-full mt-2" @click="showShareDialog = false">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
</style>
