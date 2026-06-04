<script setup lang="ts">
import { format } from 'date-fns'
import { toast } from 'vue-sonner'

const props = defineProps<{
  customer: any
}>()

// ─── Document Types ──────────────────────────────────────
const DOCUMENT_TYPES = [
  'Contract',
  'Invoice',
  'Estimate',
  'Permit',
  'Insurance Certificate',
  'Floor Plan',
  'Material Spec Sheet',
  'Photo Report',
  'Warranty',
  'Change Order',
  'Other',
] as const

// ─── Documents from API ──────────────────────────────────
const documents = ref<any[]>([])
const loadingDocs = ref(false)

async function fetchDocuments() {
  if (!props.customer?._id) return
  loadingDocs.value = true
  try {
    const res = await $fetch<any>('/api/documents', {
      params: { projectId: props.customer._id },
    })
    documents.value = res.data || []
  }
  catch {
    console.error('Failed to load documents')
  }
  finally {
    loadingDocs.value = false
  }
}

// Fetch on mount and whenever customer changes
onMounted(fetchDocuments)
watch(() => props.customer?._id, fetchDocuments)

// ─── Add Document Form ───────────────────────────────────
const showAddForm = ref(false)
const newDocType = ref('')
const newDocDate = ref(new Date().toISOString().split('T')[0])
const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadProgress = ref(0)
const pendingFiles = ref<File[]>([])

function triggerFileSelect() {
  fileInput.value?.click()
}

function handleFilesSelected(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  pendingFiles.value = Array.from(target.files)
  if (!showAddForm.value) showAddForm.value = true
}

function removePendingFile(idx: number) {
  pendingFiles.value.splice(idx, 1)
}

function cancelAdd() {
  showAddForm.value = false
  newDocType.value = ''
  newDocDate.value = new Date().toISOString().split('T')[0]
  pendingFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
}

async function uploadDocuments() {
  if (!newDocType.value) return toast.error('Please select a document type')
  if (pendingFiles.value.length === 0) return toast.error('Please select at least one file')

  isUploading.value = true
  uploadProgress.value = 0

  try {
    const uploadedFiles: Array<{ url: string, name: string, size: number, type: string }> = []
    const total = pendingFiles.value.length

    for (let i = 0; i < total; i++) {
      const file = pendingFiles.value[i]
      if (!file) continue
      uploadProgress.value = Math.round(((i) / total) * 100)

      // Use 'auto' so Cloudinary processes PDFs for thumbnail generation
      const resourceType = 'auto'

      // Get Cloudinary signature
      const sigRes = await $fetch<{
        signature: string
        timestamp: number
        cloudName: string
        apiKey: string
        folder: string
        uploadUrl: string
      }>('/api/upload/cloudinary-signature', {
        params: {
          folder: 'hardwood-hub/crm/documents',
          resourceType,
        },
      })

      // Upload to Cloudinary
      const fd = new FormData()
      fd.append('file', file)
      fd.append('api_key', sigRes.apiKey)
      fd.append('timestamp', String(sigRes.timestamp))
      fd.append('signature', sigRes.signature)
      fd.append('folder', sigRes.folder)

      const clRes = await $fetch<any>(sigRes.uploadUrl, {
        method: 'POST',
        body: fd,
      })

      if (clRes?.secure_url) {
        uploadedFiles.push({
          url: clRes.secure_url,
          name: file.name,
          size: file.size,
          type: file.type,
        })
      }
    }

    uploadProgress.value = 90

    if (uploadedFiles.length > 0) {
      // Create a new document record in the documents collection
      const res = await $fetch<any>('/api/documents', {
        method: 'POST',
        body: {
          projectId: props.customer._id,
          customerId: props.customer.customerId || null,
          date: newDocDate.value,
          documentType: newDocType.value,
          files: uploadedFiles,
          uploadedAt: new Date().toISOString(),
        },
      })

      if (res.success) {
        // Refresh the list
        await fetchDocuments()
        toast.success(`${uploadedFiles.length} file(s) uploaded`)
        cancelAdd()
      }
    }

    uploadProgress.value = 100
  }
  catch (e: any) {
    toast.error('Upload failed', { description: e?.message })
    console.error(e)
  }
  finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}

// ─── Delete Document ─────────────────────────────────────
const showDeleteDialog = ref(false)
const deleteDocId = ref<string | null>(null)

function confirmDeleteDoc(docId: string) {
  deleteDocId.value = docId
  showDeleteDialog.value = true
}

async function deleteDocument() {
  showDeleteDialog.value = false
  if (!deleteDocId.value) return
  try {
    const res = await $fetch<any>(`/api/documents/${deleteDocId.value}`, {
      method: 'DELETE',
    })
    if (res.success) {
      await fetchDocuments()
      toast.success('Document deleted')
    }
  }
  catch { toast.error('Failed to delete document') }
}

// ─── Download All ────────────────────────────────────────
function downloadAllFiles(doc: any) {
  const files = doc.files || []
  for (const file of files) {
    const a = document.createElement('a')
    a.href = file.url
    a.download = file.name || 'download'
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

// ─── Helpers ─────────────────────────────────────────────
function formatDate(d: string) {
  return d ? format(new Date(d), 'MMM dd, yyyy') : '—'
}

function formatSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(type: string) {
  if (type?.startsWith('image/')) return 'i-lucide-image'
  if (type?.includes('pdf')) return 'i-lucide-file-text'
  if (type?.includes('spreadsheet') || type?.includes('excel') || type?.includes('csv')) return 'i-lucide-table'
  if (type?.includes('word') || type?.includes('document')) return 'i-lucide-file-type'
  return 'i-lucide-file'
}

function fileExt(name: string) {
  if (!name) return ''
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop()! : ''
}

/**
 * Generate a Cloudinary thumbnail URL.
 * For PDFs uploaded as 'auto', Cloudinary stores them as image/upload so we can
 * request page-1 rendered as jpg. For images, add a small resize transform.
 */
function thumbnailUrl(url: string, type: string) {
  if (!url) return ''
  // Images — add resize transformation
  if (type?.startsWith('image/')) {
    return url.replace('/upload/', '/upload/c_fill,w_120,h_120,q_60/')
  }
  // PDFs — render page 1 as an image thumbnail
  if (type?.includes('pdf')) {
    return url.replace('/upload/', '/upload/c_fill,w_120,h_120,pg_1,q_60/').replace(/\.pdf$/i, '.jpg')
  }
  return ''
}

// ─── File Preview Dialog ─────────────────────────────────
const showPreview = ref(false)
const previewFile = ref<{ url: string, name: string, size: number, type: string, docId: string, fileIdx: number } | null>(null)

function openPreview(file: any, docId: string, fileIdx: number) {
  previewFile.value = { ...file, docId, fileIdx }
  showPreview.value = true
}

function downloadFile() {
  if (!previewFile.value) return
  const a = document.createElement('a')
  a.href = previewFile.value.url
  a.download = previewFile.value.name || 'download'
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function deleteSingleFile() {
  if (!previewFile.value) return
  const { docId, fileIdx } = previewFile.value

  // Find the document in our local list
  const doc = documents.value.find((d: any) => String(d._id) === docId)
  if (!doc) return

  const files = [...(doc.files || [])]
  files.splice(fileIdx, 1)

  try {
    if (files.length === 0) {
      // Remove the entire document record if no files remain
      await $fetch<any>(`/api/documents/${docId}`, { method: 'DELETE' })
    }
    else {
      // Update the document with remaining files
      await $fetch<any>(`/api/documents/${docId}`, {
        method: 'PUT',
        body: { files },
      })
    }
    await fetchDocuments()
    toast.success('File deleted')
  }
  catch { toast.error('Failed to delete file') }
  finally {
    showPreview.value = false
    previewFile.value = null
  }
}

// ─── Expose ──────────────────────────────────────────────
defineExpose({
  isUploading,
  showAddForm,
  triggerFileSelect,
  openAdd: () => { showAddForm.value = true },
})
</script>

<template>
  <div class="space-y-3">
    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      multiple
      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
      class="hidden"
      @change="handleFilesSelected"
    >

    <!-- Add Document Form -->
    <div v-if="showAddForm" class="rounded-xl border border-primary/20 bg-primary/[0.02] p-4 space-y-3.5">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Icon name="i-lucide-plus-circle" class="size-3.5 text-primary" />
          Add Document
        </h4>
        <button class="text-muted-foreground hover:text-foreground transition-colors" @click="cancelAdd">
          <Icon name="i-lucide-x" class="size-4" />
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- Document Type -->
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type *</label>
          <select
            v-model="newDocType"
            class="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="" disabled>
              Select type...
            </option>
            <option v-for="dt in DOCUMENT_TYPES" :key="dt" :value="dt">
              {{ dt }}
            </option>
          </select>
        </div>
        <!-- Date -->
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date</label>
          <input
            v-model="newDocDate"
            type="date"
            class="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
        </div>
      </div>

      <!-- File selection area -->
      <div v-if="pendingFiles.length === 0" class="border-2 border-dashed border-border/60 rounded-xl p-5 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all" @click="triggerFileSelect">
        <Icon name="i-lucide-upload-cloud" class="size-6 text-muted-foreground/40 mx-auto mb-1.5" />
        <p class="text-xs text-muted-foreground font-medium">
          Click to select files
        </p>
        <p class="text-[10px] text-muted-foreground/60 mt-0.5">
          PDF, images, documents, spreadsheets
        </p>
      </div>

      <!-- Pending files list -->
      <div v-else class="space-y-1.5">
        <div v-for="(f, idx) in pendingFiles" :key="idx" class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/30">
          <Icon :name="fileIcon(f.type)" class="size-3.5 text-muted-foreground shrink-0" />
          <span class="text-xs font-medium text-foreground truncate flex-1">{{ f.name }}</span>
          <span class="text-[10px] text-muted-foreground shrink-0">{{ formatSize(f.size) }}</span>
          <button class="text-muted-foreground hover:text-destructive transition-colors shrink-0" @click="removePendingFile(idx)">
            <Icon name="i-lucide-x" class="size-3" />
          </button>
        </div>
        <button class="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1" @click="triggerFileSelect">
          <Icon name="i-lucide-plus" class="size-3" />
          Add more files
        </button>
      </div>

      <!-- Upload progress -->
      <div v-if="isUploading" class="space-y-1.5">
        <div class="h-1.5 rounded-full bg-muted overflow-hidden">
          <div class="h-full bg-primary rounded-full transition-all duration-300" :style="{ width: `${uploadProgress}%` }" />
        </div>
        <p class="text-[10px] text-muted-foreground text-center">
          Uploading... {{ uploadProgress }}%
        </p>
      </div>

      <!-- Submit -->
      <div class="flex items-center justify-end gap-2 pt-1">
        <button class="h-7 px-3 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-all" @click="cancelAdd">
          Cancel
        </button>
        <button
          :disabled="isUploading || pendingFiles.length === 0 || !newDocType"
          class="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-1.5"
          @click="uploadDocuments"
        >
          <Icon v-if="isUploading" name="i-lucide-loader-2" class="size-3 animate-spin" />
          <Icon v-else name="i-lucide-upload" class="size-3" />
          Upload
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loadingDocs" class="py-6 flex items-center justify-center">
      <Icon name="i-lucide-loader-2" class="size-5 animate-spin text-muted-foreground/40" />
    </div>

    <!-- Documents List -->
    <template v-else-if="documents.length">
      <div v-for="doc in documents" :key="doc._id" class="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
        <!-- Row 1: Type · Date · File count · Delete -->
        <div class="px-3.5 py-2 flex items-center gap-2">
          <span class="text-xs font-bold text-foreground truncate">{{ doc.documentType || 'Document' }}</span>
          <span class="text-muted-foreground/40">·</span>
          <span class="text-[10px] text-muted-foreground whitespace-nowrap">{{ formatDate(doc.date) }}</span>
          <span class="ml-auto text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{{ doc.files?.length || 0 }} file{{ (doc.files?.length || 0) !== 1 ? 's' : '' }}</span>
          <button class="size-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all shrink-0" title="Download all files" @click="downloadAllFiles(doc)">
            <Icon name="i-lucide-download" class="size-3" />
          </button>
          <button class="size-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0" @click="confirmDeleteDoc(doc._id)">
            <Icon name="i-lucide-trash-2" class="size-3" />
          </button>
        </div>
        <!-- Row 2: Thumbnail carousel -->
        <div v-if="doc.files?.length" class="px-3.5 pb-3 -mt-0.5">
          <div class="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            <button
              v-for="(file, fIdx) in doc.files"
              :key="fIdx"
              class="group relative shrink-0 size-14 rounded-lg border border-border/50 bg-muted/30 overflow-hidden hover:ring-2 hover:ring-primary/40 transition-all"
              :title="file.name || 'File'"
              @click="openPreview(file, doc._id, Number(fIdx))"
            >
              <!-- Image / PDF thumbnail via Cloudinary -->
              <img
                v-if="thumbnailUrl(file.url, file.type)"
                :src="thumbnailUrl(file.url, file.type)"
                class="w-full h-full object-cover"
                loading="lazy"
              >
              <!-- Non-image/PDF file icon fallback -->
              <div v-else class="w-full h-full flex flex-col items-center justify-center gap-0.5">
                <Icon :name="fileIcon(file.type)" class="size-5 text-muted-foreground/60" />
                <span class="text-[7px] font-bold text-muted-foreground/50 uppercase tracking-wider leading-none">{{ fileExt(file.name) }}</span>
              </div>
              <!-- Hover overlay -->
              <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Icon name="i-lucide-eye" class="size-3.5 text-white" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <div v-else-if="!showAddForm" class="flex flex-col items-center justify-center py-8 text-center">
      <Icon name="i-lucide-file-stack" class="size-6 text-muted-foreground/30 mx-auto mb-2" />
      <p class="text-xs text-muted-foreground">
        No documents uploaded
      </p>
    </div>

    <!-- File Preview Dialog -->
    <Dialog :open="showPreview" @update:open="showPreview = $event">
      <DialogContent class="max-w-3xl w-[90vw] p-0 overflow-hidden bg-card/95 backdrop-blur-2xl border-border/50 shadow-2xl [&>button:last-of-type]:hidden">
        <DialogTitle class="sr-only">
          File Preview
        </DialogTitle>
        <div v-if="previewFile" class="flex flex-col max-h-[85vh]">
          <!-- Preview area -->
          <div class="flex-1 min-h-0 bg-black/5 dark:bg-black/40 flex items-center justify-center p-4 overflow-hidden">
            <!-- Image preview -->
            <img
              v-if="previewFile.type?.startsWith('image/')"
              :src="previewFile.url"
              :alt="previewFile.name"
              class="max-w-full max-h-[60vh] object-contain rounded drop-shadow-lg"
            >
            <!-- PDF preview -->
            <iframe
              v-else-if="previewFile.type?.includes('pdf')"
              :src="previewFile.url"
              class="w-full h-[60vh] rounded border-0"
            />
            <!-- Other file types -->
            <div v-else class="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div class="size-16 rounded-2xl bg-muted/50 flex items-center justify-center border border-border/50">
                <Icon :name="fileIcon(previewFile.type)" class="size-8 text-muted-foreground/60" />
              </div>
              <p class="text-sm font-semibold text-foreground">
                {{ previewFile.name || 'File' }}
              </p>
              <p class="text-xs text-muted-foreground">
                Preview not available for this file type
              </p>
            </div>
          </div>

          <!-- Bottom bar: file info + actions -->
          <div class="border-t border-border/50 bg-background/80 px-5 py-3.5 flex items-center gap-4 backdrop-blur-md shrink-0">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-foreground truncate">
                {{ previewFile.name || 'File' }}
              </p>
              <p class="text-[10px] text-muted-foreground mt-0.5">
                {{ formatSize(previewFile.size) }}{{ previewFile.type ? ` · ${fileExt(previewFile.name).toUpperCase()}` : '' }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                class="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm"
                @click="downloadFile"
              >
                <Icon name="i-lucide-download" class="size-3.5" />
                Download
              </button>
              <button
                class="h-9 px-4 rounded-lg bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive hover:text-white transition-all flex items-center gap-2"
                @click="deleteSingleFile"
              >
                <Icon name="i-lucide-trash-2" class="size-3.5" />
                Delete
              </button>
              <button
                class="h-9 px-4 rounded-lg border border-border text-foreground text-xs font-bold hover:bg-muted transition-all flex items-center gap-2"
                @click="showPreview = false"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Delete Document Confirmation -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Document?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this document and all its files. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="deleteDocument">
            <Icon name="i-lucide-trash-2" class="size-3.5 mr-1.5" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
