/**
 * GET /api/contracts/sign/pdf/:token — proxy the attached PDF for the public signing page.
 *
 * Since the PDF is stored on Vercel Blob with private access, the browser cannot
 * fetch it directly. This endpoint streams the PDF through the server so the
 * iframe on the signing page can display it without exposing the blob token.
 */
import { Contract } from '../../../../models/Contract'
import { connectDB } from '../../../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, message: 'Signing token is required' })
  }

  const contract = await Contract.findOne({ signingToken: token }).select('attachedPdf signingToken').lean() as any
  if (!contract) {
    throw createError({ statusCode: 404, message: 'Contract not found' })
  }

  if (!contract.attachedPdf) {
    throw createError({ statusCode: 404, message: 'No PDF attached to this contract' })
  }

  const pdfUrl = contract.attachedPdf

  // Only proxy remote URLs
  if (!pdfUrl.startsWith('http')) {
    throw createError({ statusCode: 400, message: 'Invalid PDF reference' })
  }

  const fetchOptions: RequestInit = {}
  if (pdfUrl.includes('vercel-storage.com') || pdfUrl.includes('vercel.com')) {
    fetchOptions.headers = { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(pdfUrl, { ...fetchOptions, signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) {
      throw createError({ statusCode: 502, message: `Failed to fetch PDF: ${res.statusText}` })
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    setResponseHeaders(event, {
      'Content-Type': 'application/pdf',
      'Content-Length': String(buffer.length),
      'Content-Disposition': 'inline; filename="contract-attachment.pdf"',
      'Cache-Control': 'private, max-age=3600',
    })

    return buffer
  }
  catch (err: any) {
    clearTimeout(timeout)
    if (err.statusCode) throw err
    throw createError({ statusCode: 502, message: 'Failed to retrieve attached PDF' })
  }
})
