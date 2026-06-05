<script setup lang="ts">
import { toast } from 'vue-sonner'

const { canCreate, canUpdate, canDelete } = usePermissions('/crm/products')

const { setHeader } = usePageHeader()
setHeader({
  title: 'Products & Services',
  icon: 'i-lucide-package',
  description: 'Manage your product catalog, pricing, and inventory',
})

// ─── State ───────────────────────────────────────────────
interface Product {
  _id: string
  sku: string
  color: string
  path: string
  type: string
  description: string
  trade: string
  unit: string
  wasteAddon: number
  salesPrice: number
  costPrice: number
  boxSalesPrice: number
  boxCostPrice: number
  isBoxPricesLinked: boolean
  boxName: string
  unitsPerBox: number
  sellByBox: boolean
  worksheetByBox: boolean
  isTaxable: boolean
  isAddon: boolean
  vendor: string
  vendorSku: string
  manufacturer: string
  costCode: string
  styleCode: string
  styleName: string
  colorCode: string
  colorName: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

const items = ref<Product[]>([])
const searchQuery = ref('')
const currentPage = ref(1)
const totalItems = ref(0)
const totalPages = ref(1)

// ─── Server-first data fetching (blocks navigation until resolved) ──────
async function fetchProducts(page = 1) {
  try {
    const params = new URLSearchParams()
    if (searchQuery.value)
      params.set('search', searchQuery.value)
    params.set('page', String(page))
    params.set('limit', '50')

    const res = await $fetch<any>(`/api/products?${params.toString()}`)
    items.value = res.data || []
    currentPage.value = res.pagination?.page || 1
    totalPages.value = res.pagination?.totalPages || 1
    totalItems.value = res.pagination?.total || 0
  }
  catch (err) {
    toast.error('Failed to load products')
  }
}

// Debounced search
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimer)
    clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    fetchProducts(1)
  }, 300)
})

await useAsyncData('crm-products', async () => { await fetchProducts(); return true })

// ─── Create / Edit Dialog ────────────────────────────────
const showFormDialog = ref(false)
const editingProduct = ref<Product | null>(null)

function emptyForm() {
  return {
    sku: '',
    color: '',
    path: '',
    type: '',
    description: '',
    trade: '',
    unit: '',
    wasteAddon: 0,
    salesPrice: 0,
    costPrice: 0,
    boxSalesPrice: 0,
    boxCostPrice: 0,
    isBoxPricesLinked: false,
    boxName: '',
    unitsPerBox: 0,
    sellByBox: false,
    worksheetByBox: false,
    isTaxable: false,
    isAddon: false,
    vendor: '',
    vendorSku: '',
    manufacturer: '',
    costCode: '',
    styleCode: '',
    styleName: '',
    colorCode: '',
    colorName: '',
    createdBy: '',
  }
}

const form = ref(emptyForm())
const isSaving = ref(false)

function openCreate() {
  editingProduct.value = null
  form.value = emptyForm()
  showFormDialog.value = true
}

function openEdit(product: Product) {
  editingProduct.value = product
  form.value = {
    sku: product.sku || '',
    color: product.color || '',
    path: product.path || '',
    type: product.type || '',
    description: product.description || '',
    trade: product.trade || '',
    unit: product.unit || '',
    wasteAddon: product.wasteAddon || 0,
    salesPrice: product.salesPrice || 0,
    costPrice: product.costPrice || 0,
    boxSalesPrice: product.boxSalesPrice || 0,
    boxCostPrice: product.boxCostPrice || 0,
    isBoxPricesLinked: product.isBoxPricesLinked || false,
    boxName: product.boxName || '',
    unitsPerBox: product.unitsPerBox || 0,
    sellByBox: product.sellByBox || false,
    worksheetByBox: product.worksheetByBox || false,
    isTaxable: product.isTaxable || false,
    isAddon: product.isAddon || false,
    vendor: product.vendor || '',
    vendorSku: product.vendorSku || '',
    manufacturer: product.manufacturer || '',
    costCode: product.costCode || '',
    styleCode: product.styleCode || '',
    styleName: product.styleName || '',
    colorCode: product.colorCode || '',
    colorName: product.colorName || '',
    createdBy: product.createdBy || '',
  }
  showFormDialog.value = true
}

async function saveProduct() {
  isSaving.value = true
  try {
    if (editingProduct.value) {
      await $fetch(`/api/products/${editingProduct.value._id}`, { method: 'PUT', body: form.value })
      toast.success('Product updated')
    }
    else {
      await $fetch('/api/products', { method: 'POST', body: form.value })
      toast.success('Product created')
    }
    showFormDialog.value = false
    await fetchProducts(currentPage.value)
  }
  catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  }
  finally {
    isSaving.value = false
  }
}

async function deleteProduct(id: string) {
  if (!confirm('Delete this product? This action cannot be undone.'))
    return
  try {
    await $fetch(`/api/products/${id}`, { method: 'DELETE' })
    toast.success('Product deleted')
    await fetchProducts(currentPage.value)
  }
  catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
  }
}

// ─── CSV Import ──────────────────────────────────────────
const showImportDialog = ref(false)
const importFile = ref<File | null>(null)
const importPreview = ref<any[]>([])
const importHeaders = ref<string[]>([])
const isImporting = ref(false)
const importError = ref('')

// CSV header → model field mapping
const HEADER_MAP: Record<string, string> = {
  'sku': 'sku',
  'color': 'color',
  'path': 'path',
  'type': 'type',
  'description': 'description',
  'trade': 'trade',
  'unit': 'unit',
  'wasteaddon': 'wasteAddon',
  'waste addon': 'wasteAddon',
  'waste_addon': 'wasteAddon',
  'salesprice': 'salesPrice',
  'sales price': 'salesPrice',
  'sales_price': 'salesPrice',
  'costprice': 'costPrice',
  'cost price': 'costPrice',
  'cost_price': 'costPrice',
  'boxsalesprice': 'boxSalesPrice',
  'box sales price': 'boxSalesPrice',
  'box_sales_price': 'boxSalesPrice',
  'boxcostprice': 'boxCostPrice',
  'box cost price': 'boxCostPrice',
  'box_cost_price': 'boxCostPrice',
  'isboxpriceslinked': 'isBoxPricesLinked',
  'is box prices linked': 'isBoxPricesLinked',
  'boxname': 'boxName',
  'box name': 'boxName',
  'box_name': 'boxName',
  'unitsperbox': 'unitsPerBox',
  'units per box': 'unitsPerBox',
  'units_per_box': 'unitsPerBox',
  'sellbybox': 'sellByBox',
  'sell by box': 'sellByBox',
  'sell_by_box': 'sellByBox',
  'worksheetbybox': 'worksheetByBox',
  'worksheet by box': 'worksheetByBox',
  'worksheet_by_box': 'worksheetByBox',
  'istaxable': 'isTaxable',
  'is taxable': 'isTaxable',
  'is_taxable': 'isTaxable',
  'taxable': 'isTaxable',
  'isaddon': 'isAddon',
  'is addon': 'isAddon',
  'is_addon': 'isAddon',
  'addon': 'isAddon',
  'vendor': 'vendor',
  'vendorsku': 'vendorSku',
  'vendor sku': 'vendorSku',
  'vendor_sku': 'vendorSku',
  'manufacturer': 'manufacturer',
  'costcode': 'costCode',
  'cost code': 'costCode',
  'cost_code': 'costCode',
  'stylecode': 'styleCode',
  'style code': 'styleCode',
  'style_code': 'styleCode',
  'stylename': 'styleName',
  'style name': 'styleName',
  'style_name': 'styleName',
  'colorcode': 'colorCode',
  'color code': 'colorCode',
  'color_code': 'colorCode',
  'colorname': 'colorName',
  'color name': 'colorName',
  'color_name': 'colorName',
  'createdby': 'createdBy',
  'created by': 'createdBy',
  'created_by': 'createdBy',
}

function parseCSV(text: string): { headers: string[], rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0)
    return { headers: [], rows: [] }

  // Parse a CSV line respecting quoted fields
  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        }
        else {
          inQuotes = !inQuotes
        }
      }
      else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      }
      else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const rawHeaders = parseLine(lines[0]!)
  const headers = rawHeaders.map((h) => {
    const key = h.toLowerCase().trim()
    return HEADER_MAP[key] || h
  })

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]!)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      if (vals[idx] !== undefined && vals[idx] !== '') {
        row[h] = vals[idx]!
      }
    })
    if (Object.keys(row).length > 0)
      rows.push(row)
  }

  return { headers, rows }
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  importFile.value = file
  importError.value = ''

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const result = parseCSV(reader.result as string)
      importHeaders.value = result.headers
      importPreview.value = result.rows
    }
    catch {
      importError.value = 'Failed to parse CSV file'
      importPreview.value = []
    }
  }
  reader.readAsText(file)
}

async function executeImport() {
  if (importPreview.value.length === 0)
    return
  isImporting.value = true
  try {
    const res = await $fetch<any>('/api/products/import', {
      method: 'POST',
      body: { rows: importPreview.value },
    })
    if (res.success) {
      toast.success(`Imported ${res.imported} products`, {
        description: res.errors ? `${res.errors} rows had errors` : undefined,
      })
      showImportDialog.value = false
      importFile.value = null
      importPreview.value = []
      importHeaders.value = []
      await fetchProducts(1)
    }
    else {
      toast.error('Import failed', { description: res.error || res.message })
    }
  }
  catch (e: any) {
    toast.error('Import failed', { description: e?.message })
  }
  finally {
    isImporting.value = false
  }
}

// ─── Helpers ─────────────────────────────────────────────
function formatCurrency(val: number | undefined) {
  if (!val && val !== 0)
    return '—'
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(d: string) {
  if (!d)
    return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Form field config ───────────────────────────────────
const formSections = [
  {
    title: 'Basic Information',
    icon: 'i-lucide-info',
    fields: [
      { key: 'sku', label: 'SKU', type: 'text' },
      { key: 'description', label: 'Description', type: 'text', span: 2 },
      { key: 'type', label: 'Type', type: 'text' },
      { key: 'color', label: 'Color', type: 'text' },
      { key: 'path', label: 'Path', type: 'text' },
      { key: 'trade', label: 'Trade', type: 'text' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'wasteAddon', label: 'Waste Addon (%)', type: 'number' },
    ],
  },
  {
    title: 'Pricing',
    icon: 'i-lucide-dollar-sign',
    fields: [
      { key: 'salesPrice', label: 'Sales Price', type: 'number' },
      { key: 'costPrice', label: 'Cost Price', type: 'number' },
      { key: 'boxSalesPrice', label: 'Box Sales Price', type: 'number' },
      { key: 'boxCostPrice', label: 'Box Cost Price', type: 'number' },
      { key: 'boxName', label: 'Box Name', type: 'text' },
      { key: 'unitsPerBox', label: 'Units Per Box', type: 'number' },
    ],
  },
  {
    title: 'Flags',
    icon: 'i-lucide-toggle-left',
    fields: [
      { key: 'isBoxPricesLinked', label: 'Box Prices Linked', type: 'checkbox' },
      { key: 'sellByBox', label: 'Sell By Box', type: 'checkbox' },
      { key: 'worksheetByBox', label: 'Worksheet By Box', type: 'checkbox' },
      { key: 'isTaxable', label: 'Taxable', type: 'checkbox' },
      { key: 'isAddon', label: 'Add-on', type: 'checkbox' },
    ],
  },
  {
    title: 'Vendor & Style',
    icon: 'i-lucide-building',
    fields: [
      { key: 'vendor', label: 'Vendor', type: 'text' },
      { key: 'vendorSku', label: 'Vendor SKU', type: 'text' },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'costCode', label: 'Cost Code', type: 'text' },
      { key: 'styleCode', label: 'Style Code', type: 'text' },
      { key: 'styleName', label: 'Style Name', type: 'text' },
      { key: 'colorCode', label: 'Color Code', type: 'text' },
      { key: 'colorName', label: 'Color Name', type: 'text' },
    ],
  },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header Teleport -->
    <Teleport to="#header-toolbar">
      <div class="flex items-center gap-2 sm:gap-3 w-full max-w-2xl pr-2">
        <div class="relative flex-1">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search products..."
            class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          >
        </div>
        <button
          v-if="canCreate()"
          class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg border bg-card text-foreground text-xs sm:text-sm font-bold hover:bg-muted transition-all shrink-0"
          @click="showImportDialog = true"
        >
          <Icon name="i-lucide-upload" class="size-3.5" />
          <span class="hidden sm:inline">Import CSV</span>
        </button>
        <button
          v-if="canCreate()"
          class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20"
          @click="openCreate"
        >
          <Icon name="i-lucide-plus" class="size-3.5" />
          <span class="hidden sm:inline">Add Product</span>
        </button>
      </div>
    </Teleport>

    <!-- Table Section -->
    <div class="border rounded-2xl bg-card overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse" style="min-width: 1800px">
          <thead>
            <tr class="border-b bg-muted/30">
              <th class="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[100px]">
                SKU
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[200px]">
                Description
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[90px]">
                Type
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[90px]">
                Color
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[80px]">
                Trade
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[60px]">
                Unit
              </th>
              <th class="text-right py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                Sales Price
              </th>
              <th class="text-right py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                Cost Price
              </th>
              <th class="text-right py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[70px]">
                Waste %
              </th>
              <th class="text-right py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                Box Sales
              </th>
              <th class="text-right py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                Box Cost
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                Box Name
              </th>
              <th class="text-right py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[70px]">
                Qty/Box
              </th>
              <th class="text-center py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[60px]">
                Linked
              </th>
              <th class="text-center py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[70px]">
                Sell Box
              </th>
              <th class="text-center py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[60px]">
                WS Box
              </th>
              <th class="text-center py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[55px]">
                Tax
              </th>
              <th class="text-center py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[60px]">
                Addon
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[110px]">
                Vendor
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                Vendor SKU
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[120px]">
                Manufacturer
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[80px]">
                Cost Code
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[80px]">
                Style Code
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                Style Name
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[80px]">
                Color Code
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                Color Name
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                Path
              </th>
              <th class="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[90px]">
                Created
              </th>
              <th class="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20 sticky right-0 bg-muted/30 z-10" />
            </tr>
          </thead>

          <tbody v-if="items.length === 0">
            <tr>
              <td colspan="29" class="py-16 text-center">
                <div class="flex flex-col items-center gap-3">
                  <div class="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Icon name="i-lucide-package" class="size-7 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p class="font-medium text-muted-foreground">
                      No products found
                    </p>
                    <p class="text-xs text-muted-foreground/60 mt-1">
                      Add products manually or import from a CSV file
                    </p>
                  </div>
                  <div class="flex items-center gap-2 mt-2">
                    <button class="px-4 py-2 rounded-lg border bg-card text-sm font-bold hover:bg-muted transition-colors" @click="showImportDialog = true">
                      <Icon name="i-lucide-upload" class="size-3.5 mr-1.5 inline-block" />
                      Import CSV
                    </button>
                    <button class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-colors" @click="openCreate">
                      <Icon name="i-lucide-plus" class="size-3.5 mr-1.5 inline-block" />
                      Add Product
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>

          <!-- Data -->
          <tbody v-else>
            <tr
              v-for="item in items"
              :key="item._id"
              class="border-b last:border-b-0 hover:bg-muted/20 transition-colors group"
            >
              <!-- SKU (sticky) -->
              <td class="py-2.5 px-4 sticky left-0 bg-card group-hover:bg-muted/20 z-10 transition-colors">
                <span class="font-bold text-xs text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 whitespace-nowrap">{{ item.sku || '—' }}</span>
              </td>
              <td class="py-2.5 px-3 font-medium text-foreground max-w-[200px] truncate">
                {{ item.description || '—' }}
              </td>
              <td class="py-2.5 px-3">
                <span v-if="item.type" class="text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full whitespace-nowrap">{{ item.type }}</span>
                <span v-else class="text-muted-foreground">—</span>
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.color || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.trade || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.unit || '—' }}
              </td>
              <td class="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                {{ formatCurrency(item.salesPrice) }}
              </td>
              <td class="py-2.5 px-3 text-right tabular-nums text-xs text-muted-foreground">
                {{ formatCurrency(item.costPrice) }}
              </td>
              <td class="py-2.5 px-3 text-right tabular-nums text-xs text-muted-foreground">
                {{ item.wasteAddon ? `${item.wasteAddon}%` : '—' }}
              </td>
              <td class="py-2.5 px-3 text-right tabular-nums text-xs text-muted-foreground">
                {{ formatCurrency(item.boxSalesPrice) }}
              </td>
              <td class="py-2.5 px-3 text-right tabular-nums text-xs text-muted-foreground">
                {{ formatCurrency(item.boxCostPrice) }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.boxName || '—' }}
              </td>
              <td class="py-2.5 px-3 text-right tabular-nums text-xs text-muted-foreground">
                {{ item.unitsPerBox || '—' }}
              </td>
              <!-- Boolean columns -->
              <td class="py-2.5 px-3 text-center">
                <Icon :name="item.isBoxPricesLinked ? 'i-lucide-check' : 'i-lucide-minus'" :class="item.isBoxPricesLinked ? 'text-emerald-500' : 'text-muted-foreground/30'" class="size-3.5" />
              </td>
              <td class="py-2.5 px-3 text-center">
                <Icon :name="item.sellByBox ? 'i-lucide-check' : 'i-lucide-minus'" :class="item.sellByBox ? 'text-emerald-500' : 'text-muted-foreground/30'" class="size-3.5" />
              </td>
              <td class="py-2.5 px-3 text-center">
                <Icon :name="item.worksheetByBox ? 'i-lucide-check' : 'i-lucide-minus'" :class="item.worksheetByBox ? 'text-emerald-500' : 'text-muted-foreground/30'" class="size-3.5" />
              </td>
              <td class="py-2.5 px-3 text-center">
                <Icon :name="item.isTaxable ? 'i-lucide-check' : 'i-lucide-minus'" :class="item.isTaxable ? 'text-emerald-500' : 'text-muted-foreground/30'" class="size-3.5" />
              </td>
              <td class="py-2.5 px-3 text-center">
                <Icon :name="item.isAddon ? 'i-lucide-check' : 'i-lucide-minus'" :class="item.isAddon ? 'text-emerald-500' : 'text-muted-foreground/30'" class="size-3.5" />
              </td>
              <!-- Vendor / Style -->
              <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                {{ item.vendor || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.vendorSku || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                {{ item.manufacturer || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.costCode || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.styleCode || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.styleName || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.colorCode || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground">
                {{ item.colorName || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground max-w-[100px] truncate">
                {{ item.path || '—' }}
              </td>
              <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                {{ formatDate(item.createdAt) }}
              </td>
              <!-- Actions (sticky right) -->
              <td class="py-2.5 px-4 sticky right-0 bg-card group-hover:bg-muted/20 z-10 transition-colors">
                <div class="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button v-if="canUpdate()" class="size-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" @click="openEdit(item)">
                    <Icon name="i-lucide-pencil" class="size-3.5" />
                  </button>
                  <button v-if="canDelete()" class="size-7 rounded-md flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" @click="deleteProduct(item._id)">
                    <Icon name="i-lucide-trash-2" class="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalItems > 50" class="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
        <span class="text-xs text-muted-foreground font-medium">
          Showing {{ (currentPage - 1) * 50 + 1 }}–{{ Math.min(currentPage * 50, totalItems) }} of {{ totalItems }}
        </span>
        <div class="flex items-center gap-1">
          <button
            class="h-8 px-3 rounded-lg border bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40"
            :disabled="currentPage <= 1"
            @click="fetchProducts(currentPage - 1)"
          >
            Previous
          </button>
          <button
            class="h-8 px-3 rounded-lg border bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40"
            :disabled="currentPage >= totalPages"
            @click="fetchProducts(currentPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════ CREATE / EDIT DIALOG ═══════ -->
    <Dialog v-model:open="showFormDialog">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon :name="editingProduct ? 'i-lucide-pencil' : 'i-lucide-plus'" class="size-4 text-primary" />
            {{ editingProduct ? 'Edit Product' : 'New Product' }}
          </DialogTitle>
          <DialogDescription>{{ editingProduct ? 'Update the product details below.' : 'Fill in the product details. All fields are optional.' }}</DialogDescription>
        </DialogHeader>

        <form class="flex-1 overflow-y-auto space-y-6 py-4 px-1" @submit.prevent="saveProduct">
          <div v-for="section in formSections" :key="section.title" class="space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon :name="section.icon" class="size-3.5 text-primary" />
              {{ section.title }}
            </h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <template v-for="field in section.fields" :key="field.key">
                <div v-if="field.type === 'checkbox'" class="flex items-center gap-2 h-9">
                  <input
                    :id="`f-${field.key}`"
                    type="checkbox"
                    :checked="(form as any)[field.key]"
                    class="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                    @change="(form as any)[field.key] = ($event.target as HTMLInputElement).checked"
                  >
                  <label :for="`f-${field.key}`" class="text-xs font-semibold text-foreground cursor-pointer select-none">{{ field.label }}</label>
                </div>
                <div v-else class="space-y-1" :class="field.span === 2 ? 'col-span-2' : ''">
                  <label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ field.label }}</label>
                  <input
                    v-model="(form as any)[field.key]"
                    :type="field.type"
                    :step="field.type === 'number' ? '0.01' : undefined"
                    class="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    :placeholder="field.label"
                  >
                </div>
              </template>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background pb-1">
            <button type="button" class="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted transition-colors" @click="showFormDialog = false">
              Cancel
            </button>
            <button type="submit" :disabled="isSaving" class="px-4 py-2 text-sm font-bold text-primary-foreground bg-primary rounded-lg disabled:opacity-50 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors">
              {{ isSaving ? 'Saving...' : editingProduct ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <!-- ═══════ CSV IMPORT DIALOG ═══════ -->
    <Dialog v-model:open="showImportDialog">
      <DialogContent class="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-file-up" class="size-4 text-amber-500" />
            Import Products from CSV
          </DialogTitle>
          <DialogDescription>Upload a CSV file to bulk-import products. All fields are optional — you can fill in missing data later.</DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto space-y-5 py-4">
          <!-- File Upload Area -->
          <div class="relative">
            <label class="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group">
              <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                <Icon name="i-lucide-file-up" class="size-6 text-amber-500" />
              </div>
              <div class="text-center">
                <p class="font-bold text-sm">{{ importFile ? importFile.name : 'Click to upload CSV' }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ importFile ? `${importPreview.length} rows detected` : 'Accepts .csv files' }}</p>
              </div>
              <input type="file" accept=".csv,text/csv" class="sr-only" @change="handleFileSelect">
            </label>
          </div>

          <!-- Error -->
          <div v-if="importError" class="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
            <Icon name="i-lucide-alert-circle" class="size-4 inline-block mr-1.5" />
            {{ importError }}
          </div>

          <!-- Preview Table -->
          <div v-if="importPreview.length > 0" class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-bold flex items-center gap-2">
                <Icon name="i-lucide-table" class="size-4 text-primary" />
                Preview
              </h4>
              <span class="text-xs font-bold bg-muted px-2 py-0.5 rounded">{{ importPreview.length }} rows</span>
            </div>
            <div class="border rounded-xl overflow-hidden">
              <div class="overflow-x-auto max-h-[300px]">
                <table class="w-full text-xs border-collapse">
                  <thead class="sticky top-0 z-10">
                    <tr class="bg-muted/60">
                      <th class="text-left py-2 px-3 font-bold text-muted-foreground">
                        #
                      </th>
                      <th v-for="h in importHeaders" :key="h" class="text-left py-2 px-3 font-bold text-muted-foreground whitespace-nowrap">
                        {{ h }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in importPreview.slice(0, 20)" :key="idx" class="border-t hover:bg-muted/20">
                      <td class="py-1.5 px-3 text-muted-foreground font-mono">
                        {{ idx + 1 }}
                      </td>
                      <td v-for="h in importHeaders" :key="h" class="py-1.5 px-3 max-w-[150px] truncate">
                        {{ row[h] || '' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="importPreview.length > 20" class="text-center py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                + {{ importPreview.length - 20 }} more rows
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-4 border-t">
          <button class="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted transition-colors" @click="showImportDialog = false">
            Cancel
          </button>
          <button
            :disabled="importPreview.length === 0 || isImporting"
            class="px-4 py-2 text-sm font-bold text-primary-foreground bg-primary rounded-lg disabled:opacity-50 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
            @click="executeImport"
          >
            <Icon v-if="isImporting" name="i-lucide-loader-circle" class="size-3.5 mr-1.5 inline-block animate-spin" />
            {{ isImporting ? 'Importing...' : `Import ${importPreview.length} Products` }}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
