<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Employees', icon: 'i-lucide-users', description: 'Manage your team members' })

const { canCreate, canUpdate, canDelete } = usePermissions('/hr/employees')

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
  status: string
  workspace: string
  basePay: number
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
  status: 'Active',
  workspace: 'none',
  basePay: 0,
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
    employees.value = res.data.map(emp => {
      // Clean legacy BigQuery image routes if they still exist in MongoDB records
      if (emp.profileImage && emp.profileImage.includes('api/bigquery')) {
        emp.profileImage = ''
      }
      return emp
    })
  }
  catch (e: any) {
    notify('Error', e?.message || 'Failed to load employees', 'destructive')
  }
  finally { loading.value = false }
}

onMounted(fetchEmployees)

// ─── Fetch Workspaces ─────────────────────────────────────
const workspacesList = ref<{ _id: string, name: string }[]>([])
async function fetchWorkspaces() {
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/workspaces')
    workspacesList.value = res.data
  } catch {}
}
onMounted(fetchWorkspaces)

function workspaceName(id: string) {
  return workspacesList.value.find(w => w._id === id)?.name || ''
}

// ─── Image Upload (→ Cloudinary via server with client-side resize) ───────────────
async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  // Show preview immediately (in-memory only, never stored as base64)
  previewUrl.value = URL.createObjectURL(file)
  uploadingImage.value = true

  try {
    // 1. Create an off-screen image to read the file
    const img = new Image()
    img.src = previewUrl.value
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    // 2. Calculate dimensions (max 500x500 for profile pics)
    const MAX_SIZE = 500
    let width = img.width
    let height = img.height

    if (width > height) {
      if (width > MAX_SIZE) {
        height *= MAX_SIZE / width
        width = MAX_SIZE
      }
    } else {
      if (height > MAX_SIZE) {
        width *= MAX_SIZE / height
        height = MAX_SIZE
      }
    }

    // 3. Draw to canvas & get optimized base64
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')

    ctx.drawImage(img, 0, 0, width, height)
    
    // Use WebP or JPEG for much smaller payload size (~70% compression)
    const base64 = canvas.toDataURL('image/jpeg', 0.8)

    // 4. Send the much-smaller optimized string directly to Cloudinary
    const sigRes = await $fetch<{ signature: string, timestamp: number, cloudName: string, apiKey: string, folder: string }>('/api/upload/cloudinary-signature', {
      params: { folder: 'hardwood-hub/uploads' }
    })
    
    const fd = new FormData()
    fd.append('file', base64)
    fd.append('api_key', sigRes.apiKey)
    fd.append('timestamp', String(sigRes.timestamp))
    fd.append('signature', sigRes.signature)
    fd.append('folder', sigRes.folder)

    const clRes = await $fetch<any>(`https://api.cloudinary.com/v1_1/${sigRes.cloudName}/auto/upload`, {
      method: 'POST',
      body: fd
    })
    
    if (clRes && clRes.secure_url) {
      form.value.profileImage = clRes.secure_url // store only the Cloudinary URL
    }
    uploadingImage.value = false
  } catch (e: any) {
    uploadingImage.value = false
    notify('Upload failed', e?.message || 'Failed to process image', 'destructive')
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
  form.value = { employee: emp.employee, email: emp.email, position: emp.position, profileImage: emp.profileImage, status: emp.status || 'Active', workspace: emp.workspace || 'none', basePay: emp.basePay || 0 }
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
    const payload = { ...form.value, workspace: form.value.workspace === 'none' ? '' : form.value.workspace }
    if (isEditing.value && editId.value) {
      await $fetch(`/api/employees/${editId.value}`, { method: 'PUT', body: payload })
      notify('Updated', `${form.value.employee} updated successfully`)
    }
    else {
      await $fetch('/api/employees', { method: 'POST', body: payload })
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

// ─── Toggle Status ────────────────────────────────────────
async function toggleStatus(emp: Employee) {
  const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active'
  const prev = emp.status
  emp.status = newStatus // optimistic
  try {
    await $fetch(`/api/employees/${emp._id}`, { method: 'PUT', body: { status: newStatus } })
    notify('Status updated', `${emp.employee} is now ${newStatus}`)
  }
  catch (e: any) {
    emp.status = prev
    notify('Error', e?.message || 'Failed to update status', 'destructive')
  }
}

</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
  <div class="w-full flex flex-col gap-4 sm:gap-6 p-3 sm:p-6">

    <!-- Header bar -->
    <div class="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
      <div class="relative flex-1 min-w-0 basis-full sm:basis-auto sm:max-w-sm">
        <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5 sm:size-4" />
        <Input v-model="searchQuery" placeholder="Search employees…" class="pl-8 sm:pl-9 h-8 sm:h-9 text-xs sm:text-sm" />
      </div>
      <Button v-if="canCreate()" size="sm" class="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3 shrink-0" @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-1 sm:mr-2 size-3.5 sm:size-4" />
        <span class="hidden xs:inline">Add Employee</span>
        <span class="xs:hidden">Add</span>
      </Button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
      <div v-for="i in 8" :key="i" class="rounded-xl border bg-card p-3 sm:p-4 space-y-2 sm:space-y-3 animate-pulse">
        <div class="size-12 sm:size-16 rounded-full bg-muted mx-auto" />
        <div class="h-3 sm:h-4 bg-muted rounded w-3/4 mx-auto" />
        <div class="h-2.5 sm:h-3 bg-muted rounded w-1/2 mx-auto" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center py-16 sm:py-24 gap-3 sm:gap-4 text-center px-4">
      <div class="size-14 sm:size-16 rounded-full bg-muted flex items-center justify-center">
        <Icon name="i-lucide-users" class="size-6 sm:size-8 text-muted-foreground" />
      </div>
      <h3 class="text-base sm:text-lg font-semibold">No employees found</h3>
      <p class="text-xs sm:text-sm text-muted-foreground">Add your first team member to get started.</p>
      <Button v-if="canCreate()" size="sm" @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-1.5 size-3.5 sm:size-4" />
        Add Employee
      </Button>
    </div>

    <!-- Employee cards grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
      <div
        v-for="emp in filtered"
        :key="emp._id"
        class="group relative rounded-xl border bg-card p-3 sm:p-5 flex flex-col items-center gap-2 sm:gap-3 shadow-xs hover:shadow-md transition-shadow"
      >
        <!-- Avatar -->
        <div class="relative">
          <img
            v-if="emp.profileImage"
            :src="emp.profileImage"
            :alt="emp.employee"
            class="size-14 sm:size-20 rounded-full object-cover ring-2 ring-border"
          />
          <div
            v-else
            class="size-14 sm:size-20 rounded-full bg-muted flex items-center justify-center ring-2 ring-border text-xl sm:text-2xl font-bold text-muted-foreground"
          >
            {{ emp.employee.charAt(0).toUpperCase() }}
          </div>
        </div>

        <!-- Info -->
        <div class="text-center flex flex-col gap-0.5 w-full">
          <p class="font-semibold text-xs sm:text-sm truncate">{{ emp.employee }}</p>
          <Badge variant="secondary" class="mx-auto text-[10px] sm:text-xs">{{ emp.position }}</Badge>
          <p class="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5 sm:mt-1">{{ emp.email }}</p>
          <div class="flex items-center justify-center gap-1 sm:gap-1.5 mt-1 sm:mt-1.5">
            <span
              class="size-1.5 sm:size-2 rounded-full"
              :class="emp.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'"
            />
            <span
              class="text-[9px] sm:text-[10px] font-semibold"
              :class="emp.status === 'Active' ? 'text-emerald-400' : 'text-muted-foreground'"
            >
              {{ emp.status || 'Active' }}
            </span>
          </div>
          <div v-if="workspaceName(emp.workspace)" class="flex items-center justify-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
            <Icon name="i-lucide-building" class="size-2.5 sm:size-3 text-muted-foreground/60" />
            <span class="text-[9px] sm:text-[10px] text-muted-foreground truncate">{{ workspaceName(emp.workspace) }}</span>
          </div>
        </div>

        <!-- Actions (visible on hover / always on mobile) -->
        <div class="flex gap-0.5 sm:gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity absolute top-2 right-2 sm:top-3 sm:right-3">
          <Button variant="ghost" size="icon" class="size-6 sm:size-7" title="View Profile" @click="navigateTo(`/my-profile?employee=${emp._id}`)">
            <Icon name="i-lucide-eye" class="size-3 sm:size-3.5 text-primary" />
          </Button>
          <Button
            v-if="canUpdate()"
            variant="ghost" size="icon" class="size-6 sm:size-7"
            :title="emp.status === 'Active' ? 'Deactivate' : 'Activate'"
            @click="toggleStatus(emp)"
          >
            <Icon
              :name="emp.status === 'Active' ? 'i-lucide-user-x' : 'i-lucide-user-check'"
              class="size-3 sm:size-3.5"
              :class="emp.status === 'Active' ? 'text-amber-400' : 'text-emerald-400'"
            />
          </Button>
          <Button v-if="canUpdate()" variant="ghost" size="icon" class="size-6 sm:size-7" @click="openEdit(emp)">
            <Icon name="i-lucide-pencil" class="size-3 sm:size-3.5" />
          </Button>
          <Button v-if="canDelete()" variant="ghost" size="icon" class="size-6 sm:size-7 text-destructive hover:text-destructive" @click="confirmDelete(emp)">
            <Icon name="i-lucide-trash-2" class="size-3 sm:size-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Count -->
    <p v-if="!loading && filtered.length > 0" class="text-[10px] sm:text-xs text-muted-foreground">
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
              class="size-20 sm:size-24 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-2 ring-border cursor-pointer relative group"
              @click="($refs.fileInput as HTMLInputElement)?.click()"
            >
              <img
                v-if="previewUrl || form.profileImage"
                :src="previewUrl || form.profileImage"
                alt="Profile"
                class="size-full object-cover"
              />
              <Icon v-else name="i-lucide-user" class="size-8 sm:size-10 text-muted-foreground" />
              <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Icon name="i-lucide-camera" class="size-5 sm:size-6 text-white" />
              </div>
              <div v-if="uploadingImage" class="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                <Icon name="i-lucide-loader-circle" class="size-5 sm:size-6 text-white animate-spin" />
              </div>
            </div>
            <p class="text-[10px] sm:text-xs text-muted-foreground">Click to upload photo</p>
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

          <!-- Workspace -->
          <div class="flex flex-col gap-1.5">
            <Label for="emp-workspace">Workspace</Label>
            <Select v-model="form.workspace">
              <SelectTrigger id="emp-workspace">
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All Workspaces (Admin)</SelectItem>
                <SelectItem v-for="ws in workspacesList" :key="ws._id" :value="ws._id">{{ ws.name }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Base Pay -->
          <div class="flex flex-col gap-1.5">
            <Label for="emp-basepay">Base Pay (USD)</Label>
            <div class="relative">
              <Icon name="i-lucide-dollar-sign" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
              <Input id="emp-basepay" type="number" v-model.number="form.basePay" placeholder="0.00" min="0" step="0.01" class="pl-9" />
            </div>
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
  </div>
</template>
