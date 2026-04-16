<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'

const props = defineProps<{
  customer: any
}>()

const emit = defineEmits(['updated'])

const customerId = computed(() => props.customer?._id)
const relatedContactsList = computed(() => (props.customer?.relatedContacts || []) as any[])

const isEditing = ref(false)
const editingIndex = ref<number | null>(null)
const isLoading = ref(false)

const form = ref({
  firstName: '',
  lastName: '',
  title: '',
  emails: [''],
  phones: [''],
  preferredContact: 'Email',
  address: ''
})

const PREFERRED_CONTACT_OPTIONS = ['Email', 'Phone', 'SMS']

function resetForm() {
  form.value = {
    firstName: '',
    lastName: '',
    title: '',
    emails: [''],
    phones: [''],
    preferredContact: 'Email',
    address: ''
  }
}

function openAdd() {
  resetForm()
  editingIndex.value = null
  isEditing.value = true
}

function openEdit(index: number, contact: any) {
  form.value = {
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    title: contact.title || '',
    emails: contact.emails?.length ? [...contact.emails] : [''],
    phones: contact.phones?.length ? [...contact.phones] : [''],
    preferredContact: contact.preferredContact || 'Email',
    address: contact.address || ''
  }
  editingIndex.value = index
  isEditing.value = true
}

function addEmail() {
  form.value.emails.push('')
}

function removeEmail(index: number) {
  if (form.value.emails.length > 1) {
    form.value.emails.splice(index, 1)
  } else {
    form.value.emails[0] = ''
  }
}

function addPhone() {
  form.value.phones.push('')
}

function removePhone(index: number) {
  if (form.value.phones.length > 1) {
    form.value.phones.splice(index, 1)
  } else {
    form.value.phones[0] = ''
  }
}

// Phone format: (xxx) xxx-xxxx
function formatPhone(val: string): string {
  if (!val) return ''
  const x = val.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
  if (!x) return val
  return !x[2] ? (x[1] || '') : `(${x[1] || ''}) ${x[2] || ''}` + (x[3] ? `-${x[3]}` : '')
}

function onPhoneInput(index: number, event: any) {
  form.value.phones[index] = formatPhone(event?.target?.value || '')
}

async function saveContact() {
  if (!props.customer) return
  isLoading.value = true
  try {
    const updatedContacts = props.customer.relatedContacts ? [...props.customer.relatedContacts] : []
    
    // Clean up empty emails and phones
    const cleanedContact = {
      ...form.value,
      emails: form.value.emails.filter(e => e.trim() !== ''),
      phones: form.value.phones.filter(p => p.trim() !== '')
    }
    
    if (editingIndex.value !== null) {
      updatedContacts[editingIndex.value] = cleanedContact
    } else {
      updatedContacts.push(cleanedContact)
    }

    const res = await $fetch<any>(`/api/customers/${customerId.value}`, {
      method: 'PUT',
      body: { relatedContacts: updatedContacts }
    })
    
    if (res.success) {
      toast.success(editingIndex.value !== null ? 'Contact updated' : 'Contact added')
      emit('updated', res.data)
      isEditing.value = false
    } else {
      toast.error('Failed to save contact')
    }
  } catch (err) {
    toast.error('Error saving contact')
  } finally {
    isLoading.value = false
  }
}

async function deleteContact(index: number) {
  if (!confirm('Are you sure you want to delete this contact?')) return
  isLoading.value = true
  try {
    const updatedContacts = props.customer.relatedContacts ? [...props.customer.relatedContacts] : []
    updatedContacts.splice(index, 1)

    const res = await $fetch<any>(`/api/customers/${customerId.value}`, {
      method: 'PUT',
      body: { relatedContacts: updatedContacts }
    })

    if (res.success) {
      toast.success('Contact deleted')
      emit('updated', res.data)
    } else {
      toast.error('Failed to delete contact')
    }
  } catch (err) {
    toast.error('Error deleting contact')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="bg-card p-6 rounded-xl border border-border/50 shadow-sm shadow-black/5 flex flex-col h-full space-y-6">
    <div class="flex items-center justify-between">
      <h3 class="font-bold text-lg flex items-center gap-2">
        <Icon name="i-lucide-users" class="size-5 text-primary" />
        Related Contacts
      </h3>
      <button v-if="!isEditing" @click="openAdd" class="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-bold">
        <Icon name="i-lucide-plus" class="size-4" />
        Add Contact
      </button>
    </div>

    <div v-if="isEditing" class="bg-muted/30 border border-border/50 rounded-xl p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">First Name</label>
          <input v-model="form.firstName" type="text" class="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="John" />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Name</label>
          <input v-model="form.lastName" type="text" class="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Doe" />
        </div>
      </div>
      
      <div class="space-y-1.5">
        <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</label>
        <input v-model="form.title" type="text" class="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="e.g. Property Manager" />
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          Emails
          <button @click="addEmail" type="button" class="text-[10px] text-primary hover:underline flex items-center gap-1">
            <Icon name="i-lucide-plus" class="size-3" /> Add Email
          </button>
        </label>
        <div v-for="(email, i) in form.emails" :key="i" class="flex items-center gap-2 mb-2">
          <input v-model="form.emails[i]" type="email" class="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="email@example.com" />
          <button @click="removeEmail(i)" type="button" class="shrink-0 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
            <Icon name="i-lucide-trash-2" class="size-4" />
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          Phones
          <button @click="addPhone" type="button" class="text-[10px] text-primary hover:underline flex items-center gap-1">
            <Icon name="i-lucide-plus" class="size-3" /> Add Phone
          </button>
        </label>
        <div v-for="(phone, i) in form.phones" :key="i" class="flex items-center gap-2 mb-2">
          <input :value="form.phones[i]" @input="onPhoneInput(i, $event)" type="text" class="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="(xxx) xxx-xxxx" />
          <button @click="removePhone(i)" type="button" class="shrink-0 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
            <Icon name="i-lucide-trash-2" class="size-4" />
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preferred Contact</label>
        <div class="flex flex-wrap gap-2">
          <button 
            v-for="option in PREFERRED_CONTACT_OPTIONS" 
            :key="option" 
            type="button"
            @click="form.preferredContact = option"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            :class="form.preferredContact === option ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'bg-background border border-input text-muted-foreground hover:text-foreground hover:border-border'"
          >
            {{ option }}
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address</label>
        <textarea v-model="form.address" rows="2" class="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none" placeholder="123 Main St..."></textarea>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button @click="isEditing = false" type="button" class="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors" :disabled="isLoading">Cancel</button>
        <button @click="saveContact" type="button" class="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2" :disabled="isLoading">
          <Icon v-if="isLoading" name="i-lucide-loader-2" class="size-4 animate-spin" />
          {{ editingIndex !== null ? 'Save Changes' : 'Add Contact' }}
        </button>
      </div>
    </div>

    <!-- Contacts List -->
    <div v-else-if="relatedContactsList.length > 0" class="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
      <div v-for="(contact, idx) in relatedContactsList" :key="idx" class="group relative bg-muted/20 border border-border/50 rounded-xl p-4 hover:border-primary/30 transition-all overflow-hidden">
        
        <div class="flex items-start justify-between mb-3">
          <div>
            <h4 class="font-bold text-foreground text-base capitalize flex items-center gap-2">
              {{ contact.firstName }} {{ contact.lastName }}
              <span v-if="contact.title" class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] uppercase tracking-wider font-bold shrink-0">{{ contact.title }}</span>
            </h4>
          </div>
          <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity top-2 right-2 absolute bg-card/80 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-border/50">
            <button @click="openEdit(idx, contact)" class="p-1.5 text-muted-foreground hover:text-primary rounded-md transition-colors" title="Edit">
              <Icon name="i-lucide-pencil" class="size-3.5" />
            </button>
            <button @click="deleteContact(idx)" class="p-1.5 text-muted-foreground hover:text-destructive rounded-md transition-colors" title="Delete">
              <Icon name="i-lucide-trash-2" class="size-3.5" />
            </button>
          </div>
        </div>

        <div class="space-y-2 text-sm text-muted-foreground">
          <div v-if="contact.emails?.length" class="flex items-start gap-2">
            <Icon name="i-lucide-mail" class="size-4 mt-0.5 shrink-0" :class="contact.preferredContact === 'Email' ? 'text-primary' : ''" />
            <div class="flex flex-col">
              <a v-for="email in contact.emails" :key="email" :href="`mailto:${email}`" class="hover:text-primary transition-colors hover:underline">{{ email }}</a>
            </div>
            <span v-if="contact.preferredContact === 'Email'" class="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase ml-1 h-fit">Preferred</span>
          </div>

          <div v-if="contact.phones?.length" class="flex items-start gap-2">
            <Icon name="i-lucide-phone" class="size-4 mt-0.5 shrink-0" :class="contact.preferredContact === 'Phone' ? 'text-primary' : ''" />
            <div class="flex flex-col">
              <a v-for="phone in contact.phones" :key="phone" :href="`tel:${phone}`" class="hover:text-primary transition-colors hover:underline">{{ phone }}</a>
            </div>
            <span v-if="contact.preferredContact === 'Phone'" class="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase ml-1 h-fit">Preferred</span>
          </div>

          <div v-if="contact.preferredContact === 'SMS'" class="flex items-center gap-2">
            <Icon name="i-lucide-message-square" class="size-4 shrink-0 text-primary" />
            <span class="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">Preferred: SMS</span>
          </div>

          <div v-if="contact.address" class="flex items-start gap-2 pt-1 mt-1 border-t border-border/40">
            <Icon name="i-lucide-map-pin" class="size-4 mt-0.5 shrink-0" />
            <span class="whitespace-pre-wrap">{{ contact.address }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex-1 flex flex-col items-center justify-center text-center py-8">
      <div class="size-12 rounded-full border border-dashed border-border/60 bg-muted/30 flex items-center justify-center mb-4 text-muted-foreground">
        <Icon name="i-lucide-users" class="size-6" />
      </div>
      <p class="font-bold text-base mb-1">No related contacts</p>
      <p class="text-xs text-muted-foreground mb-4 max-w-[200px]">Add associated contacts like property managers or assistants here.</p>
      <button @click="openAdd" class="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all text-sm font-bold">
        <Icon name="i-lucide-plus" class="size-4" />
        Add First Contact
      </button>
    </div>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-muted-foreground) 30%, transparent);
  border-radius: 9999px;
  transition: background-color 0.15s;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-primary) 50%, transparent);
}
</style>
