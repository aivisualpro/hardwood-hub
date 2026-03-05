<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import { TrendingUp } from 'lucide-vue-next'

const { setHeader } = usePageHeader()
setHeader({ title: 'Sales Reports', description: 'Comprehensive sales analytics and performance insights', icon: 'i-lucide-trending-up' })

const activeTab = ref('overview')

// ── KPI Cards ──────────────────────────────────────
const kpis = ref([
  { label: 'Total Revenue', value: 0, target: 2847500, prefix: '$', suffix: '', change: 18.4, icon: 'i-lucide-dollar-sign', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Deals Closed', value: 0, target: 142, prefix: '', suffix: '', change: 12.1, icon: 'i-lucide-handshake', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { label: 'Avg. Deal Size', value: 0, target: 20053, prefix: '$', suffix: '', change: 5.7, icon: 'i-lucide-bar-chart-3', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { label: 'Win Rate', value: 0, target: 38.2, prefix: '', suffix: '%', change: 3.1, icon: 'i-lucide-trophy', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { label: 'Pipeline Value', value: 0, target: 4215000, prefix: '$', suffix: '', change: 22.6, icon: 'i-lucide-layers', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { label: 'Sales Cycle', value: 0, target: 34, prefix: '', suffix: ' days', change: -8.2, icon: 'i-lucide-clock', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
])

onMounted(() => {
  kpis.value = kpis.value.map(k => ({ ...k, value: k.target }))
})

// ── Revenue Trend ──────────────────────────────────
const revenueData = [
  { month: 'Jan', revenue: 198000, target: 210000, lastYear: 172000 },
  { month: 'Feb', revenue: 225000, target: 215000, lastYear: 185000 },
  { month: 'Mar', revenue: 245000, target: 220000, lastYear: 198000 },
  { month: 'Apr', revenue: 232000, target: 225000, lastYear: 205000 },
  { month: 'May', revenue: 268000, target: 230000, lastYear: 212000 },
  { month: 'Jun', revenue: 285000, target: 235000, lastYear: 228000 },
  { month: 'Jul', revenue: 295000, target: 240000, lastYear: 235000 },
  { month: 'Aug', revenue: 278000, target: 245000, lastYear: 242000 },
  { month: 'Sep', revenue: 312000, target: 250000, lastYear: 248000 },
  { month: 'Oct', revenue: 298000, target: 255000, lastYear: 255000 },
  { month: 'Nov', revenue: 325000, target: 260000, lastYear: 262000 },
  { month: 'Dec', revenue: 348000, target: 265000, lastYear: 275000 },
]

// ── Pipeline by Stage ──────────────────────────────
const pipelineData = [
  { name: 'Lead', value: 1250000 },
  { name: 'Qualified', value: 890000 },
  { name: 'Proposal', value: 650000 },
  { name: 'Negotiation', value: 480000 },
  { name: 'Closing', value: 320000 },
]
const pipelineMax = computed(() => pipelineData[0]?.value ?? 1)
const funnelColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'] as const

// ── Revenue by Product ─────────────────────────────
const productData = [
  { name: 'Enterprise CRM', value: 1125000 },
  { name: 'ERP Platform', value: 845000 },
  { name: 'Analytics Suite', value: 425000 },
  { name: 'Support Plans', value: 312500 },
  { name: 'Consulting', value: 140000 },
]

// ── Monthly Deals Breakdown ────────────────────────
const dealsData = [
  { month: 'Jan', won: 10, lost: 4, pending: 8 },
  { month: 'Feb', won: 12, lost: 5, pending: 6 },
  { month: 'Mar', won: 14, lost: 3, pending: 9 },
  { month: 'Apr', won: 11, lost: 6, pending: 7 },
  { month: 'May', won: 15, lost: 4, pending: 5 },
  { month: 'Jun', won: 13, lost: 3, pending: 8 },
  { month: 'Jul', won: 16, lost: 5, pending: 6 },
  { month: 'Aug', won: 12, lost: 4, pending: 9 },
  { month: 'Sep', won: 18, lost: 3, pending: 5 },
  { month: 'Oct', won: 14, lost: 5, pending: 7 },
  { month: 'Nov', won: 17, lost: 2, pending: 6 },
  { month: 'Dec', won: 19, lost: 3, pending: 4 },
]

// ── Top Sales Reps ─────────────────────────────────
const topReps = [
  { name: 'Sarah Johnson', role: 'Senior AE', revenue: 485000, deals: 24, quota: 92, avatar: 'SJ' },
  { name: 'David Kim', role: 'Account Executive', revenue: 412000, deals: 21, quota: 88, avatar: 'DK' },
  { name: 'Emily Rodriguez', role: 'Senior AE', revenue: 378000, deals: 19, quota: 85, avatar: 'ER' },
  { name: 'Michael Chen', role: 'Account Executive', revenue: 345000, deals: 18, quota: 82, avatar: 'MC' },
  { name: 'Priya Patel', role: 'SDR Lead', revenue: 298000, deals: 16, quota: 78, avatar: 'PP' },
  { name: 'James Wilson', role: 'Account Executive', revenue: 265000, deals: 14, quota: 75, avatar: 'JW' },
  { name: 'Lisa Chang', role: 'SDR', revenue: 232000, deals: 12, quota: 71, avatar: 'LC' },
  { name: 'Robert Martinez', role: 'Account Executive', revenue: 198000, deals: 10, quota: 68, avatar: 'RM' },
]

// ── Top Clients ────────────────────────────────────
const topClients = [
  { name: 'TechVision Inc', industry: 'Technology', lifetime: 485000, deals: 8, status: 'Active' },
  { name: 'GlobalSoft', industry: 'Software', lifetime: 412000, deals: 6, status: 'Active' },
  { name: 'Apex Group', industry: 'Finance', lifetime: 378000, deals: 5, status: 'Churned' },
  { name: 'NexGen Solutions', industry: 'IT Services', lifetime: 345000, deals: 7, status: 'Active' },
  { name: 'Meridian Corp', industry: 'Manufacturing', lifetime: 298000, deals: 4, status: 'Active' },
  { name: 'CloudNine Tech', industry: 'Cloud Services', lifetime: 265000, deals: 5, status: 'At Risk' },
]

// ── Regional Revenue ───────────────────────────────
const regionData = [
  { region: 'North America', revenue: 1480000, pct: 52 },
  { region: 'Europe', revenue: 682000, pct: 24 },
  { region: 'Asia Pacific', revenue: 398000, pct: 14 },
  { region: 'Latin America', revenue: 171000, pct: 6 },
  { region: 'Middle East & Africa', revenue: 116500, pct: 4 },
]

// ── Forecast ───────────────────────────────────────
const forecastData = [
  { quarter: 'Q1 2026', actual: 668000, forecast: 645000, confidence: 95 },
  { quarter: 'Q2 2026', actual: 785000, forecast: 710000, confidence: 90 },
  { quarter: 'Q3 2026', actual: 885000, forecast: 820000, confidence: 85 },
  { quarter: 'Q4 2026', actual: null, forecast: 895000, confidence: 75 },
]

// ── Helpers ────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1000000)
    return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000)
    return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function fmtFull(n: number) {
  return `$${n.toLocaleString('en-US')}`
}

const avatarColors = [
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
]
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <div class="w-full flex flex-col gap-5 p-1">
    <!-- Tab Navigation -->
    <div class="flex items-center gap-1 border rounded-lg p-1 bg-muted/30 w-fit">
      <button
        v-for="tab in [{ id: 'overview', label: 'Overview', icon: 'i-lucide-layout-dashboard' }, { id: 'pipeline', label: 'Pipeline', icon: 'i-lucide-funnel' }, { id: 'team', label: 'Team', icon: 'i-lucide-users' }, { id: 'forecast', label: 'Forecast', icon: 'i-lucide-brain' }]"
        :key="tab.id"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all" :class="[
          activeTab === tab.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
        ]"
        @click="activeTab = tab.id"
      >
        <Icon :name="tab.icon" class="size-3.5" />
        {{ tab.label }}
      </button>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Card v-for="(kpi, i) in kpis" :key="i">
        <CardContent class="p-4 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center justify-center rounded-lg p-1.5" :class="kpi.bg">
              <Icon :name="kpi.icon" class="size-3.5" :class="kpi.color" />
            </div>
            <Badge
              variant="outline"
              :class="kpi.change > 0 ? 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-800' : 'text-rose-600 border-rose-200 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-800'"
              class="text-[10px] px-1.5 py-0"
            >
              {{ kpi.change > 0 ? '+' : '' }}{{ kpi.change }}%
            </Badge>
          </div>
          <div>
            <p class="text-xl font-bold tabular-nums leading-tight">
              {{ kpi.prefix }}<NumberFlow :value="kpi.value" :format="{ notation: kpi.value > 99999 ? 'compact' : 'standard', maximumFractionDigits: 1 }" />{{ kpi.suffix }}
            </p>
            <p class="text-[10px] text-muted-foreground mt-0.5">
              {{ kpi.label }}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- OVERVIEW TAB -->
    <template v-if="activeTab === 'overview'">
      <!-- Revenue Trend + Product Mix -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card class="lg:col-span-2">
          <CardHeader class="pb-2">
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="text-sm font-semibold">
                  Revenue Trend
                </CardTitle>
                <CardDescription>Monthly revenue vs target vs last year</CardDescription>
              </div>
              <Badge variant="outline" class="text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10">
                <TrendingUp class="size-3 mr-1" /> +18.4% YoY
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <AreaChart
              :data="revenueData"
              index="month"
              :categories="['revenue', 'target', 'lastYear']"
              :colors="['#10b981', '#3b82f6', '#94a3b8']"
              :y-formatter="(v: number | Date) => `$${(Number(v) / 1000).toFixed(0)}K`"
              class="h-[280px]"
              :show-legend="true"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Revenue by Product
            </CardTitle>
            <CardDescription>Product contribution to total revenue</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col items-center">
            <DonutChart
              :data="productData"
              index="name"
              category="value"
              :colors="['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899']"
              :value-formatter="(v: number) => fmt(v)"
              class="h-[180px]"
            />
            <div class="w-full mt-4 space-y-2">
              <div v-for="(p, i) in productData" :key="p.name" class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <div class="size-2.5 rounded-full" :style="{ background: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'][i] }" />
                  <span class="text-muted-foreground">{{ p.name }}</span>
                </div>
                <span class="font-semibold tabular-nums">{{ fmt(p.value) }}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Deals Breakdown + Regional -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Deals Breakdown
            </CardTitle>
            <CardDescription>Monthly won, lost, and pending deals</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              :data="dealsData"
              index="month"
              :categories="['won', 'lost', 'pending']"
              :colors="['#10b981', '#ef4444', '#f59e0b']"
              type="stacked"
              :rounded-corners="4"
              class="h-[260px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Revenue by Region
            </CardTitle>
            <CardDescription>Geographic revenue distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div v-for="r in regionData" :key="r.region" class="space-y-1.5">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium">{{ r.region }}</span>
                  <span class="text-muted-foreground tabular-nums">{{ fmt(r.revenue) }} <span class="text-[10px]">({{ r.pct }}%)</span></span>
                </div>
                <div class="h-2 rounded-full bg-muted overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-1000" :style="{ width: `${r.pct}%` }" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Top Clients Table -->
      <Card>
        <CardHeader class="pb-2">
          <div class="flex items-center justify-between">
            <div>
              <CardTitle class="text-sm font-semibold">
                Top Clients
              </CardTitle>
              <CardDescription>Highest revenue generating clients</CardDescription>
            </div>
            <Badge variant="secondary" class="text-xs">
              6 clients
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead class="text-right">
                  Lifetime Revenue
                </TableHead>
                <TableHead class="text-center">
                  Deals
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(c, i) in topClients" :key="c.name">
                <TableCell>
                  <div class="flex items-center gap-2">
                    <div class="flex items-center justify-center rounded-full size-7 text-[10px] font-bold" :class="avatarColors[i % avatarColors.length]">
                      {{ c.name.split(' ').map((w: string) => w[0]).join('') }}
                    </div>
                    <span class="font-medium text-sm">{{ c.name }}</span>
                  </div>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ c.industry }}
                </TableCell>
                <TableCell class="text-right font-semibold tabular-nums">
                  {{ fmtFull(c.lifetime) }}
                </TableCell>
                <TableCell class="text-center tabular-nums">
                  {{ c.deals }}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    :class="c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : c.status === 'At Risk' ? 'bg-amber-500/10 text-amber-600 border-amber-200' : 'bg-rose-500/10 text-rose-600 border-rose-200'"
                  >
                    {{ c.status }}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>

    <!-- PIPELINE TAB -->
    <template v-if="activeTab === 'pipeline'">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card class="lg:col-span-2">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Pipeline Funnel
            </CardTitle>
            <CardDescription>Deal value at each stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-3">
              <div v-for="(stage, i) in pipelineData" :key="stage.name" class="space-y-1.5">
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <div class="size-3 rounded" :style="{ background: funnelColors[i] }" />
                    <span class="font-medium">{{ stage.name }}</span>
                  </div>
                  <span class="font-semibold tabular-nums">{{ fmt(stage.value) }}</span>
                </div>
                <div class="h-8 rounded-lg overflow-hidden bg-muted/50 relative">
                  <div
                    class="h-full rounded-lg transition-all duration-1000 flex items-center px-3"
                    :style="{ width: `${(stage.value / pipelineMax) * 100}%`, background: funnelColors[i] }"
                  >
                    <span class="text-white text-xs font-semibold">{{ Math.round((stage.value / pipelineMax) * 100) }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Pipeline Metrics
            </CardTitle>
            <CardDescription>Key pipeline health indicators</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div
              v-for="metric in [
                { label: 'Pipeline Coverage', value: '3.2x', desc: 'vs 3x target', good: true },
                { label: 'Avg. Stage Duration', value: '8.5 days', desc: '↓ from 11.2 days', good: true },
                { label: 'Conversion Rate', value: '28.4%', desc: 'Lead → Close', good: true },
                { label: 'Stalled Deals', value: '12', desc: '> 30 days no activity', good: false },
                { label: 'Pipeline Velocity', value: '$142K/wk', desc: '↑ 15% QoQ', good: true },
                { label: 'Weighted Pipeline', value: '$2.8M', desc: 'Risk-adjusted value', good: true },
              ]" :key="metric.label" class="flex items-center justify-between"
            >
              <div>
                <p class="text-sm font-medium">
                  {{ metric.label }}
                </p>
                <p class="text-[10px] text-muted-foreground">
                  {{ metric.desc }}
                </p>
              </div>
              <span class="text-sm font-bold tabular-nums" :class="metric.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                {{ metric.value }}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- TEAM TAB -->
    <template v-if="activeTab === 'team'">
      <Card>
        <CardHeader class="pb-2">
          <div class="flex items-center justify-between">
            <div>
              <CardTitle class="text-sm font-semibold">
                Sales Team Leaderboard
              </CardTitle>
              <CardDescription>Performance ranking by revenue generated (YTD)</CardDescription>
            </div>
            <Badge variant="secondary" class="text-xs">
              Q1 2026
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-12">
                  Rank
                </TableHead>
                <TableHead>Rep</TableHead>
                <TableHead class="text-right">
                  Revenue
                </TableHead>
                <TableHead class="text-center">
                  Deals
                </TableHead>
                <TableHead>Quota Attainment</TableHead>
                <TableHead class="text-right">
                  Avg. Deal
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(rep, i) in topReps" :key="rep.name">
                <TableCell>
                  <div class="flex items-center justify-center size-6 rounded-full text-[10px] font-bold" :class="i < 3 ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'">
                    {{ i + 1 }}
                  </div>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2.5">
                    <div class="flex items-center justify-center rounded-full size-8 text-xs font-bold" :class="avatarColors[i % avatarColors.length]">
                      {{ rep.avatar }}
                    </div>
                    <div>
                      <p class="text-sm font-medium">
                        {{ rep.name }}
                      </p>
                      <p class="text-[10px] text-muted-foreground">
                        {{ rep.role }}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell class="text-right font-semibold tabular-nums">
                  {{ fmtFull(rep.revenue) }}
                </TableCell>
                <TableCell class="text-center tabular-nums">
                  {{ rep.deals }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div class="h-full rounded-full transition-all" :class="rep.quota >= 85 ? 'bg-emerald-500' : rep.quota >= 70 ? 'bg-amber-500' : 'bg-rose-500'" :style="{ width: `${rep.quota}%` }" />
                    </div>
                    <span class="text-xs font-medium tabular-nums w-8 text-right">{{ rep.quota }}%</span>
                  </div>
                </TableCell>
                <TableCell class="text-right tabular-nums text-sm text-muted-foreground">
                  {{ fmt(Math.round(rep.revenue / rep.deals)) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>

    <!-- FORECAST TAB -->
    <template v-if="activeTab === 'forecast'">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Quarterly Forecast vs Actual
            </CardTitle>
            <CardDescription>Revenue forecast accuracy tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              :data="forecastData"
              index="quarter"
              :categories="['actual', 'forecast']"
              :colors="['#10b981', '#94a3b8']"
              type="grouped"
              :rounded-corners="6"
              :y-formatter="(v: number | Date) => v ? `$${(Number(v) / 1000).toFixed(0)}K` : '—'"
              class="h-[280px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Forecast Confidence
            </CardTitle>
            <CardDescription>Prediction confidence by quarter</CardDescription>
          </CardHeader>
          <CardContent class="space-y-5">
            <div v-for="f in forecastData" :key="f.quarter" class="space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold">
                    {{ f.quarter }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Forecast: {{ fmt(f.forecast) }}
                    <template v-if="f.actual">
                      • Actual: {{ fmt(f.actual) }}
                    </template>
                  </p>
                </div>
                <Badge variant="outline" :class="f.confidence >= 90 ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10' : f.confidence >= 80 ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10' : 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10'">
                  {{ f.confidence }}% confidence
                </Badge>
              </div>
              <div class="h-2.5 rounded-full bg-muted overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700" :class="f.confidence >= 90 ? 'bg-emerald-500' : f.confidence >= 80 ? 'bg-blue-500' : 'bg-amber-500'" :style="{ width: `${f.confidence}%` }" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>
    </div>
  </div>
</template>
