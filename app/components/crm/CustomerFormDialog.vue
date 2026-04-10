<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{
  modelValue: boolean
  customer?: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', customer: any): void
}>()

const form = ref({
  name: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  type: 'lead',
  status: 'new',
  address: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
  stage: '',
  estimatedProjectDuration: '',
  totalEstimate: undefined as number | undefined,
  assignedTo: '',
  totalTrackedViews: 0,
  estimateSentOn: '',
  initialContactDate: '',
  lastFollowUpSentOn: '',
  dateApproved: '',
  projectAssignedTo: '',
  woodOrderDate: '',
  tags: '',
})

const isLoading = ref(false)

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.customer) {
      form.value = { 
        name: props.customer.name || '',
        firstName: props.customer.firstName || '',
        lastName: props.customer.lastName || '',
        email: props.customer.email || '',
        phone: props.customer.phone || '',
        type: props.customer.type || 'lead',
        status: props.customer.status || 'new',
        address: props.customer.address || '',
        city: props.customer.city || '',
        state: props.customer.state || '',
        zip: props.customer.zip || '',
        notes: props.customer.notes || '',
        stage: props.customer.stage || '',
        estimatedProjectDuration: props.customer.estimatedProjectDuration || '',
        totalEstimate: props.customer.totalEstimate || undefined,
        assignedTo: props.customer.assignedTo || '',
        totalTrackedViews: props.customer.totalTrackedViews || 0,
        estimateSentOn: props.customer.estimateSentOn ? (new Date(props.customer.estimateSentOn).toISOString().split('T')[0] || '') : '',
        initialContactDate: props.customer.initialContactDate ? (new Date(props.customer.initialContactDate).toISOString().split('T')[0] || '') : '',
        lastFollowUpSentOn: props.customer.lastFollowUpSentOn ? (new Date(props.customer.lastFollowUpSentOn).toISOString().split('T')[0] || '') : '',
        dateApproved: props.customer.dateApproved ? (new Date(props.customer.dateApproved).toISOString().split('T')[0] || '') : '',
        projectAssignedTo: props.customer.projectAssignedTo || '',
        woodOrderDate: props.customer.woodOrderDate ? (new Date(props.customer.woodOrderDate).toISOString().split('T')[0] || '') : '',
        tags: (props.customer.tags || []).join(', '),
      }
    } else {
      form.value = {
        name: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        type: 'lead',
        status: 'new',
        address: '',
        city: '',
        state: '',
        zip: '',
        notes: '',
        stage: '',
        estimatedProjectDuration: '',
        totalEstimate: undefined,
        assignedTo: '',
        totalTrackedViews: 0,
        estimateSentOn: '',
        initialContactDate: '',
        lastFollowUpSentOn: '',
        dateApproved: '',
        projectAssignedTo: '',
        woodOrderDate: '',
        tags: '',
      }
    }
  }
})

async function submit() {
  if (!form.value.firstName.trim() && !form.value.name.trim()) {
    toast?.error?.('Please enter a First Name or Company Name')
    return
  }
  
  isLoading.value = true
  try {
    const url = props.customer ? `/api/customers/${props.customer._id}` : '/api/customers'
    const method = props.customer ? 'PUT' : 'POST'
    
    const nameParts = form.value.name ? form.value.name.split(' ') : []
    const fallbackFirstName = nameParts[0] || ''
    const fallbackLastName = nameParts.slice(1).join(' ') || ''

    const payload = {
      ...form.value,
      firstName: form.value.firstName || fallbackFirstName,
      lastName: form.value.lastName || fallbackLastName,
      tags: form.value.tags ? form.value.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      estimateSentOn: form.value.estimateSentOn || null,
      initialContactDate: form.value.initialContactDate || null,
      lastFollowUpSentOn: form.value.lastFollowUpSentOn || null,
      dateApproved: form.value.dateApproved || null,
      woodOrderDate: form.value.woodOrderDate || null,
      totalEstimate: form.value.totalEstimate ? Number(form.value.totalEstimate) : null,
      totalTrackedViews: form.value.totalTrackedViews ? Number(form.value.totalTrackedViews) : 0,
    }
    
    if (!payload.name) {
      payload.name = `${payload.firstName} ${payload.lastName}`.trim()
    }
    
    const res = await $fetch<any>(url, {
      method,
      body: payload
    })
    
    if (res.success) {
      emit('saved', res.data)
      emit('update:modelValue', false)
    }
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ customer ? 'Edit Customer' : 'New Customer' }}</DialogTitle>
        <DialogDescription>
          {{ customer ? 'Update the details for this customer below.' : 'Fill in the details below to create a new customer.' }}
        </DialogDescription>
      </DialogHeader>
      
      <form @submit.prevent="submit" class="space-y-4 py-4 max-h-[75vh] overflow-y-auto px-2">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2 col-span-2">
            <Label>Company / Display Name</Label>
            <Input v-model="form.name" placeholder="Acme Corp" />
          </div>
          
          <div class="space-y-2">
            <Label>First Name <span class="text-destructive">*</span></Label>
            <Input v-model="form.firstName" placeholder="John" required />
          </div>
          
          <div class="space-y-2">
            <Label>Last Name</Label>
            <Input v-model="form.lastName" placeholder="Doe" />
          </div>

          <div class="space-y-2">
            <Label>Email</Label>
            <Input v-model="form.email" type="email" placeholder="john@example.com" />
          </div>
          
          <div class="space-y-2">
            <Label>Phone</Label>
            <Input v-model="form.phone" placeholder="(555) 555-5555" />
          </div>
          
          <div class="space-y-2">
            <Label>Type</Label>
            <Select v-model="form.type">
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div class="space-y-2">
            <Label>Status</Label>
            <Select v-model="form.status">
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Stage</Label>
            <Input v-model="form.stage" placeholder="e.g. Negotiation" />
          </div>
          
          <div class="space-y-2">
            <Label>Assigned To</Label>
            <Input v-model="form.assignedTo" placeholder="Sales Rep" />
          </div>

          <div class="space-y-2">
            <Label>Project Assigned To</Label>
            <Input v-model="form.projectAssignedTo" placeholder="Project Manager" />
          </div>
          
          <div class="space-y-2">
            <Label>Estim. Project Duration</Label>
            <Input v-model="form.estimatedProjectDuration" placeholder="e.g. 3 weeks" />
          </div>
          
          <div class="space-y-2">
            <Label>Total Estimate ($)</Label>
            <Input v-model="form.totalEstimate" type="number" step="0.01" placeholder="10000" />
          </div>
          
          <div class="space-y-2">
            <Label>Total Tracked Views</Label>
            <Input v-model="form.totalTrackedViews" type="number" placeholder="0" />
          </div>

          <div class="space-y-2">
            <Label>Initial Contact Date</Label>
            <Input v-model="form.initialContactDate" type="date" />
          </div>
          
          <div class="space-y-2">
            <Label>Last Follow Up Date</Label>
            <Input v-model="form.lastFollowUpSentOn" type="date" />
          </div>
          
          <div class="space-y-2">
            <Label>Estimate Sent On</Label>
            <Input v-model="form.estimateSentOn" type="date" />
          </div>
          
          <div class="space-y-2">
            <Label>Date Approved</Label>
            <Input v-model="form.dateApproved" type="date" />
          </div>
          
          <div class="space-y-2">
            <Label>Wood Order Date</Label>
            <Input v-model="form.woodOrderDate" type="date" />
          </div>

          <div class="space-y-2 col-span-2">
            <Label>Tags (comma separated)</Label>
            <Input v-model="form.tags" placeholder="VIP, Flooring, Urgent" />
          </div>
          
          <div class="space-y-2 col-span-2">
            <Label>Address</Label>
            <Input v-model="form.address" placeholder="123 Main St" />
          </div>
          
          <div class="space-y-2">
            <Label>City</Label>
            <Input v-model="form.city" placeholder="Anytown" />
          </div>
          
          <div class="grid grid-cols-2 gap-2 space-y-0">
            <div class="space-y-2">
              <Label>State</Label>
              <Input v-model="form.state" placeholder="NY" />
            </div>
            <div class="space-y-2">
              <Label>ZIP</Label>
              <Input v-model="form.zip" placeholder="10001" />
            </div>
          </div>
          
          <div class="space-y-2 col-span-2">
            <Label>Notes</Label>
            <Textarea v-model="form.notes" placeholder="Additional details..." rows="3" />
          </div>
        </div>
        
        <DialogFooter class="mt-4">
          <button type="button" class="px-4 py-2 text-sm font-medium border rounded-md" @click="emit('update:modelValue', false)">Cancel</button>
          <button type="submit" :disabled="isLoading" class="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md disabled:opacity-50">
            {{ isLoading ? 'Saving...' : 'Save' }}
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
