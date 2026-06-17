// POST /api/estimates/send-email
// Sends estimate to client via email with PDF + images as attachments
import crypto from 'node:crypto'
import { Estimate } from '../../models/Estimate'
import { EstimateTemplate } from '../../models/EstimateTemplate'
import { AppSetting } from '../../models/AppSetting'
import { sendMail } from '../../utils/mailer'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'
import { requirePermission } from '../../utils/requirePermission'
import { generatePdfFromHtml } from '../../utils/pdf-generator'
import { compressImagesInHtml } from '../../utils/image-compressor'
// @ts-ignore
import { PDFDocument } from 'pdf-lib'
import { parseBody } from '../../utils/validation'
import { z } from 'zod'

const EstimateSendEmailSchema = z.object({
  estimateId: z.string().regex(/^[0-9a-f]{24}$/i, 'Must be a valid ObjectId'),
  overrideEmail: z.string().email().or(z.literal('')).optional(),
})

async function safeFetch(url: string, timeoutMs = 15000, options: RequestInit = {}) {
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
  await connectDB()
  requireManager(event)
  await requirePermission(event, '/crm/estimates', 'update')
  const raw = await readBody(event)
  const { estimateId, overrideEmail } = parseBody(EstimateSendEmailSchema, raw)

  const estimate = await Estimate.findById(estimateId)
  if (!estimate) {
    throw createError({ statusCode: 404, message: 'Estimate not found' })
  }

  const emailTarget = overrideEmail?.trim() || estimate.customerEmail
  if (!emailTarget) {
    throw createError({ statusCode: 400, message: 'Customer has no email address' })
  }

  // Generate response token for Approve/Change Request/Decline buttons
  const responseToken = crypto.randomBytes(32).toString('hex')

  // Update estimate status
  estimate.status = 'sent'
  estimate.sentAt = new Date()
  estimate.responseToken = responseToken
  if (overrideEmail?.trim()) {
    estimate.customerEmail = overrideEmail.trim()
  }
  await estimate.save()

  // Build the response URLs
  const host = getRequestURL(event).origin
  const responseBaseUrl = `${host}/public/estimate-response/${responseToken}`

  // Load company settings for branding
  const settingsDoc = await AppSetting.findOne({ key: 'companyProfile' }).lean() as any
  const company = settingsDoc?.value || {}

  // ─── Merge variables into content ─────────────────────────
  let mergedHTML = estimate.content || ''

  if (estimate.variableValues) {
    for (const [key, val] of Object.entries<string>(estimate.variableValues)) {
      const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      mergedHTML = mergedHTML.replace(re, String(val || ''))
    }
  }

  // System variables
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

  // Clean up template variable spans and stray HRs
  mergedHTML = mergedHTML.replace(/<span[^>]*class="[^"]*template-variable[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  mergedHTML = mergedHTML.replace(/<hr\s*\/?>/gi, '')

  // ─── Generate PDF with letterhead ─────────────────────────
  const companyColor = company?.brandColor || '#84CC16'
  const companyLogo = company?.logo
    ? `<img src="${company.logo.includes('cloudinary.com') ? company.logo.replace('/upload/', '/upload/q_60,f_png,w_300/') : company.logo}" style="max-height: 90px; max-width: 250px;" alt="Logo" />`
    : `<h1 style="color: ${companyColor}; margin: 0;">${company?.name || 'Company Name'}</h1>`

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
        <td valign="top" width="50%" style="border: none; padding: 0;">${companyLogo}</td>
        <td valign="top" width="50%" style="border: none; padding: 0;">${companyDetails}</td>
      </tr>
    </table>
    <hr style="border: 0; border-bottom: 2px solid ${companyColor}; margin-bottom: 20px;" />
  `

  // Build HTML for gallery images in the PDF
  let galleryHTML = ''
  if (estimate.attachedGalleryImages && estimate.attachedGalleryImages.length > 0) {
    galleryHTML = `
      <div style="page-break-before: always; margin-top: 40px; text-align: center;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111; margin-bottom: 20px; text-align: left;">Attached Pictures</h2>
        ${estimate.attachedGalleryImages.map((imgUrl: string) => {
          const optimizedUrl = imgUrl.includes('cloudinary.com') ? imgUrl.replace('/upload/', '/upload/q_60,f_jpg,w_800/') : imgUrl
          return `<img src="${optimizedUrl}" style="max-width: 100%; max-height: 800px; object-fit: contain; margin-bottom: 24px; border-radius: 8px; border: 1px solid #ccc; page-break-inside: avoid; display: block;" />`
        }).join('')}
      </div>
    `
  }

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
      <div>${mergedHTML}</div>
      ${galleryHTML}
    </body>
    </html>
  `

  // ─── Generate PDF buffer ──────────────────────────────────
  let finalPdfBuffer: Buffer
  try {
    let compressedHTML = pdfHTML
    try {
      compressedHTML = await compressImagesInHtml(pdfHTML, { maxWidth: 800, quality: 55, format: 'jpeg' })
    }
    catch { /* use raw if compression fails */ }

    let pdfBuffer = await generatePdfFromHtml(compressedHTML)

    // Merge attached PDF if exists
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
          if (!fetchRes.ok) throw new Error(`Fetch failed: ${fetchRes.statusText}`)
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
      catch (mergeErr: any) {
        console.error('[estimates/send-email] Failed to merge attached PDF:', mergeErr?.message)
      }
    }

    finalPdfBuffer = Buffer.from(await mainPdf.save({ useObjectStreams: true }))
    console.log(`[estimates/send-email] PDF generated: ${(finalPdfBuffer.length / 1024).toFixed(0)}KB`)
  }
  catch (pdfErr: any) {
    console.error('[estimates/send-email] PDF generation failed:', pdfErr?.message)
    // Revert status
    estimate.status = 'draft'
    estimate.sentAt = undefined
    await estimate.save()
    throw createError({ statusCode: 500, message: `PDF generation failed: ${pdfErr?.message}` })
  }

  // ─── Build email attachments ──────────────────────────────
  const attachments: any[] = [
    {
      filename: `Estimate_${estimate.estimateNumber}.pdf`,
      content: finalPdfBuffer,
      contentType: 'application/pdf',
    },
  ]

  // Attach gallery images
  if (estimate.attachedGalleryImages && estimate.attachedGalleryImages.length > 0) {
    for (let i = 0; i < estimate.attachedGalleryImages.length; i++) {
      const imgUrl = estimate.attachedGalleryImages[i]
      try {
        const imgRes = await safeFetch(imgUrl, 10000)
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer()
          const ext = imgUrl.match(/\.(jpe?g|png|webp|gif)/i)?.[1] || 'jpg'
          attachments.push({
            filename: `image_${i + 1}.${ext}`,
            content: Buffer.from(arrayBuf),
            contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          })
        }
      }
      catch (imgErr: any) {
        console.warn(`[estimates/send-email] Failed to fetch gallery image ${i + 1}:`, imgErr?.message)
      }
    }
  }

  // ─── Build simple email with rendered template body ───────
  const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

              <!-- Header with Logo -->
              <tr>
                <td style="background: #ffffff; padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                  ${company.logo ? `<img src="${company.logo}" alt="${company.name}" style="max-height: 80px; max-width: 220px; object-fit: contain; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto;" />` : ''}
                  <h1 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">
                    ${estimate.title}
                  </h1>
                  <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">
                    Estimate #${estimate.estimateNumber} · ${new Date(estimate.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </td>
              </tr>

              <!-- Template Body Content -->
              <tr>
                <td style="padding: 32px 40px;">
                  <div style="font-size: 14px; line-height: 1.7; color: #374151;">
                    ${mergedHTML}
                  </div>
                </td>
              </tr>

              <!-- Response Buttons -->
              <tr>
                <td style="padding: 8px 40px 32px; text-align: center;">
                  <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px; font-weight: 500;">Please review and respond:</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding: 0 4px;">
                        <a href="${responseBaseUrl}?action=approve" target="_blank" style="display: inline-block; background: #059669; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 20px; border-radius: 10px; min-width: 100px; text-align: center; box-shadow: 0 2px 8px rgba(5,150,105,0.3);">✅ Approve</a>
                      </td>
                      <td align="center" style="padding: 0 4px;">
                        <a href="${responseBaseUrl}?action=change_request" target="_blank" style="display: inline-block; background: #d97706; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 20px; border-radius: 10px; min-width: 100px; text-align: center; box-shadow: 0 2px 8px rgba(217,119,6,0.3);">✏️ Changes</a>
                      </td>
                      <td align="center" style="padding: 0 4px;">
                        <a href="${responseBaseUrl}?action=decline" target="_blank" style="display: inline-block; background: #dc2626; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 20px; border-radius: 10px; min-width: 100px; text-align: center; box-shadow: 0 2px 8px rgba(220,38,38,0.3);">❌ Decline</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #374151;">${company.name || ''}</p>
                  <p style="margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
                    ${company.address || ''} · ${company.city || ''}, ${company.state || ''} ${company.zip || ''}<br>
                    ${company.phone1 || ''} · ${company.email || ''}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin: 16px 0 0; font-size: 10px; color: #9ca3af; text-align: center;">
              The full estimate PDF and any images are attached to this email.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  // ─── Send the email ───────────────────────────────────────
  try {
    await sendMail({
      to: emailTarget,
      subject: `Estimate — ${estimate.title}`,
      html: emailHTML,
      attachments,
    })
    console.log(`[estimates/send-email] ✅ Email sent to ${emailTarget} with ${attachments.length} attachment(s) for estimate ${estimate.estimateNumber}`)
  }
  catch (mailErr: any) {
    console.error(`[estimates/send-email] ❌ Failed to send email to ${emailTarget}:`, mailErr?.message || mailErr)
    estimate.status = 'draft'
    estimate.sentAt = undefined
    await estimate.save()
    throw createError({
      statusCode: 500,
      message: `Failed to send email: ${mailErr?.message || 'Unknown mailer error'}`,
    })
  }

  return {
    success: true,
    message: `Estimate sent to ${emailTarget} with PDF attached`,
    sentAt: estimate.sentAt,
  }
})
