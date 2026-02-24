<script setup lang="ts">
const { setHeader } = usePageHeader()
setHeader({ title: 'Live Chat', icon: 'i-lucide-message-circle', description: 'Real-time customer communication' })

// ── Types ──
interface Contact {
  id: string
  name: string
  avatar: string
  role: string
  online: boolean
  lastMsg: string
  lastMsgTime: string
  unread: number
  typing?: boolean
}

interface Message {
  id: string
  contactId: string
  text: string
  time: string
  fromMe: boolean
  read: boolean
  type: 'text' | 'image' | 'file' | 'voice'
  fileName?: string
  fileSize?: string
  replyTo?: { name: string; text: string }
  reactions?: string[]
}

// ── Demo data ──
const contacts = ref<Contact[]>([
  { id: 'c1', name: 'Costa Quinn', avatar: '/avatars/shadcn.png', role: 'Product Manager', online: true, lastMsg: 'Yes, you can!', lastMsgTime: '1m', unread: 0 },
  { id: 'c2', name: 'Rachel Doe', avatar: '', role: 'Developer', online: true, lastMsg: '📎 2. Using the static met…', lastMsgTime: '14m', unread: 3 },
  { id: 'c3', name: 'Lewis Clarke', avatar: '', role: 'Designer', online: true, lastMsg: "💬 How's these all free? 😎", lastMsgTime: '15m', unread: 0 },
  { id: 'c4', name: 'Technical Issues', avatar: '', role: 'Support Channel', online: false, lastMsg: 'Great! 👍', lastMsgTime: '55m', unread: 0 },
  { id: 'c5', name: 'Bob Dean', avatar: '', role: 'Client', online: false, lastMsg: '📎 Hey Preline team, I got a…', lastMsgTime: '41m', unread: 1 },
  { id: 'c6', name: 'Mark Colbert', avatar: '/avatars/adeel.png', role: 'Sales Lead', online: false, lastMsg: '🎤 Voice message', lastMsgTime: '50m', unread: 0 },
  { id: 'c7', name: 'Ella Lauda', avatar: '', role: 'Engineer', online: false, lastMsg: '📎 site-source.zip', lastMsgTime: '37m', unread: 2 },
  { id: 'c8', name: 'Bugs & Improvements', avatar: '', role: 'Dev Channel', online: false, lastMsg: 'I found a bug: Combobox sel…', lastMsgTime: '1h', unread: 0 },
])

const messages = ref<Record<string, Message[]>>({
  c1: [
    { id: 'm1', contactId: 'c1', text: "Hey! I've been looking at the new dashboard design. Looks incredible! 🎨", time: '10:42 AM', fromMe: false, read: true, type: 'text' },
    { id: 'm2', contactId: 'c1', text: "Thanks! We spent a lot of time on the glassmorphism effects and micro-animations.", time: '10:43 AM', fromMe: true, read: true, type: 'text' },
    { id: 'm3', contactId: 'c1', text: "Can we add a dark mode toggle in the header?", time: '10:44 AM', fromMe: false, read: true, type: 'text' },
    { id: 'm4', contactId: 'c1', text: "Already implemented! The color mode composable handles it with smooth CSS transitions. Check the top-right corner 🌙", time: '10:45 AM', fromMe: true, read: true, type: 'text' },
    { id: 'm5', contactId: 'c1', text: "Perfect. One more thing — can we export the KPI charts as PDF?", time: '10:50 AM', fromMe: false, read: true, type: 'text' },
    { id: 'm6', contactId: 'c1', text: "Yes, you can!", time: '10:51 AM', fromMe: true, read: true, type: 'text' },
  ],
  c2: [
    { id: 'm7', contactId: 'c2', text: "I've been working on the API integration. Getting a CORS error on the staging server.", time: '9:30 AM', fromMe: false, read: true, type: 'text' },
    { id: 'm8', contactId: 'c2', text: "Are you using the correct origin header? Let me check the Vercel config.", time: '9:32 AM', fromMe: true, read: true, type: 'text' },
    { id: 'm9', contactId: 'c2', text: "Found it — the allowedOrigins array was missing the staging domain.", time: '9:35 AM', fromMe: true, read: true, type: 'text' },
    { id: 'm10', contactId: 'c2', text: "Here's the fix I deployed:", time: '9:36 AM', fromMe: true, read: true, type: 'text' },
    { id: 'm11', contactId: 'c2', text: "api-config-fix.patch", time: '9:36 AM', fromMe: true, read: false, type: 'file', fileName: 'api-config-fix.patch', fileSize: '2.4 KB' },
    { id: 'm12', contactId: 'c2', text: "2. Using the static method instead of the instance method resolved the hydration mismatch too.", time: '9:40 AM', fromMe: false, read: false, type: 'text' },
  ],
  c3: [
    { id: 'm13', contactId: 'c3', text: "This boilerplate is amazing! How's everything free? 😎", time: '9:10 AM', fromMe: false, read: true, type: 'text' },
    { id: 'm14', contactId: 'c3', text: "Open source at its finest! We believe in community-driven development 🚀", time: '9:12 AM', fromMe: true, read: true, type: 'text' },
  ],
  c5: [
    { id: 'm15', contactId: 'c5', text: "Hey Preline team, I got a question about the enterprise tier.", time: '10:05 AM', fromMe: false, read: false, type: 'text', replyTo: undefined },
    { id: 'm16', contactId: 'c5', text: "Does it include custom branding for the login page?", time: '10:06 AM', fromMe: false, read: false, type: 'text' },
  ],
})

// ── State ──
const activeContactId = ref('c1')
const messageInput = ref('')
const searchQuery = ref('')
const filterTab = ref<'all' | 'mentions' | 'spam' | 'blocked'>('all')
const chatAreaRef = ref<HTMLElement | null>(null)

const activeContact = computed(() => contacts.value.find(c => c.id === activeContactId.value) ?? contacts.value[0]!)
const activeMessages = computed(() => messages.value[activeContactId.value] || [])

const filteredContacts = computed(() => {
  let list = contacts.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c => c.name.toLowerCase().includes(q) || c.lastMsg.toLowerCase().includes(q))
  }
  return list
})

// ── Actions ──
function selectContact(id: string) {
  activeContactId.value = id
  // Clear unread
  const c = contacts.value.find(c => c.id === id)
  if (c) c.unread = 0
  nextTick(() => scrollToBottom())
}

function sendMessage() {
  if (!messageInput.value.trim()) return
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const msg: Message = {
    id: `m-${Date.now()}`,
    contactId: activeContactId.value,
    text: messageInput.value.trim(),
    time: timeStr,
    fromMe: true,
    read: false,
    type: 'text',
  }
  if (!messages.value[activeContactId.value]) {
    messages.value[activeContactId.value] = []
  }
  messages.value[activeContactId.value]!.push(msg)

  // Update last message in sidebar
  const c = contacts.value.find(c => c.id === activeContactId.value)
  if (c) {
    c.lastMsg = messageInput.value.trim()
    c.lastMsgTime = 'now'
  }

  messageInput.value = ''
  nextTick(() => scrollToBottom())

  // Simulate "read" after 1s
  setTimeout(() => { msg.read = true }, 1200)

  // Simulate typing + reply
  if (c) {
    setTimeout(() => { c.typing = true }, 1500)
    setTimeout(() => {
      c.typing = false
      const replies = [
        "Got it, I'll look into that! 👍",
        "Makes sense. Let me check on my end.",
        "That's a great point, thanks for sharing!",
        "Working on it now 🔧",
        "Sounds good to me!",
      ]
      const reply: Message = {
        id: `m-${Date.now() + 1}`,
        contactId: activeContactId.value,
        text: replies[Math.floor(Math.random() * replies.length)]!,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fromMe: false,
        read: true,
        type: 'text',
      }
      messages.value[activeContactId.value]?.push(reply)
      if (c) {
        c.lastMsg = reply.text
        c.lastMsgTime = 'now'
      }
      nextTick(() => scrollToBottom())
    }, 3000)
  }
}

function scrollToBottom() {
  if (chatAreaRef.value) {
    chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight
  }
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const avatarColors = [
  'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-pink-500',
]

function getAvatarColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

onMounted(() => scrollToBottom())
</script>

<template>
  <div class="flex h-[calc(100dvh-54px-3rem)] overflow-hidden rounded-xl border border-border/50 bg-background">

    <!-- ═══════════ LEFT SIDEBAR ═══════════ -->
    <div class="w-[320px] shrink-0 border-r border-border/50 flex flex-col bg-card/40">
      <!-- Search -->
      <div class="p-3 border-b border-border/30">
        <div class="relative">
          <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
          <Input
            v-model="searchQuery"
            placeholder="Search conversations…"
            class="pl-8 h-9 bg-muted/40 border-border/40 focus:bg-background transition-colors"
          />
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="flex items-center gap-0.5 px-3 py-2 border-b border-border/30">
        <button
          v-for="tab in ['all', 'mentions', 'spam', 'blocked'] as const"
          :key="tab"
          class="px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 capitalize"
          :class="filterTab === tab
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'"
          @click="filterTab = tab"
        >
          {{ tab }}
        </button>
      </div>

      <!-- Contact List -->
      <div class="flex-1 overflow-y-auto chat-scrollbar">
        <div
          v-for="contact in filteredContacts"
          :key="contact.id"
          class="flex items-center gap-3 px-3 py-3 cursor-pointer transition-all duration-200 border-b border-border/20"
          :class="activeContactId === contact.id
            ? 'bg-primary/8 border-l-2 border-l-primary'
            : 'hover:bg-muted/40 border-l-2 border-l-transparent'"
          @click="selectContact(contact.id)"
        >
          <!-- Avatar -->
          <div class="relative shrink-0">
            <Avatar class="size-10">
              <AvatarImage v-if="contact.avatar" :src="contact.avatar" :alt="contact.name" />
              <AvatarFallback
                :class="getAvatarColor(contact.id)"
                class="text-[11px] font-bold text-white"
              >
                {{ getInitials(contact.name) }}
              </AvatarFallback>
            </Avatar>
            <!-- Online indicator -->
            <span
              v-if="contact.online"
              class="absolute -bottom-0 -right-0 size-3 rounded-full bg-emerald-500 border-2 border-background ring-1 ring-emerald-500/30"
            />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold truncate" :class="contact.unread > 0 ? 'text-foreground' : ''">
                {{ contact.name }}
              </span>
              <div class="flex items-center gap-1 shrink-0 ml-2">
                <Icon v-if="!contact.unread" name="lucide:check-check" class="size-3.5 text-primary/60" />
                <span class="text-[10px] text-muted-foreground">{{ contact.lastMsgTime }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between mt-0.5">
              <p class="text-xs truncate" :class="contact.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'">
                {{ contact.lastMsg }}
              </p>
              <Badge
                v-if="contact.unread > 0"
                class="ml-2 shrink-0 h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center"
              >
                {{ contact.unread }}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ CHAT AREA ═══════════ -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Chat Header -->
      <div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div class="flex items-center gap-3">
          <div class="relative">
            <Avatar class="size-9">
              <AvatarImage v-if="activeContact.avatar" :src="activeContact.avatar" :alt="activeContact.name" />
              <AvatarFallback
                :class="getAvatarColor(activeContact.id)"
                class="text-[10px] font-bold text-white"
              >
                {{ getInitials(activeContact.name) }}
              </AvatarFallback>
            </Avatar>
            <span
              v-if="activeContact.online"
              class="absolute -bottom-0 -right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-background"
            />
          </div>
          <div>
            <h3 class="text-sm font-semibold leading-tight">{{ activeContact.name }}</h3>
            <p class="text-[11px] text-muted-foreground">
              <template v-if="activeContact.typing">
                <span class="text-primary font-medium">typing<span class="typing-dots">...</span></span>
              </template>
              <template v-else-if="activeContact.online">
                <span class="inline-flex items-center gap-1">
                  <span class="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </template>
              <template v-else>
                {{ activeContact.role }}
              </template>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-foreground">
            <Icon name="lucide:phone" class="size-4" />
          </Button>
          <Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-foreground">
            <Icon name="lucide:video" class="size-4" />
          </Button>
          <Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-foreground">
            <Icon name="lucide:search" class="size-4" />
          </Button>
          <Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-foreground">
            <Icon name="lucide:ellipsis-vertical" class="size-4" />
          </Button>
        </div>
      </div>

      <!-- Messages Area -->
      <div ref="chatAreaRef" class="flex-1 overflow-y-auto px-5 py-4 space-y-1 chat-scrollbar bg-gradient-to-b from-background to-muted/10">
        <!-- Date separator -->
        <div class="flex items-center justify-center py-3">
          <span class="px-3 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/60 rounded-full border border-border/30 uppercase tracking-wider">
            Today
          </span>
        </div>

        <template v-for="(msg, idx) in activeMessages" :key="msg.id">
          <!-- Sender label for received messages -->
          <div
            v-if="!msg.fromMe && (idx === 0 || activeMessages[idx - 1]?.fromMe)"
            class="pl-1 pt-3 pb-0.5"
          >
            <span class="text-[11px] font-semibold text-muted-foreground">{{ activeContact.name }}</span>
          </div>

          <!-- Message bubble -->
          <div
            class="flex items-end gap-2 message-appear"
            :class="msg.fromMe ? 'justify-end' : 'justify-start'"
            :style="{ animationDelay: `${idx * 30}ms` }"
          >
            <!-- Avatar (received only, first in cluster) -->
            <div
              v-if="!msg.fromMe && (idx === activeMessages.length - 1 || activeMessages[idx + 1]?.fromMe)"
              class="shrink-0 mb-1"
            >
              <Avatar class="size-7">
                <AvatarImage v-if="activeContact.avatar" :src="activeContact.avatar" :alt="activeContact.name" />
                <AvatarFallback
                  :class="getAvatarColor(activeContact.id)"
                  class="text-[8px] font-bold text-white"
                >
                  {{ getInitials(activeContact.name) }}
                </AvatarFallback>
              </Avatar>
            </div>
            <div v-else-if="!msg.fromMe" class="w-7 shrink-0" />

            <!-- Bubble -->
            <div
              class="relative max-w-[70%] group"
              :class="msg.fromMe ? 'order-1' : 'order-1'"
            >
              <!-- Reply preview -->
              <div v-if="msg.replyTo" class="mb-1 ml-1 pl-2 border-l-2 border-primary/40 rounded-sm">
                <p class="text-[10px] font-semibold text-primary/80">Reply to {{ msg.replyTo.name }}</p>
                <p class="text-[10px] text-muted-foreground truncate">{{ msg.replyTo.text }}</p>
              </div>

              <div
                class="rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm transition-shadow hover:shadow-md"
                :class="msg.fromMe
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted/70 border border-border/30 text-foreground rounded-bl-md'"
              >
                <!-- File message -->
                <div v-if="msg.type === 'file'" class="flex items-center gap-2.5">
                  <div
                    class="flex items-center justify-center size-9 rounded-lg shrink-0"
                    :class="msg.fromMe ? 'bg-primary-foreground/15' : 'bg-primary/10'"
                  >
                    <Icon name="lucide:file-text" class="size-4" :class="msg.fromMe ? 'text-primary-foreground' : 'text-primary'" />
                  </div>
                  <div>
                    <p class="text-xs font-medium">{{ msg.fileName }}</p>
                    <p class="text-[10px] opacity-70">{{ msg.fileSize }}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7 ml-1 shrink-0"
                    :class="msg.fromMe ? 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10' : ''"
                  >
                    <Icon name="lucide:download" class="size-3.5" />
                  </Button>
                </div>

                <!-- Voice message -->
                <div v-else-if="msg.type === 'voice'" class="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7 shrink-0"
                    :class="msg.fromMe ? 'text-primary-foreground hover:bg-primary-foreground/10' : ''"
                  >
                    <Icon name="lucide:play" class="size-3.5" />
                  </Button>
                  <div class="flex-1 h-1 bg-current/20 rounded-full overflow-hidden">
                    <div class="h-full w-[60%] bg-current/50 rounded-full" />
                  </div>
                  <span class="text-[10px] opacity-70">0:32</span>
                </div>

                <!-- Text message -->
                <template v-else>
                  {{ msg.text }}
                </template>

                <!-- Time + read receipt -->
                <div
                  class="flex items-center gap-1 justify-end mt-1 -mb-0.5"
                  :class="msg.fromMe ? 'text-primary-foreground/50' : 'text-muted-foreground/50'"
                >
                  <span class="text-[9px]">{{ msg.time }}</span>
                  <Icon
                    v-if="msg.fromMe"
                    :name="msg.read ? 'lucide:check-check' : 'lucide:check'"
                    class="size-3"
                    :class="msg.read ? 'text-sky-300' : ''"
                  />
                </div>
              </div>

              <!-- Reactions (hover) -->
              <div
                class="absolute -top-3 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-0.5 rounded-full bg-background border border-border/50 shadow-lg px-1 py-0.5 z-10"
                :class="msg.fromMe ? 'right-0' : 'left-0'"
              >
                <button v-for="emoji in ['👍', '❤️', '😂', '😮']" :key="emoji" class="size-6 flex items-center justify-center text-xs hover:scale-125 transition-transform rounded-full hover:bg-muted">
                  {{ emoji }}
                </button>
                <button class="size-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors">
                  <Icon name="lucide:plus" class="size-3" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Typing indicator -->
        <div v-if="activeContact.typing" class="flex items-end gap-2 justify-start">
          <Avatar class="size-7 shrink-0 mb-1">
            <AvatarImage v-if="activeContact.avatar" :src="activeContact.avatar" :alt="activeContact.name" />
            <AvatarFallback
              :class="getAvatarColor(activeContact.id)"
              class="text-[8px] font-bold text-white"
            >
              {{ getInitials(activeContact.name) }}
            </AvatarFallback>
          </Avatar>
          <div class="bg-muted/70 border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
            <div class="flex gap-1">
              <span class="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style="animation-delay: 0ms" />
              <span class="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style="animation-delay: 150ms" />
              <span class="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style="animation-delay: 300ms" />
            </div>
          </div>
        </div>
      </div>

      <!-- Message Input -->
      <div class="px-4 py-3 border-t border-border/50 bg-card/30 backdrop-blur-sm">
        <!-- Reply preview (static demo) -->
        <div class="flex items-center justify-between gap-3 mb-2" v-if="false">
          <div class="flex items-center gap-2 pl-3 border-l-2 border-primary">
            <div>
              <p class="text-[11px] font-semibold text-primary">Reply to Alex</p>
              <p class="text-[11px] text-muted-foreground truncate">I love Preline Pro!</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" class="size-6">
            <Icon name="lucide:x" class="size-3" />
          </Button>
        </div>

        <div class="flex items-end gap-2">
          <!-- Attachments -->
          <div class="flex items-center gap-0.5 shrink-0 pb-1">
            <Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-foreground">
              <Icon name="lucide:paperclip" class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-foreground">
              <Icon name="lucide:smile" class="size-4" />
            </Button>
          </div>

          <!-- Text input -->
          <div class="flex-1 relative">
            <Textarea
              v-model="messageInput"
              placeholder="Type a message…"
              class="min-h-[40px] max-h-[120px] resize-none bg-muted/30 border-border/40 rounded-xl pr-12 focus:bg-background transition-colors text-sm"
              rows="1"
              @keydown.enter.exact.prevent="sendMessage"
            />
          </div>

          <!-- Send / Voice -->
          <div class="shrink-0 pb-1">
            <Button
              v-if="messageInput.trim()"
              size="icon"
              class="size-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all active:scale-95"
              @click="sendMessage"
            >
              <Icon name="lucide:send-horizontal" class="size-4" />
            </Button>
            <Button
              v-else
              variant="ghost"
              size="icon"
              class="size-9 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Icon name="lucide:mic" class="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for chat */
.chat-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.chat-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.chat-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.15);
  border-radius: 999px;
}
.chat-scrollbar::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.3);
}

/* Message appear animation */
.message-appear {
  animation: msg-slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes msg-slide-in {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Typing dots animation */
.typing-dots {
  display: inline-block;
  animation: typing-blink 1.2s infinite steps(4, end);
}

@keyframes typing-blink {
  0%   { content: ''; opacity: 0.3; }
  25%  { content: '.'; opacity: 0.6; }
  50%  { content: '..'; opacity: 0.8; }
  75%  { content: '...'; opacity: 1; }
  100% { content: ''; opacity: 0.3; }
}
</style>
