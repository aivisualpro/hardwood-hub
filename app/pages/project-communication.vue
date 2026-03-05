<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Project Communication', icon: 'i-lucide-message-square', description: 'Manage and Track Field Project Communications' })

// ─── Setup ─────────────────────────────────────────────
const activeTab = ref('list') // 'list' or 'form'
const records = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)

const editingId = ref<string | null>(null)

const emptyForm = () => ({
  leadTechnicianSupervisorTechnician: '',
  pleaseMarkIfThisProjectIsFullyCompleteOrNot: '',
  leaveAnyNotesAboutThingsThatStillNeedToBeDoneForFutureCrews: '',
  whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply: [] as string[],
  gradeOfFlooring: '',
  widthOfFlooring: '',
  cutOfFlooring: '',
  fidBox: '',
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

// Custom Options
const woodTypes = ['Solid', 'Engineered', 'LVP', 'Laminate', 'Tile', 'Other']
const yesNoOptions = ['Yes', 'No']
const completionOptions = ['Fully Complete', 'Partially Complete', 'Not Started']

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
    if(idx !== -1) records.value.splice(idx, 1)
      
    await $fetch(`/api/project-communication/${id}`, { method: 'DELETE' })
    toast.success('Record deleted')
  } catch(e: any) {
     toast.error('Delete failed', { description: e?.message })
     await fetchRecords()
  }
}

function toggleWoodType(type: string) {
   const arr = form.value.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply
   if (arr.includes(type)) {
      form.value.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply = arr.filter(t => t !== type)
   } else {
      arr.push(type)
   }
}

function formatDate(d: string) {
   if (!d) return '—'
   return new Date(d).toLocaleDateString()
}
</script>

<template>
  <div class="p-6 space-y-6 max-w-7xl mx-auto h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <!-- Header Controls -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">Project Communications</h1>
      <Button v-if="activeTab === 'list'" @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-2 size-4" />
        New Entry
      </Button>
      <Button v-else variant="outline" @click="cancelEdit">
        <Icon name="i-lucide-arrow-left" class="mr-2 size-4" />
        Back to List
      </Button>
    </div>

    <!-- ═════════ LIST VIEW ═════════ -->
    <div v-if="activeTab === 'list'" class="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <div v-if="loading" class="p-12 flex justify-center text-muted-foreground gap-3 items-center">
         <Icon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" /> Loading...
      </div>
      <div v-else-if="records.length === 0" class="p-24 flex flex-col items-center justify-center text-center">
        <div class="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Icon name="i-lucide-file-spreadsheet" class="size-8 text-primary" />
        </div>
        <h3 class="text-lg font-semibold mb-1">No communications recorded yet</h3>
        <p class="text-sm text-muted-foreground max-w-sm mb-6">Create the first project communication log to view it here.</p>
        <Button @click="openCreate">Create First Entry</Button>
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
            <tr v-for="r in records" :key="r._id" class="hover:bg-muted/20 transition-colors">
              <td class="px-5 py-3">{{ formatDate(r.createdAt) }}</td>
              <td class="px-5 py-3 font-medium">{{ r.leadTechnicianSupervisorTechnician || '—' }}</td>
              <td class="px-5 py-3">
                 <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    :class="r.pleaseMarkIfThisProjectIsFullyCompleteOrNot === 'Fully Complete' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                            r.pleaseMarkIfThisProjectIsFullyCompleteOrNot ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-muted text-muted-foreground border-border'"
                 >
                    {{ r.pleaseMarkIfThisProjectIsFullyCompleteOrNot || 'Pending' }}
                 </span>
              </td>
              <td class="px-5 py-3">
                 <div class="flex flex-wrap gap-1 max-w-[150px] overflow-hidden">
                    <span v-if="!r.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply?.length" class="text-muted-foreground/50">—</span>
                    <span v-for="wood in r.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply" :key="wood" class="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                       {{ wood }}
                    </span>
                 </div>
              </td>
              <td class="px-5 py-3">
                 {{ r.wasThereAChangeOrderFilledOut || '—' }}
              </td>
              <td class="px-5 py-3 text-right">
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

    <!-- ═════════ FORM VIEW ═════════ -->
    <div v-else class="rounded-xl border border-border/50 bg-card shadow-sm p-6 overflow-hidden">
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        
        <!-- General Info -->
        <div class="col-span-1 md:col-span-2 space-y-4">
           <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-4">General Details</h3>
           <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div class="space-y-1.5">
               <Label>Lead Technician / Supervisor</Label>
               <Input v-model="form.leadTechnicianSupervisorTechnician" placeholder="Name" />
             </div>
             <div class="space-y-1.5">
               <Label>Is Project Fully Complete?</Label>
               <Select v-model="form.pleaseMarkIfThisProjectIsFullyCompleteOrNot">
                 <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem v-for="opt in completionOptions" :key="opt" :value="opt">{{ opt }}</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>
        </div>

        <div class="col-span-1 md:col-span-2 space-y-1.5">
          <Label>Notes for Future Crews (Things still needed)</Label>
          <Textarea v-model="form.leaveAnyNotesAboutThingsThatStillNeedToBeDoneForFutureCrews" rows="3" placeholder="Enter notes..." />
        </div>

        <!-- Wood Details -->
        <div class="col-span-1 md:col-span-2 space-y-4 mt-4">
           <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-4">Flooring & Material Specs</h3>
           
           <div class="space-y-2 mb-4">
             <Label>Wood Flooring Type Used (Multi-select)</Label>
             <div class="flex flex-wrap gap-2">
                <button 
                  v-for="opt in woodTypes" 
                  :key="opt" 
                  class="px-3 py-1.5 rounded-md border text-sm font-medium transition-colors"
                  :class="form.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply.includes(opt) ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border/60 hover:border-primary/50'"
                  @click="toggleWoodType(opt)"
                >
                   {{ opt }}
                   <Icon v-if="form.whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply.includes(opt)" name="i-lucide-check" class="inline-block ml-1 size-3" />
                </button>
             </div>
           </div>

           <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div class="space-y-1.5"><Label>Grade</Label><Input v-model="form.gradeOfFlooring" /></div>
             <div class="space-y-1.5"><Label>Width</Label><Input v-model="form.widthOfFlooring" /></div>
             <div class="space-y-1.5"><Label>Cut</Label><Input v-model="form.cutOfFlooring" /></div>
             <div class="space-y-1.5"><Label>FID Box</Label><Input v-model="form.fidBox" /></div>
           </div>
        </div>

        <!-- Finishes -->
        <div class="col-span-1 md:col-span-2 space-y-4 mt-4">
           <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-4">Stain & Finishes</h3>
           <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             <div class="space-y-1.5"><Label>Stain</Label><Input v-model="form.stain" /></div>
             <div class="space-y-1.5"><Label>Mix Colors/Ratio</Label><Input v-model="form.ifMixWhatColorsAndRatio" /></div>
             <div class="space-y-1.5"><Label>Sealer</Label><Input v-model="form.whatSealerWasUsed" /></div>
             
             <div class="space-y-1.5"><Label>First Coat Finish</Label><Input v-model="form.whatWasTheFirstCoatOfFinish" /></div>
             <div class="space-y-1.5"><Label>Final Coat Finish</Label><Input v-model="form.whatWasTheFinalCoatOfFinish" /></div>
             <div class="space-y-1.5"><Label>Sheen</Label><Input v-model="form.whatSheen" /></div>
             
             <div class="space-y-1.5 col-span-1 lg:col-span-3"><Label>Additives to Finish</Label><Input v-model="form.whatAdditivesToFinish" /></div>
           </div>
        </div>

        <!-- Task Tracking -->
        <div class="col-span-1 md:col-span-2 space-y-4 mt-4">
           <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-4">Task & Change order tracking</h3>
           
           <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
             <div class="space-y-1.5">
               <Label>All QC Tasks Complete?</Label>
               <Select v-model="form.allTasksAssignedToProjectLeadFromQcAreCompleted">
                 <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                 <SelectContent><SelectItem v-for="opt in yesNoOptions" :key="opt" :value="opt">{{ opt }}</SelectItem></SelectContent>
               </Select>
             </div>
             <div class="space-y-1.5">
               <Label>If No, what needs to be done?</Label>
               <Textarea v-model="form.ifNoWhatNeedsToBeDone" rows="2" />
             </div>

             <div class="space-y-1.5">
               <Label>Change Order Filled Out?</Label>
               <Select v-model="form.wasThereAChangeOrderFilledOut">
                 <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                 <SelectContent><SelectItem v-for="opt in yesNoOptions" :key="opt" :value="opt">{{ opt }}</SelectItem></SelectContent>
               </Select>
             </div>
             <div class="space-y-1.5">
               <Label>Any Work Added?</Label>
               <Input v-model="form.wasThereAnyWorkAdded" />
             </div>

             <div class="space-y-1.5 col-span-1 sm:col-span-2">
               <Label>Work Not Completed (Remove from Invoice)</Label>
               <Input v-model="form.wasThereAnyWorkNotCompletedThatShouldBeRemovedFromTheInvoice" />
             </div>
             
             <div class="space-y-1.5 col-span-1 sm:col-span-2">
               <Label>List Work Removed/Added (Billing Details)</Label>
               <Textarea v-model="form.listAnyWorkRemovedOrAddedPleaseGiveAsMuchDetailAsPossibleForBilling" rows="3" />
             </div>
           </div>
        </div>

        <!-- Project Review -->
        <div class="col-span-1 md:col-span-2 space-y-4 mt-4">
           <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-4">Project Review</h3>
           
           <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             <div class="space-y-1.5">
               <Label>Team Performance Rating</Label>
               <Input v-model="form.howWouldYouRateYourTeamsPerformanceOnThisProject" placeholder="Ex: 5/5, Excellent..." />
             </div>
             <div class="space-y-1.5">
               <Label>Client Interaction Rating</Label>
               <Input v-model="form.howWouldYouRateYourInteractionsWithTheClient" />
             </div>
             <div class="space-y-1.5">
               <Label>Final Pictures Taken?</Label>
               <Select v-model="form.didYouTakeFinalPictures">
                 <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                 <SelectContent><SelectItem v-for="opt in yesNoOptions" :key="opt" :value="opt">{{ opt }}</SelectItem></SelectContent>
               </Select>
             </div>
             <div class="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-3">
               <Label>Any Other Notes</Label>
               <Textarea v-model="form.anyOtherNotesAboutThisProject" rows="2" />
             </div>
           </div>
        </div>

      </div>

      <div class="mt-8 pt-6 border-t border-border/60 flex items-center justify-end gap-3">
        <Button variant="outline" type="button" @click="cancelEdit">Cancel</Button>
        <Button :disabled="saving" @click="saveRecord">
           <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
           {{ editingId ? 'Save Changes' : 'Submit Communication' }}
        </Button>
      </div>
    </div>

  </div>
</template>
