import { generatePdfFromHtml } from '../../../utils/pdf-generator'
import { compressImagesInHtml } from '../../../utils/image-compressor'
// @ts-ignore: IDE cache invalidation workaround
import { PDFDocument } from 'pdf-lib'
import { v2 as cloudinary } from 'cloudinary'
import { connectDB } from '../../../utils/mongoose'
import { Contract } from '../../../models/Contract'
import { AppSetting } from '../../../models/AppSetting'
import { ContractTemplate } from '../../../models/ContractTemplate'

// Vercel serverless body cap is ~4.5MB on Hobby and 6MB on Pro for non-streamed
// responses. Anything bigger we route through Cloudinary and 302 the user.
const VERCEL_BODY_LIMIT_BYTES = 4 * 1024 * 1024 // 4MB safe ceiling

const safeFetch = async (url: string, timeoutMs = 8000, options: RequestInit = {}) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (err) {
    clearTimeout(id)
    throw err
  }
}

import { Readable } from 'stream'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, message: 'Contract ID is required' })
    }

    const contract = await Contract.findById(id)
    if (!contract) {
      throw createError({ statusCode: 404, message: 'Contract not found' })
    }

    const settingsDoc = await AppSetting.findOne({ key: 'companyProfile' }).lean() as any
    const company = settingsDoc?.value || {}
    const template = await ContractTemplate.findById(contract.templateId).lean() as any

    let mergedHTML = contract.content || ''

    if (contract.variableValues) {
      for (const [key, val] of Object.entries<string>(contract.variableValues)) {
        const vDef = template?.variables?.find((v: any) => v.key === key)
        const isSig = vDef?.type === 'signature'
        let mergedVal = String(val || '')
        if (isSig && val) {
          mergedVal = `<img src="${val}" alt="Signature" style="max-height: 80px; object-fit: contain; vertical-align: middle;" />`
        }
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
    mergedHTML = mergedHTML.replace(/\{\{\s*company_phone[1]?\s*\}\}/gi, company?.phone1 || company?.phone || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_phone2\s*\}\}/gi, company?.phone2 || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_website\s*\}\}/gi, company?.website || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_email\s*\}\}/gi, company?.email || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_license\s*\}\}/gi, company?.licenseNumber || '')

    const companyLogoImg = company?.logo
      ? `<img src="${company.logo.includes('cloudinary.com') ? company.logo.replace('/upload/', '/upload/q_60,f_png,w_300/') : company.logo}" alt="Company Logo" style="max-height: 80px; object-fit: contain;" />`
      : ''
    mergedHTML = mergedHTML.replace(/\{\{\s*company_logo\s*\}\}/g, companyLogoImg)

    mergedHTML = mergedHTML.replace(/<table[\s\S]*?<\/table>/gi, (tableHTML: string) => {
      if (tableHTML.includes('Signature') && tableHTML.includes('____')) return ''
      return tableHTML
    })

    const contractorSigImg = company?.signature
      ? `<img src="${company.signature.includes('cloudinary.com') ? company.signature.replace('/upload/', '/upload/q_60,f_png,w_300/') : company.signature}" alt="Contractor Signature" style="max-height: 64px; object-fit: contain; vertical-align: middle;" />`
      : ''
    mergedHTML = mergedHTML.replace(/\{\{\s*companySignature\s*\}\}/gi, contractorSigImg)
    mergedHTML = mergedHTML.replace(/\{\{\s*company_signature\s*\}\}/gi, contractorSigImg)
    mergedHTML = mergedHTML.replace(/\{\{\s*contractor_signature\s*\}\}/gi, contractorSigImg)
    mergedHTML = mergedHTML.replace(/\{\{\s*customerSignature\s*\}\}/g, '')
    mergedHTML = mergedHTML.replace(/\{\{\s*customerSignatureDate\s*\}\}/g, '')

    mergedHTML = mergedHTML.replace(/<span[^>]*class="[^"]*template-variable[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    mergedHTML = mergedHTML.replace(/<hr\s*\/?>/gi, '')

    if (contract.attachedGalleryImages && contract.attachedGalleryImages.length > 0) {
      mergedHTML += `
        <div style="page-break-before: always; margin-top: 40px; text-align: center;">
          <h2 style="font-size: 1.5rem; font-weight: 700; color: #111; margin-bottom: 20px; text-align: left;">Attached Pictures</h2>
          ${contract.attachedGalleryImages.map((imgUrl: string) => {
            const optimizedUrl = imgUrl.includes('cloudinary.com') ? imgUrl.replace('/upload/', '/upload/q_60,f_jpg,w_800/') : imgUrl;
            return `<img src="${optimizedUrl}" style="max-width: 100%; max-height: 800px; object-fit: contain; margin-bottom: 24px; border-radius: 8px; border: 1px solid #ccc; page-break-inside: avoid; display: block;" />`;
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

    const companySigBox = `
      <div style="width: 100%; max-width: 480px;">
        <div style="height: 64px;">
          ${company?.signature ? `<img src="${company.signature.includes('cloudinary.com') ? company.signature.replace('/upload/', '/upload/q_60,f_png,w_300/') : company.signature}" style="max-height: 64px; max-width: 100%; object-fit: contain; object-position: left bottom; margin: 0; display: block;" />` : ``}
        </div>
        <div style="border-top: 1.5px solid #111827; margin-top: 4px; padding-top: 8px;">
          <div style="float: left; font-size: 15px; font-weight: 700; color: #111827; font-family: Helvetica, Arial, sans-serif; letter-spacing: -0.01em;">
            Contractor's Signature
          </div>
          <div style="float: right; font-size: 14px; font-weight: 400; color: #111827; font-family: Helvetica, Arial, sans-serif;">
            Date: ${sysPrintDate}
          </div>
          <div style="clear: both;"></div>
        </div>
      </div>
    `

    let signatureSection = ''

    if (contract.customerSignature) {
      const customerSigBox = `
        <div style="width: 100%; max-width: 480px;">
          <div style="height: 64px;">
            <img src="${contract.customerSignature.includes('cloudinary.com') ? contract.customerSignature.replace('/upload/', '/upload/q_60,f_png,w_300/') : contract.customerSignature}" style="max-height: 64px; max-width: 100%; object-fit: contain; object-position: left bottom; margin: 0; display: block;" />
          </div>
          <div style="border-top: 1.5px solid #111827; margin-top: 4px; padding-top: 8px;">
            <div style="float: left; font-size: 15px; font-weight: 700; color: #111827; font-family: Helvetica, Arial, sans-serif; letter-spacing: -0.01em;">
              Client's Signature
            </div>
            <div style="float: right; font-size: 14px; font-weight: 400; color: #111827; font-family: Helvetica, Arial, sans-serif;">
              Date: ${contract.customerSignatureDate ? new Date(contract.customerSignatureDate).toLocaleDateString() : sysPrintDate}
            </div>
            <div style="clear: both;"></div>
          </div>
        </div>
      `
      signatureSection = `
        <div style="margin-top: 60px;">
          <div style="margin-bottom: 40px;">
             ${customerSigBox}
          </div>
          <div>
             ${companySigBox}
          </div>
        </div>
      `
    }

    mergedHTML += signatureSection

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
          ${contract.title}
        </h2>
        <div>
          ${mergedHTML}
        </div>
      </body>
      </html>
    `

    // Pre-compress all images in the HTML before Puppeteer renders them.
    // Wrapped in try/catch — if sharp fails on Vercel, fall back to raw HTML
    // so the request still succeeds (just produces a bigger PDF).
    let compressedHTML = pdfHTML
    try {
      compressedHTML = await compressImagesInHtml(pdfHTML, {
        maxWidth: 800,
        quality: 55,
        format: 'jpeg',
      })
      console.log(`[pdf-download] HTML before/after compress: ${(pdfHTML.length / 1024).toFixed(0)}KB → ${(compressedHTML.length / 1024).toFixed(0)}KB`)
    } catch (compressErr: any) {
      console.warn('[pdf-download] Image compression failed, using raw HTML:', compressErr?.message)
    }

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generatePdfFromHtml(compressedHTML)
      console.log(`[pdf-download] Puppeteer PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`)
    } catch (err: any) {
      console.error('[pdf-download] Puppeteer error:', err)
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

      if (contract.attachedPdf) {
        try {
          let attachedPdfBuffer: Buffer
          if (contract.attachedPdf.startsWith('http')) {
            const fetchOptions: RequestInit = {}
            if (contract.attachedPdf.includes('vercel-storage.com') || contract.attachedPdf.includes('vercel.com')) {
              fetchOptions.headers = { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
            }
            const fetchRes = await safeFetch(contract.attachedPdf, 15000, fetchOptions)
            if (!fetchRes.ok) throw new Error(`Fetch failed: ${fetchRes.statusText}`)
            const arrayBuffer = await fetchRes.arrayBuffer()
            attachedPdfBuffer = Buffer.from(arrayBuffer)
          } else {
            const attachedBase64 = contract.attachedPdf.replace(/^data:application\/pdf;base64,/, '')
            attachedPdfBuffer = Buffer.from(attachedBase64, 'base64')
          }

          const attachedPdfDoc = await PDFDocument.load(attachedPdfBuffer, { ignoreEncryption: true })
          const copiedPages = await mainPdf.copyPages(attachedPdfDoc, attachedPdfDoc.getPageIndices())
          copiedPages.forEach((page: any) => mainPdf.addPage(page))
        } catch (mergeErr) {
          console.error('[pdf-download] Failed to merge attached PDF:', mergeErr)
        }
      }

      finalPdfBuffer = Buffer.from(await mainPdf.save({ useObjectStreams: true }))
      console.log(`[pdf-download] Final PDF after pdf-lib: ${(finalPdfBuffer.length / 1024 / 1024).toFixed(2)}MB`)
    } catch (compressErr) {
      console.error('[pdf-download] pdf-lib compression failed, using raw buffer:', compressErr)
      finalPdfBuffer = pdfBuffer
    }

    const filename = `Contract_${contract.contractNumber || contract._id}`

    setResponseHeader(event, 'Content-Type', 'application/pdf')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}.pdf"`)

    if (finalPdfBuffer.length > VERCEL_BODY_LIMIT_BYTES) {
      console.log(`[pdf-download] PDF over ${VERCEL_BODY_LIMIT_BYTES} bytes → Streaming response`)
      return sendStream(event, Readable.from(finalPdfBuffer))
    }

    return finalPdfBuffer
  } catch (err: any) {
    console.error('[CRITICAL PDF ERROR]', err)
    throw createError({
      statusCode: 500,
      statusMessage: 'PDF Error: ' + (err.message || String(err)),
      data: err.stack,
    })
  }
})
