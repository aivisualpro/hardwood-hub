<script lang="ts" setup>
import type { Task } from './data/schema'
import type { ColumnDef } from '@tanstack/vue-table'
import { useMediaQuery } from '@vueuse/core'
import { projects, taskProjectMap } from './data/projects'
import { cn } from '~/lib/utils'
import DataTable from './components/DataTable.vue'

interface Props {
  data: Task[]
  columns: ColumnDef<Task, any>[]
  defaultLayout?: number[]
  defaultCollapsed?: boolean
  navCollapsedSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  defaultCollapsed: false,
  defaultLayout: () => [20, 80],
  navCollapsedSize: 4,
})

const isCollapsed = ref(props.defaultCollapsed)
const selectedProjectId = ref<string | null>(null)
const selectedStageId = ref<string | null>(null)

// Compute task counts per project
const taskCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const project of projects) {
    counts[project.id] = 0
  }
  for (const task of props.data) {
    const mapping = taskProjectMap[task.id]
    if (mapping) {
      counts[mapping.projectId] = (counts[mapping.projectId] || 0) + 1
    }
  }
  return counts
})

// Compute task counts per stage
const stageCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const task of props.data) {
    const mapping = taskProjectMap[task.id]
    if (mapping) {
      counts[mapping.stageId] = (counts[mapping.stageId] || 0) + 1
    }
  }
  return counts
})

// Filter tasks based on selected project/stage
const filteredData = computed(() => {
  if (!selectedProjectId.value) {
    return props.data
  }

  return props.data.filter((task) => {
    const mapping = taskProjectMap[task.id]
    if (!mapping)
      return false

    if (selectedStageId.value) {
      return mapping.projectId === selectedProjectId.value && mapping.stageId === selectedStageId.value
    }

    return mapping.projectId === selectedProjectId.value
  })
})

// Get selected context label for the header
const selectedLabel = computed(() => {
  if (!selectedProjectId.value)
    return 'All Tasks'

  const project = projects.find(p => p.id === selectedProjectId.value)
  if (!project)
    return 'All Tasks'

  if (selectedStageId.value) {
    const stage = project.stages.find(s => s.id === selectedStageId.value)
    return stage ? `${project.name} / ${stage.name}` : project.name
  }

  return project.name
})

const selectedStageColor = computed(() => {
  if (!selectedProjectId.value || !selectedStageId.value)
    return null
  const project = projects.find(p => p.id === selectedProjectId.value)
  if (!project)
    return null
  const stage = project.stages.find(s => s.id === selectedStageId.value)
  return stage?.color || null
})

function onSelectProject(projectId: string | null) {
  selectedProjectId.value = projectId
  selectedStageId.value = null
}

function onSelectStage(projectId: string, stageId: string) {
  selectedProjectId.value = projectId
  selectedStageId.value = stageId || null
}

function onCollapse() {
  isCollapsed.value = true
}

function onExpand() {
  isCollapsed.value = false
}

const defaultCollapse = useMediaQuery('(max-width: 768px)')

watch(() => defaultCollapse.value, () => {
  isCollapsed.value = defaultCollapse.value
})
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <ResizablePanelGroup
      id="tasks-panel-group"
      direction="horizontal"
      class="h-full max-h-[calc(100dvh-54px-3rem)] items-stretch"
    >
      <!-- Sidebar Panel -->
      <ResizablePanel
        id="tasks-sidebar-panel"
        :default-size="defaultLayout[0]"
        :collapsed-size="navCollapsedSize"
        collapsible
        :min-size="15"
        :max-size="25"
        :class="cn(isCollapsed && 'min-w-[50px] transition-all duration-300 ease-in-out')"
        @expand="onExpand"
        @collapse="onCollapse"
      >
        <TasksProjectSidebar
          :projects="projects"
          :selected-project-id="selectedProjectId"
          :selected-stage-id="selectedStageId"
          :task-counts="taskCounts"
          :stage-counts="stageCounts"
          :is-collapsed="isCollapsed"
          @select-project="onSelectProject"
          @select-stage="onSelectStage"
        />
      </ResizablePanel>

      <ResizableHandle id="tasks-resize-handle" with-handle />

      <!-- Main Content Panel -->
      <ResizablePanel id="tasks-content-panel" :default-size="defaultLayout[1]" :min-size="50">
        <div class="flex flex-col h-full">
          <!-- Context header -->
          <div class="flex items-center gap-2 px-4 h-[56px] border-b">
            <div class="flex items-center gap-2 min-w-0">
              <span
                v-if="selectedStageColor"
                class="size-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: selectedStageColor }"
              />
              <Icon v-else-if="selectedProjectId" name="lucide:folder-kanban" class="size-4 text-primary shrink-0" />
              <Icon v-else name="lucide:layout-list" class="size-4 text-muted-foreground shrink-0" />
              <h2 class="text-base font-semibold truncate">{{ selectedLabel }}</h2>
            </div>
            <Badge variant="outline" class="ml-auto tabular-nums text-xs shrink-0">
              {{ filteredData.length }} {{ filteredData.length === 1 ? 'task' : 'tasks' }}
            </Badge>
          </div>

          <!-- Data table -->
          <div class="flex-1 overflow-auto p-4">
            <DataTable :data="filteredData" :columns="columns" />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </TooltipProvider>
</template>
