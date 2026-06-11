import { Readable } from 'node:stream'
import { v2 as cloudinary } from 'cloudinary'
// @ts-ignore: IDE cache invalidation workaround
import { PDFDocument } from 'pdf-lib'
import { AppSetting } from '../../../models/AppSetting'
import { Estimate } from '../../../models/Estimate'
import { EstimateTemplate } from '../../../models/EstimateTemplate'
import { compressImagesInHtml } from '../../../utils/image-compressor'
import { connectDB } from '../../../utils/mongoose'

import { generatePdfFromHtml } from '../../../utils/pdf-generator'
import { logger } from '../../../utils/logger'
const log = logger('[estimates/download-pdf]')

// Vercel serverless body cap is ~4.5MB on Hobby and 6MB on Pro for non-streamed
// responses. Anything bigger we route through Cloudinary and 302 the user.
const VERCEL_BODY_LIMIT_BYTES = 4 * 1024 * 1024 // 4MB safe ceiling

async function safeFetch(url: string, timeoutMs = 8000, options: RequestInit = {}) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  }
  catch (err) {
    clearTimeout(id)
    throw err
  }
}

export default defineEventHandler(async (event) => {
  try {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, message: 'Estimate ID is required' })
    }

    const estimate = await Estimate.findById(id)
    if (!estimate) {
      throw createError({ statusCode: 404, message: 'Estimate not found' })
    }

    const settingsDoc = await AppSetting.findOne({ key: 'companyProfile' }).lean() as any
    const company = settingsDoc?.value || {}
    const template = await EstimateTemplate.findById(estimate.templateId).lean() as any

    let mergedHTML = estimate.content || ''

    if (estimate.variableValues) {
      for (const [key, val] of Object.entries<string>(estimate.variableValues)) {
        let mergedVal = String(val || '')
        const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
        mergedHTML = mergedHTML.replace(re, mergedVal)
      }
    }

    const sysPrintDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    mergedHTML = mergedHTML.replace(/\{\{\s*printDate\s*\}\}/gi, sysPrintDate)
    mergedHTML = mergedHTML.replace(/\{\{\s*company_name\s*\}\}/gi, company?.name || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_address\s*\}\}/gi, company?.address || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_city\s*\}\}/gi, company?.city || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_state\s*\}\}/gi, company?.state || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_zip\s*\}\}/gi, company?.zip || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_phone1?\s*\}\}/gi, company?.phone1 || company?.phone || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_phone2\s*\}\}/gi, company?.phone2 || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_website\s*\}\}/gi, company?.website || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_email\s*\}\}/gi, company?.email || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_license\s*\}\}/gi, company?.licenseNumber || '')

    const companyLogoImg = company?.logo
      ? `<img src="${company.logo.includes('cloudinary.com') ? company.logo.replace('/upload/', '/upload/q_60,f_png,w_300/') : company.logo}" alt="Company Logo" style="max-height: 80px; object-fit: contain;" />`
      : ''
    mergedHTML = mergedHTML.replace(/\{\{\s*company_logo\s*\}\}/g, companyLogoImg)

    mergedHTML = mergedHTML.replace(/<span[^>]*class="[^"]*template-variable[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    mergedHTML = mergedHTML.replace(/<hr\s*\/?>/gi, '')

    if (estimate.attachedGalleryImages && estimate.attachedGalleryImages.length > 0) {
      mergedHTML += `
        <div style="page-break-before: always; margin-top: 40px; text-align: center;">
          <h2 style="font-size: 1.5rem; font-weight: 700; color: #111; margin-bottom: 20px; text-align: left;">Attached Pictures</h2>
          ${estimate.attachedGalleryImages.map((imgUrl: string) => {
            const optimizedUrl = imgUrl.includes('cloudinary.com') ? imgUrl.replace('/upload/', '/upload/q_60,f_jpg,w_800/') : imgUrl
            return `<img src="${optimizedUrl}" style="max-width: 100%; max-height: 800px; object-fit: contain; margin-bottom: 24px; border-radius: 8px; border: 1px solid #ccc; page-break-inside: avoid; display: block;" />`
          }).join('')}
        </div>
      `
    }

    const companyColor = company?.brandColor || '#84CC16'
    const companyLogo = company?.logo ? `<img src="${company.logo.includes('cloudinary.com') ? company.logo.replace('/upload/', '/upload/q_60,f_png,w_300/') : company.logo}" style="max-height: 90px; max-width: 250px;" alt="Logo" />` : `<h1 style="color: ${companyColor}; margin: 0;">${company?.name || 'Company Name'}</h1>`

    const companyDetails = `
      <div style="text-align: right; font-size: 12px; line-height: 1.5; color: #8A4F2A; font-family: Helvetica, Arial, sans-serif; font-weight: bold;">
        <div style="color: ${companyColor}; font-size: 16px;">${company?.name || 'Company Name'}</div>
        <div>${company?.address || ''}</div>
        <div>${company?.city || ''}, ${company?.state || ''} ${company?.zip || ''}</div>
        <div>Phone: ${company?.phone1 || company?.phone || ''}</div>
        ${company?.phone2 ? `<div>Phone: ${company.phone2}</div>` : ''}
        <div>${company?.website?.replace(new RegExp('^https?://'), '') || ''}</div>
        <div>${company?.email || ''}</div>
        ${company?.licenseNumber ? `<div>Builder's License Number: ${company.licenseNumber}</div>` : ''}
      </div>
    `

    const letterHead = `
      <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; border: none;">
        <tr>
          <td valign="top" width="50%" style="border: none; padding: 0;">
            ${companyLogo}
          </td>
          <td valign="top" width="50%" style="border: none; padding: 0;">
            ${companyDetails}
          </td>
        </tr>
      </table>
      <hr style="border: 0; border-bottom: 2px solid ${companyColor}; margin-bottom: 20px;" />
    `

    const pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.75; font-size: 14px; color: #111; }
          h1 { font-size: 1.875rem; font-weight: 900; letter-spacing: -0.025em; margin-bottom: 1rem; margin-top: 2rem; }
          h2 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.025em; margin-bottom: 0.75rem; margin-top: 1.5rem; }
          h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; margin-top: 1.25rem; }
          p { font-size: 0.875rem; line-height: 1.625; margin-bottom: 0.75rem; margin-top: 1em; }
          ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; margin-top: 1em; }
          ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.75rem; margin-top: 1em; }
          li { font-size: 0.875rem; }
          blockquote { border-left: 4px solid rgba(0,0,0,0.2); padding-left: 1rem; padding-top: 0.5rem; padding-bottom: 0.5rem; margin: 1rem 0; font-style: italic; color: #666; background: rgba(0,0,0,0.02); }
          hr { border-top: 2px solid #ccc; margin: 1.5rem 0; }
          img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
          a { color: #2563eb; text-decoration: underline; }
          mark { background: #fef08a; padding: 0 0.125rem; border-radius: 0.125rem; }
          table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
          th, td { border: 1px solid #ccc; padding: 0.5rem 0.75rem; text-align: left; }
          th { background: #f3f4f6; font-weight: 600; }
        </style>
      </head>
      <body style="padding: 0; margin: 0;">
        ${letterHead}
        <h2 style="color: #000; text-align: left; margin-top: 20px; margin-bottom: 20px; font-size: 18px;">
          ${estimate.title}
        </h2>
        <div>
          ${mergedHTML}
        </div>
      </body>
      </html>
    `

    // Pre-compress all images in the HTML before Puppeteer renders them.
    let compressedHTML = pdfHTML
    try {
      compressedHTML = await compressImagesInHtml(pdfHTML, {
        maxWidth: 800,
        quality: 55,
        format: 'jpeg',
      })
      log.info(`[pdf-download] HTML before/after compress: ${(pdfHTML.length / 1024).toFixed(0)}KB → ${(compressedHTML.length / 1024).toFixed(0)}KB`)
    }
    catch (compressErr: any) {
      log.warn('[pdf-download] Image compression failed, using raw HTML:', compressErr?.message)
    }

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generatePdfFromHtml(compressedHTML)
      log.info(`[pdf-download] Puppeteer PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`)
    }
    catch (err: any) {
      log.error('[pdf-download] Puppeteer error:', err)
      throw createError({
        statusCode: 500,
        statusMessage: err?.message || 'PDF generation crashed',
        data: err?.stack,
      })
    }

    // Always run through pdf-lib for compression + optional attached PDF merge.
    let finalPdfBuffer: Buffer
    try {
      const mainPdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })

      if (estimate.attachedPdf) {
        try {
          let attachedPdfBuffer: Buffer
          if (estimate.attachedPdf.startsWith('http')) {
            const fetchOptions: RequestInit = {}
            if (estimate.attachedPdf.includes('vercel-storage.com') || estimate.attachedPdf.includes('vercel.com')) {
              fetchOptions.headers = { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
            }
            const fetchRes = await safeFetch(estimate.attachedPdf, 15000, fetchOptions)
            if (!fetchRes.ok)
              throw new Error(`Fetch failed: ${fetchRes.statusText}`)
            const arrayBuffer = await fetchRes.arrayBuffer()
            attachedPdfBuffer = Buffer.from(arrayBuffer)
          }
          else {
            const attachedBase64 = estimate.attachedPdf.replace(/^data:application\/pdf;base64,/, '')
            attachedPdfBuffer = Buffer.from(attachedBase64, 'base64')
          }

          const attachedPdfDoc = await PDFDocument.load(attachedPdfBuffer, { ignoreEncryption: true })
          const copiedPages = await mainPdf.copyPages(attachedPdfDoc, attachedPdfDoc.getPageIndices())
          copiedPages.forEach((page: any) => mainPdf.addPage(page))
        }
        catch (mergeErr) {
          log.error('[pdf-download] Failed to merge attached PDF:', mergeErr)
        }
      }

      finalPdfBuffer = Buffer.from(await mainPdf.save({ useObjectStreams: true }))
      log.info(`[pdf-download] Final PDF after pdf-lib: ${(finalPdfBuffer.length / 1024 / 1024).toFixed(2)}MB`)
    }
    catch (compressErr) {
      log.error('[pdf-download] pdf-lib compression failed, using raw buffer:', compressErr)
      finalPdfBuffer = pdfBuffer
    }

    const filename = `Estimate_${estimate.estimateNumber || estimate._id}`

    setResponseHeader(event, 'Content-Type', 'application/pdf')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}.pdf"`)

    if (finalPdfBuffer.length > VERCEL_BODY_LIMIT_BYTES) {
      log.info(`[pdf-download] PDF over ${VERCEL_BODY_LIMIT_BYTES} bytes → Streaming response`)
      return sendStream(event, Readable.from(finalPdfBuffer))
    }

    return finalPdfBuffer
  }
  catch (err: any) {
    log.error('[CRITICAL PDF ERROR]', err)
    throw createError({
      statusCode: 500,
      statusMessage: `PDF Error: ${err.message || String(err)}`,
      data: err.stack,
    })
  }
})
