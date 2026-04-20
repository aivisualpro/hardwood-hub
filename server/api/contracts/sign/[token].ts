// GET /api/contracts/sign/:token — fetch contract details for signing
// POST /api/contracts/sign/:token — submit signature
import { generatePdfFromHtml } from '../../../utils/pdf-generator'
// @ts-ignore: IDE cache invalidation workaround
import { PDFDocument } from 'pdf-lib'
import { connectDB } from '../../../utils/mongoose'
import { Contract } from '../../../models/Contract'
import { AppSetting } from '../../../models/AppSetting'
import { ContractTemplate } from '../../../models/ContractTemplate'

const safeFetch = async (url: string, timeoutMs = 8000) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (err) {
    clearTimeout(id)
    throw err
  }
}

export default defineEventHandler(async (event) => {
  await connectDB()
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, message: 'Signing token is required' })
  }

  const contract = await Contract.findOne({ signingToken: token })
  if (!contract) {
    throw createError({ statusCode: 404, message: 'Contract not found or link has expired' })
  }

  // ─── GET: Return contract details for display ───
  if (event.method === 'GET') {
    // Load company profile for letterhead
    const settingsDoc = await AppSetting.findOne({ key: 'companyProfile' }).lean() as any
    const company = settingsDoc?.value || {}

    // Load template to get variable definitions (for signature rendering)
    const template = await ContractTemplate.findById(contract.templateId).lean() as any

    let mergedHTML = contract.content || ''
    
    // Replace custom variables
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

    // Replace system variables
    const sysPrintDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    mergedHTML = mergedHTML.replace(/\{\{\s*printDate\s*\}\}/g, sysPrintDate)
    mergedHTML = mergedHTML.replace(/\{\{\s*company_name\s*\}\}/g, company?.name || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_address\s*\}\}/g, company?.address || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_city\s*\}\}/g, company?.city || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_state\s*\}\}/g, company?.state || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_zip\s*\}\}/g, company?.zip || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_phone1\s*\}\}/g, company?.phone1 || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_phone2\s*\}\}/g, company?.phone2 || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_website\s*\}\}/g, company?.website || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_email\s*\}\}/g, company?.email || '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_license\s*\}\}/g, company?.licenseNumber || '')
    const companyLogoHtml = company?.logo ? `<img src="${company.logo}" alt="Company Logo" style="max-height: 80px; object-fit: contain;" />` : ''
    mergedHTML = mergedHTML.replace(/\{\{\s*company_logo\s*\}\}/g, companyLogoHtml)

    // Strip old template signature tables & inline variables
    mergedHTML = mergedHTML.replace(
      /<table[\s\S]*?<\/table>/gi,
      (tableHTML: string) => {
        if (tableHTML.includes('Signature') && tableHTML.includes('____')) return ''
        return tableHTML
      },
    )
    const contractorSigImg = company?.signature
      ? `<img src="${company.signature}" alt="Contractor Signature" style="max-height: 64px; object-fit: contain; vertical-align: middle;" />`
      : ''
    mergedHTML = mergedHTML.replace(/\{\{\s*companySignature\s*\}\}/gi, contractorSigImg)
    mergedHTML = mergedHTML.replace(/\{\{\s*company_signature\s*\}\}/gi, contractorSigImg)
    mergedHTML = mergedHTML.replace(/\{\{\s*contractor_signature\s*\}\}/gi, contractorSigImg)
    mergedHTML = mergedHTML.replace(/\{\{\s*customerSignature\s*\}\}/g, '')
    mergedHTML = mergedHTML.replace(/\{\{\s*customerSignatureDate\s*\}\}/g, '')

    const clientVariables = template?.variables?.filter((v: any) => v.scope === 'client') || []

    return {
      success: true,
      data: {
        _id: contract._id,
        title: contract.title,
        contractNumber: contract.contractNumber,
        customerName: contract.customerName,
        content: mergedHTML,
        variableValues: contract.variableValues,
        clientVariables,
        templateId: contract.templateId,
        status: contract.status,
        createdAt: contract.createdAt,
        alreadySigned: contract.status === 'signed' || !!contract.customerSignature,
        company,
      },
    }
  }

  // ─── POST: Submit signature ───
  if (event.method === 'POST') {
    if (contract.status === 'signed' || contract.customerSignature) {
      throw createError({ statusCode: 400, message: 'This contract has already been signed' })
    }

    const body = await readBody(event)
    const { signature, clientValues } = body

    if (!signature) {
      throw createError({ statusCode: 400, message: 'Signature is required' })
    }

    if (clientValues) {
      contract.variableValues = {
        ...contract.variableValues,
        ...clientValues,
      }
    }

    contract.customerSignature = signature
    contract.customerSignatureDate = new Date()
    contract.status = 'signed'
    // Clear the token so the link can't be reused
    contract.signingToken = ''
    await contract.save()

    // ─── Generate Signed HTML for Email ───
    const settingsDoc = await AppSetting.findOne({ key: 'companyProfile' }).lean() as any
    const company = settingsDoc?.value || {}

    const template = await ContractTemplate.findById(contract.templateId).lean() as any

    let mergedHTML = contract.content || ''
    
    // Replace custom variables — plain inline text, no decorative boxes
    if (contract.variableValues) {
      for (const [key, val] of Object.entries<string>(contract.variableValues)) {
        const vDef = template?.variables?.find((v: any) => v.key === key)
        const isSig = vDef?.type === 'signature'
        let mergedVal = String(val || '')
        if (isSig && val) {
          mergedVal = `<img src="${val}" alt="Signature" style="max-height: 80px; object-fit: contain; vertical-align: middle;" />`
        }
        // Non-signature: just inject the plain value — no boxes
        const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
        mergedHTML = mergedHTML.replace(re, mergedVal)
      }
    }

    // Replace system variables — plain text
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
    const companyLogoHtml = company?.logo ? `<img src="${company.logo}" alt="Company Logo" style="max-height: 80px; object-fit: contain;" />` : ''
    mergedHTML = mergedHTML.replace(/\{\{\s*company_logo\s*\}\}/gi, companyLogoHtml)

    // Strip old signature markers
    mergedHTML = mergedHTML.replace(/<table[\s\S]*?<\/table>/gi, (tableHTML: string) => {
      if (tableHTML.includes('Signature') && tableHTML.includes('____')) return ''
      return tableHTML
    })
    const contractorSigImg = company?.signature
      ? `<img src="${company.signature}" alt="Contractor Signature" style="max-height: 64px; object-fit: contain; vertical-align: middle;" />`
      : ''
    mergedHTML = mergedHTML.replace(/\{\{\s*companySignature\s*\}\}/gi, contractorSigImg)
    mergedHTML = mergedHTML.replace(/\{\{\s*company_signature\s*\}\}/gi, contractorSigImg)
    mergedHTML = mergedHTML.replace(/\{\{\s*contractor_signature\s*\}\}/gi, contractorSigImg)
    mergedHTML = mergedHTML.replace(/\{\{\s*customerSignature\s*\}\}/g, '')
    mergedHTML = mergedHTML.replace(/\{\{\s*customerSignatureDate\s*\}\}/g, '')

    // Strip spans from template variable injections to prevent inherited styling borders
    mergedHTML = mergedHTML.replace(/<span[^>]*class="[^"]*template-variable[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    // Remove injected <hr> lines
    mergedHTML = mergedHTML.replace(/<hr\s*\/?>/gi, '')

    const companyColor = company?.brandColor || '#84CC16'
    const companyLogo = company?.logo ? `<img src="${company.logo}" style="max-height: 90px; max-width: 250px;" alt="Logo" />` : `<h1 style="color: ${companyColor}; margin: 0;">${company?.name || 'Company Name'}</h1>`

    const companyDetails = `
      <div style="text-align: right; font-size: 12px; line-height: 1.5; color: #8A4F2A; font-family: Helvetica, Arial, sans-serif; font-weight: bold;">
        <div style="color: ${companyColor}; font-size: 16px;">${company?.name || 'Ann Arbor Hardwoods LLC'}</div>
        <div>${company?.address || '2232 South Main Street'}</div>
        <div>${company?.city || 'Ann Arbor'}, ${company?.state || 'MI'}. ${company?.zip || '48104'}</div>
        <div>Phone: ${company?.phone1 || company?.phone || '(734) 604-3786'}</div>
        ${company?.phone2 ? `<div>Phone: ${company.phone2}</div>` : ''}
        <div>${company?.website?.replace(new RegExp('^https?://'), '') || 'www.annarborhardwoods.com'}</div>
        <div>${company?.email || 'quote@annarborhardwoods.com'}</div>
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
          ${company?.signature ? `<img src="${company.signature}" style="max-height: 64px; max-width: 100%; object-fit: contain; object-position: left bottom; margin: 0; display: block;" />` : ``}
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

    const customerSigBox = `
      <div style="width: 100%; max-width: 480px;">
        <div style="height: 64px;">
          <img src="${signature}" style="max-height: 64px; max-width: 100%; object-fit: contain; object-position: left bottom; margin: 0; display: block;" />
        </div>
        <div style="border-top: 1.5px solid #111827; margin-top: 4px; padding-top: 8px;">
          <div style="float: left; font-size: 15px; font-weight: 700; color: #111827; font-family: Helvetica, Arial, sans-serif; letter-spacing: -0.01em;">
            Client's Signature
          </div>
          <div style="float: right; font-size: 14px; font-weight: 400; color: #111827; font-family: Helvetica, Arial, sans-serif;">
            Date: ${sysPrintDate}
          </div>
          <div style="clear: both;"></div>
        </div>
      </div>
    `

    const signatureSection = `
      <div style="margin-top: 60px;">
        <div style="margin-bottom: 40px;">
           ${customerSigBox}
        </div>
        <div>
           ${companySigBox}
        </div>
      </div>
    `

    mergedHTML += signatureSection
    
    if (contract.attachedGalleryImages && contract.attachedGalleryImages.length > 0) {
      mergedHTML += `
        <div style="page-break-before: always; margin-top: 40px; text-align: center;">
          <h2 style="font-size: 1.5rem; font-weight: 700; color: #111; margin-bottom: 20px; text-align: left;">Attached Pictures</h2>
          ${contract.attachedGalleryImages.map((imgUrl: string) => `
            <img src="${imgUrl}" style="max-width: 100%; max-height: 800px; object-fit: contain; margin-bottom: 24px; border-radius: 8px; border: 1px solid #ccc; page-break-inside: avoid; display: block;" />
          `).join('')}
        </div>
      `
    }

    if (contract.customerEmail) {
      const emailHTML = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; background: #f9fafb; padding: 20px; margin: 0;">
          <div style="max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h2 style="color: #047857; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 0;">
              ${contract.title} (Signed Copy)
            </h2>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 30px;">
              Hello ${contract.customerName || 'there'},<br><br>
              Thank you for signing the contract. Your fully executed copy is included below for your records.
            </p>
            <div style="font-size: 14px; line-height: 1.6; color: #374151;">
              ${mergedHTML}
            </div>
            <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
              This is a final signed copy for your records.<br>
              ${company?.name || 'Ann Arbor Hardwoods'}
            </div>
          </div>
        </body>
        </html>
      `
      
      let attachments: any[] = []
      try {
        // Strip out the background styles for the PDF to look like a clean document
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
        const pdfBuffer = await generatePdfFromHtml(pdfHTML)
        
        let finalPdfBuffer = pdfBuffer;
        if (contract.attachedPdf) {
          try {
            const mainPdf = await PDFDocument.load(pdfBuffer);
            let attachedPdfBuffer: Buffer;
            if (contract.attachedPdf.startsWith('http')) {
              const fetchRes = await safeFetch(contract.attachedPdf);
              if (!fetchRes.ok) throw new Error(`Fetch failed: ${fetchRes.statusText}`);
              const arrayBuffer = await fetchRes.arrayBuffer();
              attachedPdfBuffer = Buffer.from(arrayBuffer);
            } else {
              const attachedBase64 = contract.attachedPdf.replace(/^data:application\/pdf;base64,/, '');
              attachedPdfBuffer = Buffer.from(attachedBase64, 'base64');
            }
            const attachedPdfDoc = await PDFDocument.load(attachedPdfBuffer);
            
            const copiedPages = await mainPdf.copyPages(attachedPdfDoc, attachedPdfDoc.getPageIndices());
            copiedPages.forEach((page: any) => {
              mainPdf.addPage(page);
            });
            
            finalPdfBuffer = Buffer.from(await mainPdf.save());
          } catch (mergeErr) {
            console.error('Failed to merge PDFs:', mergeErr);
          }
        }

        attachments = [{
          filename: `${contract.contractNumber || 'Contract'}_Signed.pdf`,
          content: finalPdfBuffer,
          contentType: 'application/pdf'
        }]
      } catch (e) {
        console.error('Failed to generate PDF:', e)
      }

      // Explicitly append the original uploaded PDF as a separate attachment if it exists
      if (contract.attachedPdf) {
        try {
          if (contract.attachedPdf.startsWith('http')) {
            const pdfFetch = await safeFetch(contract.attachedPdf)
            if (pdfFetch.ok) {
              attachments.push({
                filename: `Attached_Document_${contract.contractNumber || 'Contract'}.pdf`,
                content: Buffer.from(await pdfFetch.arrayBuffer()),
                contentType: 'application/pdf'
              })
            }
          } else {
            const attachedBase64 = contract.attachedPdf.replace(/^data:application\/pdf;base64,/, '');
            attachments.push({
              filename: `Attached_Document_${contract.contractNumber || 'Contract'}.pdf`,
              content: Buffer.from(attachedBase64, 'base64'),
              contentType: 'application/pdf'
            })
          }
        } catch (err) {
          console.error('Error attaching original PDF:', err)
        }
      }

      // Explicitly append all gallery images as separate image attachments safely
      if (contract.attachedGalleryImages && contract.attachedGalleryImages.length > 0) {
        for (let idx = 0; idx < contract.attachedGalleryImages.length; idx++) {
          const imgUrl = contract.attachedGalleryImages[idx]
          try {
            if (imgUrl.startsWith('http')) {
              const imgFetch = await safeFetch(imgUrl)
              if (imgFetch.ok) {
                attachments.push({
                  filename: `Attached_Image_${idx + 1}.png`,
                  content: Buffer.from(await imgFetch.arrayBuffer())
                })
              }
            } else {
              const imgBase64 = imgUrl.replace(/^data:image\/\w+;base64,/, '');
              attachments.push({
                filename: `Attached_Image_${idx + 1}.png`,
                content: Buffer.from(imgBase64, 'base64')
              })
            }
          } catch (err) {
            console.error('Error attaching image:', err)
          }
        }
      }

      let finalEmailHTML = emailHTML;
      let imgCidCounter = 1;
      finalEmailHTML = finalEmailHTML.replace(/src=["'](data:image\/[^;]+;base64,([^"']+))["']/gi, (match, fullDataUri, base64Data) => {
        const cid = `inline-img-${imgCidCounter++}`;
        attachments.push({
          filename: `${cid}.png`,
          content: Buffer.from(base64Data, 'base64'),
          cid: cid,
          disposition: 'inline'
        });
        return `src="cid:${cid}"`;
      });

      const { sendMail } = await import('../../../utils/mailer')
      await sendMail({
        to: contract.customerEmail,
        subject: `Signed Copy: ${contract.title}`,
        html: finalEmailHTML,
        attachments
      }).catch(err => {
        console.error('Failed to send signed contract email:', err)
      })
    }

    return {
      success: true,
      message: 'Contract signed successfully',
      signedAt: contract.customerSignatureDate,
    }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
