// POST /api/upload/compress-pdf
// Receives a base64 PDF from the client, compresses with pdf-lib (works on Vercel),
// then uploads the compressed version to Cloudinary using upload_large for any size.
import { v2 as cloudinary } from 'cloudinary'
// @ts-ignore
import { PDFDocument } from 'pdf-lib'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  })

  const body = await readBody(event)
  const { file, folder } = body

  if (!file) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  try {
    const base64Data = file.replace(/^data:application\/pdf;base64,/, '')
    const inputBuffer = Buffer.from(base64Data, 'base64')
    const inputSizeMB = (inputBuffer.length / 1024 / 1024).toFixed(2)

    console.log(`[compress-pdf] Input PDF size: ${inputSizeMB}MB`)

    // pdf-lib structural compression — works on Vercel with no native deps.
    // Strips metadata + uses object streams for ~20-40% reduction.
    let compressedBuffer: Buffer = inputBuffer
    try {
      const pdfDoc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true })
      pdfDoc.setTitle('')
      pdfDoc.setAuthor('')
      pdfDoc.setSubject('')
      pdfDoc.setKeywords([])
      pdfDoc.setProducer('')
      pdfDoc.setCreator('')

      const compressedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      })
      compressedBuffer = Buffer.from(compressedBytes)
    } catch (e: any) {
      console.warn('[compress-pdf] pdf-lib pass failed, using original:', e.message)
    }

    const outputSizeMB = (compressedBuffer.length / 1024 / 1024).toFixed(2)
    console.log(
      `[compress-pdf] Compressed: ${inputSizeMB}MB → ${outputSizeMB}MB ` +
      `(${((1 - compressedBuffer.length / inputBuffer.length) * 100).toFixed(1)}% reduction)`,
    )

    // Cloudinary upload_large needs a path. Use OS tmpdir (writable as /tmp on Vercel).
    const fs = await import('fs')
    const path = await import('path')
    const os = await import('os')

    const tempFilePath = path.join(
      os.tmpdir(),
      `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`,
    )
    fs.writeFileSync(tempFilePath, compressedBuffer)

    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_large(
        tempFilePath,
        {
          folder: folder || 'hardwood-hub/contracts',
          resource_type: 'raw',
          chunk_size: 6_000_000,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          try { fs.unlinkSync(tempFilePath) } catch (e) { /* ignore */ }
          if (error) return reject(error)
          resolve(result)
        },
      )
    })

    console.log(`[compress-pdf] Uploaded: ${result.secure_url}`)

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      originalSize: inputSizeMB,
      compressedSize: outputSizeMB,
    }
  } catch (e: any) {
    console.error('[compress-pdf] Error:', e?.message, e?.stack)
    throw createError({
      statusCode: 500,
      message: `PDF compression/upload failed: ${e?.message || String(e)}`,
    })
  }
})
