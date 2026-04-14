<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let isDrawing = false
let lastX = 0
let lastY = 0

function initCanvas() {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  // Set actual size in memory (scaled to account for extra pixel density)
  const rect = canvas.value.getBoundingClientRect()
  canvas.value.width = rect.width
  canvas.value.height = rect.height
  
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // If there's already an image, load it onto the canvas
  if (props.modelValue && (props.modelValue.startsWith('data:image/') || props.modelValue.startsWith('http'))) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (ctx && canvas.value) {
        ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
        ctx.drawImage(img, 0, 0, canvas.value.width, canvas.value.height)
      }
    }
    img.src = props.modelValue
  }
}

onMounted(() => {
  // Give layout time to calculate width/height
  setTimeout(initCanvas, 10)
  window.addEventListener('resize', initCanvas)
})
onUnmounted(() => window.removeEventListener('resize', initCanvas))

function startDrawing(e: MouseEvent | TouchEvent) {
  isDrawing = true
  const { x, y } = getCoordinates(e)
  lastX = x
  lastY = y
}

function draw(e: MouseEvent | TouchEvent) {
  if (!isDrawing || !ctx) return
  e.preventDefault()
  
  const { x, y } = getCoordinates(e)
  
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(x, y)
  ctx.stroke()
  
  lastX = x
  lastY = y
}

function stopDrawing() {
  if (isDrawing) {
    isDrawing = false
    emitSignature()
  }
}

function getCoordinates(e: MouseEvent | TouchEvent) {
  if (!canvas.value) return { x: 0, y: 0 }
  const rect = canvas.value.getBoundingClientRect()
  
  if ('touches' in e) {
    const touchEvent = e as TouchEvent
    if (touchEvent.touches && touchEvent.touches.length > 0 && touchEvent.touches[0]) {
      return {
        x: touchEvent.touches[0].clientX - rect.left,
        y: touchEvent.touches[0].clientY - rect.top,
      }
    }
  }
  
  return {
    x: (e as MouseEvent).clientX - rect.left,
    y: (e as MouseEvent).clientY - rect.top,
  }
}

function clear() {
  if (!canvas.value || !ctx) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  emit('update:modelValue', '')
}

function emitSignature() {
  if (!canvas.value) return
  emit('update:modelValue', canvas.value.toDataURL('image/png'))
}

defineExpose({ clear })
</script>

<template>
  <div class="relative group bg-muted/10 border border-dashed rounded-xl overflow-hidden touch-none" style="min-height: 120px;">
    <canvas
      ref="canvas"
      class="absolute inset-0 w-full h-full z-10 cursor-crosshair touch-none dark:invert dark:opacity-90"
      @mousedown="startDrawing"
      @mousemove="draw"
      @mouseup="stopDrawing"
      @mouseleave="stopDrawing"
      @touchstart="startDrawing"
      @touchmove="draw"
      @touchend="stopDrawing"
    />

    <img v-if="modelValue && modelValue.startsWith('http')" :src="modelValue" class="absolute inset-0 w-full h-full object-contain pointer-events-none z-0 opacity-80 dark:invert dark:opacity-70" />
    
    <div v-if="!modelValue" class="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-40 z-0">
      <Icon name="i-lucide-pencil-line" class="size-5 mb-1" />
      <span class="text-xs font-medium">Draw signature here</span>
    </div>

    <button
      v-if="modelValue"
      type="button"
      class="absolute top-2 right-2 size-6 bg-white/90 border rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
      title="Clear signature"
      @click="clear"
    >
      <Icon name="i-lucide-eraser" class="size-3.5" />
    </button>
  </div>
</template>
