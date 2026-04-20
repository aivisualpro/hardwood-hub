<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'

const props = defineProps<{
  customer: any
}>()

const emit = defineEmits<{
  (e: 'updated', customer: any): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const selectedImage = ref<any>(null)
const showLightbox = ref(false)

const uploadQueue = ref<any[]>([])

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = event => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1200
        const MAX_HEIGHT = 1200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = reject
      img.src = event.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function handleFileSubmit(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  
  const files = Array.from(target.files)
  isUploading.value = true
  
  try {
    const uploadedImages: any[] = []
    
    // Add to queue for UI
    const queueItems = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      thumbnail: '',
      progress: 0
    }))
    uploadQueue.value.push(...queueItems)
    
    // Upload each
    for (const item of queueItems) {
      item.progress = 10
      try {
        // Compress first to avoid 413 Payload Too Large on Nitro
        const dataUrl = await compressImage(item.file)
        item.thumbnail = dataUrl
        item.progress = 40
        
        // Setup a fake progress interval while waiting for fetch
        const interval = setInterval(() => {
          if (item.progress < 90) item.progress += 5
        }, 300)

        const sigRes = await $fetch<{ signature: string, timestamp: number, cloudName: string, apiKey: string, folder: string }>('/api/upload/cloudinary-signature', {
          params: { folder: 'hardwood-hub/crm/gallery' }
        })

        const fd = new FormData()
        fd.append('file', dataUrl)
        fd.append('api_key', sigRes.apiKey)
        fd.append('timestamp', String(sigRes.timestamp))
        fd.append('signature', sigRes.signature)
        fd.append('folder', sigRes.folder)

        const clRes = await $fetch<any>(`https://api.cloudinary.com/v1_1/${sigRes.cloudName}/auto/upload`, {
          method: 'POST',
          body: fd
        })
        
        clearInterval(interval)
        item.progress = 100
        
        if (clRes && clRes.secure_url) {
          uploadedImages.push({
            url: clRes.secure_url,
            caption: '',
            uploadedAt: new Date().toISOString()
          })
        }
      } catch (e) {
        console.error('Failed to upload file:', item.file.name, e)
        item.progress = -1
      }
    }
    
    if (uploadedImages.length > 0) {
      const currentGallery = props.customer.gallery || []
      const newGallery = [...currentGallery, ...uploadedImages]
      
      const updateRes = await $fetch<any>(`/api/customers/${props.customer._id}`, {
        method: 'PUT',
        body: { gallery: newGallery }
      })
      
      if (updateRes.success) {
        emit('updated', updateRes.data)
        toast.success(`Successfully uploaded ${uploadedImages.length} image(s)`)
      }
    }
    
    // Clear queue after brief delay to show 100%
    setTimeout(() => {
      uploadQueue.value = []
    }, 1000)

  } catch (error) {
    toast.error('Failed to upload images')
    console.error(error)
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function removeImage(index: number | string) {
  if (!confirm('Are you sure you want to delete this image?')) return
  
  const numIndex = Number(index)
  const currentGallery = [...(props.customer.gallery || [])]
  currentGallery.splice(numIndex, 1)
  
  try {
    const res = await $fetch<any>(`/api/customers/${props.customer._id}`, {
      method: 'PUT',
      body: { gallery: currentGallery }
    })
    if (res.success) {
      emit('updated', res.data)
      toast.success('Image removed')
      if (showLightbox.value) showLightbox.value = false
    }
  } catch (error) {
    toast.error('Failed to remove image')
  }
}

function openLightbox(img: any, index: number | string) {
  selectedImage.value = { ...img, index: Number(index) }
  showLightbox.value = true
}

async function updateCaption() {
  if (!selectedImage.value) return
  
  const currentGallery = [...(props.customer.gallery || [])]
  currentGallery[selectedImage.value.index].caption = selectedImage.value.caption
  
  try {
    const res = await $fetch<any>(`/api/customers/${props.customer._id}`, {
      method: 'PUT',
      body: { gallery: currentGallery }
    })
    if (res.success) {
      emit('updated', res.data)
      toast.success('Caption auto-saved')
    }
  } catch (error) {
    toast.error('Failed to update caption')
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

const selectionMode = ref(false)
const selectedIndices = ref<Set<number>>(new Set())

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) selectedIndices.value.clear()
}

function toggleSelection(idx: number | string) {
  const numIdx = Number(idx)
  if (selectedIndices.value.has(numIdx)) {
    selectedIndices.value.delete(numIdx)
  } else {
    selectedIndices.value.add(numIdx)
  }
}

async function removeSelectedImages() {
  if (selectedIndices.value.size === 0) return
  if (!confirm(`Are you sure you want to delete ${selectedIndices.value.size} images?`)) return
  
  const sortedIndices = Array.from(selectedIndices.value).sort((a, b) => b - a)
  const currentGallery = [...(props.customer.gallery || [])]
  for (const idx of sortedIndices) {
    currentGallery.splice(idx, 1)
  }
  
  try {
    const res = await $fetch<any>(`/api/customers/${props.customer._id}`, {
      method: 'PUT',
      body: { gallery: currentGallery }
    })
    if (res.success) {
      emit('updated', res.data)
      toast.success(`${selectedIndices.value.size} images removed`)
      toggleSelectionMode()
    }
  } catch (error) {
    toast.error('Failed to remove images')
  }
}

function handleImageClick(img: any, idx: number | string) {
  if (selectionMode.value) {
    toggleSelection(idx)
  } else {
    openLightbox(img, idx)
  }
}
</script>

<template>
  <div class="h-full w-full">
    <Teleport to="#header-toolbar">
      <div class="flex items-center gap-2">
         <template v-if="customer?.gallery?.length > 0">
           <button 
             v-if="!selectionMode"
             @click="toggleSelectionMode" 
             class="inline-flex items-center justify-center h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-muted text-foreground text-xs sm:text-sm font-bold hover:bg-muted/80 transition-all shrink-0"
           >
             Select
           </button>
           <template v-else>
             <button 
               @click="removeSelectedImages" 
               class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-destructive text-destructive-foreground text-xs sm:text-sm font-bold hover:bg-destructive/90 transition-all shadow-sm shadow-destructive/20 shrink-0 select-none"
               :disabled="selectedIndices.size === 0"
             >
               <Icon name="i-lucide-trash-2" class="size-3.5" />
               <span class="hidden sm:inline">Delete ({{ selectedIndices.size }})</span>
             </button>
             <button 
               @click="toggleSelectionMode" 
               class="inline-flex items-center justify-center h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-background border border-border text-foreground text-xs sm:text-sm font-bold hover:bg-muted transition-all shrink-0"
             >
               Cancel
             </button>
           </template>
         </template>

         <button 
           v-if="!selectionMode"
           @click="triggerUpload" 
           :disabled="isUploading"
           class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 shrink-0 disabled:opacity-50"
         >
           <template v-if="isUploading">
             <Icon name="i-lucide-loader-2" class="size-3.5 sm:size-4 animate-spin" />
             <span class="hidden sm:inline">Uploading...</span>
           </template>
           <template v-else>
             <Icon name="i-lucide-upload-cloud" class="size-3.5 sm:size-4" />
             <span class="hidden sm:inline">Upload Images</span>
           </template>
         </button>
      </div>
    </Teleport>

    <!-- Hidden File Input -->
    <input 
      ref="fileInput" 
      type="file" 
      multiple 
      accept="image/*" 
      class="hidden" 
      @change="handleFileSubmit"
    />

    <!-- Empty State -->
    <div v-if="(!customer.gallery || customer.gallery.length === 0) && uploadQueue.length === 0" class="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-xl bg-card">
      <div class="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4 ring-1 ring-border shadow-inner">
        <Icon name="i-lucide-images" class="size-8 text-muted-foreground opacity-50" />
      </div>
      <h3 class="font-bold text-lg mb-1">No images yet</h3>
      <p class="text-sm text-muted-foreground mb-4 max-w-sm">Upload photos of the space, before/after shots, or material references.</p>
      <button @click="triggerUpload" class="text-sm font-bold text-primary hover:underline transition-all hover:text-primary/80">
        Browse files
      </button>
    </div>

    <!-- Gallery Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      <div 
        v-for="(img, idx) in customer.gallery" 
        :key="img.url + idx"
        class="group relative aspect-square rounded-xl overflow-hidden bg-muted border border-border/50 shadow-sm cursor-pointer"
        :class="[selectionMode && selectedIndices.has(Number(idx)) ? 'ring-2 ring-primary ring-offset-2 scale-95' : '', selectionMode && !selectedIndices.has(Number(idx)) ? 'transition-all scale-[0.98] outline outline-transparent' : '']"
        @click="handleImageClick(img, idx)"
      >
        <NuxtImg 
          :src="img.url" 
          class="w-full h-full object-cover transition-transform duration-700"
          :class="!selectionMode ? 'group-hover:scale-110' : ''"
          loading="lazy"
        />
        
        <!-- Selection Checkbox -->
        <div v-if="selectionMode" class="absolute top-2 left-2 z-20">
          <div class="size-5 sm:size-6 rounded-full border-2 bg-black/20 backdrop-blur flex items-center justify-center transition-colors" :class="selectedIndices.has(Number(idx)) ? 'border-primary bg-primary text-primary-foreground' : 'border-white/70'">
             <Icon v-if="selectedIndices.has(Number(idx))" name="i-lucide-check" class="size-3 lg:size-4" />
          </div>
        </div>

        <!-- Overlay -->
        <div v-if="!selectionMode" class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
          <div class="flex justify-end">
            <button 
              @click.stop="removeImage(idx)" 
              class="size-7 rounded-full bg-red-600/90 text-white flex items-center justify-center hover:bg-red-500 hover:scale-110 transition-all backdrop-blur-md shadow-lg shadow-black/20"
              title="Delete Image"
            >
              <Icon name="i-lucide-trash-2" class="size-3.5" />
            </button>
          </div>
          
          <div class="flex flex-col">
            <p v-if="img.caption" class="text-xs text-white font-semibold line-clamp-2 mb-1 drop-shadow-md leading-tight">{{ img.caption }}</p>
            <span class="text-[9px] text-white/70 font-bold uppercase tracking-wider">
              {{ new Date(img.uploadedAt).toLocaleDateString() }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Uploading Queue Skeletons -->
      <div 
        v-for="item in uploadQueue" 
        :key="item.id" 
        class="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border/50 shadow-sm flex flex-col items-center justify-center p-4 space-y-3"
      >
         <!-- Blurry compressed preview -->
         <NuxtImg v-if="item.thumbnail" :src="item.thumbnail" class="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm scale-105 transition-all duration-300" />
         
         <div class="relative z-10 flex flex-col items-center w-full max-w-[85%] gap-2.5 bg-background/80 p-3 rounded-xl shadow-lg backdrop-blur-md border border-border/50 text-center select-none">
            <template v-if="item.progress < 0">
               <Icon name="i-lucide-x-circle" class="size-6 text-red-500" />
               <span class="text-[9px] font-bold text-red-500 uppercase tracking-widest">Failed</span>
            </template>
            <template v-else-if="item.progress === 100">
               <Icon name="i-lucide-check-circle-2" class="size-6 text-emerald-500" />
               <span class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Done</span>
            </template>
            <template v-else>
               <div class="relative size-10 flex items-center justify-center">
                  <!-- Custom SVG Progress Ring -->
                  <svg class="absolute inset-0 size-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="18" cy="18" r="16" fill="none" class="stroke-primary/20" stroke-width="3"></circle>
                    <circle cx="18" cy="18" r="16" fill="none" class="stroke-primary transition-all duration-300" stroke-width="3" stroke-dasharray="100" :stroke-dashoffset="100 - item.progress" stroke-linecap="round"></circle>
                  </svg>
                  <span class="text-[9px] font-bold text-primary">{{ item.progress }}%</span>
               </div>
               <span class="text-[9px] font-bold text-foreground truncate w-full">{{ item.file?.name || 'Processing...' }}</span>
            </template>
         </div>
      </div>
    </div>

    <!-- Lightbox Modal -->
    <Dialog :open="showLightbox" @update:open="showLightbox = $event">
      <DialogContent class="max-w-6xl w-[95vw] p-0 overflow-hidden bg-card/95 backdrop-blur-2xl border-border/50 shadow-2xl">
        <DialogTitle class="sr-only">Image Details</DialogTitle>
        <div class="relative flex flex-col h-[90vh]">
          <!-- Image Section -->
          <div class="relative flex-1 bg-black/5 dark:bg-black/60 flex items-center justify-center p-4 min-h-0 overflow-hidden">
             <NuxtImg v-if="selectedImage" :src="selectedImage.url" class="max-w-full max-h-full object-contain drop-shadow-2xl rounded-sm" />
          </div>
          
          <!-- Details Bottom Bar -->
          <div class="w-full border-t border-border/50 bg-background/80 p-4 shrink-0 backdrop-blur-md">
             <div v-if="selectedImage" class="flex flex-col sm:flex-row items-center gap-6 w-full">
                <!-- Caption Input -->
                <div class="flex-1 w-full">
                   <div class="relative">
                     <input 
                       type="text"
                       v-model="selectedImage.caption" 
                       placeholder="Add a description or note... (e.g. Living room before refinishing)" 
                       class="w-full bg-transparent border-0 border-b border-border/50 hover:border-border focus:border-primary focus:ring-0 px-1 py-1.5 text-sm md:text-base font-medium placeholder:text-muted-foreground/50 transition-colors outline-none"
                       @blur="updateCaption"
                       @keydown.enter="($event.target as HTMLInputElement).blur()"
                     />
                   </div>
                   <div class="flex items-center justify-between mt-2 px-1">
                      <p class="text-[10px] font-medium text-muted-foreground/70 flex items-center gap-1">
                         <Icon name="i-lucide-check-circle-2" class="size-3 text-emerald-500/70" />
                         Auto-saves when typing
                      </p>
                      
                      <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/90 flex items-center gap-1.5">
                        <Icon name="i-lucide-calendar-days" class="size-3 opacity-70" />
                        {{ new Date(selectedImage.uploadedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) }}
                      </p>
                   </div>
                </div>
                
                <!-- Actions -->
                <div class="flex items-center justify-end w-full sm:w-auto shrink-0 pb-4 sm:pb-0">
                  <button @click="removeImage(selectedImage.index)" class="h-10 px-6 text-xs uppercase tracking-wider font-bold text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm">
                    <Icon name="i-lucide-trash-2" class="size-4" />
                    Delete
                  </button>
                </div>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
