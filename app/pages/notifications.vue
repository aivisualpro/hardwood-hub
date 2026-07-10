<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Notifications', icon: 'i-lucide-bell', description: 'Your alerts and automation rules' })

const { user } = useAuth()

// Manager+ can view automations, Admin+ can edit
const MANAGER_TIERS = ['Manager', 'Supervisor', 'Admin', 'Super Admin', 'Finance']
const ADMIN_TIERS = ['Admin', 'Super Admin', 'Finance']
const isManager = computed(() => MANAGER_TIERS.includes((user.value as any)?.position || ''))
const isAdmin = computed(() => ADMIN_TIERS.includes((user.value as any)?.position || ''))

const activeTab = ref('inbox')

// ═══════════════════════════════════════════════════════════════════════════
// INBOX
// ═══════════════════════════════════════════════════════════════════════════
const notifications = ref<any[]>([])
const unreadCount = ref(0)
const pagination = ref({ page: 1, limit: 25, total: 0, totalPages: 0 })
const onlyUnread = ref(false)
const moduleFilter = ref('all')
const loadingInbox = ref(false)

async function fetchNotifications(page = 1) {
  loadingInbox.value = true
  try {
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (onlyUnread.value)
      params.set('unread', '1')
    if (moduleFilter.value !== 'all')
      params.set('module', moduleFilter.value)
    const res = await $fetch<any>(`/api/notifications?${params}`)
    notifications.value = res.data
    unreadCount.value = res.unreadCount
    pagination.value = res.pagination
  }
  catch (e: any) {
    toast.error('Failed to load notifications', { description: e?.data?.message || e?.message })
  }
  finally {
    loadingInbox.value = false
  }
}

await useAsyncData('notifications-inbox', async () => { await fetchNotifications(); return true })

watch([onlyUnread, moduleFilter], () => fetchNotifications(1))

// ── Live refresh: poll every 30s while on this page + refresh when tab regains focus
function syncBadge() {
  // Refresh the sidebar bell badge immediately (shares the 'nav-counts' useAsyncData key)
  refreshNuxtData('nav-counts')
}
let inboxPoll: ReturnType<typeof setInterval> | undefined
function onPageVisible() {
  if (document.visibilityState === 'visible')
    fetchNotifications(pagination.value.page)
}
onMounted(() => {
  inboxPoll = setInterval(() => fetchNotifications(pagination.value.page), 30_000)
  document.addEventListener('visibilitychange', onPageVisible)
})
onUnmounted(() => {
  clearInterval(inboxPoll)
  document.removeEventListener('visibilitychange', onPageVisible)
})

async function markRead(n: any, read = true) {
  try {
    await $fetch(`/api/notifications/${n._id}`, { method: 'PATCH', body: { read } })
    n.readAt = read ? new Date().toISOString() : null
    unreadCount.value = Math.max(0, unreadCount.value + (read ? -1 : 1))
    syncBadge()
  }
  catch (e: any) {
    toast.error('Failed to update', { description: e?.data?.message || e?.message })
  }
}

async function markAllRead() {
  try {
    await $fetch('/api/notifications/mark-all-read', { method: 'POST' })
    notifications.value.forEach((n) => { n.readAt = n.readAt || new Date().toISOString() })
    unreadCount.value = 0
    syncBadge()
    toast.success('All notifications marked as read')
  }
  catch (e: any) {
    toast.error('Failed to mark all read', { description: e?.data?.message || e?.message })
  }
}

async function removeNotification(n: any) {
  try {
    await $fetch(`/api/notifications/${n._id}`, { method: 'DELETE' })
    notifications.value = notifications.value.filter(x => x._id !== n._id)
    if (!n.readAt) {
      unreadCount.value = Math.max(0, unreadCount.value - 1)
      syncBadge()
    }
  }
  catch (e: any) {
    toast.error('Failed to delete', { description: e?.data?.message || e?.message })
  }
}

function openNotification(n: any) {
  if (!n.readAt)
    markRead(n)
  if (n.link)
    navigateTo(n.link)
}

function timeAgo(date: string) {
  const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diffSec < 60)
    return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60)
    return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)
    return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7)
    return `${diffDay}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function actionIcon(action: string) {
  return { create: 'i-lucide-plus-circle', update: 'i-lucide-pencil', delete: 'i-lucide-trash-2' }[action] || 'i-lucide-zap'
}

function actionColor(action: string) {
  return {
    create: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    update: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    delete: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  }[action] || 'text-primary bg-primary/10 border-primary/20'
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATIONS
// ═══════════════════════════════════════════════════════════════════════════
const rules = ref<any[]>([])
const meta = ref<any>(null)
const loadingRules = ref(false)
const metaLoaded = ref(false)

async function fetchAutomationData() {
  if (!isManager.value)
    return
  loadingRules.value = true
  try {
    const [rulesRes, metaRes] = await Promise.all([
      $fetch<any>('/api/notifications/automations'),
      metaLoaded.value ? Promise.resolve(null) : $fetch<any>('/api/notifications/automations/meta'),
    ])
    rules.value = rulesRes.data
    if (metaRes) {
      meta.value = metaRes.data
      metaLoaded.value = true
    }
  }
  catch (e: any) {
    toast.error('Failed to load automations', { description: e?.data?.message || e?.message })
  }
  finally {
    loadingRules.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'automations' && !rules.value.length)
    fetchAutomationData()
})

// ─── Builder state ──────────────────────────────────────────────────────────
const builderOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const blankForm = () => ({
  name: '',
  module: '',
  submodule: '',
  action: 'update',
  field: '',
  operator: 'any',
  values: [] as string[],
  valueLabels: [] as string[],
  assignees: [] as string[],
  messageTemplate: '',
  sendEmail: false,
  enabled: true,
})
const form = ref(blankForm())

const modules = computed(() => meta.value?.modules || [])
const employees = computed(() => meta.value?.employees || [])

const selectedModule = computed(() => modules.value.find((m: any) => m.key === form.value.module))
const submodules = computed(() => selectedModule.value?.submodules || [])
const selectedSubmodule = computed(() => submodules.value.find((s: any) => s.key === form.value.submodule))
const fields = computed(() => selectedSubmodule.value?.fields || [])
const selectedField = computed(() => fields.value.find((f: any) => f.key === form.value.field))
const fieldOptions = computed(() => selectedField.value?.options || [])

// Sentinel for "any field" (reka-ui Select rejects empty-string values)
const ANY_FIELD = '__any__'
const fieldProxy = computed({
  get: () => form.value.field || ANY_FIELD,
  set: (v: string) => { form.value.field = v === ANY_FIELD ? '' : v },
})

// Reset downstream selections when upstream changes (skipped while loading a rule for editing)
let suppressResets = false
watch(() => form.value.module, () => {
  if (suppressResets)
    return
  form.value.submodule = ''
  form.value.field = ''
  form.value.values = []
})
watch(() => form.value.submodule, () => {
  if (suppressResets)
    return
  form.value.field = ''
  form.value.values = []
})
watch(() => form.value.field, () => {
  if (suppressResets)
    return
  form.value.values = []
  form.value.operator = 'any'
})

function toggleValue(opt: any) {
  const i = form.value.values.indexOf(opt.value)
  if (i >= 0) {
    form.value.values.splice(i, 1)
    form.value.valueLabels.splice(i, 1)
  }
  else {
    form.value.values.push(opt.value)
    form.value.valueLabels.push(opt.label)
  }
}

const freeTextValues = ref('')
watch(freeTextValues, (v) => {
  const parts = v.split(',').map(s => s.trim()).filter(Boolean)
  form.value.values = parts
  form.value.valueLabels = parts
})

function toggleAssignee(id: string) {
  const i = form.value.assignees.indexOf(id)
  if (i >= 0)
    form.value.assignees.splice(i, 1)
  else form.value.assignees.push(id)
}

const assigneeSearch = ref('')
const filteredEmployees = computed(() => {
  const q = assigneeSearch.value.toLowerCase().trim()
  if (!q)
    return employees.value
  return employees.value.filter((e: any) =>
    e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || (e.position || '').toLowerCase().includes(q))
})

const PLACEHOLDERS = [
  { key: '{{entity}}', label: 'Record name', example: 'EST-1024 — Smith Residence' },
  { key: '{{field}}', label: 'Field', example: 'Status' },
  { key: '{{old}}', label: 'Old value', example: 'Sent' },
  { key: '{{new}}', label: 'New value', example: 'Approved' },
  { key: '{{actor}}', label: 'Changed by', example: 'Jane Doe' },
  { key: '{{action}}', label: 'Action', example: 'updated' },
]

function insertPlaceholder(p: string) {
  form.value.messageTemplate = `${form.value.messageTemplate}${form.value.messageTemplate && !form.value.messageTemplate.endsWith(' ') ? ' ' : ''}${p}`
}

const messagePreview = computed(() => {
  const tpl = form.value.messageTemplate
  const subLabel = selectedSubmodule.value?.label || 'Record'
  const sample: Record<string, string> = {
    entity: 'EST-1024 — Smith Residence',
    field: selectedField.value?.label || 'Status',
    old: 'Sent',
    new: form.value.valueLabels[0] || 'Approved',
    actor: (user.value as any)?.employee || 'Jane Doe',
    action: { create: 'created', update: 'updated', delete: 'deleted' }[form.value.action] || 'updated',
  }
  if (!tpl) {
    return form.value.action === 'update' && form.value.field
      ? `${subLabel} "${sample.entity}": ${sample.field} changed from "${sample.old}" to "${sample.new}" by ${sample.actor}.`
      : `${subLabel} "${sample.entity}" was ${sample.action} by ${sample.actor}.`
  }
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => sample[k] ?? '')
})

const canSave = computed(() =>
  form.value.name.trim()
  && form.value.module
  && form.value.submodule
  && form.value.action
  && form.value.assignees.length > 0
  && (form.value.operator === 'any' || form.value.values.length > 0))

function openBuilder(rule?: any) {
  if (rule) {
    editingId.value = rule._id
    form.value = {
      name: rule.name,
      module: rule.module,
      submodule: rule.submodule,
      action: rule.action,
      field: rule.field || '',
      operator: rule.operator || 'any',
      values: [...(rule.values || [])],
      valueLabels: [...(rule.valueLabels || [])],
      assignees: [...(rule.assignees || [])],
      messageTemplate: rule.messageTemplate || '',
      sendEmail: !!rule.sendEmail,
      enabled: !!rule.enabled,
    }
    // Prevent the cascade watchers from wiping the loaded values
    suppressResets = true
    nextTick(() => {
      suppressResets = false
      if (selectedField.value && !fieldOptions.value.length)
        freeTextValues.value = (rule.values || []).join(', ')
    })
  }
  else {
    editingId.value = null
    form.value = blankForm()
    freeTextValues.value = ''
  }
  builderOpen.value = true
}

async function saveRule() {
  if (!canSave.value)
    return
  saving.value = true
  try {
    const body = { ...form.value }
    if (editingId.value) {
      await $fetch(`/api/notifications/automations/${editingId.value}`, { method: 'PUT', body })
      toast.success('Automation updated')
    }
    else {
      await $fetch('/api/notifications/automations', { method: 'POST', body })
      toast.success('Automation created', { description: 'It is live and will fire on matching events.' })
    }
    builderOpen.value = false
    await fetchAutomationData()
  }
  catch (e: any) {
    toast.error('Failed to save automation', { description: e?.data?.message || e?.message })
  }
  finally {
    saving.value = false
  }
}

async function toggleRule(rule: any) {
  try {
    await $fetch(`/api/notifications/automations/${rule._id}`, { method: 'PATCH', body: { enabled: !rule.enabled } })
    rule.enabled = !rule.enabled
    toast.success(rule.enabled ? 'Automation enabled' : 'Automation paused')
  }
  catch (e: any) {
    toast.error('Failed to toggle', { description: e?.data?.message || e?.message })
  }
}

const deleteTarget = ref<any>(null)
async function confirmDelete() {
  if (!deleteTarget.value)
    return
  try {
    await $fetch(`/api/notifications/automations/${deleteTarget.value._id}`, { method: 'DELETE' })
    rules.value = rules.value.filter(r => r._id !== deleteTarget.value._id)
    toast.success('Automation deleted')
  }
  catch (e: any) {
    toast.error('Failed to delete', { description: e?.data?.message || e?.message })
  }
  finally {
    deleteTarget.value = null
  }
}

// ─── Rule card helpers ──────────────────────────────────────────────────────
function ruleSummary(rule: any): string {
  const mod = modules.value.find((m: any) => m.key === rule.module)
  const sub = mod?.submodules?.find((s: any) => s.key === rule.submodule)
  const subLabel = sub?.label || rule.submodule
  const verb = { create: 'is added', update: 'is updated', delete: 'is deleted' }[rule.action as string] || rule.action
  let s = `When a ${subLabel} record ${verb}`
  if (rule.field) {
    const fieldLabel = sub?.fields?.find((f: any) => f.key === rule.field)?.label || rule.field
    if (rule.operator === 'changes_to')
      s += ` and ${fieldLabel} changes to ${(rule.valueLabels?.length ? rule.valueLabels : rule.values).join(' / ')}`
    else if (rule.operator === 'changes_from')
      s += ` and ${fieldLabel} changes from ${(rule.valueLabels?.length ? rule.valueLabels : rule.values).join(' / ')}`
    else
      s += ` and ${fieldLabel} changes`
  }
  return s
}

function ruleAssignees(rule: any) {
  return (rule.assignees || [])
    .map((id: string) => employees.value.find((e: any) => e._id === id))
    .filter(Boolean)
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const moduleFilterOptions = [
  { value: 'all', label: 'All Modules' },
  { value: 'crm', label: 'CRM' },
  { value: 'hr', label: 'HR' },
  { value: 'learning-center', label: 'Learning Center' },
  { value: 'project-management', label: 'Project Management' },
]
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <Tabs v-model="activeTab">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="inbox" class="gap-2">
            <Icon name="i-lucide-inbox" class="size-4" />
            Inbox
            <span v-if="unreadCount" class="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground leading-none font-bold">
              {{ unreadCount }}
            </span>
          </TabsTrigger>
          <TabsTrigger v-if="isManager" value="automations" class="gap-2">
            <Icon name="i-lucide-workflow" class="size-4" />
            Automations
          </TabsTrigger>
        </TabsList>

        <div class="flex items-center gap-2">
          <template v-if="activeTab === 'inbox'">
            <Button v-if="unreadCount" variant="outline" size="sm" @click="markAllRead">
              <Icon name="i-lucide-check-check" class="size-4 mr-1.5" />
              Mark all read
            </Button>
          </template>
          <template v-else>
            <Button v-if="isAdmin" size="sm" @click="openBuilder()">
              <Icon name="i-lucide-plus" class="size-4 mr-1.5" />
              New Automation
            </Button>
          </template>
        </div>
      </div>

      <!-- ═══════════════ INBOX TAB ═══════════════ -->
      <TabsContent value="inbox" class="mt-4 space-y-4">
        <!-- Filter bar -->
        <div class="rounded-xl border border-border/50 bg-card p-3 flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <Switch id="unread-only" v-model="onlyUnread" />
            <Label for="unread-only" class="text-sm text-muted-foreground cursor-pointer">Unread only</Label>
          </div>
          <Select v-model="moduleFilter">
            <SelectTrigger class="w-[180px] h-8 text-xs sm:text-sm">
              <SelectValue placeholder="All Modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="o in moduleFilterOptions" :key="o.value" :value="o.value">
                {{ o.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="ml-auto text-xs text-muted-foreground">
            {{ pagination.total }} total · {{ unreadCount }} unread
          </span>
        </div>

        <!-- Empty state -->
        <div v-if="!loadingInbox && !notifications.length" class="rounded-xl border border-dashed border-border/60 bg-card/50 py-16 flex flex-col items-center gap-3 text-center">
          <div class="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Icon name="i-lucide-bell-off" class="size-7 text-primary" />
          </div>
          <div>
            <p class="font-semibold">
              You're all caught up
            </p>
            <p class="text-sm text-muted-foreground mt-1 max-w-sm">
              No notifications here. When an automation rule fires, alerts assigned to you will land in this inbox.
            </p>
          </div>
          <Button v-if="isManager && !rules.length" variant="outline" size="sm" @click="activeTab = 'automations'">
            <Icon name="i-lucide-workflow" class="size-4 mr-1.5" />
            Set up automations
          </Button>
        </div>

        <!-- Notification list -->
        <div v-else class="space-y-2">
          <div
            v-for="n in notifications"
            :key="n._id"
            class="group rounded-xl border bg-card p-3.5 sm:p-4 flex items-start gap-3 cursor-pointer transition-colors hover:border-primary/40"
            :class="n.readAt ? 'border-border/50 opacity-80' : 'border-primary/30 bg-primary/[0.03]'"
            @click="openNotification(n)"
          >
            <div class="size-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5" :class="actionColor(n.action)">
              <Icon :name="actionIcon(n.action)" class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span v-if="!n.readAt" class="size-2 rounded-full bg-primary shrink-0" />
                <p class="font-semibold text-sm truncate">
                  {{ n.title }}
                </p>
                <span class="text-[11px] text-muted-foreground shrink-0 ml-auto" :title="new Date(n.createdAt).toLocaleString()">
                  {{ timeAgo(n.createdAt) }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {{ n.message }}
              </p>
              <div class="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge variant="outline" class="text-[10px] px-1.5 py-0 h-5 capitalize">
                  {{ n.submodule.replace(/-/g, ' ') }}
                </Badge>
                <Badge v-if="n.entityLabel" variant="secondary" class="text-[10px] px-1.5 py-0 h-5 max-w-[220px] truncate">
                  {{ n.entityLabel }}
                </Badge>
                <span v-if="n.ruleName" class="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Icon name="i-lucide-workflow" class="size-3" />{{ n.ruleName }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" @click.stop>
              <Button variant="ghost" size="icon" class="size-7" :title="n.readAt ? 'Mark unread' : 'Mark read'" @click="markRead(n, !n.readAt)">
                <Icon :name="n.readAt ? 'i-lucide-mail' : 'i-lucide-mail-open'" class="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-rose-400" title="Delete" @click="removeNotification(n)">
                <Icon name="i-lucide-trash-2" class="size-3.5" />
              </Button>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" :disabled="pagination.page <= 1" @click="fetchNotifications(pagination.page - 1)">
              <Icon name="i-lucide-chevron-left" class="size-4" />
            </Button>
            <span class="text-xs text-muted-foreground">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
            <Button variant="outline" size="sm" :disabled="pagination.page >= pagination.totalPages" @click="fetchNotifications(pagination.page + 1)">
              <Icon name="i-lucide-chevron-right" class="size-4" />
            </Button>
          </div>
        </div>
      </TabsContent>

      <!-- ═══════════════ AUTOMATIONS TAB ═══════════════ -->
      <TabsContent v-if="isManager" value="automations" class="mt-4 space-y-4">
        <!-- Empty state -->
        <div v-if="!loadingRules && !rules.length" class="rounded-xl border border-dashed border-border/60 bg-card/50 py-16 flex flex-col items-center gap-3 text-center">
          <div class="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Icon name="i-lucide-workflow" class="size-7 text-primary" />
          </div>
          <div>
            <p class="font-semibold">
              No automations yet
            </p>
            <p class="text-sm text-muted-foreground mt-1 max-w-md">
              Build rules like "When an Estimate's status changes to Approved, notify the board" — notifications and emails go out automatically.
            </p>
          </div>
          <Button v-if="isAdmin" size="sm" @click="openBuilder()">
            <Icon name="i-lucide-plus" class="size-4 mr-1.5" />
            Create your first automation
          </Button>
        </div>

        <!-- Rule cards -->
        <div v-else class="grid gap-3 md:grid-cols-2">
          <div
            v-for="rule in rules"
            :key="rule._id"
            class="rounded-xl border bg-card p-4 flex flex-col gap-3 transition-colors"
            :class="rule.enabled ? 'border-border/50' : 'border-border/40 opacity-60'"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-zap" class="size-4 text-primary" />
                </div>
                <div class="min-w-0">
                  <p class="font-semibold text-sm truncate">
                    {{ rule.name }}
                  </p>
                  <p class="text-[11px] text-muted-foreground capitalize">
                    {{ (modules.find((m: any) => m.key === rule.module)?.label) || rule.module }}
                    <span v-if="rule.fireCount" class="ml-1">· fired {{ rule.fireCount }}×</span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Switch :model-value="rule.enabled" :disabled="!isAdmin" @update:model-value="toggleRule(rule)" />
                <DropdownMenu v-if="isAdmin">
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-7">
                      <Icon name="i-lucide-more-vertical" class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="openBuilder(rule)">
                      <Icon name="i-lucide-pencil" class="size-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem class="text-rose-400 focus:text-rose-400" @click="deleteTarget = rule">
                      <Icon name="i-lucide-trash-2" class="size-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ ruleSummary(rule) }}
            </p>

            <div class="flex items-center justify-between mt-auto pt-1">
              <div class="flex -space-x-2">
                <Avatar v-for="a in ruleAssignees(rule).slice(0, 5)" :key="a._id" class="size-6 border-2 border-card" :title="a.name">
                  <AvatarImage v-if="a.profileImage" :src="a.profileImage" />
                  <AvatarFallback class="text-[9px]">
                    {{ initials(a.name) }}
                  </AvatarFallback>
                </Avatar>
                <div v-if="ruleAssignees(rule).length > 5" class="size-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] font-bold">
                  +{{ ruleAssignees(rule).length - 5 }}
                </div>
              </div>
              <div class="flex items-center gap-2 text-muted-foreground">
                <span class="inline-flex items-center gap-1 text-[11px]">
                  <Icon name="i-lucide-bell" class="size-3.5" />In-app
                </span>
                <span v-if="rule.sendEmail" class="inline-flex items-center gap-1 text-[11px]">
                  <Icon name="i-lucide-mail" class="size-3.5" />Email
                </span>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <!-- ═══════════════ AUTOMATION BUILDER ═══════════════ -->
    <Sheet v-model:open="builderOpen">
      <SheetContent class="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle class="flex items-center gap-2">
            <Icon name="i-lucide-workflow" class="size-5 text-primary" />
            {{ editingId ? 'Edit Automation' : 'New Automation' }}
          </SheetTitle>
          <SheetDescription>
            Pick what to watch, when to trigger, and who to tell.
          </SheetDescription>
        </SheetHeader>

        <div class="space-y-5 py-5 px-4">
          <!-- Name -->
          <div class="space-y-1.5">
            <Label>Automation name</Label>
            <Input v-model="form.name" placeholder="e.g. Estimate approved → notify board" />
          </div>

          <Separator />

          <!-- Step 1: Module + Submodule -->
          <div class="space-y-1.5">
            <Label class="flex items-center gap-1.5">
              <span class="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">1</span>
              Watch
            </Label>
            <div class="grid grid-cols-2 gap-2">
              <Select v-model="form.module">
                <SelectTrigger>
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="m in modules" :key="m.key" :value="m.key">
                    {{ m.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select v-model="form.submodule" :disabled="!form.module">
                <SelectTrigger>
                  <SelectValue placeholder="Sub-module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="s in submodules" :key="s.key" :value="s.key">
                    {{ s.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p v-if="selectedSubmodule && !selectedSubmodule.wired" class="text-[11px] text-amber-500 flex items-center gap-1">
              <Icon name="i-lucide-alert-triangle" class="size-3" />
              This sub-module isn't emitting events yet — the rule will save but won't fire until it's wired up.
            </p>
          </div>

          <!-- Step 2: Trigger -->
          <div class="space-y-1.5">
            <Label class="flex items-center gap-1.5">
              <span class="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">2</span>
              When a record is…
            </Label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="a in [{ v: 'create', l: 'Added', i: 'i-lucide-plus-circle' }, { v: 'update', l: 'Updated', i: 'i-lucide-pencil' }, { v: 'delete', l: 'Deleted', i: 'i-lucide-trash-2' }]"
                :key="a.v"
                type="button"
                class="rounded-lg border p-2.5 flex flex-col items-center gap-1 text-xs font-medium transition-colors"
                :class="form.action === a.v ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-primary/40'"
                @click="form.action = a.v"
              >
                <Icon :name="a.i" class="size-4" />
                {{ a.l }}
              </button>
            </div>
          </div>

          <!-- Step 3: Field condition -->
          <div v-if="form.action === 'update' && fields.length" class="space-y-1.5">
            <Label class="flex items-center gap-1.5">
              <span class="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">3</span>
              Which field? <span class="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Select v-model="fieldProxy">
              <SelectTrigger>
                <SelectValue placeholder="Any field change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">
                  Any field change
                </SelectItem>
                <SelectItem v-for="f in fields" :key="f.key" :value="f.key">
                  {{ f.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <template v-if="form.field">
              <div class="grid grid-cols-3 gap-2 mt-2">
                <button
                  v-for="op in [{ v: 'any', l: 'Any change' }, { v: 'changes_to', l: 'Changes to' }, { v: 'changes_from', l: 'Changes from' }]"
                  :key="op.v"
                  type="button"
                  class="rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors"
                  :class="form.operator === op.v ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-primary/40'"
                  @click="form.operator = op.v"
                >
                  {{ op.l }}
                </button>
              </div>

              <div v-if="form.operator !== 'any'" class="mt-2">
                <div v-if="fieldOptions.length" class="flex flex-wrap gap-1.5">
                  <button
                    v-for="opt in fieldOptions"
                    :key="opt.value"
                    type="button"
                    class="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                    :class="form.values.includes(opt.value) ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-primary/40'"
                    @click="toggleValue(opt)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
                <Input v-else v-model="freeTextValues" placeholder="Values, comma-separated" />
              </div>
            </template>
          </div>

          <!-- Step 4: Assignees -->
          <div class="space-y-1.5">
            <Label class="flex items-center gap-1.5">
              <span class="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{{ form.action === 'update' && fields.length ? 4 : 3 }}</span>
              Who gets notified?
            </Label>
            <div class="rounded-lg border border-border/60">
              <div class="relative border-b border-border/50">
                <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  v-model="assigneeSearch"
                  placeholder="Search employees…"
                  class="w-full bg-transparent pl-8 pr-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                >
              </div>
              <div class="max-h-44 overflow-y-auto p-1">
                <button
                  v-for="e in filteredEmployees"
                  :key="e._id"
                  type="button"
                  class="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors"
                  @click="toggleAssignee(e._id)"
                >
                  <div
                    class="size-4 rounded border flex items-center justify-center shrink-0"
                    :class="form.assignees.includes(e._id) ? 'bg-primary border-primary' : 'border-border'"
                  >
                    <Icon v-if="form.assignees.includes(e._id)" name="i-lucide-check" class="size-3 text-primary-foreground" />
                  </div>
                  <Avatar class="size-6">
                    <AvatarImage v-if="e.profileImage" :src="e.profileImage" />
                    <AvatarFallback class="text-[9px]">
                      {{ initials(e.name) }}
                    </AvatarFallback>
                  </Avatar>
                  <div class="min-w-0">
                    <p class="truncate leading-tight">
                      {{ e.name }}
                    </p>
                    <p class="text-[10px] text-muted-foreground truncate leading-tight">
                      {{ e.position }}
                    </p>
                  </div>
                </button>
                <p v-if="!filteredEmployees.length" class="text-xs text-muted-foreground text-center py-3">
                  No employees found
                </p>
              </div>
            </div>
            <p v-if="form.assignees.length" class="text-[11px] text-muted-foreground">
              {{ form.assignees.length }} selected
            </p>
          </div>

          <!-- Step 5: Message -->
          <div class="space-y-1.5">
            <Label class="flex items-center gap-1.5">
              <span class="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{{ form.action === 'update' && fields.length ? 5 : 4 }}</span>
              What should it say? <span class="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Textarea v-model="form.messageTemplate" rows="2" placeholder="Leave blank for a smart default message" />
            <p class="text-[11px] text-muted-foreground">
              Click to insert dynamic values — they're replaced with real data when the notification is sent:
            </p>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="p in PLACEHOLDERS"
                :key="p.key"
                type="button"
                class="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                :title="`Inserts ${p.key} — e.g. “${p.example}”`"
                @click="insertPlaceholder(p.key)"
              >
                <Icon name="i-lucide-plus" class="size-3" />
                {{ p.label }}
              </button>
            </div>
            <div class="rounded-lg bg-muted/40 border border-border/40 p-2.5 mt-1">
              <p class="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                Preview
              </p>
              <p class="text-xs text-foreground/90">
                {{ messagePreview }}
              </p>
            </div>
          </div>

          <!-- Email toggle -->
          <div class="rounded-lg border border-border/60 p-3 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <Icon name="i-lucide-mail" class="size-4 text-muted-foreground" />
              <div>
                <p class="text-sm font-medium">
                  Also send email
                </p>
                <p class="text-[11px] text-muted-foreground">
                  Each assignee gets an email in addition to the in-app alert
                </p>
              </div>
            </div>
            <Switch v-model="form.sendEmail" />
          </div>
        </div>

        <SheetFooter class="gap-2">
          <Button variant="outline" @click="builderOpen = false">
            Cancel
          </Button>
          <Button :disabled="!canSave || saving" @click="saveRule">
            <Icon v-if="saving" name="i-lucide-loader-2" class="size-4 mr-1.5 animate-spin" />
            {{ editingId ? 'Save changes' : 'Create automation' }}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Delete confirm -->
    <AlertDialog :open="!!deleteTarget" @update:open="(v: boolean) => { if (!v) deleteTarget = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{{ deleteTarget?.name }}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This automation will stop firing immediately. Existing notifications it created are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="deleteTarget = null">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction class="bg-rose-600 hover:bg-rose-700 text-white" @click="confirmDelete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
