<script setup lang="ts">
import { useSidebar } from '~/components/ui/sidebar'

const props = defineProps<{
  teams: {
    _id: string
    name: string
    logo: string
    plan: string
  }[]
  modelValue?: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
}>()

const { isMobile } = useSidebar()

const activeTeam = computed({
  get: () => props.modelValue || props.teams[0],
  set: (val) => emit('update:modelValue', val)
})
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
            <!-- Logo only in the trigger button, no background -->
            <div class="aspect-square size-8 flex items-center justify-center rounded-lg overflow-hidden">
              <img src="/logo-192.png" alt="Hardwood Hub" class="size-8 object-cover" />
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ activeTeam!.name }}</span>
              <span class="truncate text-xs">{{ activeTeam!.plan }}</span>
            </div>
            <Icon name="i-lucide-chevrons-up-down" class="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="min-w-56 w-[--radix-dropdown-menu-trigger-width] rounded-lg"
          align="start"
          :side="isMobile ? 'bottom' : 'right'"
        >
          <DropdownMenuLabel class="text-xs text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          <DropdownMenuItem
            v-for="(team, index) in teams"
            :key="team.name"
            class="gap-2 p-2"
            @click="activeTeam = team"
          >
            <!-- Lucide icon instead of logo image -->
            <div class="size-6 flex items-center justify-center rounded-sm bg-sidebar-accent text-sidebar-accent-foreground shrink-0">
              <Icon :name="team.logo" class="size-3.5" />
            </div>
            {{ team.name }}
            <DropdownMenuShortcut>⌘{{ index + 1 }}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="gap-2 p-2" @click="navigateTo('/general-settings')">
            <div class="size-6 flex items-center justify-center border rounded-md bg-background">
              <Icon name="i-lucide-settings" class="size-4" />
            </div>
            <div class="text-muted-foreground font-medium">
              Manage Workspaces
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
