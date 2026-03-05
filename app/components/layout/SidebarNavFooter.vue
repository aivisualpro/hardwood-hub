<script setup lang="ts">
import { useSidebar } from '~/components/ui/sidebar'

defineProps<{
  user: {
    name: string
    email: string
    avatar: string
    position: string
  }
}>()

const { isMobile, setOpenMobile } = useSidebar()

async function handleLogout() {
  try { await $fetch('/api/auth/logout', { method: 'POST' }) } catch {}
  const userCookie = useCookie('hardwood_user')
  userCookie.value = null
  navigateTo('/login')
}


</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarImage :src="user.avatar" :alt="user.name" />
              <AvatarFallback class="rounded-lg">
                {{ user.name.split(' ').map((n) => n[0]).join('') }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ user.name }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ user.position }}</span>
            </div>
            <Icon name="i-lucide-chevrons-up-down" class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="min-w-56 w-[--radix-dropdown-menu-trigger-width] rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarImage :src="user.avatar" :alt="user.name" />
                <AvatarFallback class="rounded-lg">
                  {{ user.name.split(' ').map((n) => n[0]).join('') }}
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">{{ user.name }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ user.position }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="handleLogout">
            <Icon name="i-lucide-log-out" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>


</template>

<style scoped>

</style>
