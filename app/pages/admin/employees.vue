<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Employees', icon: 'i-lucide-users', description: 'Manage your team members' })

function notify(title: string, description: string, variant?: string) {
  if (variant === 'destructive') toast.error(title, { description })
  else toast.success(title, { description })
}

interface Employee {
  _id: string
  employee: string
  email: string
  position: string
  profileImage: string
  createdAt?: string
}

// ─── State ───────────────────────────────────────────────
const employees = ref<Employee[]>([])
const loading = ref(false)
const saving = ref(false)
const uploadingImage = ref(false)
const searchQuery = ref('')
const showModal = ref(false)
const isEditing = ref(false)
const deleteTarget = ref<Employee | null>(null)
const showDeleteDialog = ref(false)

const emptyForm = () => ({
  employee: '',
  email: '',
  position: '',
  profileImage: '',
})

const form = ref(emptyForm())
const editId = ref<string | null>(null)
const previewUrl = ref('')

// ─── Computed ─────────────────────────────────────────────
const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  const list = q
    ? employees.value.filter(e =>
      e.employee.toLowerCase().includes(q)
      || e.email.toLowerCase().includes(q)
      || e.position.toLowerCase().includes(q),
    )
    : employees.value
  return [...list].sort((a, b) => a.employee.localeCompare(b.employee))
})

// ─── Fetch ────────────────────────────────────────────────
async function fetchEmployees() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: Employee[] }>('/api/employees')
    employees.value = res.data
  }
  catch (e: any) {
    notify('Error', e?.message || 'Failed to load employees', 'destructive')
  }
  finally { loading.value = false }
}

onMounted(fetchEmployees)

// ─── Image Upload (→ Cloudinary via server) ───────────────
async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  // Show preview immediately (in-memory only, never stored as base64)
  previewUrl.value = URL.createObjectURL(file)
  uploadingImage.value = true

  try {
    // Convert to base64 just for transport, server uploads to Cloudinary
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = async () => {
      const base64 = reader.result as string
      const res = await $fetch<{ success: boolean, url: string }>('/api/upload/cloudinary', {
        method: 'POST',
        body: { file: base64 },
      })
      form.value.profileImage = res.url // store only the Cloudinary URL
      uploadingImage.value = false
    }
    reader.onerror = () => {
      uploadingImage.value = false
      notify('Error', 'Failed to read file', 'destructive')
    }
  }
  catch (e: any) {
    uploadingImage.value = false
    notify('Upload failed', e?.message, 'destructive')
  }
}

// ─── Open Modal ───────────────────────────────────────────
function openCreate() {
  form.value = emptyForm()
  editId.value = null
  previewUrl.value = ''
  isEditing.value = false
  showModal.value = true
}

function openEdit(emp: Employee) {
  form.value = { employee: emp.employee, email: emp.email, position: emp.position, profileImage: emp.profileImage }
  editId.value = emp._id
  previewUrl.value = emp.profileImage
  isEditing.value = true
  showModal.value = true
}

// ─── Save ─────────────────────────────────────────────────
async function saveEmployee() {
  if (!form.value.employee || !form.value.email || !form.value.position) {
    notify('Validation', 'Name, email and position are required', 'destructive')
    return
  }

  saving.value = true
  try {
    if (isEditing.value && editId.value) {
      await $fetch(`/api/employees/${editId.value}`, { method: 'PUT', body: form.value })
      notify('Updated', `${form.value.employee} updated successfully`)
    }
    else {
      await $fetch('/api/employees', { method: 'POST', body: form.value })
      notify('Created', `${form.value.employee} added to the team`)
    }
    showModal.value = false
    await fetchEmployees()
  }
  catch (e: any) {
    notify('Save failed', e?.message, 'destructive')
  }
  finally { saving.value = false }
}

// ─── Delete ───────────────────────────────────────────────
function confirmDelete(emp: Employee) {
  deleteTarget.value = emp
  showDeleteDialog.value = true
}

async function deleteEmployee() {
  if (!deleteTarget.value) return
  try {
    await $fetch(`/api/employees/${deleteTarget.value._id}`, { method: 'DELETE' })
    notify('Deleted', `${deleteTarget.value.employee} removed`)
    showDeleteDialog.value = false
    await fetchEmployees()
  }
  catch (e: any) {
    notify('Delete failed', e?.message, 'destructive')
  }
}


</script>

<template>
  <div class="w-full flex flex-col gap-6">

    <!-- Header bar -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div class="relative flex-1 max-w-sm">
        <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
        <Input v-model="searchQuery" placeholder="Search employees…" class="pl-9" />
      </div>
      <Button @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-2 size-4" />
        Add Employee
      </Button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="i in 8" :key="i" class="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
        <div class="size-16 rounded-full bg-muted mx-auto" />
        <div class="h-4 bg-muted rounded w-3/4 mx-auto" />
        <div class="h-3 bg-muted rounded w-1/2 mx-auto" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div class="size-16 rounded-full bg-muted flex items-center justify-center">
        <Icon name="i-lucide-users" class="size-8 text-muted-foreground" />
      </div>
      <h3 class="text-lg font-semibold">No employees found</h3>
      <p class="text-sm text-muted-foreground">Add your first team member to get started.</p>
      <Button @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-2 size-4" />
        Add Employee
      </Button>
    </div>

    <!-- Employee cards grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="emp in filtered"
        :key="emp._id"
        class="group relative rounded-xl border bg-card p-5 flex flex-col items-center gap-3 shadow-xs hover:shadow-md transition-shadow"
      >
        <!-- Avatar -->
        <div class="relative">
          <img
            v-if="emp.profileImage"
            :src="emp.profileImage"
            :alt="emp.employee"
            class="size-20 rounded-full object-cover ring-2 ring-border"
          />
          <div
            v-else
            class="size-20 rounded-full bg-muted flex items-center justify-center ring-2 ring-border text-2xl font-bold text-muted-foreground"
          >
            {{ emp.employee.charAt(0).toUpperCase() }}
          </div>
        </div>

        <!-- Info -->
        <div class="text-center flex flex-col gap-0.5 w-full">
          <p class="font-semibold text-sm truncate">{{ emp.employee }}</p>
          <Badge variant="secondary" class="mx-auto text-xs">{{ emp.position }}</Badge>
          <p class="text-xs text-muted-foreground truncate mt-1">{{ emp.email }}</p>
        </div>

        <!-- Actions (visible on hover) -->
        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3">
          <Button variant="ghost" size="icon" class="size-7" @click="openEdit(emp)">
            <Icon name="i-lucide-pencil" class="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" class="size-7 text-destructive hover:text-destructive" @click="confirmDelete(emp)">
            <Icon name="i-lucide-trash-2" class="size-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Count -->
    <p v-if="!loading && filtered.length > 0" class="text-xs text-muted-foreground">
      Showing {{ filtered.length }} of {{ employees.length }} employees
    </p>

    <!-- ─── Create / Edit Dialog ─── -->
    <Dialog v-model:open="showModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? 'Edit Employee' : 'Add Employee' }}</DialogTitle>
          <DialogDescription>
            {{ isEditing ? 'Update the employee details below.' : 'Fill in the details to add a new team member.' }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">

          <!-- Profile image -->
          <div class="flex flex-col items-center gap-3">
            <div
              class="size-24 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-2 ring-border cursor-pointer relative group"
              @click="($refs.fileInput as HTMLInputElement)?.click()"
            >
              <img
                v-if="previewUrl || form.profileImage"
                :src="previewUrl || form.profileImage"
                alt="Profile"
                class="size-full object-cover"
              />
              <Icon v-else name="i-lucide-user" class="size-10 text-muted-foreground" />
              <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Icon name="i-lucide-camera" class="size-6 text-white" />
              </div>
              <div v-if="uploadingImage" class="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                <Icon name="i-lucide-loader-circle" class="size-6 text-white animate-spin" />
              </div>
            </div>
            <p class="text-xs text-muted-foreground">Click to upload photo</p>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onFileChange"
            />
          </div>

          <!-- Name -->
          <div class="flex flex-col gap-1.5">
            <Label for="emp-name">Full Name</Label>
            <Input id="emp-name" v-model="form.employee" placeholder="John Doe" />
          </div>

          <!-- Email -->
          <div class="flex flex-col gap-1.5">
            <Label for="emp-email">Email</Label>
            <Input id="emp-email" v-model="form.email" type="email" placeholder="john@hardwoodhub.com" />
          </div>

          <!-- Position -->
          <div class="flex flex-col gap-1.5">
            <Label for="emp-position">Position</Label>
            <Select v-model="form.position">
              <SelectTrigger id="emp-position">
                <SelectValue placeholder="Select a position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Crew member">Crew member</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Super Admin">Super Admin</SelectItem>
                <SelectItem value="Supervisor">Supervisor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showModal = false">Cancel</Button>
          <Button :disabled="saving || uploadingImage" @click="saveEmployee">
            <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            {{ isEditing ? 'Save Changes' : 'Add Employee' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ─── Delete Confirm Dialog ─── -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Employee</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{{ deleteTarget?.employee }}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive hover:bg-destructive/90" @click="deleteEmployee">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </div>
</template>
