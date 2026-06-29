// POST /api/estimates/extract-pdf
// Accepts a Vercel Blob URL of a PDF and uses Gemini AI to extract line items and totals.

import { GoogleGenAI } from '@google/genai'
import { requirePermission } from '../../utils/requirePermission'
import { logger } from '../../utils/logger'
import { connectDB } from '../../utils/mongoose'

const log = logger('[estimates/extract-pdf.post]')

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/crm/estimates')

  const body = await readBody(event)
  const { pdfUrl } = body

  if (!pdfUrl) {
    throw createError({
      statusCode: 400,
      message: 'PDF URL is required',
    })
  }

  // Download PDF from the URL (private Vercel Blob URLs require auth)
  let pdfBase64 = ''
  try {
    const fetchOptions: RequestInit = {}
    const isVercelBlob = pdfUrl.includes('vercel-storage.com') || pdfUrl.includes('vercel.com') || pdfUrl.includes('blob.vercel-storage.com')
    if (isVercelBlob && process.env.BLOB_READ_WRITE_TOKEN) {
      fetchOptions.headers = { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
      log.info('Fetching private Vercel Blob with auth token')
    } else {
      log.info('Fetching PDF without auth:', pdfUrl.substring(0, 80))
    }
    const res = await fetch(pdfUrl, fetchOptions)
    if (!res.ok)
      throw new Error(`Failed to fetch PDF: ${res.statusText}`)
    const arrayBuffer = await res.arrayBuffer()
    pdfBase64 = Buffer.from(arrayBuffer).toString('base64')
  }
  catch (err: any) {
    log.error('Failed to download PDF:', err)
    throw createError({
      statusCode: 500,
      message: `Failed to download PDF from URL: ${err.message}`,
    })
  }

  const runtimeConfig = useRuntimeConfig()

  // Setup Gemini client
  const projectId = runtimeConfig.googleCloudProjectId
  const location = runtimeConfig.googleCloudLocation || 'us-central1'
  const clientEmail = runtimeConfig.googleClientEmail
  const privateKey = runtimeConfig.googlePrivateKey
  const apiKey = runtimeConfig.geminiApiKey

  if (!projectId && !apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Neither Vertex AI credentials nor Gemini API Key configured',
    })
  }

  try {
    let ai: GoogleGenAI
    if (projectId && clientEmail && privateKey) {
      ai = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location,
        googleAuthOptions: {
          credentials: {
            client_email: clientEmail,
            private_key: privateKey.replace(/\\n/g, '\n'),
          },
        },
      })
    }
    else {
      ai = new GoogleGenAI({ apiKey })
    }

    const prompt = `You are a document analysis expert. Analyze this PDF document representing a flooring estimate proposal and extract the individual line items and final summary totals.

Your task:
1. **Extract all proposal line items**: Walk through the sections or pages representing proposal tables.
2. Group items by their **Room** or **Area** (e.g. "Main Floor", "1/2 bath", "dining room", "foyer/hall", "closet"). This is typically indicated by headers or section titles above the tables.
3. For each line item, extract:
   - "room": The name of the room or area this item belongs to.
   - "sku": The item's SKU/Item ID/Name (e.g. "3 yard dump", "Base moulding removal", "4 1/4\" white oak select").
   - "description": The full description of materials and labor.
   - "quantity": The numeric quantity.
   - "unit": The unit of measurement (e.g. "EA", "LF", "SF").
   - "price": The unit price (numeric, do not include dollar signs or commas).
   - "amount": The line total amount (numeric, do not include dollar signs or commas).
4. **Extract the final summary totals** at the end of the document (usually under Material, Labor, Tax, Discount, and Total):
   - "materialTotal": Total cost of materials.
   - "laborTotal": Total cost of labor.
   - "taxTotal": Total tax amount.
   - "discountTotal": Total discount applied.
   - "totalAmount": Grand total amount.

Return your response as a valid JSON object with this exact structure:
{
  "lineItems": [
    {
      "room": "Main Floor",
      "sku": "3 yard dump",
      "description": "3 yards of waste removal",
      "quantity": 2.0,
      "unit": "EA",
      "price": 200.0,
      "amount": 400.0
    }
  ],
  "materialTotal": 18592.65,
  "laborTotal": 15104.66,
  "taxTotal": 0.0,
  "discountTotal": 1197.31,
  "totalAmount": 32500.0
}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    })

    const text = response.text ?? ''
    let parsed: any
    try {
      parsed = JSON.parse(text)
    }
    catch {
      const cleanJson = text
        .replace(/^```(?:json)?\n?/i, '')
        .replace(/\n?```$/, '')
        .trim()
      try {
        parsed = JSON.parse(cleanJson)
      }
      catch {
        const braceMatch = cleanJson.match(/\{[\s\S]*\}/)
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0])
        }
        else {
          throw new Error('Could not parse AI response as JSON')
        }
      }
    }

    return {
      success: true,
      data: {
        lineItems: parsed.lineItems || [],
        materialTotal: parsed.materialTotal || 0,
        laborTotal: parsed.laborTotal || 0,
        taxTotal: parsed.taxTotal || 0,
        discountTotal: parsed.discountTotal || 0,
        totalAmount: parsed.totalAmount || 0,
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
