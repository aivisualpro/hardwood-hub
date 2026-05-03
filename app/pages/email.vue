<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Email', icon: 'i-lucide-mail', description: 'Your Gmail inbox' })

// ─── State ─────────────────────────────────────────────
const gmailConnected = ref(false)
const gmailEmail = ref('')
const loading = ref(false)
const loadingMessage = ref(false)
const messages = ref<any[]>([])
const selectedMessage = ref<any>(null)
const selectedId = ref('')
const activeFolder = ref('INBOX')
const searchQuery = ref('')
const nextPageToken = ref<string | null>(null)
const resultSizeEstimate = ref(0)

const folders = [
  { id: 'INBOX', label: 'Inbox', icon: 'i-lucide-inbox' },
  { id: 'SENT', label: 'Sent', icon: 'i-lucide-send' },
  { id: 'STARRED', label: 'Starred', icon: 'i-lucide-star' },
  { id: 'DRAFT', label: 'Drafts', icon: 'i-lucide-file' },
  { id: 'TRASH', label: 'Trash', icon: 'i-lucide-trash' },
  { id: 'SPAM', label: 'Spam', icon: 'i-lucide-alert-circle' },
]

// ─── Check Gmail Connection ──────────────────────────────
async function checkGmail() {
  try {
    const res = await $fetch<{ connected: boolean, email: string }>('/api/gmail/status')
    gmailConnected.value = res.connected
    gmailEmail.value = res.email
    if (res.connected) fetchMessages()
  } catch { /* ignore */ }
}

// ─── Fetch Messages ──────────────────────────────────────
async function fetchMessages(append = false) {
  loading.value = true
  try {
    const params: Record<string, any> = { folder: activeFolder.value, maxResults: 25 }
    if (append && nextPageToken.value) params.pageToken = nextPageToken.value
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim()

    const res = await $fetch<any>('/api/gmail/messages', { params })
    if (append) {
      messages.value.push(...(res.messages || []))
    } else {
      messages.value = res.messages || []
    }
    nextPageToken.value = res.nextPageToken
    resultSizeEstimate.value = res.resultSizeEstimate || 0
  } catch (e: any) {
    toast.error('Failed to load emails', { description: e?.data?.message || e?.message })
  } finally {
    loading.value = false
  }
}

// ─── Fetch Single Message ────────────────────────────────
async function openMessage(id: string) {
  selectedId.value = id
  loadingMessage.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any }>(`/api/gmail/messages/${id}`)
    selectedMessage.value = res.data
    // Mark as read in local state
    const msg = messages.value.find(m => m.id === id)
    if (msg) msg.read = true
  } catch (e: any) {
    toast.error('Failed to load message', { description: e?.message })
  } finally {
    loadingMessage.value = false
  }
}

// ─── Folder Switch ───────────────────────────────────────
function switchFolder(folderId: string) {
  activeFolder.value = folderId
  selectedMessage.value = null
  selectedId.value = ''
  messages.value = []
  fetchMessages()
}

// ─── Search ──────────────────────────────────────────────
const debouncedSearch = refDebounced(searchQuery, 400)
watch(debouncedSearch, () => {
  selectedMessage.value = null
  fetchMessages()
})

// ─── Connect Gmail ───────────────────────────────────────
async function connectGmail() {
  try {
    const res = await $fetch<{ url: string }>('/api/gmail/auth-url')
    window.location.href = res.url
  } catch (e: any) {
    toast.error('Failed to connect', { description: e?.data?.message || e?.message })
  }
}

// ─── Helpers ─────────────────────────────────────────────
function formatDate(d: string) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const unreadCount = computed(() => messages.value.filter(m => !m.read).length)

onMounted(checkGmail)
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] flex overflow-hidden -m-4 lg:-m-6">

    <!-- Not Connected State -->
    <div v-if="!gmailConnected" class="flex-1 flex items-center justify-center p-8">
      <div class="text-center max-w-md space-y-6">
        <div class="mx-auto size-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg">
          <Icon name="i-lucide-mail" class="size-10 text-primary" />
        </div>
        <div>
          <h2 class="text-2xl font-bold tracking-tight">Connect Your Gmail</h2>
          <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
            Link your Google account to view and manage your emails directly from Hardwood Hub.
            Your data is secured with AES-256 encryption.
          </p>
        </div>
        <Button size="lg" class="gap-2 shadow-lg shadow-primary/20" @click="connectGmail">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5">
            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor" />
          </svg>
          Connect with Google
        </Button>
        <div class="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
          <Icon name="i-lucide-shield-check" class="size-3" />
          Read-only access · Encrypted storage · Revocable anytime
        </div>
      </div>
    </div>

    <!-- Connected: Email UI -->
    <template v-else>
      <!-- Sidebar -->
      <aside class="w-56 lg:w-64 border-r border-border/50 flex flex-col bg-card/50 shrink-0">
        <!-- Account -->
        <div class="p-3 border-b border-border/40">
          <div class="flex items-center gap-2.5 px-2 py-1.5">
            <div class="size-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Icon name="i-lucide-mail" class="size-4 text-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold truncate">{{ gmailEmail }}</p>
              <p class="text-[10px] text-muted-foreground">Google Mail</p>
            </div>
          </div>
        </div>

        <!-- Folders -->
        <nav class="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button
            v-for="f in folders"
            :key="f.id"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            :class="activeFolder === f.id
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'"
            @click="switchFolder(f.id)"
          >
            <Icon :name="f.icon" class="size-4 shrink-0" />
            <span class="flex-1 text-left">{{ f.label }}</span>
            <span v-if="f.id === 'INBOX' && unreadCount > 0" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </button>
        </nav>

        <!-- Refresh -->
        <div class="p-2 border-t border-border/40">
          <Button variant="ghost" size="sm" class="w-full justify-start gap-2 text-xs text-muted-foreground" :disabled="loading" @click="fetchMessages()">
            <Icon :name="loading ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw'" :class="loading ? 'size-3 animate-spin' : 'size-3'" />
            {{ loading ? 'Syncing...' : 'Refresh' }}
          </Button>
        </div>
      </aside>

      <!-- Message List -->
      <div class="w-80 lg:w-96 border-r border-border/50 flex flex-col bg-background shrink-0">
        <!-- Search -->
        <div class="p-3 border-b border-border/40">
          <div class="relative">
            <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search emails..."
              class="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all"
            />
          </div>
        </div>

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="loading && messages.length === 0" class="p-4 space-y-3">
            <div v-for="i in 8" :key="i" class="flex gap-3 p-3 rounded-lg animate-pulse">
              <div class="size-8 rounded-full bg-muted shrink-0" />
              <div class="flex-1 space-y-2">
                <div class="h-3 bg-muted rounded w-3/4" />
                <div class="h-2.5 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>

          <div v-else-if="messages.length === 0" class="flex flex-col items-center justify-center py-16 text-center px-4">
            <Icon name="i-lucide-inbox" class="size-12 text-muted-foreground/20 mb-3" />
            <p class="text-sm font-medium text-muted-foreground">No messages found</p>
          </div>

          <div v-else>
            <button
              v-for="msg in messages"
              :key="msg.id"
              class="w-full text-left px-4 py-3 border-b border-border/30 transition-all hover:bg-muted/40"
              :class="[
                selectedId === msg.id ? 'bg-primary/5 border-l-2 border-l-primary' : '',
                !msg.read ? 'bg-primary/[0.02]' : '',
              ]"
              @click="openMessage(msg.id)"
            >
              <div class="flex items-start gap-3">
                <div class="size-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5"
                  :class="!msg.read ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'"
                >
                  {{ (msg.fromName || '?').charAt(0).toUpperCase() }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-sm truncate" :class="!msg.read ? 'font-bold text-foreground' : 'font-medium text-foreground/80'">
                      {{ msg.fromName || msg.fromEmail }}
                    </p>
                    <span class="text-[10px] text-muted-foreground tabular-nums shrink-0">{{ formatDate(msg.internalDate || msg.date) }}</span>
                  </div>
                  <p class="text-xs mt-0.5 truncate" :class="!msg.read ? 'font-semibold text-foreground/90' : 'text-foreground/70'">
                    {{ msg.subject || '(no subject)' }}
                  </p>
                  <p class="text-[11px] text-muted-foreground mt-1 line-clamp-1">{{ msg.snippet }}</p>
                </div>
                <div v-if="!msg.read" class="size-2 rounded-full bg-primary shrink-0 mt-2" />
              </div>
            </button>

            <!-- Load More -->
            <div v-if="nextPageToken" class="p-4">
              <Button variant="ghost" size="sm" class="w-full text-xs" :disabled="loading" @click="fetchMessages(true)">
                <Icon v-if="loading" name="i-lucide-loader-2" class="size-3 animate-spin mr-1" />
                Load More
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Message Detail -->
      <div class="flex-1 flex flex-col overflow-hidden bg-background">
        <div v-if="loadingMessage" class="flex-1 flex items-center justify-center">
          <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
        </div>

        <div v-else-if="!selectedMessage" class="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <Icon name="i-lucide-mail-open" class="size-16 text-muted-foreground/15 mx-auto mb-4" />
            <p class="text-sm font-medium text-muted-foreground">Select a message to read</p>
          </div>
        </div>

        <template v-else>
          <!-- Message Header -->
          <div class="border-b border-border/40 p-5 shrink-0">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <h2 class="text-lg font-bold leading-tight">{{ selectedMessage.subject || '(no subject)' }}</h2>
                <div class="flex items-center gap-3 mt-3">
                  <div class="size-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold shrink-0">
                    {{ (selectedMessage.fromName || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold">{{ selectedMessage.fromName }}</p>
                    <p class="text-xs text-muted-foreground truncate">{{ selectedMessage.fromEmail }}</p>
                  </div>
                </div>
              </div>
              <div class="text-right shrink-0">
                <p class="text-xs text-muted-foreground tabular-nums">{{ formatDate(selectedMessage.internalDate || selectedMessage.date) }}</p>
                <div class="flex items-center gap-1 mt-2 justify-end">
                  <button @click="selectedMessage = null; selectedId = ''" class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                    <Icon name="i-lucide-x" class="size-4" />
                  </button>
                </div>
              </div>
            </div>
            <div v-if="selectedMessage.to" class="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <span class="font-medium">To:</span>
              <span class="truncate">{{ selectedMessage.to }}</span>
            </div>
          </div>

          <!-- Message Body -->
          <div class="flex-1 overflow-y-auto p-5">
            <div v-if="selectedMessage.htmlBody" class="prose prose-sm dark:prose-invert max-w-none" v-html="selectedMessage.htmlBody" />
            <pre v-else class="whitespace-pre-wrap text-sm text-foreground/90 font-sans leading-relaxed">{{ selectedMessage.body || selectedMessage.snippet }}</pre>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
