<script setup lang="ts">
import { computed, ref } from 'vue'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns'

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
  return props.items.filter(item => {
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
  if (!dateString) return ''
  return format(new Date(dateString), 'h:mm a')
}
</script>

<template>
  <div class="bg-card rounded-2xl border flex flex-col overflow-hidden shadow-sm">
    <!-- Header Controls -->
    <div class="flex items-center justify-between px-6 py-4 border-b bg-muted/40">
      <h2 class="text-xl font-bold font-display text-foreground">{{ format(currentDate, 'MMMM yyyy') }}</h2>
      <div class="flex items-center gap-2">
        <button @click="previousMonth" class="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <Icon name="i-lucide-chevron-left" class="size-5" />
        </button>
        <button @click="currentDate = new Date()" class="px-4 py-2 text-sm font-semibold rounded-lg bg-background border hover:bg-muted transition-colors">
          Today
        </button>
        <button @click="nextMonth" class="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
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
                @click="emit('select', apt)"
                class="group cursor-pointer flex flex-col p-1.5 sm:p-2 rounded-md sm:rounded-lg border text-[10px] sm:text-xs text-left bg-gradient-to-br transition-all hover:-translate-y-px hover:shadow-md truncate"
                :class="apt.status === 'completed' ? 'from-green-500/10 to-green-500/5 border-green-500/20 text-green-700 dark:text-green-400' : 'from-sky-500/10 to-blue-600/5 border-sky-500/20 text-sky-700 dark:text-sky-400'"
              >
                <div class="font-bold truncate group-hover:text-sky-600 transition-colors">
                  {{ apt.name || 'Anonymous' }}
                </div>
                <div class="flex items-center gap-1 mt-0.5 opacity-80 text-[9px] sm:text-[10px]">
                  <Icon name="i-lucide-clock" class="size-3 shrink-0 hidden sm:inline-block" />
                  <span>{{ apt.fields?.meetingScheduled?.startTime ? formatTime(apt.fields.meetingScheduled.startTime) : formatTime(apt.dateSubmitted) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
