<script setup lang="ts">
/**
 * TimeClock — Global floating widget that shows a live running counter
 * whenever the authenticated employee is clocked in.
 *
 * Rendered in the default layout so it persists across all pages.
 */
import { toast } from 'vue-sonner'

const { user } = useAuth()

interface ActiveEntry {
  _id: string
  projectName: string
  customerName: string
  clockIn: string
}

const active = ref<ActiveEntry | null>(null)
const elapsed = ref('00:00:00')
const expanded = ref(false)
const clockingOut = ref(false)
const clockOutNotes = ref('')
let timer: ReturnType<typeof setInterval> | null = null

// ── Fetch active entry ───────────────────────────────────────────────────────
async function fetchActive() {
  if (!user.value) return
  try {
    const res = await $fetch<{ success: boolean, data: ActiveEntry | null }>('/api/timesheet/active')
    active.value = res.data
    if (res.data) startTimer()
    else stopTimer()
  }
  catch { /* silent */ }
}

// ── Timer ────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer()
  tick()
  timer = setInterval(tick, 1000)
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null }
  elapsed.value = '00:00:00'
}

function tick() {
  if (!active.value) return
  const ms = Date.now() - new Date(active.value.clockIn).getTime()
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  elapsed.value = `${h}:${m}:${s}`
}

// ── Clock Out ────────────────────────────────────────────────────────────────
async function clockOut() {
  if (!active.value) return
  clockingOut.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any }>(`/api/timesheet/${active.value._id}`, {
      method: 'PUT',
      body: { notes: clockOutNotes.value },
    })
    const dur = res.data?.duration || 0
    const hrs = Math.floor(dur / 60)
    const mins = dur % 60
    toast.success('Clocked Out!', { description: `Total time: ${hrs}h ${mins}m` })
    active.value = null
    clockOutNotes.value = ''
    expanded.value = false
    stopTimer()
  }
  catch (e: any) {
    toast.error('Clock-out failed', { description: e?.data?.message || e?.message || 'Error' })
  }
  finally {
    clockingOut.value = false
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  fetchActive()
  // Poll every 30 seconds in case another tab clocks in/out
  const poll = setInterval(fetchActive, 30_000)
  onUnmounted(() => { clearInterval(poll); stopTimer() })
})

// Re-check when user changes
watch(user, () => fetchActive())
</script>

<template>
  <!-- Only render when clocked in -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-4 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-4 scale-95"
    >
      <div
        v-if="active"
        class="fixed bottom-6 right-6 z-[9999]"
      >
        <!-- Collapsed pill -->
        <div
          v-if="!expanded"
          class="flex items-center gap-3 bg-card/95 backdrop-blur-xl border shadow-2xl rounded-2xl px-4 py-3 cursor-pointer hover:shadow-3xl transition-all duration-200 hover:scale-[1.02] group"
          @click="expanded = true"
        >
          <!-- Pulsing dot -->
          <span class="relative flex size-2.5 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span class="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
          </span>

          <!-- Timer -->
          <span class="text-lg font-black tabular-nums tracking-tight text-foreground font-mono">
            {{ elapsed }}
          </span>

          <!-- Project badge -->
          <span
            v-if="active.projectName"
            class="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 max-w-[120px] truncate"
          >
            {{ active.projectName }}
          </span>

          <!-- Expand hint -->
          <Icon name="i-lucide-chevron-up" class="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>

        <!-- Expanded card -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="expanded"
            class="bg-card/95 backdrop-blur-xl border shadow-2xl rounded-2xl w-[320px] overflow-hidden"
          >
            <!-- Header -->
            <div class="px-4 py-3 border-b bg-emerald-500/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="relative flex size-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span class="relative inline-flex rounded-full size-2 bg-emerald-500" />
                </span>
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Clocked In
                </span>
              </div>
              <div class="flex items-center gap-1">
                <NuxtLink to="/hr/timesheet">
                  <Button variant="ghost" size="icon" class="size-7">
                    <Icon name="i-lucide-external-link" class="size-3.5" />
                  </Button>
                </NuxtLink>
                <Button variant="ghost" size="icon" class="size-7" @click="expanded = false">
                  <Icon name="i-lucide-chevron-down" class="size-3.5" />
                </Button>
              </div>
            </div>

            <!-- Body -->
            <div class="p-4 space-y-3">
              <!-- Timer -->
              <p class="text-3xl font-black tabular-nums tracking-tight text-center text-foreground font-mono">
                {{ elapsed }}
              </p>

              <!-- Project info -->
              <div v-if="active.projectName" class="text-center">
                <span class="text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                  {{ active.projectName }}
                </span>
                <p v-if="active.customerName" class="text-[10px] text-muted-foreground mt-1.5">
                  {{ active.customerName }}
                </p>
              </div>

              <!-- Notes -->
              <div class="space-y-1.5">
                <Label class="text-[10px] text-muted-foreground uppercase tracking-wider">Notes</Label>
                <Textarea
                  v-model="clockOutNotes"
                  placeholder="What did you work on?"
                  class="resize-none h-16 text-xs"
                />
              </div>

              <!-- Clock Out Button -->
              <Button
                :disabled="clockingOut"
                class="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 rounded-lg transition-all duration-200"
                @click="clockOut"
              >
                <Icon v-if="clockingOut" name="i-lucide-loader-2" class="size-3.5 animate-spin mr-1.5" />
                <Icon v-else name="i-lucide-log-out" class="size-3.5 mr-1.5" />
                Clock Out
              </Button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
