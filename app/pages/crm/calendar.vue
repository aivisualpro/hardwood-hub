<script setup lang="ts">
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, setHours, setMinutes, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({
  title: 'Calendar',
  icon: 'i-lucide-calendar',
  description: 'Google Calendar sync',
})

// ─── Types ───────────────────────────────────────────────
interface CalendarEvent {
  id: string
  summary: string
  description: string
  location: string
  status: string
  htmlLink: string
  start: string
  end: string
  allDay: boolean
  attendees: { email: string, displayName: string, responseStatus: string, self: boolean }[]
  organizer: { email: string, displayName: string, self: boolean }
  colorId: string
}

// ─── State ───────────────────────────────────────────────
const events = ref<CalendarEvent[]>([])
const loading = ref(true)
const connected = ref(false)
const currentDate = ref(new Date())
const viewMode = ref<'month' | 'week'>('month')

// Event create/edit dialog
const showEventDialog = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)
const savingEvent = ref(false)
const eventForm = ref({
  summary: '',
  description: '',
  location: '',
  start: '',
  end: '',
  allDay: false,
})

// Event detail popover
const selectedEvent = ref<CalendarEvent | null>(null)
const showEventDetail = ref(false)

// ─── Calendar Grid ───────────────────────────────────────
const calendarDays = computed(() => {
  const start = startOfWeek(startOfMonth(currentDate.value), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(currentDate.value), { weekStartsOn: 0 })
  const days: Date[] = []
  let d = start
  while (d <= end) {
    days.push(d)
    d = addDays(d, 1)
  }
  return days
})

const weekDays = computed(() => {
  const start = startOfWeek(currentDate.value, { weekStartsOn: 0 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
})

const displayDays = computed(() => viewMode.value === 'month' ? calendarDays.value : weekDays.value)

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Event Colors ────────────────────────────────────────
const EVENT_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  1: { bg: 'bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-500/30' },
  2: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30' },
  3: { bg: 'bg-violet-500/15', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-500/30' },
  4: { bg: 'bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/30' },
  5: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/30' },
  6: { bg: 'bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/30' },
  7: { bg: 'bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-500/30' },
  8: { bg: 'bg-gray-500/15', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-500/30' },
  9: { bg: 'bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/30' },
  10: { bg: 'bg-green-500/15', text: 'text-green-700 dark:text-green-300', border: 'border-green-500/30' },
  11: { bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-300', border: 'border-red-500/30' },
  default: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
}

function getEventColor(colorId: string | undefined | null) {
  return EVENT_COLORS[colorId ?? ''] || EVENT_COLORS.default
}

// ─── Event Helpers ───────────────────────────────────────
function getEventsForDay(day: Date): CalendarEvent[] {
  return events.value.filter((ev) => {
    const evStart = parseISO(ev.start)
    return isSameDay(evStart, day)
  })
}

function formatEventTime(ev: CalendarEvent): string {
  if (ev.allDay)
    return 'All day'
  try {
    return format(parseISO(ev.start), 'h:mm a')
  }
  catch {
    return ''
  }
}

// ─── Navigation ──────────────────────────────────────────
function goToday() { currentDate.value = new Date() }
function goPrev() { currentDate.value = viewMode.value === 'month' ? subMonths(currentDate.value, 1) : addDays(currentDate.value, -7) }
function goNext() { currentDate.value = viewMode.value === 'month' ? addMonths(currentDate.value, 1) : addDays(currentDate.value, 7) }

const headerTitle = computed(() => {
  if (viewMode.value === 'month')
    return format(currentDate.value, 'MMMM yyyy')
  const start = startOfWeek(currentDate.value, { weekStartsOn: 0 })
  const end = addDays(start, 6)
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
  }
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
})

// ─── API ─────────────────────────────────────────────────
async function fetchEvents() {
  loading.value = true
  try {
    // Check connection first
    const status = await $fetch<any>('/api/google-calendar/status')
    connected.value = status.data?.connected || false

    if (!connected.value) {
      loading.value = false
      return
    }

    // Calculate time range
    const monthStart = startOfMonth(currentDate.value)
    const monthEnd = endOfMonth(currentDate.value)
    const timeMin = addDays(startOfWeek(monthStart, { weekStartsOn: 0 }), 0).toISOString()
    const timeMax = addDays(endOfWeek(monthEnd, { weekStartsOn: 0 }), 1).toISOString()

    const res = await $fetch<any>('/api/google-calendar/events', {
      params: { timeMin, timeMax },
    })
    events.value = res.data?.events || []
  }
  catch (e: any) {
    console.error('[Calendar] Failed to fetch events:', e?.message)
    toast.error('Failed to load calendar events', { description: e?.message })
  }
  finally {
    loading.value = false
  }
}

async function createEvent() {
  if (!eventForm.value.summary.trim()) {
    toast.error('Event title is required')
    return
  }
  savingEvent.value = true
  try {
    const body = {
      summary: eventForm.value.summary,
      description: eventForm.value.description,
      location: eventForm.value.location,
      start: eventForm.value.allDay ? eventForm.value.start : new Date(eventForm.value.start).toISOString(),
      end: eventForm.value.allDay ? eventForm.value.end : new Date(eventForm.value.end).toISOString(),
      allDay: eventForm.value.allDay,
    }

    if (editingEvent.value) {
      await $fetch(`/api/google-calendar/events/${editingEvent.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.success('Event updated')
    }
    else {
      await $fetch('/api/google-calendar/events', {
        method: 'POST',
        body,
      })
      toast.success('Event created')
    }

    showEventDialog.value = false
    await fetchEvents()
  }
  catch (e: any) {
    toast.error('Failed to save event', { description: e?.message })
  }
  finally {
    savingEvent.value = false
  }
}

async function deleteEvent(id: string) {
  try {
    await $fetch(`/api/google-calendar/events/${id}`, { method: 'DELETE' })
    toast.success('Event deleted')
    showEventDetail.value = false
    selectedEvent.value = null
    await fetchEvents()
  }
  catch (e: any) {
    toast.error('Failed to delete event', { description: e?.message })
  }
}

function openNewEvent(day?: Date) {
  editingEvent.value = null
  const d = day || new Date()
  const start = setMinutes(setHours(d, 9), 0)
  const end = setMinutes(setHours(d, 10), 0)
  eventForm.value = {
    summary: '',
    description: '',
    location: '',
    start: format(start, 'yyyy-MM-dd\'T\'HH:mm'),
    end: format(end, 'yyyy-MM-dd\'T\'HH:mm'),
    allDay: false,
  }
  showEventDialog.value = true
}

function openEditEvent(ev: CalendarEvent) {
  editingEvent.value = ev
  const startStr = ev.allDay ? ev.start : format(parseISO(ev.start), 'yyyy-MM-dd\'T\'HH:mm')
  const endStr = ev.allDay ? ev.end : format(parseISO(ev.end), 'yyyy-MM-dd\'T\'HH:mm')
  eventForm.value = {
    summary: ev.summary,
    description: ev.description,
    location: ev.location,
    start: startStr,
    end: endStr,
    allDay: ev.allDay,
  }
  showEventDetail.value = false
  showEventDialog.value = true
}

function selectEvent(ev: CalendarEvent) {
  selectedEvent.value = ev
  showEventDetail.value = true
}

// ─── Lifecycle ───────────────────────────────────────────
watch(currentDate, () => fetchEvents())

onMounted(() => {
  fetchEvents()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header Teleport -->
    <ClientOnly>
      <Teleport to="#header-toolbar">
        <div class="flex items-center gap-2 sm:gap-3 w-full max-w-2xl pr-2">
          <!-- Navigation -->
          <div class="flex items-center gap-1">
            <button
              class="size-8 sm:size-9 rounded-lg border border-border/50 bg-background/50 hover:bg-muted flex items-center justify-center transition-colors"
              @click="goPrev"
            >
              <Icon name="i-lucide-chevron-left" class="size-4" />
            </button>
            <button
              class="h-8 sm:h-9 px-3 rounded-lg border border-border/50 bg-background/50 hover:bg-muted text-xs sm:text-sm font-semibold transition-colors"
              @click="goToday"
            >
              Today
            </button>
            <button
              class="size-8 sm:size-9 rounded-lg border border-border/50 bg-background/50 hover:bg-muted flex items-center justify-center transition-colors"
              @click="goNext"
            >
              <Icon name="i-lucide-chevron-right" class="size-4" />
            </button>
          </div>

          <h2 class="text-sm sm:text-base font-bold truncate">
            {{ headerTitle }}
          </h2>

          <div class="ml-auto flex items-center gap-2">
            <!-- View Toggle -->
            <div class="bg-muted p-0.5 hidden sm:flex rounded-lg items-center shadow-inner border border-input/50 h-8 sm:h-9">
              <button
                class="px-2.5 h-full rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                :class="viewMode === 'month' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="viewMode = 'month'"
              >
                Month
              </button>
              <button
                class="px-2.5 h-full rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                :class="viewMode === 'week' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="viewMode = 'week'"
              >
                Week
              </button>
            </div>

            <!-- New Event -->
            <Button v-if="connected" size="sm" class="h-8 sm:h-9 gap-2 shadow-lg shadow-primary/20" @click="openNewEvent()">
              <Icon name="i-lucide-plus" class="size-3.5" />
              <span class="hidden sm:inline">New Event</span>
            </Button>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- Not Connected State -->
    <div v-if="!loading && !connected" class="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div class="size-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
        <Icon name="i-lucide-calendar" class="size-10 text-blue-500" />
      </div>
      <div>
        <h2 class="text-xl font-bold mb-2">
          Connect Google Calendar
        </h2>
        <p class="text-sm text-muted-foreground max-w-md">
          Connect your Google Calendar to view and manage your events.
          Go to <NuxtLink to="/admin/general-settings/integrations" class="text-primary hover:underline font-medium">
            Admin → Integrations
          </NuxtLink> to connect.
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="flex items-center justify-center py-20">
      <div class="flex items-center gap-3">
        <Icon name="i-lucide-loader-2" class="size-5 animate-spin text-primary" />
        <span class="text-sm text-muted-foreground font-medium">Loading calendar...</span>
      </div>
    </div>

    <!-- Calendar Grid -->
    <div v-else class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
      <!-- Day headers -->
      <div class="grid grid-cols-7 border-b border-border/30 bg-muted/30">
        <div
          v-for="day in DAY_NAMES"
          :key="day"
          class="px-2 py-2.5 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
        >
          {{ day }}
        </div>
      </div>

      <!-- Day cells -->
      <div class="grid grid-cols-7" :class="viewMode === 'week' ? 'min-h-[500px]' : ''">
        <div
          v-for="(day, idx) in displayDays"
          :key="idx"
          class="border-b border-r border-border/20 p-1.5 transition-colors hover:bg-muted/20 cursor-pointer group/cell"
          :class="[
            viewMode === 'month' ? 'min-h-[100px] sm:min-h-[120px]' : 'min-h-[400px]',
            !isSameMonth(day, currentDate) && viewMode === 'month' ? 'bg-muted/10 opacity-50' : '',
            isToday(day) ? 'bg-primary/[0.03]' : '',
          ]"
          @dblclick="openNewEvent(day)"
        >
          <!-- Day number -->
          <div class="flex items-center justify-between mb-1">
            <span
              class="text-xs font-bold px-1.5 py-0.5 rounded-md"
              :class="isToday(day)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'"
            >
              {{ format(day, 'd') }}
            </span>
            <button
              class="size-5 rounded flex items-center justify-center hover:bg-muted text-muted-foreground/0 group-hover/cell:text-muted-foreground transition-colors"
              @click.stop="openNewEvent(day)"
            >
              <Icon name="i-lucide-plus" class="size-3" />
            </button>
          </div>

          <!-- Events -->
          <div class="space-y-0.5">
            <button
              v-for="ev in getEventsForDay(day).slice(0, viewMode === 'month' ? 3 : 20)"
              :key="ev.id"
              class="w-full text-left px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium truncate border transition-colors hover:opacity-80"
              :class="[getEventColor(ev.colorId).bg, getEventColor(ev.colorId).text, getEventColor(ev.colorId).border]"
              @click.stop="selectEvent(ev)"
            >
              <span v-if="!ev.allDay" class="font-semibold mr-1">{{ formatEventTime(ev) }}</span>
              {{ ev.summary }}
            </button>
            <div
              v-if="getEventsForDay(day).length > (viewMode === 'month' ? 3 : 20)"
              class="text-[10px] text-muted-foreground font-medium px-1.5"
            >
              +{{ getEventsForDay(day).length - (viewMode === 'month' ? 3 : 20) }} more
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Detail Sheet -->
    <Sheet v-model:open="showEventDetail">
      <SheetContent class="sm:max-w-lg overflow-y-auto w-full p-6 sm:p-8">
        <SheetHeader v-if="selectedEvent">
          <div class="flex items-center gap-3 mb-1">
            <div
              class="size-12 rounded-xl flex items-center justify-center"
              :class="getEventColor(selectedEvent.colorId).bg"
            >
              <Icon name="i-lucide-calendar" class="size-6" :class="getEventColor(selectedEvent.colorId).text" />
            </div>
            <div class="flex-1 min-w-0">
              <SheetTitle class="text-lg truncate">
                {{ selectedEvent.summary || 'Untitled Event' }}
              </SheetTitle>
              <SheetDescription>
                {{ selectedEvent.allDay ? 'All-day event' : `${formatEventTime(selectedEvent)}` }}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div v-if="selectedEvent" class="mt-6 space-y-5">
          <!-- Time -->
          <div class="flex items-start gap-3">
            <Icon name="i-lucide-clock" class="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p class="text-sm font-medium">
                {{ selectedEvent.allDay
                  ? format(parseISO(selectedEvent.start), 'EEEE, MMMM d, yyyy')
                  : format(parseISO(selectedEvent.start), 'EEEE, MMMM d, yyyy') }}
              </p>
              <p v-if="!selectedEvent.allDay" class="text-xs text-muted-foreground">
                {{ format(parseISO(selectedEvent.start), 'h:mm a') }} – {{ format(parseISO(selectedEvent.end), 'h:mm a') }}
              </p>
            </div>
          </div>

          <!-- Location -->
          <div v-if="selectedEvent.location" class="flex items-start gap-3">
            <Icon name="i-lucide-map-pin" class="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <p class="text-sm">
              {{ selectedEvent.location }}
            </p>
          </div>

          <!-- Description -->
          <div v-if="selectedEvent.description" class="flex items-start gap-3">
            <Icon name="i-lucide-align-left" class="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <p class="text-sm text-muted-foreground whitespace-pre-wrap">
              {{ selectedEvent.description }}
            </p>
          </div>

          <!-- Attendees -->
          <div v-if="selectedEvent.attendees?.length" class="flex items-start gap-3">
            <Icon name="i-lucide-users" class="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div class="space-y-1">
              <div v-for="att in selectedEvent.attendees" :key="att.email" class="flex items-center gap-2 text-sm">
                <span
                  class="size-2 rounded-full"
                  :class="att.responseStatus === 'accepted' ? 'bg-emerald-500' : att.responseStatus === 'declined' ? 'bg-red-500' : 'bg-amber-500'"
                />
                <span>{{ att.displayName || att.email }}</span>
                <span v-if="att.self" class="text-[10px] text-muted-foreground">(you)</span>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Actions -->
          <div class="flex items-center gap-3">
            <Button size="sm" variant="outline" class="h-9 gap-2" @click="openEditEvent(selectedEvent)">
              <Icon name="i-lucide-pencil" class="size-3.5" />
              Edit
            </Button>
            <a v-if="selectedEvent.htmlLink" :href="selectedEvent.htmlLink" target="_blank" class="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-md border border-border/50 hover:bg-muted/50 transition-colors">
              <Icon name="i-lucide-external-link" class="size-3.5" />
              Open in Google
            </a>
            <div class="ml-auto">
              <Button size="sm" variant="ghost" class="h-9 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" @click="deleteEvent(selectedEvent.id)">
                <Icon name="i-lucide-trash-2" class="size-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    <!-- Create / Edit Event Dialog -->
    <Dialog v-model:open="showEventDialog">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingEvent ? 'Edit Event' : 'New Event' }}</DialogTitle>
          <DialogDescription>
            {{ editingEvent ? 'Update this event on Google Calendar.' : 'Create a new event on Google Calendar.' }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-3">
          <div class="flex flex-col gap-1.5">
            <Label for="ev-title">Title</Label>
            <input
              id="ev-title"
              v-model="eventForm.summary"
              class="h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Event title"
            >
          </div>

          <div class="flex items-center gap-2">
            <input id="ev-allday" v-model="eventForm.allDay" type="checkbox" class="rounded border-border">
            <Label for="ev-allday" class="text-sm cursor-pointer">All-day event</Label>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label for="ev-start">Start</Label>
              <input
                id="ev-start"
                v-model="eventForm.start"
                :type="eventForm.allDay ? 'date' : 'datetime-local'"
                class="h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="ev-end">End</Label>
              <input
                id="ev-end"
                v-model="eventForm.end"
                :type="eventForm.allDay ? 'date' : 'datetime-local'"
                class="h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label for="ev-location">Location</Label>
            <input
              id="ev-location"
              v-model="eventForm.location"
              class="h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Add location"
            >
          </div>

          <div class="flex flex-col gap-1.5">
            <Label for="ev-desc">Description</Label>
            <textarea
              id="ev-desc"
              v-model="eventForm.description"
              rows="3"
              class="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder="Add description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showEventDialog = false">
            Cancel
          </Button>
          <Button :disabled="savingEvent" @click="createEvent">
            <Icon v-if="savingEvent" name="i-lucide-loader-2" class="size-3.5 animate-spin mr-2" />
            {{ editingEvent ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
