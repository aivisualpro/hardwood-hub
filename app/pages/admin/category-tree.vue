<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Handle, Position } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import dagre from 'dagre'
import { toast } from 'vue-sonner'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const { setHeader } = usePageHeader()
setHeader({ title: 'Category Tree', icon: 'i-lucide-git-merge', description: 'Visually manage sub-categories and predecessor logic' })

// ─── State ───────────────────────────────────────────────
const allNodes = ref<any[]>([])
const allEdges = ref<any[]>([])
const nodes = ref<any[]>([])
const edges = ref<any[]>([])
const loading = ref(true)
const rawTree = ref<any[]>([])

// ─── Filter / Search State ──────────────────────────────
const searchQuery = ref('')
const selectedCategories = ref<string[]>([])

// ─── Derived: Unique categories with colors ─────────────
const categories = computed(() => {
  return rawTree.value.map(cat => ({
    id: cat._id,
    name: cat.name,
    color: cat.color || '#94a3b8',
    count: cat.subCategories?.length ?? 0,
  }))
})

const activeFilterCount = computed(() => {
  let count = 0
  if (selectedCategories.value.length > 0) count += selectedCategories.value.length
  if (searchQuery.value.trim()) count += 1
  return count
})

const { fitView } = useVueFlow()

// ─── Build full graph from API data ─────────────────────
function buildGraph(tree: any[]) {
  const newNodes: any[] = []
  const newEdges: any[] = []

  tree.forEach(cat => {
    const rawColor = cat.color || '#94a3b8'
    
    cat.subCategories.forEach((sub: any) => {
      newNodes.push({
        id: `sub_${sub._id}`,
        type: 'subcategory',
        data: {
          label: sub.name,
          rawId: sub._id,
          categoryId: cat._id,
          categoryName: cat.name,
          color: rawColor,
          predecessor: sub.predecessor || '',
          dimmed: false,
        },
        position: { x: 0, y: 0 },
      })

      if (sub.predecessor) {
        newEdges.push({
          id: `e_pred_${sub.predecessor}_sub_${sub._id}`,
          source: `sub_${sub.predecessor}`,
          target: `sub_${sub._id}`,
          type: 'default',
          animated: true,
          label: 'Complete first',
          style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '3, 3' },
          labelStyle: { fill: '#f59e0b', fontWeight: 700, fontSize: 12 },
          labelBgPadding: [4, 4],
          labelBgBorderRadius: 4,
          labelBgStyle: { fill: '#fff', fillOpacity: 0.8 },
        })
      }
    })
  })

  allNodes.value = newNodes
  allEdges.value = newEdges
}

// ─── Apply filters to determine visible nodes ───────────
function applyFilters() {
  const q = searchQuery.value.trim().toLowerCase()
  const catFilter = selectedCategories.value
  const hasFilter = q.length > 0 || catFilter.length > 0

  if (!hasFilter) {
    // No filter: show everything, no dimming
    nodes.value = allNodes.value.map(n => ({
      ...n,
      data: { ...n.data, dimmed: false },
    }))
    edges.value = [...allEdges.value]
    nextTick(() => layoutAndFit())
    return
  }

  // Step 1: Determine primary matched sub IDs
  const matchedIds = new Set<string>()

  allNodes.value.forEach(node => {
    const d = node.data
    const matchesCat = catFilter.length === 0 || catFilter.includes(d.categoryId)
    const matchesSearch = q.length === 0 || d.label.toLowerCase().includes(q)
    if (matchesCat && matchesSearch) {
      matchedIds.add(node.id)
    }
  })

  // Step 2: Walk predecessor chains in BOTH directions to include related nodes
  const relatedIds = new Set<string>(matchedIds)

  // Walk predecessors UP (if A requires B, and A matches, also show B)
  function walkUp(nodeId: string) {
    allEdges.value.forEach(edge => {
      if (edge.target === nodeId && !relatedIds.has(edge.source)) {
        relatedIds.add(edge.source)
        walkUp(edge.source)
      }
    })
  }
  // Walk successors DOWN (if A requires B, and B matches, also show A)
  function walkDown(nodeId: string) {
    allEdges.value.forEach(edge => {
      if (edge.source === nodeId && !relatedIds.has(edge.target)) {
        relatedIds.add(edge.target)
        walkDown(edge.target)
      }
    })
  }

  matchedIds.forEach(id => {
    walkUp(id)
    walkDown(id)
  })

  // Show matched + related, dim the related (not directly matched) ones
  nodes.value = allNodes.value
    .filter(n => relatedIds.has(n.id))
    .map(n => ({
      ...n,
      data: {
        ...n.data,
        dimmed: !matchedIds.has(n.id),
      },
    }))

  const visibleIds = new Set(nodes.value.map(n => n.id))
  edges.value = allEdges.value.filter(
    e => visibleIds.has(e.source) && visibleIds.has(e.target),
  )

  nextTick(() => layoutAndFit())
}

// ─── Watch filters to reactively re-apply ───────────────
watch([searchQuery, selectedCategories], () => {
  applyFilters()
}, { deep: true })

// ─── Layout + adaptive zoom ─────────────────────────────
function layoutAndFit() {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'BT', nodesep: 60, ranksep: 100, align: 'DL' })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.value.forEach((node) => {
    g.setNode(node.id, { width: 240, height: 80 })
  })

  edges.value.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  nodes.value = nodes.value.map((node) => {
    const nodeWithPos = g.node(node.id)
    if (!nodeWithPos) return node
    return {
      ...node,
      position: { x: nodeWithPos.x - nodeWithPos.width / 2, y: nodeWithPos.y - nodeWithPos.height / 2 },
    }
  })

  // Adaptive zoom: fewer nodes = zoom in for clarity
  const count = nodes.value.length
  const padding = count <= 3 ? 0.6 : count <= 8 ? 0.35 : 0.2

  setTimeout(() => {
    try { fitView({ padding, duration: 600, maxZoom: count <= 3 ? 1.5 : 1.2 }) } catch {}
  }, 120)
}

function layoutNodes() {
  layoutAndFit()
}

// ─── Fetch data on mount ─────────────────────────────────
async function fetchTree() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: any[] }>('/api/skills/tree')
    rawTree.value = res.data
    buildGraph(res.data)

    // Initial unfiltered render
    nodes.value = allNodes.value.map(n => ({ ...n, data: { ...n.data, dimmed: false } }))
    edges.value = [...allEdges.value]

    await nextTick()
    setTimeout(() => layoutAndFit(), 100)
  }
  catch (e: any) {
    toast.error('Failed to load tree', { description: e?.message })
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchTree()
})

// ─── Category Filter Toggle ─────────────────────────────
function toggleCategory(catId: string) {
  const idx = selectedCategories.value.indexOf(catId)
  if (idx >= 0) selectedCategories.value.splice(idx, 1)
  else selectedCategories.value.push(catId)
}

function clearFilters() {
  searchQuery.value = ''
  selectedCategories.value = []
}

// ─── Predecessor Connect / Disconnect ───────────────────
async function handleConnect(params: any) {
  if (params.source.startsWith('sub_') && params.target.startsWith('sub_')) {
    const sourceId = params.source.replace('sub_', '')
    const targetId = params.target.replace('sub_', '')

    if (sourceId === targetId) {
      toast.error('Cannot link a sub-category to itself')
      return
    }

    try {
      await $fetch(`/api/subcategories/${targetId}`, {
        method: 'PUT',
        body: { predecessor: sourceId },
      })
      toast.success('Predecessor linked successfully!')

      // Remove existing predecessor edge for this target from BOTH allEdges and edges
      allEdges.value = allEdges.value.filter(e => !(e.target === params.target && e.id.startsWith('e_pred_')))
      edges.value = edges.value.filter(e => !(e.target === params.target && e.id.startsWith('e_pred_')))

      const newEdge = {
        id: `e_pred_${sourceId}_sub_${targetId}`,
        source: params.source,
        target: params.target,
        type: 'default',
        animated: true,
        label: 'Complete first',
        style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '3, 3' },
        labelStyle: { fill: '#f59e0b', fontWeight: 700, fontSize: 12 },
        labelBgPadding: [4, 4],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#fff', fillOpacity: 0.8 },
      }
      allEdges.value.push(newEdge)
      edges.value.push(newEdge)
    }
    catch (e: any) {
      toast.error('Failed to link predecessor', { description: e?.message })
    }
  }
  else {
    toast.error('Invalid connection', { description: 'You can only link Sub-Categories to set predecessor requirements.' })
  }
}

async function handleEdgeDoubleClick(params: any) {
  const edge = params.edge
  if (edge.id.startsWith('e_pred_')) {
    toast.warning('Remove this predecessor requirement?', {
      description: 'This will unlink the requirement between these sub-categories.',
      action: {
        label: 'Remove',
        onClick: async () => {
          const targetId = edge.target.replace('sub_', '')
          try {
            await $fetch(`/api/subcategories/${targetId}`, {
              method: 'PUT',
              body: { predecessor: '' },
            })
            allEdges.value = allEdges.value.filter(e => e.id !== edge.id)
            edges.value = edges.value.filter(e => e.id !== edge.id)
            toast.success('Requirement removed')
          }
          catch (e) {
            toast.error('Failed to remove requirement')
          }
        }
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {}
      }
    })
  }
}
</script>

<template>
  <div class="h-[calc(100vh-100px)] w-full relative bg-muted/10 rounded-xl overflow-hidden border border-border/50">
    <!-- Loading -->
    <div v-if="loading" class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
      <p class="mt-4 font-medium text-muted-foreground">Building visual tree...</p>
    </div>

    <!-- ─── TOP TOOLBAR ────────────────────────────────── -->
    <div class="absolute top-3 left-3 right-3 z-10 flex items-start gap-3">
      
      <!-- Search + Category Filters Panel -->
      <div class="bg-card/95 backdrop-blur-md border border-border/60 shadow-xl rounded-xl p-3 flex flex-col gap-3 min-w-[320px] max-w-sm pointer-events-auto">
        
        <!-- Search Input -->
        <div class="relative">
          <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search sub-categories..."
            class="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-border/50 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 placeholder:text-muted-foreground/40 transition-all"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
          >
            <Icon name="i-lucide-x" class="size-3 text-muted-foreground" />
          </button>
        </div>

        <!-- Category Filter Pills -->
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="cat in categories"
            :key="cat.id"
            @click="toggleCategory(cat.id)"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all duration-200 cursor-pointer select-none"
            :class="selectedCategories.includes(cat.id) 
              ? 'text-white shadow-md scale-105' 
              : 'bg-card hover:scale-105 text-muted-foreground/80 hover:text-foreground'"
            :style="selectedCategories.includes(cat.id) 
              ? { backgroundColor: cat.color, borderColor: cat.color, boxShadow: `0 2px 8px ${cat.color}40` } 
              : { borderColor: `${cat.color}40` }"
          >
            <span 
              class="size-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: selectedCategories.includes(cat.id) ? '#fff' : cat.color }"
            ></span>
            {{ cat.name }}
            <span class="text-[10px] opacity-70">({{ cat.count }})</span>
          </button>
        </div>

        <!-- Active Filter Status Bar -->
        <div v-if="activeFilterCount > 0" class="flex items-center justify-between border-t border-border/30 pt-2">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="i-lucide-filter" class="size-3.5 text-primary" />
            <span>{{ nodes.length }} result{{ nodes.length !== 1 ? 's' : '' }}</span>
            <span v-if="nodes.some(n => n.data.dimmed)" class="text-amber-500">
              • includes linked predecessors
            </span>
          </div>
          <button
            @click="clearFilters"
            class="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
          >
            <Icon name="i-lucide-x-circle" class="size-3" />
            Clear
          </button>
        </div>
      </div>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Auto Layout Button -->
      <div class="pointer-events-auto">
        <Button variant="secondary" size="sm" class="shadow-sm" @click="layoutNodes">
          <Icon name="i-lucide-layout-list" class="mr-2 size-4" />
          Auto Layout
        </Button>
      </div>
    </div>

    <!-- ─── VUE FLOW CANVAS ────────────────────────────── -->
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      @connect="handleConnect"
      @edge-double-click="handleEdgeDoubleClick"
      :default-viewport="{ zoom: 0.8 }"
      :min-zoom="0.1"
      :max-zoom="2"
      fit-view-on-init
      class="vue-flow-theme"
    >
      <Background pattern-color="#888" :gap="20" :size="1" />
      <Controls position="bottom-right" />
      <MiniMap position="bottom-left" />
      
      <!-- Custom Sub-Category Node -->
      <template #node-subcategory="{ data }">
        <div 
          class="px-4 py-3 rounded-xl border-2 shadow-sm flex flex-col items-center justify-center gap-1.5 w-[240px] transition-all duration-300 cursor-grab group/node relative bg-card"
          :class="data.dimmed ? 'opacity-40 scale-95' : 'hover:shadow-lg'"
          :style="{ borderColor: `${data.color}80`, boxShadow: data.dimmed ? 'none' : `0 4px 14px 0 ${data.color}15` }"
        >
          <Handle type="source" :position="Position.Top" class="!w-3 !h-3 !-top-1.5 transition-colors" :style="{ backgroundColor: data.color }" />
          <Handle type="target" :position="Position.Bottom" class="!w-3 !h-3 !-bottom-1.5 transition-colors" :style="{ backgroundColor: data.color }" />
          
          <!-- Category Badge -->
          <div class="flex items-center gap-2 mb-1 w-full justify-center">
            <div class="size-6 rounded-md flex items-center justify-center shrink-0" :style="{ backgroundColor: `${data.color}20` }">
              <Icon name="i-lucide-layers" class="size-3.5" :style="{ color: data.color }" />
            </div>
            <div class="font-bold text-xs uppercase tracking-wider truncate max-w-[160px]" :style="{ color: data.color }">{{ data.categoryName }}</div>
          </div>
          
          <!-- Sub-Category Name -->
          <div class="font-bold text-[15px] text-foreground leading-tight text-center drop-shadow-sm px-2 w-full truncate" :title="data.label">{{ data.label }}</div>
          
          <!-- Dimmed badge for related predecessors -->
          <div v-if="data.dimmed" class="absolute -top-2 -right-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
            LINKED
          </div>
        </div>
      </template>
    </VueFlow>
  </div>
</template>

<style>
/* Vue Flow custom overrides */
.vue-flow-theme .vue-flow__node {
  border-radius: 8px;
}
.vue-flow-theme .vue-flow__edge-path {
  stroke-width: 2;
}
.vue-flow-theme .vue-flow__connection-path {
  stroke: #f59e0b;
  stroke-width: 2;
  stroke-dasharray: 5, 5;
}
.vue-flow-theme .vue-flow__minimap {
  background: rgba(var(--background), 0.8);
  border: 1px solid rgba(var(--border), 0.5);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.vue-flow-theme .vue-flow__minimap-node {
  fill: rgba(var(--primary), 0.5);
}
.vue-flow-theme .vue-flow__controls {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(var(--border), 0.5);
}
.vue-flow-theme .vue-flow__controls-button {
  background: rgba(var(--card), 1);
  border-bottom: 1px solid rgba(var(--border), 0.5);
  color: rgba(var(--foreground), 1);
}
.vue-flow-theme .vue-flow__controls-button:hover {
  background: rgba(var(--muted), 1);
}
.vue-flow-theme .vue-flow__controls-button svg {
  fill: currentColor;
}
</style>
