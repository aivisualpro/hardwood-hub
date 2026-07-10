<script setup lang="ts">
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { computed, ref } from 'vue'

const props = defineProps<{
  items: any[]
  isLoading?: boolean
}>()

const emit = defineEmits(['update-status', 'select'])

const currentDate = ref(new Date())

const days = computed(() => {
  const start = startOfWeek(startOfMonth(currentDate.value), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(currentDate.value), { weekStartsOn: 0 })
  return eachDayOfInterval({ start, end })
})

function previousMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

function getAppointmentsForDay(day: Date) {
  return props.items.filter((item) => {
    // Check if the appointment has meetingScheduled.startTime from Calendly
    if (item.fields?.meetingScheduled?.startTime) {
      return isSameDay(new Date(item.fields.meetingScheduled.startTime), day)
    }
    // Fallback to dateSubmitted
    return isSameDay(new Date(item.dateSubmitted), day)
  }).sort((a, b) => {
    const timeA = a.fields?.meetingScheduled?.startTime ? new Date(a.fields.meetingScheduled.startTime).getTime() : new Date(a.dateSubmitted).getTime()
    const timeB = b.fields?.meetingScheduled?.startTime ? new Date(b.fields.meetingScheduled.startTime).getTime() : new Date(b.dateSubmitted).getTime()
    return timeA - timeB
  })
}

function formatTime(dateString: string | Date) {
  if (!dateString)
    return ''
  return format(new Date(dateString), 'h:mm a')
}

// ─── Appointment state helpers (active / rescheduled / canceled) ────────────
type AptState = 'active' | 'rescheduled' | 'canceled' | 'completed'

function getAptState(apt: any): AptState {
  const meeting = apt.fields?.meetingScheduled
  if (meeting?.rescheduled)
    return 'rescheduled'
  if (meeting?.eventStatus === 'canceled' || apt.status === 'archived')
    return 'canceled'
  if (apt.status === 'completed')
    return 'completed'
  return 'active'
}

function getServiceLabel(apt: any): string {
  return apt.formName && apt.formName !== 'Calendly Appointment' ? apt.formName : 'Appointment'
}

function getServiceIcon(apt: any): string {
  const t = apt.fields?.appointmentType || ''
  const name = (apt.formName || '').toLowerCase()
  if (t === 'in-home' || /in[\s-]?home/.test(name))
    return 'i-lucide-home'
  if (t === 'phone' || /phone|call|consult/.test(name))
    return 'i-lucide-phone'
  return 'i-lucide-calendar'
}

// ─── Appointment type detection ─────────────────────────────────────────────
type AptType = 'in-home' | 'phone' | 'other'

function getAptType(apt: any): AptType {
  const t = (apt.fields?.appointmentType || '').toLowerCase()
  const name = (apt.formName || '').toLowerCase()
  if (t === 'in-home' || /in[\s-]?home/.test(name))
    return 'in-home'
  if (t === 'phone' || /phone|call|consult/.test(name))
    return 'phone'
  return 'other'
}

// Type-based card colors (background, border, row1 text, row2 text, row3 text)
const APT_TYPE_COLORS: Record<AptType, { card: string, row1: string, row2: string, row3: string }> = {
  'in-home': {
    card: 'bg-blue-600/15 border-blue-500/40 hover:bg-blue-600/25',
    row1: 'text-blue-900 dark:text-blue-200',
    row2: 'text-blue-700 dark:text-blue-300',
    row3: 'text-blue-600/70 dark:text-blue-400/70',
  },
  'phone': {
    card: 'bg-emerald-600/15 border-emerald-500/40 hover:bg-emerald-600/25',
    row1: 'text-emerald-900 dark:text-emerald-200',
    row2: 'text-emerald-700 dark:text-emerald-300',
    row3: 'text-emerald-600/70 dark:text-emerald-400/70',
  },
  'other': {
    card: 'bg-amber-600/15 border-amber-500/40 hover:bg-amber-600/25',
    row1: 'text-amber-900 dark:text-amber-200',
    row2: 'text-amber-700 dark:text-amber-300',
    row3: 'text-amber-600/70 dark:text-amber-400/70',
  },
}

// State overlay for canceled/rescheduled
const APT_STATE_OVERLAY: Record<AptState, string> = {
  active: '',
  completed: '',
  rescheduled: 'opacity-50',
  canceled: 'opacity-40',
}
</script>

<template>
  <div class="bg-card rounded-2xl border flex flex-col overflow-hidden shadow-sm">
    <!-- Header Controls -->
    <div class="flex items-center justify-between px-6 py-4 border-b bg-muted/40">
      <h2 class="text-xl font-bold font-display text-foreground">
        {{ format(currentDate, 'MMMM yyyy') }}
      </h2>
      <div class="flex items-center gap-2">
        <button class="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors" @click="previousMonth">
          <Icon name="i-lucide-chevron-left" class="size-5" />
        </button>
        <button class="px-4 py-2 text-sm font-semibold rounded-lg bg-background border hover:bg-muted transition-colors" @click="currentDate = new Date()">
          Today
        </button>
        <button class="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors" @click="nextMonth">
          <Icon name="i-lucide-chevron-right" class="size-5" />
        </button>
      </div>
    </div>

    <!-- Scrollable wrapper for mobile -->
    <div class="overflow-x-auto w-full flex-1">
      <div class="min-w-[700px] h-full flex flex-col">
        <!-- Calendar Header Row -->
        <div class="grid grid-cols-7 border-b bg-muted/20 shrink-0">
          <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day" class="px-1 sm:px-2 py-3 text-center text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span class="hidden sm:inline">{{ day }}</span>
            <span class="sm:hidden">{{ day.substring(0, 3) }}</span>
          </div>
        </div>

        <!-- Calendar Body Grid -->
        <div class="bg-border grid grid-cols-7 gap-px flex-1">
          <div
            v-for="day in days"
            :key="day.toString()"
            class="min-h-[120px] sm:min-h-[140px] bg-card p-1.5 sm:p-2 flex flex-col gap-1 transition-colors hover:bg-muted/10"
            :class="{
              'opacity-60 bg-muted/5': !isSameMonth(day, currentDate),
            }"
          >
            <div class="flex items-center justify-between px-1">
              <span
                class="text-xs sm:text-sm font-medium w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full"
                :class="isToday(day) ? 'bg-primary text-primary-foreground font-bold shadow-md' : 'text-foreground'"
              >
                {{ format(day, 'd') }}
              </span>
              <span v-if="getAppointmentsForDay(day).length > 0" class="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                {{ getAppointmentsForDay(day).length }}
              </span>
            </div>

            <!-- Appointments List -->
            <div class="flex flex-col gap-1 sm:gap-1.5 mt-1 flex-1 overflow-y-auto overflow-x-hidden pr-0.5 scrollbar-thin">
              <div
                v-for="apt in getAppointmentsForDay(day)"
                :key="apt._id"
                class="group cursor-pointer flex flex-col p-1.5 sm:p-2 rounded-md sm:rounded-lg border text-[10px] sm:text-xs text-left transition-all hover:-translate-y-px hover:shadow-md truncate"
                :class="[APT_TYPE_COLORS[getAptType(apt)].card, APT_STATE_OVERLAY[getAptState(apt)]]"
                @click="emit('select', apt)"
              >
                <div
                  class="font-bold truncate transition-colors"
                  :class="[
                    APT_TYPE_COLORS[getAptType(apt)].row1,
                    (getAptState(apt) === 'rescheduled' || getAptState(apt) === 'canceled') ? 'line-through' : '',
                  ]"
                >
                  {{ apt.name || 'Anonymous' }}
                </div>
                <div
                  class="flex items-center gap-1 mt-0.5 font-semibold text-[9px] sm:text-[10px] truncate"
                  :class="APT_TYPE_COLORS[getAptType(apt)].row2"
                >
                  <Icon :name="getServiceIcon(apt)" class="size-3 shrink-0 hidden sm:inline-block" />
                  <span class="truncate">{{ getServiceLabel(apt) }}</span>
                </div>
                <div
                  class="flex items-center gap-1 mt-0.5 font-medium text-[10px] sm:text-xs"
                  :class="APT_TYPE_COLORS[getAptType(apt)].row3"
                >
                  <Icon name="i-lucide-clock" class="size-3 shrink-0 hidden sm:inline-block" />
                  <span :class="{ 'line-through': getAptState(apt) === 'rescheduled' || getAptState(apt) === 'canceled' }">
                    {{ apt.fields?.meetingScheduled?.startTime ? formatTime(apt.fields.meetingScheduled.startTime) : formatTime(apt.dateSubmitted) }}
                  </span>
                  <span
                    v-if="getAptState(apt) === 'rescheduled'"
                    class="ml-auto shrink-0 px-1.5 py-0.5 rounded-md bg-zinc-700 text-white font-bold uppercase tracking-wide text-[7px] sm:text-[8px] shadow-sm"
                  >Rescheduled</span>
                  <span
                    v-else-if="getAptState(apt) === 'canceled'"
                    class="ml-auto shrink-0 px-1.5 py-0.5 rounded-md bg-red-700 text-white font-bold uppercase tracking-wide text-[7px] sm:text-[8px] shadow-sm"
                  >Canceled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
