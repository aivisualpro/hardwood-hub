// POST /api/estimates/extract-pdf
// Accepts a Vercel Blob URL of a PDF and uses unpdf to extract line items and totals.
// After extraction, any new unique line-item SKUs are automatically upserted into the Products catalogue.

import { requirePermission } from '../../utils/requirePermission'
import { logger } from '../../utils/logger'
import { connectDB } from '../../utils/mongoose'
import { syncProductsFromLineItems } from '../../utils/syncProductsFromLineItems'

const log = logger('[estimates/extract-pdf.post]')

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNumber(str: string): number {
  if (!str) return 0
  return parseFloat(str.replace(/[$,\s]/g, '')) || 0
}

/**
 * Detect if a line looks like a section/room header.
 * Heuristic: short (< 50 chars), no dollar amounts, ends with common room words
 * or is ALL CAPS / Title Case with no numeric columns.
 */
function detectRoomHeader(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 60) return null
  // Skip lines that are clearly data rows (contain dollar amounts or tab-separated numbers)
  if (/\$[\d,]+/.test(trimmed)) return null
  if (/^\d+(\.\d+)?\s+(EA|SF|LF|SY|SQ|HR|LS)/i.test(trimmed)) return null

  // Common flooring room keywords
  const roomKeywords = /\b(floor|room|bath|kitchen|hall|foyer|closet|bedroom|stair|living|dining|office|entry|laundry|landing|area|garage|basement|loft|master|main|upper|lower|1st|2nd|3rd)\b/i
  if (roomKeywords.test(trimmed) && !/\d{3,}/.test(trimmed)) {
    return trimmed
  }
  // ALL CAPS short line with no numbers = likely a section header
  if (trimmed === trimmed.toUpperCase() && !/\d/.test(trimmed) && trimmed.length > 2) {
    return trimmed
  }
  return null
}

/**
 * Parse a line item row. Flooring estimates typically have columns like:
 * SKU/Description   Qty   Unit   UnitPrice   Amount
 * We try multiple patterns to handle different PDF layouts.
 */
function parseLineItem(line: string, currentRoom: string): any | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Pattern 1: tab/multiple-space separated with trailing numbers
  // e.g. "Base moulding removal   120   LF   1.50   180.00"
  const pattern1 = /^(.+?)\s{2,}(\d+\.?\d*)\s+(EA|SF|LF|SY|SQ|HR|LS|PC|BD|BX|PK|SET|ROLL|GAL|TON|YD|FT|IN|MT|M2|M)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/i
  const m1 = trimmed.match(pattern1)
  if (m1) {
    return {
      room: currentRoom,
      sku: m1[1].trim(),
      description: m1[1].trim(),
      quantity: parseNumber(m1[2]),
      unit: m1[3].toUpperCase(),
      price: parseNumber(m1[4]),
      amount: parseNumber(m1[5]),
    }
  }

  // Pattern 2: with dollar signs
  // e.g. "3 yard dump   2   EA   $200.00   $400.00"
  const pattern2 = /^(.+?)\s{2,}(\d+\.?\d*)\s+(EA|SF|LF|SY|SQ|HR|LS|PC|BD|BX|PK|SET|ROLL|GAL|TON|YD|FT|IN|MT|M2|M)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)$/i
  const m2 = trimmed.match(pattern2)
  if (m2) {
    return {
      room: currentRoom,
      sku: m2[1].trim(),
      description: m2[1].trim(),
      quantity: parseNumber(m2[2]),
      unit: m2[3].toUpperCase(),
      price: parseNumber(m2[4]),
      amount: parseNumber(m2[5]),
    }
  }

  // Pattern 3: just description + amount at end (no unit)
  // e.g. "Haul away debris                  350.00"
  const pattern3 = /^(.{5,}?)\s{3,}\$?([\d,]+\.?\d{2})$/
  const m3 = trimmed.match(pattern3)
  if (m3) {
    const amount = parseNumber(m3[2])
    if (amount > 0) {
      return {
        room: currentRoom,
        sku: m3[1].trim(),
        description: m3[1].trim(),
        quantity: 1,
        unit: 'EA',
        price: amount,
        amount,
      }
    }
  }

  return null
}

/**
 * Extract summary totals from the bottom of the document.
 * Looks for lines like "Material Total: $18,592.65"
 */
function extractTotals(text: string) {
  const totals = { materialTotal: 0, laborTotal: 0, taxTotal: 0, discountTotal: 0, totalAmount: 0 }

  const patterns: { key: keyof typeof totals, regex: RegExp }[] = [
    { key: 'materialTotal', regex: /material[s]?\s*(?:total|subtotal|cost)[:\s]+\$?([\d,]+\.?\d*)/i },
    { key: 'laborTotal', regex: /labor\s*(?:total|subtotal|cost)[:\s]+\$?([\d,]+\.?\d*)/i },
    { key: 'taxTotal', regex: /tax\s*(?:total|amount)?[:\s]+\$?([\d,]+\.?\d*)/i },
    { key: 'discountTotal', regex: /discount\s*(?:total|amount)?[:\s]+\$?([\d,]+\.?\d*)/i },
    { key: 'totalAmount', regex: /(?:grand\s*)?total[:\s]+\$?([\d,]+\.?\d*)/i },
  ]

  for (const { key, regex } of patterns) {
    const match = text.match(regex)
    if (match) {
      totals[key] = parseNumber(match[1])
    }
  }

  return totals
}

/**
 * Parse line items from a MeasureSquare-format PDF.
 * MeasureSquare items follow the pattern:
 *   SF/LF items: "Description SF <area> SF (<area> SY) <area> SF (<area> SY) <perimeter> <waste>%"
 *   EA items:    "Description EA <qty> <qty> <waste>%"
 * Items don't have per-item prices — only quantities and descriptions.
 */
function parseMeasureSquareItems(text: string): any[] {
  const items: any[] = []

  // Find items section (starts after header row ending with "Waste*")
  const wasteHeaderIdx = text.indexOf('Waste*')
  if (wasteHeaderIdx === -1) return items

  // Also stop before room dimension pages / floor plan pages
  let itemsText = text.substring(wasteHeaderIdx + 6)
  // Cut off at the "For roll products" footer or room dimension pages
  const footerMatch = itemsText.match(/\*\s*For roll products/)
  if (footerMatch && footerMatch.index !== undefined) {
    itemsText = itemsText.substring(0, footerMatch.index)
  }

  // Each item ends with a waste percentage (e.g., "0.0%" or "13.2%")
  // Split on these markers to isolate individual item chunks
  const segments = itemsText.split(/(\d+\.?\d*%)/g)

  // segments alternates: [content0, percent0, content1, percent1, ...]
  for (let i = 0; i < segments.length - 1; i += 2) {
    const content = segments[i].trim()
    if (!content) continue

    // Skip non-item text (page headers, footers, summary lines)
    if (/^(Summary|\d+\/\d+\s+estimate|Ann Arbor|Excellence|quote@|Prepared by)/i.test(content)) continue
    // Skip room dimension lines (like "4'7\" 2'7\"")
    if (/^\d+'[\d"\s]+$/.test(content)) continue

    // ── SF/LF items ──
    // e.g. "Deep Clean Hardwood SF 710.87 SF (78.99 SY) 710.87 SF (78.99 SY) 203'0\""
    const sfMatch = content.match(/^(.*?)\s+(SF|LF)\s+(\d[\d,.]*)\s+(?:SF|LF)/i)
    if (sfMatch) {
      const desc = sfMatch[1].trim()
      if (!desc || desc.length < 3) continue
      items.push({
        room: 'General',
        sku: desc,
        description: desc,
        quantity: parseNumber(sfMatch[3]),
        unit: sfMatch[2].toUpperCase(),
        price: 0,
        amount: 0,
      })
      continue
    }

    // ── EA items ──
    // e.g. "Small job set up fee EA 1.0 1.0" or "3 1/2 red oak bullnose EA 4.0 4.0"
    const eaMatch = content.match(/^(.*?)\s+(EA)\s+(\d+\.?\d*)/i)
    if (eaMatch) {
      const desc = eaMatch[1].trim()
      if (!desc || desc.length < 3) continue
      items.push({
        room: 'General',
        sku: desc,
        description: desc,
        quantity: parseNumber(eaMatch[3]),
        unit: 'EA',
        price: 0,
        amount: 0,
      })
      continue
    }
  }

  return items
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/estimates')

  const body = await readBody(event)
  const { pdfUrl } = body

  if (!pdfUrl) {
    throw createError({ statusCode: 400, message: 'PDF URL is required' })
  }

  // Download PDF
  let pdfBuffer: Buffer
  try {
    const fetchOptions: RequestInit = {}
    const isVercelBlob = pdfUrl.includes('vercel-storage.com') || pdfUrl.includes('vercel.com') || pdfUrl.includes('blob.vercel-storage.com')
    if (isVercelBlob && process.env.BLOB_READ_WRITE_TOKEN) {
      fetchOptions.headers = { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
      log.info('Fetching private Vercel Blob with auth token')
    }
    else {
      log.info('Fetching PDF without auth:', pdfUrl.substring(0, 80))
    }
    const res = await fetch(pdfUrl, fetchOptions)
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`)
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  }
  catch (err: any) {
    log.error('Failed to download PDF:', err)
    throw createError({ statusCode: 500, message: `Failed to download PDF: ${err.message}` })
  }

  try {
    // Parse the PDF text using unpdf (same approach as Cultural-Gourmet)
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdfData = new Uint8Array(pdfBuffer)
    const pdf = await getDocumentProxy(pdfData)
    const { text } = await extractText(pdf, { mergePages: true })
    log.info(`PDF parsed: ${pdf.numPages} pages, ${text.length} chars`)

    const lineItems: any[] = []
    const totals = extractTotals(text)

    // Detect PDF format and use appropriate parser
    const isMeasureSquare = /Measure\s*Square/i.test(text)

    if (isMeasureSquare) {
      log.info('Detected MeasureSquare format PDF')
      lineItems.push(...parseMeasureSquareItems(text))
    } else {
      // Generic format: line-by-line parsing for tab/space-separated columns
      const lines = text.split('\n')
      let currentRoom = 'General'

      for (const line of lines) {
        const roomHeader = detectRoomHeader(line)
        if (roomHeader) {
          currentRoom = roomHeader
          continue
        }
        const item = parseLineItem(line, currentRoom)
        if (item) {
          lineItems.push(item)
        }
      }
    }

    log.info(`Extracted ${lineItems.length} line items, totals: ${JSON.stringify(totals)}`)

    // Auto-sync new SKUs into Products catalogue
    if (lineItems.length > 0) {
      try {
        const syncResult = await syncProductsFromLineItems(lineItems)
        log.info(`Product sync: ${syncResult.inserted} new, ${syncResult.existing} existing, ${syncResult.skipped} skipped`)
      }
      catch (syncErr: any) {
        log.error('Product sync failed (non-fatal):', syncErr?.message)
      }
    }

    return {
      success: true,
      data: {
        lineItems,
        ...totals,
      },
    }
  }
  catch (error: any) {
    log.error('PDF extraction error:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to extract data from PDF: ${error?.message || 'Unknown error'}`,
    })
  }
})
