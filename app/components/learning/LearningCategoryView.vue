<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { LCCategory, LCContentMode } from '~/constants/learning-center'
import { LC_CATEGORIES, lcByKey } from '~/constants/learning-center'

const props = defineProps<{ categoryKey: string }>()

// Resolved once per mount — the parent page remounts this on category change.
const cfg: LCCategory = lcByKey(props.categoryKey) || LC_CATEGORIES[0]!

const { setHeader } = usePageHeader()
setHeader({ title: cfg.label, icon: cfg.icon, description: cfg.desc })

const { canCreate, canUpdate, canDelete } = usePermissions('/learning-center')
const isAdmin = computed(() => canCreate() || canUpdate() || canDelete())

function notify(title: string, description: string, variant?: string) {
  if (variant === 'destructive')
    toast.error(title, { description })
  else toast.success(title, { description })
}

interface LearningResource {
  _id: string
  title: string
  description: string
  category: string
  type: 'video' | 'document' | 'link'
  source: 'cloudinary' | 'youtube' | 'external'
  url: string
  thumbnail: string
  fileType: string
  fileSize: number
  duration: string
  tags: string[]
  order: number
  isPublished: boolean
  meta: Record<string, any>
  createdAt?: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const resources = ref<LearningResource[]>([])
const loading = ref(true)
const searchQuery = ref('')

async function fetchResources() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: LearningResource[] }>('/api/learning-center', {
      params: { category: cfg.key },
    })
    resources.value = res.data || []
  }
  catch (e: any) {
    notify('Error', e?.message || 'Failed to load resources', 'destructive')
  }
  finally {
    loading.value = false
  }
}
onMounted(fetchResources)

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return resources.value
  return resources.value.filter(r =>
    r.title.toLowerCase().includes(q)
    || r.description.toLowerCase().includes(q)
    || (r.tags || []).some(t => t.toLowerCase().includes(q)),
  )
})

// ─── Embeds / viewer ───────────────────────────────────────────────────────────
function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}
function vimeoEmbed(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return m ? `https://player.vimeo.com/video/${m[1]}` : null
}
const showViewer = ref(false)
const viewing = ref<LearningResource | null>(null)
const viewerEmbed = computed(() => {
  if (!viewing.value)
    return null
  return youtubeEmbed(viewing.value.url) || vimeoEmbed(viewing.value.url)
})
function openResource(r: LearningResource) {
  if (r.type === 'video') {
    viewing.value = r
    showViewer.value = true
  }
  else {
    window.open(r.url, '_blank', 'noopener,noreferrer')
  }
}

// ─── Display helpers ────────────────────────────────────────────────────────────
function typeBadge(t: string) {
  if (t === 'video')
    return { label: 'Video', icon: 'i-lucide-play' }
  if (t === 'document')
    return { label: 'Document', icon: 'i-lucide-file-text' }
  return { label: 'Link', icon: 'i-lucide-link' }
}
function actionLabel(t: string) {
  if (t === 'video')
    return 'Watch'
  if (t === 'document')
    return 'Open'
  return 'Visit'
}
function fmtSize(bytes: number) {
  if (!bytes)
    return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}
// Category-specific meta chips that actually have a value
function metaChips(r: LearningResource) {
  return cfg.fields
    .map(f => ({ icon: f.icon, value: r.meta?.[f.key] }))
    .filter(c => c.value !== undefined && c.value !== null && String(c.value).trim() !== '')
}

// ─── Form ────────────────────────────────────────────────────────────────────
const showForm = ref(false)
const isEditing = ref(false)
const editId = ref<string | null>(null)
const saving = ref(false)
const uploading = ref(false)
const uploadingThumb = ref(false)
const contentMode = ref<string>(cfg.contentModes[0]!.id)
const currentMode = computed<LCContentMode>(() =>
  cfg.contentModes.find(m => m.id === contentMode.value) || cfg.contentModes[0]!,
)

function seedMeta(existing?: Record<string, any>) {
  const m: Record<string, any> = {}
  for (const f of cfg.fields)
    m[f.key] = existing?.[f.key] ?? ''
  return m
}

function emptyForm() {
  const first = cfg.contentModes[0]!
  return {
    title: '',
    description: '',
    type: first.type,
    source: first.source,
    url: '',
    thumbnail: '',
    fileType: '',
    fileSize: 0,
    duration: '',
    tagsText: '',
    order: 0,
    isPublished: true,
    meta: seedMeta(),
  }
}
const form = ref(emptyForm())

function applyMode(mode: LCContentMode, clear = true) {
  contentMode.value = mode.id
  form.value.type = mode.type
  form.value.source = mode.source
  if (clear) {
    form.value.url = ''
    form.value.fileType = ''
    form.value.fileSize = 0
    if (mode.type !== 'video')
      form.value.duration = ''
  }
}

function openCreate() {
  form.value = emptyForm()
  editId.value = null
  isEditing.value = false
  contentMode.value = cfg.contentModes[0]!.id
  showForm.value = true
}
function openEdit(r: LearningResource) {
  form.value = {
    title: r.title,
    description: r.description,
    type: r.type,
    source: r.source,
    url: r.url,
    thumbnail: r.thumbnail,
    fileType: r.fileType,
    fileSize: r.fileSize,
    duration: r.duration,
    tagsText: (r.tags || []).join(', '),
    order: r.order,
    isPublished: r.isPublished,
    meta: seedMeta(r.meta),
  }
  editId.value = r._id
  isEditing.value = true
  // Pick the content mode that matches this resource
  const match = cfg.contentModes.find(m => m.type === r.type && m.source === r.source)
  contentMode.value = (match || cfg.contentModes[0]!).id
  showForm.value = true
}

// Auto-detect YouTube/Vimeo when pasting into a video URL field
watch(() => form.value.url, (u) => {
  if (currentMode.value.via !== 'url' || currentMode.value.type !== 'video')
    return
  form.value.source = (youtubeEmbed(u) || vimeoEmbed(u)) ? 'youtube' : 'external'
})

// ─── Cloudinary direct upload ───────────────────────────────────────────────────
async function uploadFile(file: File, resourceType: 'image' | 'video' | 'auto') {
  const sig = await $fetch<{ apiKey: string, timestamp: number, signature: string, folder: string, uploadUrl: string }>(
    '/api/upload/cloudinary-signature',
    { params: { folder: 'hardwood-hub/learning-center', resourceType } },
  )
  const fd = new FormData()
  fd.append('file', file)
  fd.append('api_key', sig.apiKey)
  fd.append('timestamp', String(sig.timestamp))
  fd.append('signature', sig.signature)
  fd.append('folder', sig.folder)
  return await $fetch<any>(sig.uploadUrl, { method: 'POST', body: fd })
}

async function onMainFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  uploading.value = true
  try {
    const res = await uploadFile(file, currentMode.value.resourceType || 'auto')
    if (res?.secure_url) {
      form.value.url = res.secure_url
      form.value.source = 'cloudinary'
      form.value.fileType = (res.format || file.name.split('.').pop() || '').toLowerCase()
      form.value.fileSize = res.bytes || file.size
      if (currentMode.value.type === 'video' && res.duration) {
        const secs = Math.round(res.duration)
        form.value.duration = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
      }
      notify('Uploaded', `${file.name} is ready`)
    }
  }
  catch (err: any) {
    notify('Upload failed', err?.message || 'Could not upload file', 'destructive')
  }
  finally {
    uploading.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function onThumbChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  uploadingThumb.value = true
  try {
    const res = await uploadFile(file, 'image')
    if (res?.secure_url) {
      form.value.thumbnail = res.secure_url
      notify('Uploaded', 'Thumbnail added')
    }
  }
  catch (err: any) {
    notify('Upload failed', err?.message || 'Could not upload thumbnail', 'destructive')
  }
  finally {
    uploadingThumb.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function save() {
  if (!form.value.title.trim()) {
    notify('Validation', 'Please add a title', 'destructive')
    return
  }
  if (!form.value.url.trim()) {
    notify('Validation', 'Add a link or upload a file', 'destructive')
    return
  }
  saving.value = true
  try {
    const meta: Record<string, any> = {}
    for (const [k, v] of Object.entries(form.value.meta)) {
      if (v !== undefined && v !== null && String(v).trim() !== '')
        meta[k] = v
    }
    const payload = {
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      category: cfg.key,
      type: form.value.type,
      source: form.value.source,
      url: form.value.url.trim(),
      thumbnail: form.value.thumbnail,
      fileType: form.value.fileType,
      fileSize: form.value.fileSize,
      duration: form.value.duration,
      tags: form.value.tagsText.split(',').map(t => t.trim()).filter(Boolean),
      order: Number(form.value.order) || 0,
      isPublished: form.value.isPublished,
      meta,
    }
    if (isEditing.value && editId.value) {
      await $fetch(`/api/learning-center/${editId.value}`, { method: 'PUT', body: payload })
      notify('Updated', 'Resource updated')
    }
    else {
      await $fetch('/api/learning-center', { method: 'POST', body: payload })
      notify('Added', `Added to ${cfg.label}`)
    }
    showForm.value = false
    await fetchResources()
  }
  catch (e: any) {
    notify('Save failed', e?.message || 'Could not save resource', 'destructive')
  }
  finally {
    saving.value = false
  }
}

// ─── Delete ─────────────────────────────────────────────────────────────────────
const showDelete = ref(false)
const deleteTarget = ref<LearningResource | null>(null)
function confirmDelete(r: LearningResource) {
  deleteTarget.value = r
  showDelete.value = true
}
async function doDelete() {
  if (!deleteTarget.value)
    return
  try {
    await $fetch(`/api/learning-center/${deleteTarget.value._id}`, { method: 'DELETE' })
    notify('Deleted', 'Resource removed')
    showDelete.value = false
    await fetchResources()
  }
  catch (e: any) {
    notify('Delete failed', e?.message || 'Could not delete', 'destructive')
  }
}
</script>

<template>
  <div class="w-full flex flex-col gap-5 sm:gap-6">
    <!-- Header toolbar: search + add -->
    <ClientOnly>
      <Teleport to="#header-toolbar">
        <div class="flex items-center gap-2">
          <div class="relative min-w-0 sm:w-64">
            <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5 sm:size-4" />
            <Input v-model="searchQuery" :placeholder="`Search ${cfg.short.toLowerCase()}…`" class="pl-8 sm:pl-9 h-8 sm:h-9 text-xs sm:text-sm" />
          </div>
          <Button v-if="canCreate()" size="sm" class="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3 shrink-0" @click="openCreate">
            <Icon name="i-lucide-plus" class="mr-1 sm:mr-2 size-3.5 sm:size-4" />
            <span class="hidden xs:inline">Add</span>
          </Button>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- Category banner -->
    <div class="relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 sm:p-6" :class="cfg.gradient">
      <div class="flex items-center gap-4">
        <div class="flex size-12 sm:size-14 items-center justify-center rounded-xl bg-background/70 backdrop-blur shrink-0">
          <Icon :name="cfg.icon" class="size-6 sm:size-7" :class="cfg.text" />
        </div>
        <div class="min-w-0">
          <h1 class="text-lg sm:text-xl font-bold tracking-tight">
            {{ cfg.label }}
          </h1>
          <p class="text-xs sm:text-sm text-muted-foreground">
            {{ cfg.desc }}
          </p>
        </div>
        <div class="ml-auto hidden sm:flex flex-col items-end">
          <span class="text-2xl font-bold tabular-nums">{{ resources.length }}</span>
          <span class="text-[11px] text-muted-foreground uppercase tracking-wide">{{ resources.length === 1 ? 'resource' : 'resources' }}</span>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 3" :key="i" class="rounded-xl border bg-card overflow-hidden">
        <Skeleton class="aspect-video w-full" />
        <div class="p-4 flex flex-col gap-2">
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-3 w-full" />
          <Skeleton class="h-3 w-2/3" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center py-16 sm:py-24 gap-3 text-center">
      <div class="size-16 rounded-2xl bg-gradient-to-br flex items-center justify-center" :class="cfg.gradient">
        <Icon :name="cfg.icon" class="size-7" :class="cfg.text" />
      </div>
      <h3 class="text-base font-semibold">
        {{ searchQuery ? 'No matching resources' : 'Nothing here yet' }}
      </h3>
      <p class="text-xs sm:text-sm text-muted-foreground max-w-sm">
        {{ searchQuery ? 'Try a different search term.' : `${cfg.desc}. Anything added here is visible to the whole team.` }}
      </p>
      <Button v-if="canCreate() && !searchQuery" size="sm" class="mt-1" @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-1.5 size-4" />
        Add the first resource
      </Button>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="r in filtered"
        :key="r._id"
        class="group relative rounded-xl border bg-card overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 flex flex-col"
      >
        <!-- Cover -->
        <div class="relative aspect-video overflow-hidden cursor-pointer bg-muted" @click="openResource(r)">
          <img v-if="r.thumbnail" :src="r.thumbnail" :alt="r.title" class="size-full object-cover transition-transform duration-300 group-hover:scale-105">
          <div v-else class="size-full bg-gradient-to-br flex items-center justify-center" :class="cfg.gradient">
            <Icon :name="cfg.icon" class="size-10 opacity-70" :class="cfg.text" />
          </div>

          <div v-if="r.type === 'video'" class="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/30">
            <div class="size-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
              <Icon name="i-lucide-play" class="size-5 text-black translate-x-px" />
            </div>
          </div>

          <span class="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            <Icon :name="typeBadge(r.type).icon" class="size-3" />
            {{ typeBadge(r.type).label }}
          </span>

          <span v-if="r.duration" class="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {{ r.duration }}
          </span>
          <span v-if="!r.isPublished" class="absolute bottom-2 left-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Draft
          </span>

          <div v-if="isAdmin" class="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button v-if="canUpdate()" class="size-7 rounded-md border bg-background/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-background" title="Edit" @click.stop="openEdit(r)">
              <Icon name="i-lucide-pencil" class="size-3.5" />
            </button>
            <button v-if="canDelete()" class="size-7 rounded-md border bg-background/90 backdrop-blur flex items-center justify-center shadow-sm text-destructive hover:bg-background" title="Delete" @click.stop="confirmDelete(r)">
              <Icon name="i-lucide-trash-2" class="size-3.5" />
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex flex-1 flex-col gap-2 p-4">
          <h3 class="font-semibold text-sm leading-snug line-clamp-2">
            {{ r.title }}
          </h3>
          <p v-if="r.description" class="text-xs text-muted-foreground line-clamp-2">
            {{ r.description }}
          </p>

          <!-- Category-specific meta chips -->
          <div v-if="metaChips(r).length" class="flex flex-wrap gap-1">
            <span v-for="(c, i) in metaChips(r)" :key="i" class="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Icon v-if="c.icon" :name="c.icon" class="size-3" />
              {{ c.value }}
            </span>
          </div>

          <div v-if="r.tags?.length" class="flex flex-wrap gap-1">
            <span v-for="tag in r.tags.slice(0, 3)" :key="tag" class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {{ tag }}
            </span>
          </div>

          <div class="mt-auto flex items-center justify-between gap-2 border-t pt-2.5">
            <span class="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground truncate">
              <Icon v-if="r.fileType" name="i-lucide-file" class="size-3 shrink-0" />
              {{ r.fileType || cfg.short }}<template v-if="fmtSize(r.fileSize)"> · {{ fmtSize(r.fileSize) }}</template>
            </span>
            <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1 text-xs hover:text-primary" @click="openResource(r)">
              {{ actionLabel(r.type) }}
              <Icon :name="r.type === 'video' ? 'i-lucide-play' : 'i-lucide-arrow-up-right'" class="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Video viewer ─── -->
    <Dialog v-model:open="showViewer">
      <DialogContent class="max-w-3xl gap-0 overflow-hidden p-0">
        <div class="aspect-video w-full bg-black">
          <iframe
            v-if="viewerEmbed"
            :src="viewerEmbed"
            class="size-full"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
          <video v-else-if="viewing" :src="viewing.url" controls autoplay playsinline class="size-full">
            Your browser does not support video playback.
          </video>
        </div>
        <div class="p-4 sm:p-5">
          <DialogHeader class="text-left">
            <DialogTitle class="text-base">
              {{ viewing?.title }}
            </DialogTitle>
            <DialogDescription v-if="viewing?.description">
              {{ viewing?.description }}
            </DialogDescription>
          </DialogHeader>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ─── Create / Edit form (dynamic per category) ─── -->
    <Dialog v-model:open="showForm">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? 'Edit' : 'Add' }} · {{ cfg.label }}</DialogTitle>
          <DialogDescription>{{ cfg.desc }}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-1">
          <!-- Title -->
          <div class="flex flex-col gap-1.5">
            <Label for="lc-title">Title</Label>
            <Input id="lc-title" v-model="form.title" placeholder="Give it a clear name" />
          </div>

          <!-- Description -->
          <div class="flex flex-col gap-1.5">
            <Label for="lc-desc">Description</Label>
            <Textarea id="lc-desc" v-model="form.description" rows="2" placeholder="A short summary of what this covers…" />
          </div>

          <!-- Content (dynamic input modes) -->
          <div class="flex flex-col gap-1.5">
            <Label>Content</Label>
            <div v-if="cfg.contentModes.length > 1" class="flex flex-wrap gap-1 rounded-lg bg-muted p-1 w-fit">
              <button
                v-for="m in cfg.contentModes"
                :key="m.id"
                type="button"
                class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors"
                :class="contentMode === m.id ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                @click="applyMode(m)"
              >
                <Icon :name="m.icon" class="size-3.5" />
                {{ m.label }}
              </button>
            </div>

            <!-- URL input -->
            <Input
              v-if="currentMode.via === 'url'"
              v-model="form.url"
              :placeholder="currentMode.placeholder || 'https://…'"
            />

            <!-- Upload zone -->
            <div v-else>
              <input
                ref="mainFile"
                type="file"
                class="hidden"
                :accept="currentMode.accept"
                @change="onMainFileChange"
              >
              <button
                type="button"
                class="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-muted-foreground transition-colors hover:bg-muted/50"
                @click="($refs.mainFile as HTMLInputElement)?.click()"
              >
                <Icon :name="uploading ? 'i-lucide-loader-circle' : currentMode.icon" class="size-6" :class="uploading ? 'animate-spin' : ''" />
                <span class="text-xs">{{ uploading ? 'Uploading…' : currentMode.label }}</span>
                <span v-if="currentMode.hint" class="text-[10px] text-muted-foreground/70">{{ currentMode.hint }}</span>
              </button>
            </div>

            <p v-if="form.url" class="flex items-center gap-1 text-[11px] text-emerald-500">
              <Icon name="i-lucide-circle-check" class="size-3.5 shrink-0" />
              <span class="truncate">{{ form.source === 'cloudinary' ? 'Uploaded file ready' : form.url }}</span>
            </p>
          </div>

          <!-- Category-specific extra fields -->
          <div v-if="cfg.fields.length" class="grid grid-cols-2 gap-3">
            <div
              v-for="f in cfg.fields"
              :key="f.key"
              class="flex flex-col gap-1.5"
              :class="f.col === 2 ? 'col-span-2' : ''"
            >
              <Label :for="`lc-${f.key}`">{{ f.label }}</Label>
              <Select v-if="f.input === 'select'" v-model="form.meta[f.key]">
                <SelectTrigger :id="`lc-${f.key}`">
                  <SelectValue :placeholder="f.placeholder || `Select ${f.label.toLowerCase()}`" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in f.options" :key="opt" :value="opt">
                    {{ opt }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Textarea v-else-if="f.input === 'textarea'" :id="`lc-${f.key}`" v-model="form.meta[f.key]" rows="2" :placeholder="f.placeholder" />
              <Input v-else :id="`lc-${f.key}`" v-model="form.meta[f.key]" :placeholder="f.placeholder" />
            </div>
          </div>

          <!-- Duration (video only) + Tags -->
          <div class="grid grid-cols-2 gap-3">
            <div v-if="form.type === 'video'" class="flex flex-col gap-1.5">
              <Label for="lc-dur">Duration <span class="font-normal text-muted-foreground">(opt)</span></Label>
              <Input id="lc-dur" v-model="form.duration" placeholder="e.g. 8:45" />
            </div>
            <div class="flex flex-col gap-1.5" :class="form.type === 'video' ? '' : 'col-span-2'">
              <Label for="lc-tags">Tags <span class="font-normal text-muted-foreground">(comma separated)</span></Label>
              <Input id="lc-tags" v-model="form.tagsText" placeholder="oak, finishing" />
            </div>
          </div>

          <!-- Thumbnail -->
          <div class="flex flex-col gap-1.5">
            <Label>Thumbnail <span class="font-normal text-muted-foreground">(optional)</span></Label>
            <div class="flex items-center gap-3">
              <div class="size-16 shrink-0 overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                <img v-if="form.thumbnail" :src="form.thumbnail" alt="thumbnail" class="size-full object-cover">
                <Icon v-else name="i-lucide-image" class="size-5 text-muted-foreground" />
              </div>
              <input ref="thumbFile" type="file" accept="image/*" class="hidden" @change="onThumbChange">
              <Button type="button" variant="outline" size="sm" :disabled="uploadingThumb" @click="($refs.thumbFile as HTMLInputElement)?.click()">
                <Icon :name="uploadingThumb ? 'i-lucide-loader-circle' : 'i-lucide-image-plus'" class="mr-2 size-4" :class="uploadingThumb ? 'animate-spin' : ''" />
                {{ form.thumbnail ? 'Change' : 'Upload' }}
              </Button>
              <Button v-if="form.thumbnail" type="button" variant="ghost" size="sm" class="text-destructive" @click="form.thumbnail = ''">
                Remove
              </Button>
            </div>
          </div>

          <!-- Published -->
          <div class="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div class="flex flex-col">
              <span class="text-sm font-medium">Published</span>
              <span class="text-[11px] text-muted-foreground">Visible to all employees</span>
            </div>
            <Switch :checked="form.isPublished" @update:checked="(v: boolean) => form.isPublished = v" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showForm = false">
            Cancel
          </Button>
          <Button :disabled="saving || uploading" @click="save">
            <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            {{ isEditing ? 'Save Changes' : 'Add Resource' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ─── Delete confirm ─── -->
    <AlertDialog v-model:open="showDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Resource</AlertDialogTitle>
          <AlertDialogDescription>
            Remove <strong>{{ deleteTarget?.title }}</strong> from {{ cfg.label }}? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive hover:bg-destructive/90" @click="doDelete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
