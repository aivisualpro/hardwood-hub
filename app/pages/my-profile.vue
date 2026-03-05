<script setup lang="ts">
const { setHeader } = usePageHeader()
setHeader({ title: 'My Profile', icon: 'i-lucide-user-circle', description: 'View and manage your profile' })
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-8">
    <!-- Profile card -->
    <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
      <!-- Cover gradient -->
      <div class="h-32 bg-gradient-to-r from-primary/30 via-violet-500/20 to-cyan-500/20" />
      <div class="px-6 pb-6">
        <!-- Avatar area -->
        <div class="flex items-end gap-5 -mt-12">
          <div class="size-24 rounded-2xl bg-background border-4 border-background shadow-lg flex items-center justify-center overflow-hidden">
            <img src="/avatars/adeel.png" alt="Profile" class="size-full object-cover" />
          </div>
          <div class="flex-1 pb-1">
            <h2 class="text-xl font-bold">Adeel Jabbar</h2>
            <p class="text-sm text-muted-foreground">adeel@hardwoodhub.com</p>
          </div>
          <Button variant="outline" size="sm">
            <Icon name="i-lucide-pencil" class="mr-1.5 size-3.5" />
            Edit Profile
          </Button>
        </div>
      </div>
    </div>

    <!-- Info grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal Info</p>
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Full Name</span>
            <span class="font-medium">Adeel Jabbar</span>
          </div>
          <Separator />
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Email</span>
            <span class="font-medium">adeel@hardwoodhub.com</span>
          </div>
          <Separator />
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Role</span>
            <Badge variant="secondary">Super Admin</Badge>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity</p>
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Last Login</span>
            <span class="font-medium">Today</span>
          </div>
          <Separator />
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Status</span>
            <span class="flex items-center gap-1.5 font-medium text-emerald-400">
              <span class="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
