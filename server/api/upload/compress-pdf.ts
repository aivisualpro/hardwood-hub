// POST /api/upload/compress-pdf
// Receives a base64 PDF from the client, compresses it with pdf-lib,
// then uploads the compressed version to Cloudinary.
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
    // Strip data URI prefix
    const base64Data = file.replace(/^data:application\/pdf;base64,/, '')
    const inputBuffer = Buffer.from(base64Data, 'base64')
    const inputSizeMB = (inputBuffer.length / 1024 / 1024).toFixed(2)

    console.log(`[compress-pdf] Input PDF size: ${inputSizeMB}MB`)

    // First try aggressive Ghostscript compression (downsamples images)
    const { compressPdfWithGhostscript } = await import('../../utils/pdf-compressor')
    let compressedBuffer = await compressPdfWithGhostscript(inputBuffer)
    
    // Fallback/secondary compression: pdf-lib (strips metadata, useObjectStreams)
    try {
      const pdfDoc = await PDFDocument.load(compressedBuffer, { ignoreEncryption: true })
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
      console.warn('[compress-pdf] pdf-lib pass failed:', e.message)
    }

    const outputSizeMB = (compressedBuffer.length / 1024 / 1024).toFixed(2)

    console.log(`[compress-pdf] Compressed PDF: ${inputSizeMB}MB → ${outputSizeMB}MB (${((1 - compressedBuffer.length / inputBuffer.length) * 100).toFixed(1)}% reduction)`)

    // Save to temp file for upload_large (which requires a path, not a base64 string)
    const fs = await import('fs')
    const path = await import('path')
    const os = await import('os')
    
    const tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`)
    fs.writeFileSync(tempFilePath, compressedBuffer)

    // Upload compressed version to Cloudinary using upload_large
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_large(tempFilePath, {
        folder: folder || 'hardwood-hub/contracts',
        resource_type: 'raw',
        chunk_size: 6000000 // 6MB chunks
      }, (error, result) => {
        // Clean up temp file
        try { fs.unlinkSync(tempFilePath) } catch (e) {}
        
        if (error) return reject(error)
        resolve(result)
      })
    })

    console.log(`[compress-pdf] Uploaded to Cloudinary: ${result.secure_url}`)

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      originalSize: inputSizeMB,
      compressedSize: outputSizeMB,
    }
  } catch (e: any) {
    console.error('[compress-pdf] Error:', e.message)
    throw createError({
      statusCode: 500,
      message: `PDF compression/upload failed: ${e.message}`,
    })
  }
})
