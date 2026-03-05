<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import { TrendingDown, TrendingUp } from 'lucide-vue-next'

const { setHeader } = usePageHeader()
setHeader({ title: 'Financial Reports', description: 'Complete financial analytics and performance insights', icon: 'i-lucide-pie-chart' })

const activeTab = ref('pnl')

// ── KPIs ───────────────────────────────────────────
const kpis = ref([
  { label: 'Total Revenue', value: 0, target: 12850000, prefix: '$', suffix: '', change: 14.2, icon: 'i-lucide-trending-up', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Net Income', value: 0, target: 2288000, prefix: '$', suffix: '', change: 21.5, icon: 'i-lucide-circle-dollar-sign', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { label: 'Gross Margin', value: 0, target: 68.4, prefix: '', suffix: '%', change: 2.1, icon: 'i-lucide-percent', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { label: 'Operating Expenses', value: 0, target: 6380000, prefix: '$', suffix: '', change: 8.4, icon: 'i-lucide-receipt', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { label: 'EBITDA', value: 0, target: 3215000, prefix: '$', suffix: '', change: 16.8, icon: 'i-lucide-landmark', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { label: 'Cash on Hand', value: 0, target: 4680000, prefix: '$', suffix: '', change: 11.2, icon: 'i-lucide-wallet', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
])

onMounted(() => { kpis.value = kpis.value.map(k => ({ ...k, value: k.target })) })

// ── P&L Statement ─────────────────────────────────
const pnlData = [
  { category: 'Revenue', items: [
    { name: 'Product Revenue', current: 8950000, previous: 7825000 },
    { name: 'Service Revenue', current: 2680000, previous: 2345000 },
    { name: 'Subscription Revenue', current: 1220000, previous: 980000 },
  ] },
  { category: 'Cost of Goods Sold', items: [
    { name: 'Direct Labor', current: -1890000, previous: -1720000 },
    { name: 'Materials & Hosting', current: -1245000, previous: -1095000 },
    { name: 'Third-Party Services', current: -925000, previous: -845000 },
  ] },
  { category: 'Operating Expenses', items: [
    { name: 'Sales & Marketing', current: -2180000, previous: -1950000 },
    { name: 'Research & Development', current: -1850000, previous: -1680000 },
    { name: 'General & Administrative', current: -1425000, previous: -1320000 },
    { name: 'Depreciation & Amortization', current: -925000, previous: -870000 },
  ] },
  { category: 'Other Income/Expense', items: [
    { name: 'Interest Income', current: 142000, previous: 98000 },
    { name: 'Interest Expense', current: -285000, previous: -310000 },
    { name: 'Other Income', current: 45000, previous: 32000 },
  ] },
]

// ── Revenue Trend ──────────────────────────────────
const revenueTrend = [
  { month: 'Jan', revenue: 985000, expenses: 780000, profit: 205000 },
  { month: 'Feb', revenue: 1020000, expenses: 795000, profit: 225000 },
  { month: 'Mar', revenue: 1105000, expenses: 810000, profit: 295000 },
  { month: 'Apr', revenue: 1045000, expenses: 825000, profit: 220000 },
  { month: 'May', revenue: 1125000, expenses: 840000, profit: 285000 },
  { month: 'Jun', revenue: 1180000, expenses: 855000, profit: 325000 },
  { month: 'Jul', revenue: 1095000, expenses: 830000, profit: 265000 },
  { month: 'Aug', revenue: 1150000, expenses: 845000, profit: 305000 },
  { month: 'Sep', revenue: 1210000, expenses: 860000, profit: 350000 },
  { month: 'Oct', revenue: 1165000, expenses: 875000, profit: 290000 },
  { month: 'Nov', revenue: 1280000, expenses: 890000, profit: 390000 },
  { month: 'Dec', revenue: 1350000, expenses: 920000, profit: 430000 },
]

// ── Expense Breakdown ──────────────────────────────
const expenseBreakdown = [
  { name: 'Sales & Marketing', value: 2180000 },
  { name: 'R&D', value: 1850000 },
  { name: 'G&A', value: 1425000 },
  { name: 'Depreciation', value: 925000 },
]

// ── Budget vs Actual ───────────────────────────────
const budgetData = [
  { department: 'Sales & Marketing', budget: 2350000, actual: 2180000, variance: 170000 },
  { department: 'Research & Development', budget: 1800000, actual: 1850000, variance: -50000 },
  { department: 'General & Admin', budget: 1480000, actual: 1425000, variance: 55000 },
  { department: 'Customer Success', budget: 680000, actual: 645000, variance: 35000 },
  { department: 'IT & Infrastructure', budget: 520000, actual: 498000, variance: 22000 },
  { department: 'Human Resources', budget: 420000, actual: 435000, variance: -15000 },
]

// ── Cash Flow ──────────────────────────────────────
const cashFlowData = [
  { month: 'Jan', operating: 420000, investing: -180000, financing: -95000 },
  { month: 'Feb', operating: 385000, investing: -125000, financing: -95000 },
  { month: 'Mar', operating: 510000, investing: -210000, financing: -95000 },
  { month: 'Apr', operating: 445000, investing: -150000, financing: -95000 },
  { month: 'May', operating: 495000, investing: -175000, financing: -95000 },
  { month: 'Jun', operating: 530000, investing: -195000, financing: -95000 },
  { month: 'Jul', operating: 465000, investing: -160000, financing: -95000 },
  { month: 'Aug', operating: 480000, investing: -140000, financing: -95000 },
  { month: 'Sep', operating: 555000, investing: -220000, financing: -95000 },
  { month: 'Oct', operating: 498000, investing: -185000, financing: -95000 },
  { month: 'Nov', operating: 580000, investing: -245000, financing: -95000 },
  { month: 'Dec', operating: 625000, investing: -280000, financing: -95000 },
]

// ── Aged Receivables ───────────────────────────────
const receivablesData = [
  { bucket: 'Current', amount: 1850000, pct: 48, count: 45, color: '#10b981' },
  { bucket: '1–30 Days', amount: 920000, pct: 24, count: 22, color: '#3b82f6' },
  { bucket: '31–60 Days', amount: 580000, pct: 15, count: 14, color: '#f59e0b' },
  { bucket: '61–90 Days', amount: 310000, pct: 8, count: 8, color: '#f97316' },
  { bucket: '90+ Days', amount: 195000, pct: 5, count: 5, color: '#ef4444' },
]

// ── Financial Ratios ───────────────────────────────
const ratios = [
  { category: 'Profitability', items: [
    { name: 'Gross Profit Margin', value: '68.4%', benchmark: '65.0%', status: 'above' },
    { name: 'Net Profit Margin', value: '17.8%', benchmark: '12.5%', status: 'above' },
    { name: 'Return on Equity (ROE)', value: '26.8%', benchmark: '20.0%', status: 'above' },
    { name: 'Return on Assets (ROA)', value: '18.2%', benchmark: '14.0%', status: 'above' },
  ] },
  { category: 'Liquidity', items: [
    { name: 'Current Ratio', value: '2.80x', benchmark: '2.00x', status: 'above' },
    { name: 'Quick Ratio', value: '2.26x', benchmark: '1.50x', status: 'above' },
    { name: 'Cash Ratio', value: '1.18x', benchmark: '0.80x', status: 'above' },
    { name: 'Working Capital', value: '$3.74M', benchmark: '$2.50M', status: 'above' },
  ] },
  { category: 'Efficiency', items: [
    { name: 'Asset Turnover', value: '1.44x', benchmark: '1.20x', status: 'above' },
    { name: 'Inventory Turnover', value: '6.33x', benchmark: '7.00x', status: 'below' },
    { name: 'Days Sales Outstanding', value: '26.5 days', benchmark: '30 days', status: 'above' },
    { name: 'Days Payable Outstanding', value: '44.7 days', benchmark: '45 days', status: 'at' },
  ] },
  { category: 'Leverage', items: [
    { name: 'Debt-to-Equity', value: '0.51x', benchmark: '1.00x', status: 'above' },
    { name: 'Interest Coverage', value: '13.6x', benchmark: '5.00x', status: 'above' },
    { name: 'Debt Ratio', value: '0.34', benchmark: '0.50', status: 'above' },
    { name: 'Equity Multiplier', value: '1.51x', benchmark: '2.00x', status: 'above' },
  ] },
]

// ── Helpers ────────────────────────────────────────
function fmt(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1000000)
    return `${n < 0 ? '-' : ''}$${(abs / 1000000).toFixed(1)}M`
  if (abs >= 1000)
    return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(0)}K`
  return `$${n.toLocaleString('en-US')}`
}

function fmtExact(n: number) {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US')}`
}
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <div class="w-full flex flex-col gap-5 p-1">
    <!-- Tab Navigation -->
    <div class="flex items-center gap-1 border rounded-lg p-1 bg-muted/30 w-fit">
      <button
        v-for="tab in [{ id: 'pnl', label: 'P&L Statement', icon: 'i-lucide-file-text' }, { id: 'cashflow', label: 'Cash Flow', icon: 'i-lucide-arrow-right-left' }, { id: 'budget', label: 'Budget vs Actual', icon: 'i-lucide-target' }, { id: 'receivables', label: 'Receivables', icon: 'i-lucide-clock' }, { id: 'ratios', label: 'Ratios', icon: 'i-lucide-gauge' }]"
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

    <!-- P&L TAB -->
    <template v-if="activeTab === 'pnl'">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Revenue vs Expenses Chart -->
        <Card class="lg:col-span-2">
          <CardHeader class="pb-2">
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="text-sm font-semibold">
                  Revenue, Expenses & Profit
                </CardTitle>
                <CardDescription>Monthly breakdown for FY 2026</CardDescription>
              </div>
              <Badge variant="outline" class="text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10">
                <TrendingUp class="size-3 mr-1" /> +14.2% YoY
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <AreaChart
              :data="revenueTrend"
              index="month"
              :categories="['revenue', 'expenses', 'profit']"
              :colors="['#10b981', '#ef4444', '#3b82f6']"
              :y-formatter="(v: number | Date) => `$${(Number(v) / 1000).toFixed(0)}K`"
              class="h-[300px]"
            />
          </CardContent>
        </Card>

        <!-- Expense Breakdown -->
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Operating Expense Mix
            </CardTitle>
            <CardDescription>Expense distribution by category</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col items-center">
            <DonutChart
              :data="expenseBreakdown"
              index="name"
              category="value"
              :colors="['#ec4899', '#8b5cf6', '#f59e0b', '#64748b']"
              :value-formatter="(v: number) => fmt(v)"
              class="h-[180px]"
            />
            <div class="w-full mt-4 space-y-2">
              <div v-for="(e, i) in expenseBreakdown" :key="e.name" class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <div class="size-2.5 rounded-full" :style="{ background: ['#ec4899', '#8b5cf6', '#f59e0b', '#64748b'][i] }" />
                  <span class="text-muted-foreground">{{ e.name }}</span>
                </div>
                <span class="font-semibold tabular-nums">{{ fmt(e.value) }}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- P&L Statement Table -->
      <Card>
        <CardHeader class="pb-2">
          <div class="flex items-center justify-between">
            <div>
              <CardTitle class="text-sm font-semibold">
                Income Statement
              </CardTitle>
              <CardDescription>Detailed P&L for FY 2026 vs FY 2025</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line Item</TableHead>
                <TableHead class="text-right">
                  FY 2026
                </TableHead>
                <TableHead class="text-right">
                  FY 2025
                </TableHead>
                <TableHead class="text-right">
                  Variance
                </TableHead>
                <TableHead class="text-right">
                  % Change
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-for="section in pnlData" :key="section.category">
                <TableRow class="bg-muted/30">
                  <TableCell :colspan="5" class="font-bold text-sm py-2">
                    {{ section.category }}
                  </TableCell>
                </TableRow>
                <TableRow v-for="item in section.items" :key="item.name">
                  <TableCell class="pl-8 text-sm">
                    {{ item.name }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums text-sm" :class="item.current < 0 ? 'text-rose-600 dark:text-rose-400' : ''">
                    {{ fmtExact(item.current) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums text-sm text-muted-foreground" :class="item.previous < 0 ? 'text-rose-500/60' : ''">
                    {{ fmtExact(item.previous) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums text-sm" :class="(item.current - item.previous) > 0 ? item.current > 0 ? 'text-emerald-600' : 'text-rose-600' : item.current > 0 ? 'text-rose-600' : 'text-emerald-600'">
                    {{ fmtExact(item.current - item.previous) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums text-sm">
                    <Badge
                      variant="outline"
                      :class="
                        (() => {
                          const pctChange = ((item.current - item.previous) / Math.abs(item.previous)) * 100
                          const isGood = item.current > 0 ? pctChange > 0 : pctChange < 0
                          return isGood ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10' : 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10'
                        })()
                      "
                      class="text-[10px]"
                    >
                      {{ ((item.current - item.previous) / Math.abs(item.previous) * 100).toFixed(1) }}%
                    </Badge>
                  </TableCell>
                </TableRow>
              </template>
              <!-- Totals -->
              <TableRow class="border-t-2 font-bold">
                <TableCell class="text-sm font-bold">
                  Net Income
                </TableCell>
                <TableCell class="text-right tabular-nums text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                  $2,288,000
                </TableCell>
                <TableCell class="text-right tabular-nums text-muted-foreground text-sm font-bold">
                  $1,883,000
                </TableCell>
                <TableCell class="text-right tabular-nums text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                  $405,000
                </TableCell>
                <TableCell class="text-right">
                  <Badge variant="outline" class="text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 text-[10px]">
                    +21.5%
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>

    <!-- CASH FLOW TAB -->
    <template v-if="activeTab === 'cashflow'">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card class="lg:col-span-2">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Cash Flow Components
            </CardTitle>
            <CardDescription>Operating, investing, and financing activities</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              :data="cashFlowData"
              index="month"
              :categories="['operating', 'investing', 'financing']"
              :colors="['#10b981', '#8b5cf6', '#f59e0b']"
              type="grouped"
              :rounded-corners="4"
              :y-formatter="(v: number | Date) => `$${(Number(v) / 1000).toFixed(0)}K`"
              class="h-[300px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Cash Flow Summary
            </CardTitle>
            <CardDescription>Annual cash flow breakdown</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div
              v-for="item in [
                { label: 'Operating Activities', value: 5988000, icon: 'i-lucide-building-2', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Investing Activities', value: -2265000, icon: 'i-lucide-trending-up', color: 'text-violet-500', bg: 'bg-violet-500/10' },
                { label: 'Financing Activities', value: -1140000, icon: 'i-lucide-banknote', color: 'text-amber-500', bg: 'bg-amber-500/10' },
              ]" :key="item.label" class="flex items-center gap-3 p-3 rounded-lg border"
            >
              <div class="flex items-center justify-center rounded-lg p-2" :class="item.bg">
                <Icon :name="item.icon" class="size-4" :class="item.color" />
              </div>
              <div class="flex-1">
                <p class="text-xs text-muted-foreground">
                  {{ item.label }}
                </p>
                <p class="text-sm font-bold tabular-nums" :class="item.value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                  {{ fmt(item.value) }}
                </p>
              </div>
            </div>
            <Separator />
            <div class="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <span class="text-sm font-semibold">Net Cash Flow</span>
              <span class="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">$2,583,000</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- BUDGET vs ACTUAL TAB -->
    <template v-if="activeTab === 'budget'">
      <Card>
        <CardHeader class="pb-2">
          <div class="flex items-center justify-between">
            <div>
              <CardTitle class="text-sm font-semibold">
                Budget vs Actual by Department
              </CardTitle>
              <CardDescription>FY 2026 variance analysis</CardDescription>
            </div>
            <Badge variant="outline" class="text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10">
              Net $217K Under Budget
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead class="text-right">
                  Budget
                </TableHead>
                <TableHead class="text-right">
                  Actual
                </TableHead>
                <TableHead class="text-right">
                  Variance
                </TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="dept in budgetData" :key="dept.department">
                <TableCell class="font-medium text-sm">
                  {{ dept.department }}
                </TableCell>
                <TableCell class="text-right tabular-nums text-sm text-muted-foreground">
                  {{ fmtExact(dept.budget) }}
                </TableCell>
                <TableCell class="text-right tabular-nums text-sm font-medium">
                  {{ fmtExact(dept.actual) }}
                </TableCell>
                <TableCell class="text-right tabular-nums text-sm" :class="dept.variance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                  {{ dept.variance >= 0 ? '+' : '' }}{{ fmtExact(dept.variance) }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="(dept.actual / dept.budget * 100) > 100 ? 'bg-rose-500' : (dept.actual / dept.budget * 100) > 95 ? 'bg-amber-500' : 'bg-emerald-500'"
                        :style="{ width: `${Math.min(dept.actual / dept.budget * 100, 100)}%` }"
                      />
                    </div>
                    <span class="text-xs tabular-nums w-10 text-right">{{ (dept.actual / dept.budget * 100).toFixed(0) }}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    :class="dept.variance >= 0 ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10' : 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10'"
                  >
                    {{ dept.variance >= 0 ? 'Under' : 'Over' }}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>

    <!-- RECEIVABLES TAB -->
    <template v-if="activeTab === 'receivables'">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card class="lg:col-span-2">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              Accounts Receivable Aging
            </CardTitle>
            <CardDescription>Outstanding receivables by aging bucket</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div v-for="bucket in receivablesData" :key="bucket.bucket" class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <div class="size-3 rounded" :style="{ background: bucket.color }" />
                    <span class="font-medium">{{ bucket.bucket }}</span>
                    <Badge variant="secondary" class="text-[10px]">
                      {{ bucket.count }} invoices
                    </Badge>
                  </div>
                  <span class="font-semibold tabular-nums">{{ fmtExact(bucket.amount) }}</span>
                </div>
                <div class="h-6 rounded-lg overflow-hidden bg-muted/50 relative">
                  <div
                    class="h-full rounded-lg transition-all duration-1000 flex items-center px-3"
                    :style="{ width: `${bucket.pct}%`, background: bucket.color }"
                  >
                    <span class="text-white text-[10px] font-semibold">{{ bucket.pct }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              AR Metrics
            </CardTitle>
            <CardDescription>Receivables health indicators</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div
              v-for="metric in [
                { label: 'Total Outstanding', value: '$3.86M', icon: 'i-lucide-banknote', change: '' },
                { label: 'Days Sales Outstanding', value: '26.5 days', icon: 'i-lucide-clock', change: '↓ 3.2 days' },
                { label: 'Collection Rate', value: '94.2%', icon: 'i-lucide-check-circle', change: '↑ 1.8%' },
                { label: 'Bad Debt Rate', value: '0.8%', icon: 'i-lucide-alert-triangle', change: '↓ 0.3%' },
                { label: 'Avg. Payment Days', value: '22 days', icon: 'i-lucide-calendar', change: '↓ 4 days' },
              ]" :key="metric.label" class="flex items-center gap-3"
            >
              <div class="flex items-center justify-center rounded-lg p-2 bg-muted/50">
                <Icon :name="metric.icon" class="size-4 text-muted-foreground" />
              </div>
              <div class="flex-1">
                <p class="text-xs text-muted-foreground">
                  {{ metric.label }}
                </p>
                <p class="text-sm font-bold tabular-nums">
                  {{ metric.value }}
                </p>
              </div>
              <span v-if="metric.change" class="text-[10px] text-emerald-600 dark:text-emerald-400">{{ metric.change }}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- RATIOS TAB -->
    <template v-if="activeTab === 'ratios'">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card v-for="section in ratios" :key="section.category">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-semibold">
              {{ section.category }}
            </CardTitle>
          </CardHeader>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ratio</TableHead>
                  <TableHead class="text-right">
                    Value
                  </TableHead>
                  <TableHead class="text-right">
                    Benchmark
                  </TableHead>
                  <TableHead class="text-center">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="r in section.items" :key="r.name">
                  <TableCell class="text-sm font-medium">
                    {{ r.name }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums text-sm font-semibold">
                    {{ r.value }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums text-sm text-muted-foreground">
                    {{ r.benchmark }}
                  </TableCell>
                  <TableCell class="text-center">
                    <component :is="r.status === 'above' ? TrendingUp : TrendingDown" class="size-4 mx-auto" :class="r.status === 'above' ? 'text-emerald-500' : r.status === 'below' ? 'text-rose-500' : 'text-amber-500'" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </template>
    </div>
  </div>
</template>
