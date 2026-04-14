// GET /api/contracts/sign/:token — fetch contract details for signing
// POST /api/contracts/sign/:token — submit signature
import { connectDB } from '../../../utils/mongoose'
import { Contract } from '../../../models/Contract'

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
    const { AppSetting } = await import('../../../models/AppSetting')
    const settingsDoc = await AppSetting.findOne({ key: 'companyProfile' }).lean() as any
    const company = settingsDoc?.value || {}

    // Load template to get variable definitions (for signature rendering)
    const { ContractTemplate } = await import('../../../models/ContractTemplate')
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

    // Strip old template signature tables & inline variables
    mergedHTML = mergedHTML.replace(
      /<table[\s\S]*?<\/table>/gi,
      (tableHTML: string) => {
        if (tableHTML.includes('Signature') && tableHTML.includes('____')) return ''
        return tableHTML
      },
    )
    mergedHTML = mergedHTML.replace(/\{\{\s*companySignature\s*\}\}/g, '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_signature\s*\}\}/g, '')
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
    const { AppSetting } = await import('../../../models/AppSetting')
    const settingsDoc = await AppSetting.findOne({ key: 'companyProfile' }).lean() as any
    const company = settingsDoc?.value || {}

    const { ContractTemplate } = await import('../../../models/ContractTemplate')
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
    mergedHTML = mergedHTML.replace(/\{\{\s*printDate\s*\}\}/g, sysPrintDate)
    mergedHTML = mergedHTML.replace(/\{\{\s*company_name\s*\}\}/g, company?.name || '')

    // Strip old signature markers
    mergedHTML = mergedHTML.replace(/<table[\s\S]*?<\/table>/gi, (tableHTML: string) => {
      if (tableHTML.includes('Signature') && tableHTML.includes('____')) return ''
      return tableHTML
    })
    mergedHTML = mergedHTML.replace(/\{\{\s*companySignature\s*\}\}/g, '')
    mergedHTML = mergedHTML.replace(/\{\{\s*company_signature\s*\}\}/g, '')
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
      <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
        <tr>
          <td valign="top" width="50%">
            ${companyLogo}
          </td>
          <td valign="top" width="50%">
            ${companyDetails}
          </td>
        </tr>
      </table>
      <hr style="border: 0; border-bottom: 2px solid #1e3a8a; margin-bottom: 20px;" />
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
        // @ts-ignore: No types available
        const htmlPdf = await import('html-pdf-node')
        // Strip out the background styles for the PDF to look like a clean document
        const pdfHTML = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: Helvetica, Arial, sans-serif; padding: 0; margin: 0; font-size: 13px; color: #111;">
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
        const pdfBuffer = await htmlPdf.default.generatePdf({ content: pdfHTML }, { format: 'A4', margin: { top: '30px', right: '30px', bottom: '30px', left: '30px' } })
        
        let finalPdfBuffer = pdfBuffer;
        if (contract.attachedPdf) {
          try {
            const { PDFDocument } = await import('pdf-lib');
            const mainPdf = await PDFDocument.load(pdfBuffer);
            const attachedBase64 = contract.attachedPdf.replace(/^data:application\/pdf;base64,/, '');
            const attachedPdfDoc = await PDFDocument.load(Buffer.from(attachedBase64, 'base64'));
            
            const copiedPages = await mainPdf.copyPages(attachedPdfDoc, attachedPdfDoc.getPageIndices());
            copiedPages.forEach((page) => {
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

      const { sendMail } = await import('../../../utils/mailer')
      await sendMail({
        to: contract.customerEmail,
        subject: `Signed Copy: ${contract.title}`,
        html: emailHTML,
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
