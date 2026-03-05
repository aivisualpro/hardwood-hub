<script setup lang="ts">
import type { SalesDocument } from '~/composables/useSalesDocument'

const statusOptions = [
  { label: 'Draft', value: 'Draft' },
  { label: 'Sent', value: 'Sent' },
  { label: 'Accepted', value: 'Accepted' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Expired', value: 'Expired' },
]

const extraFields = [
  { key: 'validUntil', label: 'Valid Until', type: 'date' },
  { key: 'createdBy', label: 'Sales Rep', placeholder: 'Name of sales representative' },
]

const seedData: SalesDocument[] = [
  {
    id: 'q1',
    number: 'QT-2026-041',
    client: 'Riverside Custom Homes',
    clientEmail: 'builds@riversidecustomhomes.com',
    clientAddress: '3480 Washtenaw Ave, Ann Arbor, MI 48104',
    status: 'Sent',
    date: '2026-02-10',
    validUntil: '2026-03-10',
    createdBy: 'Mike Brennan',
    notes: 'Full hardwood install for new construction. White oak throughout, herringbone pattern in foyer. Jobsite ready March 15.',
    lineItems: [
      { id: 'li1', description: 'White Oak Hardwood Supply (3/4" x 5")', quantity: 2400, unitPrice: 6.50, discount: 5, tax: 6 },
      { id: 'li2', description: 'Herringbone Pattern Install — Foyer (180 sqft)', quantity: 180, unitPrice: 12.00, discount: 0, tax: 6 },
      { id: 'li3', description: 'Standard Hardwood Installation (2220 sqft)', quantity: 2220, unitPrice: 4.75, discount: 0, tax: 6 },
      { id: 'li4', description: 'Sand & Finish — 3 Coats Oil-Based Poly', quantity: 2400, unitPrice: 2.50, discount: 0, tax: 6 },
      { id: 'li5', description: 'Subfloor Prep & Moisture Barrier', quantity: 2400, unitPrice: 0.85, discount: 0, tax: 6 },
    ],
    subtotal: 34890,
    taxTotal: 2093.40,
    discountTotal: 780,
    total: 36983.40,
    createdAt: '2026-02-10T10:30:00Z',
  },
  {
    id: 'q2',
    number: 'QT-2026-040',
    client: 'The Patterson Residence',
    clientEmail: 'jpatterson@gmail.com',
    clientAddress: '1872 Geddes Rd, Ann Arbor, MI 48104',
    status: 'Accepted',
    date: '2026-02-08',
    validUntil: '2026-03-08',
    createdBy: 'Jake Sullivan',
    notes: 'Accepted Feb 12. Refinish existing red oak floors in living room, dining room, and hallway. Schedule for late February.',
    lineItems: [
      { id: 'li6', description: 'Hardwood Floor Sanding (Drum & Edge)', quantity: 950, unitPrice: 2.00, discount: 0, tax: 6 },
      { id: 'li7', description: 'Stain Application — Jacobean', quantity: 950, unitPrice: 1.50, discount: 0, tax: 6 },
      { id: 'li8', description: 'Finish — 3 Coats Water-Based Poly', quantity: 950, unitPrice: 1.75, discount: 0, tax: 6 },
      { id: 'li9', description: 'Furniture Moving & Protection', quantity: 1, unitPrice: 450, discount: 0, tax: 6 },
    ],
    subtotal: 5437.50,
    taxTotal: 326.25,
    discountTotal: 0,
    total: 5763.75,
    createdAt: '2026-02-08T14:15:00Z',
  },
  {
    id: 'q3',
    number: 'QT-2026-039',
    client: 'Briarwood Mall Management',
    clientEmail: 'facilities@briarwoodmall.com',
    clientAddress: '100 Briarwood Circle, Ann Arbor, MI 48108',
    status: 'Draft',
    date: '2026-02-12',
    validUntil: '2026-03-12',
    createdBy: 'Mike Brennan',
    notes: 'Commercial refinish for common area hallways. Work to be done after hours (9PM–6AM). Awaiting facility manager approval.',
    lineItems: [
      { id: 'li10', description: 'Commercial Floor Sanding (High-Traffic Grade)', quantity: 3200, unitPrice: 2.25, discount: 0, tax: 6 },
      { id: 'li11', description: 'Commercial-Grade Finish — 4 Coats', quantity: 3200, unitPrice: 2.50, discount: 0, tax: 6 },
      { id: 'li12', description: 'After-Hours Labor Premium', quantity: 1, unitPrice: 2800, discount: 0, tax: 6 },
    ],
    subtotal: 18000,
    taxTotal: 1080,
    discountTotal: 0,
    total: 19080,
    createdAt: '2026-02-12T09:00:00Z',
  },
  {
    id: 'q4',
    number: 'QT-2026-038',
    client: 'Dexter Community Schools',
    clientEmail: 'maintenance@dexterschools.org',
    clientAddress: '7714 Ann Arbor St, Dexter, MI 48130',
    status: 'Sent',
    date: '2026-02-06',
    validUntil: '2026-03-06',
    createdBy: 'Jake Sullivan',
    notes: 'Gymnasium floor sand & refinish with new game lines. Summer schedule preferred. Must use low-VOC finish per district policy.',
    lineItems: [
      { id: 'li13', description: 'Gym Floor Sanding — Heavy Duty', quantity: 6400, unitPrice: 1.75, discount: 0, tax: 0 },
      { id: 'li14', description: 'Game Line Painting (Basketball + Volleyball)', quantity: 1, unitPrice: 4500, discount: 0, tax: 0 },
      { id: 'li15', description: 'Low-VOC Gym Floor Finish — 3 Coats', quantity: 6400, unitPrice: 2.25, discount: 5, tax: 0 },
      { id: 'li16', description: 'Logo Re-application (Center Court)', quantity: 1, unitPrice: 1800, discount: 0, tax: 0 },
    ],
    subtotal: 31900,
    taxTotal: 0,
    discountTotal: 720,
    total: 31180,
    createdAt: '2026-02-06T11:45:00Z',
  },
  {
    id: 'q5',
    number: 'QT-2026-037',
    client: 'Thompson & Hart Law Offices',
    clientEmail: 'office@thompsonhart.com',
    clientAddress: '301 E Liberty St, Suite 400, Ann Arbor, MI 48104',
    status: 'Rejected',
    date: '2026-01-28',
    validUntil: '2026-02-28',
    createdBy: 'Mike Brennan',
    notes: 'Client chose LVP instead of hardwood. Follow up in fall if they reconsider solid hardwood for partner offices.',
    lineItems: [
      { id: 'li18', description: 'Brazilian Cherry Supply (3/4" x 3-1/4")', quantity: 1800, unitPrice: 9.75, discount: 0, tax: 6 },
      { id: 'li19', description: 'Installation — Nail-Down Method', quantity: 1800, unitPrice: 4.50, discount: 0, tax: 6 },
      { id: 'li20', description: 'Sand & Finish — Semi-Gloss', quantity: 1800, unitPrice: 2.75, discount: 0, tax: 6 },
    ],
    subtotal: 30600,
    taxTotal: 1836,
    discountTotal: 0,
    total: 32436,
    createdAt: '2026-01-28T16:20:00Z',
  },
  {
    id: 'q6',
    number: 'QT-2026-036',
    client: 'Harper Renovation Co.',
    clientEmail: 'quotes@harperreno.com',
    clientAddress: '524 S State St, Ann Arbor, MI 48104',
    status: 'Accepted',
    date: '2026-01-25',
    validUntil: '2026-02-25',
    createdBy: 'Jake Sullivan',
    notes: 'Staircase refinish + install new treads. Accepted Jan 28. Work scheduled for Feb 3–5.',
    lineItems: [
      { id: 'li21', description: 'Stair Tread Supply — Red Oak (14 treads)', quantity: 14, unitPrice: 65, discount: 0, tax: 6 },
      { id: 'li22', description: 'Stair Riser Supply — Red Oak', quantity: 14, unitPrice: 28, discount: 0, tax: 6 },
      { id: 'li23', description: 'Staircase Installation & Finishing', quantity: 1, unitPrice: 3200, discount: 0, tax: 6 },
      { id: 'li24', description: 'Baluster & Railing Refinish', quantity: 1, unitPrice: 1400, discount: 10, tax: 6 },
    ],
    subtotal: 5902,
    taxTotal: 354.12,
    discountTotal: 140,
    total: 6256.12,
    createdAt: '2026-01-25T08:30:00Z',
  },
]
</script>

<template>
  <SalesDocumentPage
    store-key="sales-quotes-v2"
    doc-type="Quote"
    title="Quotes & Estimates"
    description="Create professional quotes with configurable line items"
    icon="i-lucide-file-text"
    :status-options="statusOptions"
    :extra-fields="extraFields"
    :initial-data="seedData"
  />
</template>
