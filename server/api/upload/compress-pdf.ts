// POST /api/upload/compress-pdf
//
// Two ways to call this:
//   1. { url: 'https://res.cloudinary.com/.../file.pdf', deleteOriginal?: true }
//      — recommended for files > 3MB. Browser uploads directly to Cloudinary
//      first, then sends the URL here for compression. Bypasses Vercel's
//      4.5MB body limit entirely.
//
//   2. { file: 'data:application/pdf;base64,...' }
//      — legacy path for small files. Will fail on Vercel for inputs > 4MB.
//
// In both cases, returns:
//   { success, url, publicId, originalSize, compressedSize }
import { v2 as cloudinary } from 'cloudinary'
// @ts-ignore
import { PDFDocument } from 'pdf-lib'

async function compressPdfBuffer(input: Buffer): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(input, { ignoreEncryption: true })
    pdfDoc.setTitle('')
    pdfDoc.setAuthor('')
    pdfDoc.setSubject('')
    pdfDoc.setKeywords([])
    pdfDoc.setProducer('')
    pdfDoc.setCreator('')
    const out = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    })
    return Buffer.from(out)
  } catch (e: any) {
    console.warn('[compress-pdf] pdf-lib pass failed, returning input:', e.message)
    return input
  }
}

async function uploadCompressedToCloudinary(
  buffer: Buffer,
  folder: string,
): Promise<{ url: string; publicId: string }> {
  const fs = await import('fs')
  const path = await import('path')
  const os = await import('os')

  const tmp = path.join(
    os.tmpdir(),
    `compressed_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`,
  )
  fs.writeFileSync(tmp, buffer)

  try {
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_large(
        tmp,
        {
          folder,
          resource_type: 'raw',
          chunk_size: 6_000_000,
          use_filename: true,
          unique_filename: true,
        },
        (err, res) => (err ? reject(err) : resolve(res)),
      )
    })
    return { url: result.secure_url, publicId: result.public_id }
  } finally {
    try { fs.unlinkSync(tmp) } catch (e) { /* ignore */ }
  }
}

/**
 * Best-effort delete of an original Cloudinary asset after we've uploaded
 * the compressed version. Failures are logged but never thrown.
 */
async function tryDeleteCloudinaryAsset(publicId: string) {
  try {
    await new Promise<void>((resolve, reject) => {
      cloudinary.uploader.destroy(
        publicId,
        { resource_type: 'raw', invalidate: true },
        (err, res) => (err ? reject(err) : resolve(res)),
      )
    })
    console.log(`[compress-pdf] Deleted original: ${publicId}`)
  } catch (e: any) {
    console.warn(`[compress-pdf] Could not delete original ${publicId}:`, e?.message)
  }
}

/** Extract the Cloudinary public_id from a secure_url. */
function publicIdFromUrl(url: string): string | null {
  // e.g. https://res.cloudinary.com/<cloud>/raw/upload/v1735000000/<folder>/<name>.pdf
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/)
  return match ? match[1] : null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  })

  const body = await readBody<{
    file?: string
    url?: string
    folder?: string
    deleteOriginal?: boolean
  }>(event)

  const targetFolder = body?.folder || 'hardwood-hub/contracts'

  try {
    // ─── Path A: URL input (recommended for any size) ────────────
    if (body?.url) {
      console.log(`[compress-pdf] URL mode → ${body.url.slice(0, 80)}…`)

      const fetchRes = await fetch(body.url)
      if (!fetchRes.ok) {
        throw new Error(`Failed to fetch original: ${fetchRes.status} ${fetchRes.statusText}`)
      }
      const original = Buffer.from(await fetchRes.arrayBuffer())
      const inputMB = (original.length / 1024 / 1024).toFixed(2)
      console.log(`[compress-pdf] Downloaded original: ${inputMB}MB`)

      const compressed = await compressPdfBuffer(original)
      const outputMB = (compressed.length / 1024 / 1024).toFixed(2)
      const ratio = ((1 - compressed.length / original.length) * 100).toFixed(1)
      console.log(`[compress-pdf] ${inputMB}MB → ${outputMB}MB (${ratio}% smaller)`)

      const uploaded = await uploadCompressedToCloudinary(compressed, targetFolder)
      console.log(`[compress-pdf] Compressed copy: ${uploaded.url}`)

      // Best-effort: clean up the uncompressed original to save storage
      if (body.deleteOriginal !== false) {
        const origPid = publicIdFromUrl(body.url)
        if (origPid) await tryDeleteCloudinaryAsset(origPid)
      }

      return {
        success: true,
        url: uploaded.url,
        publicId: uploaded.publicId,
        originalSize: inputMB,
        compressedSize: outputMB,
      }
    }

    // ─── Path B: base64 input (legacy, small files only) ─────────
    if (body?.file) {
      const base64Data = body.file.replace(/^data:application\/pdf;base64,/, '')
      const original = Buffer.from(base64Data, 'base64')
      const inputMB = (original.length / 1024 / 1024).toFixed(2)
      console.log(`[compress-pdf] base64 mode, ${inputMB}MB`)

      const compressed = await compressPdfBuffer(original)
      const outputMB = (compressed.length / 1024 / 1024).toFixed(2)
      console.log(`[compress-pdf] ${inputMB}MB → ${outputMB}MB`)

      const uploaded = await uploadCompressedToCloudinary(compressed, targetFolder)
      console.log(`[compress-pdf] Uploaded: ${uploaded.url}`)

      return {
        success: true,
        url: uploaded.url,
        publicId: uploaded.publicId,
        originalSize: inputMB,
        compressedSize: outputMB,
      }
    }

    throw createError({
      statusCode: 400,
      message: 'Provide either { url } (preferred) or { file } (base64)',
    })
  } catch (e: any) {
    console.error('[compress-pdf] Error:', e?.message, e?.stack)
    throw createError({
      statusCode: 500,
      message: `PDF compression/upload failed: ${e?.message || String(e)}`,
    })
  }
})
