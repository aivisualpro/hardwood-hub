<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Project Communication', icon: 'i-lucide-message-square', description: 'Manage and Track Field Project Communications' })

// ─── Setup ─────────────────────────────────────────────
const activeTab = ref('list') // 'list' or 'form'
const records = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)
const hideCompleted = ref(false)

const editingId = ref<string | null>(null)

const emptyForm = () => ({
  leadTechnicianSupervisorTechnician: '',
  pleaseMarkIfThisProjectIsFullyCompleteOrNot: '',
  leaveAnyNotesAboutThingsThatStillNeedToBeDoneForFutureCrews: '',
  whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply: [] as string[],
  gradeOfFlooring: [] as string[],
  widthOfFlooring: [] as string[],
  cutOfFlooring: [] as string[],
  fidBox: [] as string[],
  stain: '',
  ifMixWhatColorsAndRatio: '',
  whatSealerWasUsed: '',
  whatWasTheFirstCoatOfFinish: '',
  whatWasTheFinalCoatOfFinish: '',
  whatSheen: '',
  whatAdditivesToFinish: '',
  allTasksAssignedToProjectLeadFromQcAreCompleted: '',
  ifNoWhatNeedsToBeDone: '',
  wasThereAChangeOrderFilledOut: '',
  wasThereAnyWorkAdded: '',
  wasThereAnyWorkNotCompletedThatShouldBeRemovedFromTheInvoice: '',
  listAnyWorkRemovedOrAddedPleaseGiveAsMuchDetailAsPossibleForBilling: '',
  howWouldYouRateYourTeamsPerformanceOnThisProject: '',
  howWouldYouRateYourInteractionsWithTheClient: '',
  anyOtherNotesAboutThisProject: '',
  didYouTakeFinalPictures: '',
})
const form = ref(emptyForm())

// ─── Checklist Options ────────────────────────────────
const technicianOptions = ['Jacob', 'Jordan', 'Tom', 'Ian']
const completionOptions = ['Still in Progress', 'Fully Complete']
const woodSpeciesOptions = ['Birch', 'Beech', 'Cherry', 'Douglas Fir', 'Hickory', 'Jatoba', 'Maple', 'Red Oak', 'Red & White Oak Mix', 'White Oak', 'Yellow Pine', 'Vinyl', 'Other']
const gradeOptions = ['Clear', 'Select & Better', '#1 Common', '#2 Common', '1st Grade "Maple only"', '2nd Grade "Maple only"']
const widthOptions = ['1 1/2"', '2 1/4"', '3"', '3 1/4"', '4"', '5"', '6"', '7"', '8"', '9"', '10"']
const cutOptions = ['Plain Sawn', 'Live Sawn aka "Euro sawn"', 'Rift Sawn', 'Quarter Sawn', 'Rift & Quarter Sawn']
const fidBoxOptions = ['No Fid box installed', 'Fid box Installed', 'Customer has app and has been given access to fid box']
const sheenOptions = ['Matte', 'Satin', 'Semi-Gloss', 'Gloss']
const ratingOptions = ['1', '2', '3', '4', '5']
const yesNoOptions = ['Yes', 'No']

// ─── Sections Definition for Checklist ─────────────────
const sections = computed(() => [
  {
    id: 'lead-tech',
    title: 'Lead Technician / Supervisor Technician',
    description: 'To be filled out by the lead or supervisor technician only',
    icon: 'i-lucide-hard-hat',
    fields: [
      { key: 'leadTechnicianSupervisorTechnician', label: 'Lead Technician / Supervisor Technician', type: 'chips', options: technicianOptions },
    ]
  },
  {
    id: 'completion',
    title: 'Completion Level',
    description: 'Mark the project completion status',
    icon: 'i-lucide-check-circle-2',
    fields: [
      { key: 'pleaseMarkIfThisProjectIsFullyCompleteOrNot', label: 'Please mark if this project is fully complete or not', type: 'chips', options: completionOptions },
      { key: 'leaveAnyNotesAboutThingsThatStillNeedToBeDoneForFutureCrews', label: 'Leave any notes about things that still need to be done for future crews', type: 'textarea' },
    ]
  },
  {
    id: 'flooring-species',
    title: 'Flooring Species / Type',
    description: 'What type of wood/flooring was used on the project — select all that apply',
    icon: 'i-lucide-trees',
    fields: [
      { key: 'whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply', label: 'What type of wood/flooring was used on the project — select all that apply', type: 'multi-chips', options: woodSpeciesOptions },
      { key: 'gradeOfFlooring', label: 'Grade of flooring', type: 'multi-chips', options: gradeOptions },
      { key: 'widthOfFlooring', label: 'Width of flooring', type: 'multi-chips', options: widthOptions },
      { key: 'cutOfFlooring', label: 'Cut of flooring', type: 'multi-chips', options: cutOptions },
      { key: 'fidBox', label: 'Fid Box', type: 'multi-chips', options: fidBoxOptions },
    ]
  },
  {
    id: 'stain-finish',
    title: 'Stain & Finish',
    description: 'Record stain and finish specifications for the project',
    icon: 'i-lucide-paintbrush',
    fields: [
      { key: 'stain', label: 'Stain', type: 'input' },
      { key: 'ifMixWhatColorsAndRatio', label: 'If mix, what colors and ratio?', type: 'input' },
      { key: 'whatSealerWasUsed', label: 'What sealer was used?', type: 'input' },
      { key: 'whatWasTheFirstCoatOfFinish', label: 'What was the first coat of finish?', type: 'input' },
      { key: 'whatWasTheFinalCoatOfFinish', label: 'What was the final coat of finish?', type: 'input' },
      { key: 'whatSheen', label: 'What sheen?', type: 'chips', options: sheenOptions },
      { key: 'whatAdditivesToFinish', label: 'What additives to finish?', type: 'input' },
    ]
  },
  {
    id: 'task-tracking',
    title: 'Task & Change Order Tracking',
    description: 'Track QC task completion and any change orders',
    icon: 'i-lucide-clipboard-check',
    fields: [
      { key: 'allTasksAssignedToProjectLeadFromQcAreCompleted', label: 'All tasks assigned to project lead from QC are completed?', type: 'chips', options: yesNoOptions },
      { key: 'ifNoWhatNeedsToBeDone', label: 'If no, what needs to be done?', type: 'textarea' },
      { key: 'wasThereAChangeOrderFilledOut', label: 'Was there a change order filled out?', type: 'chips', options: yesNoOptions },
      { key: 'wasThereAnyWorkAdded', label: 'Was there any work added?', type: 'chips', options: yesNoOptions },
      { key: 'wasThereAnyWorkNotCompletedThatShouldBeRemovedFromTheInvoice', label: 'Was there any work not completed that should be removed from the invoice?', type: 'chips', options: yesNoOptions },
      { key: 'listAnyWorkRemovedOrAddedPleaseGiveAsMuchDetailAsPossibleForBilling', label: 'List any work removed or added — provide as much detail as possible for billing', type: 'textarea' },
    ]
  },
  {
    id: 'project-review',
    title: 'Project Review',
    description: 'Rate your team\'s performance and client interactions',
    icon: 'i-lucide-star',
    fields: [
      { key: 'howWouldYouRateYourTeamsPerformanceOnThisProject', label: 'How would you rate your team\'s performance on this project?', type: 'chips', options: ratingOptions },
      { key: 'howWouldYouRateYourInteractionsWithTheClient', label: 'How would you rate your interactions with the client?', type: 'chips', options: ratingOptions },
      { key: 'didYouTakeFinalPictures', label: 'Did you take final pictures?', type: 'chips', options: yesNoOptions },
      { key: 'anyOtherNotesAboutThisProject', label: 'Any other notes about this project', type: 'textarea' },
    ]
  },
])

// ─── Progress ─────────────────────────────────────────
const totalFields = computed(() => sections.value.reduce((sum, s) => sum + s.fields.length, 0))

const completedFields = computed(() => {
  let count = 0
  for (const section of sections.value) {
    for (const field of section.fields) {
      const val = (form.value as any)[field.key]
      if (field.type === 'multi-chips') {
        if (Array.isArray(val) && val.length > 0) count++
      } else if (val && typeof val === 'string' && val.trim() !== '') count++
    }
  }
  return count
})

const progressPercent = computed(() => totalFields.value > 0 ? Math.round((completedFields.value / totalFields.value) * 100) : 0)

function isSectionCompleted(section: any) {
  return section.fields.every((field: any) => {
    const val = (form.value as any)[field.key]
    if (field.type === 'multi-chips') return Array.isArray(val) && val.length > 0
    return val && typeof val === 'string' && val.trim() !== ''
  })
}

function sectionProgress(section: any) {
  let done = 0
  for (const field of section.fields) {
    const val = (form.value as any)[field.key]
    if (field.type === 'multi-chips') { if (Array.isArray(val) && val.length > 0) done++ }
    else if (val && typeof val === 'string' && val.trim() !== '') done++
  }
  return { done, total: section.fields.length }
}

function isFieldCompleted(field: any) {
  const val = (form.value as any)[field.key]
  if (field.type === 'multi-chips') return Array.isArray(val) && val.length > 0
  return val && typeof val === 'string' && val.trim() !== ''
}

const visibleSections = computed(() => {
  if (!hideCompleted.value) return sections.value
  return sections.value.filter(s => !isSectionCompleted(s))
})

// ─── Chip Helpers ──────────────────────────────────────
function selectChip(key: string, value: string) {
  ;(form.value as any)[key] = (form.value as any)[key] === value ? '' : value
}

function toggleMultiChip(key: string, value: string) {
  const arr: string[] = (form.value as any)[key]
  if (arr.includes(value)) {
    ;(form.value as any)[key] = arr.filter((v: string) => v !== value)
  } else {
    arr.push(value)
  }
}

// ─── API ──────────────────────────────────────────────
async function fetchRecords() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/project-communication')
    records.value = res.data
  } catch (e: any) {
    toast.error('Failed to load project communications', { description: e?.message })
  } finally {
    loading.value = false
  }
}

onMounted(fetchRecords)

function openCreate() {
  form.value = emptyForm()
  editingId.value = null
  activeTab.value = 'form'
}

function openEdit(rec: any) {
  form.value = { ...emptyForm(), ...rec }
  editingId.value = rec._id
  activeTab.value = 'form'
}

function cancelEdit() {
  activeTab.value = 'list'
  editingId.value = null
}

async function saveRecord() {
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/project-communication/${editingId.value}`, { method: 'PUT', body: form.value })
      toast.success('Record updated successfully')
    } else {
      await $fetch('/api/project-communication', { method: 'POST', body: form.value })
      toast.success('Record created successfully')
    }
    await fetchRecords()
    activeTab.value = 'list'
  } catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  } finally {
    saving.value = false
  }
}

async function deleteRecord(id: string) {
  if (!confirm('Are you sure you want to delete this record?')) return
  try {
    const idx = records.value.findIndex(r => r._id === id)
    if (idx !== -1) records.value.splice(idx, 1)
    await $fetch(`/api/project-communication/${id}`, { method: 'DELETE' })
    toast.success('Record deleted')
  } catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
    await fetchRecords()
  }
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">

    <!-- ═════════ LIST VIEW ═════════ -->
    <div v-if="activeTab === 'list'" class="p-6 space-y-6 max-w-7xl mx-auto">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold tracking-tight">Project Communications</h1>
        <Button @click="openCreate">
          <Icon name="i-lucide-plus" class="mr-2 size-4" />
          New Checklist
        </Button>
      </div>

      <div class="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div v-if="loading" class="p-12 flex justify-center text-muted-foreground gap-3 items-center">
          <Icon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" /> Loading...
        </div>
        <div v-else-if="records.length === 0" class="p-24 flex flex-col items-center justify-center text-center">
          <div class="size-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-5">
            <Icon name="i-lucide-clipboard-list" class="size-10 text-primary" />
          </div>
          <h3 class="text-xl font-bold mb-2">No checklists yet</h3>
          <p class="text-sm text-muted-foreground max-w-sm mb-6">Create your first project communication checklist to start tracking field data.</p>
          <Button @click="openCreate" size="lg">
            <Icon name="i-lucide-plus" class="mr-2 size-4" />
            Create First Checklist
          </Button>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead>
              <tr class="bg-muted/40 border-b border-border/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <th class="px-5 py-3">Date</th>
                <th class="px-5 py-3">Lead Technician</th>
                <th class="px-5 py-3">Status</th>
                <th class="px-5 py-3">Wood Type</th>
                <th class="px-5 py-3">Change Order?</th>
                <th class="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/30">
              <tr v-for="r in records" :key="r._id" class="hover:bg-muted/20 transition-colors cursor-pointer" @click="openEdit(r)">
                <td class="px-5 py-3 text-muted-foreground">{{ formatDate(r.createdAt) }}</td>
                <td class="px-5 py-3 font-medium">{{ r.leadTechnicianSupervisorTechnician || '—' }}</td>
                <td class="px-5 py-3">
                  <span class="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border"
                    :class="r.pleaseMarkIfThisProjectIsFullyCompleteOrNot === 'Fully Complete' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            r.pleaseMarkIfThisProjectIsFullyCompleteOrNot ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-muted text-muted-foreground border-border'"
                  >
                    {{ r.pleaseMarkIfThisProjectIsFullyCompleteOrNot || 'Pending' }}
                  </span>
                </td>
                <td class="px-5 py-3">
                  <div class="flex flex-wrap gap-1 max-w-[200px]">
                    <span v-if="!r.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply?.length" class="text-muted-foreground/50">—</span>
                    <span v-for="wood in (r.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply || []).slice(0, 3)" :key="wood" class="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                      {{ wood }}
                    </span>
                    <span v-if="(r.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply || []).length > 3" class="text-[10px] text-muted-foreground">
                      +{{ r.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply.length - 3 }}
                    </span>
                  </div>
                </td>
                <td class="px-5 py-3">{{ r.wasThereAChangeOrderFilledOut || '—' }}</td>
                <td class="px-5 py-3 text-right" @click.stop>
                  <Button variant="ghost" size="sm" class="h-8 px-2" @click="openEdit(r)">
                    <Icon name="i-lucide-pencil" class="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" @click="deleteRecord(r._id)">
                    <Icon name="i-lucide-trash-2" class="size-4" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ═════════ CHECKLIST FORM VIEW ═════════ -->
    <div v-else class="max-w-4xl mx-auto pb-12">

      <!-- ─── Checklist Masthead ─── -->
      <div class="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div class="px-6 py-5 flex items-center gap-5">
          <!-- Progress Ring -->
          <div class="relative size-16 shrink-0">
            <svg class="size-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4" class="text-muted/30" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4"
                class="text-primary transition-all duration-500"
                :stroke-dasharray="`${progressPercent * 1.76} 176`"
                stroke-linecap="round"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-sm font-bold">{{ progressPercent }}%</span>
          </div>

          <!-- Title & Meta -->
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-bold tracking-tight truncate">
              Project Communication Form
              <span class="text-muted-foreground font-normal text-base">({{ records.length + (editingId ? 0 : 1) }})</span>
            </h1>
            <p class="text-sm text-muted-foreground mt-0.5">
              {{ completedFields }}/{{ totalFields }} fields completed
              <span v-if="editingId" class="ml-2 text-xs">· Last updated {{ formatDate((records.find(r => r._id === editingId) as any)?.updatedAt || '') }}</span>
            </p>
          </div>

          <!-- Header Actions -->
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="cancelEdit">
              <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
              Back
            </Button>
            <Button :disabled="saving" size="sm" @click="saveRecord">
              <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
              <Icon v-else name="i-lucide-save" class="mr-1.5 size-3.5" />
              {{ editingId ? 'Save' : 'Submit' }}
            </Button>
          </div>
        </div>

        <!-- Toolbar Row -->
        <div class="px-6 pb-4 flex items-center gap-4">
          <button
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors"
            :class="hideCompleted ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted'"
            @click="hideCompleted = !hideCompleted"
          >
            <span class="size-4 rounded-full flex items-center justify-center" :class="hideCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20'">
              <Icon :name="hideCompleted ? 'i-lucide-check' : 'i-lucide-x'" class="size-2.5" />
            </span>
            Hide Completed Fields
          </button>
        </div>
      </div>

      <!-- ─── Checklist Sections ─── -->
      <div class="px-6 pt-6 space-y-5">
        <TransitionGroup name="checklist" tag="div" class="space-y-5">
          <div
            v-for="section in visibleSections"
            :key="section.id"
            class="relative rounded-xl border bg-card overflow-hidden transition-all duration-300"
            :class="isSectionCompleted(section) ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-border/50'"
          >
            <!-- Section Header -->
            <div class="px-5 py-4 flex items-start gap-4">
              <div
                class="size-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 mt-0.5"
                :class="isSectionCompleted(section) ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-border/60 text-muted-foreground/50'"
              >
                <Icon v-if="isSectionCompleted(section)" name="i-lucide-check" class="size-5" />
                <Icon v-else :name="section.icon" class="size-4" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-base">{{ section.title }}</h3>
                <p class="text-xs text-muted-foreground mt-0.5">{{ section.description }}</p>
              </div>
              <span class="text-[10px] font-bold uppercase tracking-widest shrink-0 px-2 py-1 rounded-full"
                :class="isSectionCompleted(section) ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/60 text-muted-foreground'"
              >
                {{ sectionProgress(section).done }}/{{ sectionProgress(section).total }}
              </span>
            </div>

            <!-- Section Fields -->
            <div class="px-5 pb-5 space-y-5">
              <template v-for="field in section.fields" :key="field.key">
                <div
                  v-if="!hideCompleted || !isFieldCompleted(field)"
                  class="transition-all duration-200"
                >
                  <!-- Field Label -->
                  <div class="flex items-center gap-2 mb-2">
                    <div
                      class="size-5 rounded flex items-center justify-center shrink-0 transition-colors"
                      :class="isFieldCompleted(field) ? 'bg-primary text-primary-foreground' : 'border border-border/60 bg-muted/20'"
                    >
                      <Icon v-if="isFieldCompleted(field)" name="i-lucide-check" class="size-3" />
                    </div>
                    <span class="text-sm font-medium" :class="isFieldCompleted(field) ? 'text-foreground' : 'text-muted-foreground'">
                      {{ field.label }}
                    </span>
                  </div>

                  <!-- Chips (single select) -->
                  <div v-if="field.type === 'chips'" class="flex flex-wrap gap-2 ml-7">
                    <button
                      v-for="opt in field.options"
                      :key="opt"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150"
                      :class="(form as any)[field.key] === opt
                        ? 'bg-primary/10 text-primary border-primary/40 shadow-sm shadow-primary/5'
                        : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:bg-muted/30'"
                      @click="selectChip(field.key, opt)"
                    >
                      <span
                        class="size-3.5 rounded-[3px] border flex items-center justify-center transition-colors"
                        :class="(form as any)[field.key] === opt ? 'bg-primary border-primary text-primary-foreground' : 'border-border/60'"
                      >
                        <Icon v-if="(form as any)[field.key] === opt" name="i-lucide-check" class="size-2" />
                      </span>
                      {{ opt }}
                    </button>
                  </div>

                  <!-- Multi-Chips (multi select) -->
                  <div v-else-if="field.type === 'multi-chips'" class="flex flex-wrap gap-2 ml-7">
                    <button
                      v-for="opt in field.options"
                      :key="opt"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150"
                      :class="((form as any)[field.key] as string[]).includes(opt)
                        ? 'bg-primary/10 text-primary border-primary/40 shadow-sm shadow-primary/5'
                        : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:bg-muted/30'"
                      @click="toggleMultiChip(field.key, opt)"
                    >
                      <span
                        class="size-3.5 rounded-[3px] border flex items-center justify-center transition-colors"
                        :class="((form as any)[field.key] as string[]).includes(opt) ? 'bg-primary border-primary text-primary-foreground' : 'border-border/60'"
                      >
                        <Icon v-if="((form as any)[field.key] as string[]).includes(opt)" name="i-lucide-check" class="size-2" />
                      </span>
                      {{ opt }}
                    </button>
                  </div>

                  <!-- Text Input -->
                  <div v-else-if="field.type === 'input'" class="ml-7">
                    <Input
                      v-model="(form as any)[field.key]"
                      placeholder="Add Response..."
                      class="bg-background/50"
                    />
                  </div>

                  <!-- Textarea -->
                  <div v-else-if="field.type === 'textarea'" class="ml-7">
                    <Textarea
                      v-model="(form as any)[field.key]"
                      placeholder="Add Response..."
                      rows="3"
                      class="bg-background/50 resize-none"
                    />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </TransitionGroup>

        <!-- ─── Bottom Submit Bar ─── -->
        <div class="rounded-xl border border-border/50 bg-card p-5 flex items-center justify-between mt-6">
          <div class="flex items-center gap-3">
            <div
              class="size-10 rounded-full flex items-center justify-center"
              :class="progressPercent === 100 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted/60 text-muted-foreground'"
            >
              <Icon :name="progressPercent === 100 ? 'i-lucide-check-circle-2' : 'i-lucide-circle-dashed'" class="size-5" />
            </div>
            <div>
              <p class="text-sm font-semibold">
                {{ progressPercent === 100 ? 'All fields completed!' : `${completedFields} of ${totalFields} fields filled` }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ progressPercent === 100 ? 'Ready to submit this checklist.' : 'Fill in remaining fields to complete the checklist.' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <Button variant="outline" @click="cancelEdit">Cancel</Button>
            <Button :disabled="saving" @click="saveRecord">
              <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
              {{ editingId ? 'Save Changes' : 'Submit Checklist' }}
            </Button>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<style scoped>
.checklist-enter-active,
.checklist-leave-active {
  transition: all 0.3s ease;
}
.checklist-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.checklist-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
