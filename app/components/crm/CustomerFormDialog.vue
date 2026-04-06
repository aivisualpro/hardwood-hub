<script setup lang="ts">
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
  email: '',
  phone: '',
  type: 'lead',
  status: 'new',
  address: '',
  city: '',
  state: '',
  zip: '',
})

const isLoading = ref(false)

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.customer) {
      form.value = { 
        name: props.customer.name || `${props.customer.firstName || ''} ${props.customer.lastName || ''}`.trim(),
        email: props.customer.email || '',
        phone: props.customer.phone || '',
        type: props.customer.type || 'lead',
        status: props.customer.status || 'new',
        address: props.customer.address || '',
        city: props.customer.city || '',
        state: props.customer.state || '',
        zip: props.customer.zip || '',
      }
    } else {
      form.value = {
        name: '',
        email: '',
        phone: '',
        type: 'lead',
        status: 'new',
        address: '',
        city: '',
        state: '',
        zip: '',
      }
    }
  }
})

async function submit() {
  if (!form.value.name.trim()) {
    return
  }
  
  isLoading.value = true
  try {
    const url = props.customer ? `/api/customers/${props.customer._id}` : '/api/customers'
    const method = props.customer ? 'PUT' : 'POST'
    
    // Attempt to merge name into firstName/lastName for backwards compatibility if needed
    const nameParts = form.value.name.split(' ')
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ')

    const payload = {
      ...form.value,
      firstName,
      lastName
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
      
      <form @submit.prevent="submit" class="space-y-4 py-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2 col-span-2">
            <Label>Name / Company</Label>
            <Input v-model="form.name" placeholder="John Doe or Acme Corp" required />
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
