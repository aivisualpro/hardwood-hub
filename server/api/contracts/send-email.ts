// POST /api/contracts/send-email
// Sends contract to client for e-signing
import crypto from 'crypto'
import { connectDB } from '../../utils/mongoose'
import { Contract } from '../../models/Contract'
import { sendMail } from '../../utils/mailer'

export default defineEventHandler(async (event) => {
  await connectDB()
  const body = await readBody(event)
  const { contractId, overrideEmail } = body

  if (!contractId) {
    throw createError({ statusCode: 400, message: 'contractId is required' })
  }

  const contract = await Contract.findById(contractId)
  if (!contract) {
    throw createError({ statusCode: 404, message: 'Contract not found' })
  }

  const emailTarget = overrideEmail?.trim() || contract.customerEmail
  if (!emailTarget) {
    throw createError({ statusCode: 400, message: 'Customer has no email address' })
  }

  // Generate a unique signing token
  const signingToken = crypto.randomBytes(32).toString('hex')

  // Update contract with token and status
  contract.signingToken = signingToken
  contract.status = 'sent'
  contract.sentAt = new Date()
  await contract.save()

  // Build the signing URL
  const host = getRequestURL(event).origin
  const signingUrl = `${host}/sign/${signingToken}`

  // Load company settings for branding
  const { AppSetting } = await import('../../models/AppSetting')
  const settingsDoc = await AppSetting.findOne({ key: 'companyProfile' }).lean() as any
  const company = settingsDoc?.value || {}

  // Build branded email HTML
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
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #047857 0%, #065f46 100%); padding: 32px 40px; text-align: center;">
                  ${company.logo ? `<img src="${company.logo}" alt="${company.name}" style="max-height: 48px; margin-bottom: 12px;" />` : ''}
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">
                    Contract for Your Review
                  </h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px;">
                  <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
                    Hello <strong>${contract.customerName || 'there'}</strong>,
                  </p>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 28px;">
                    ${company.name || 'We'} has prepared a contract for your review and signature. Please click the button below to view and sign the document.
                  </p>

                  <!-- Contract Details Card -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 28px;">
                    <tr>
                      <td style="padding: 20px 24px;">
                        <p style="margin: 0 0 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; font-weight: 700;">Contract</p>
                        <p style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #111827;">${contract.title}</p>
                        <table role="presentation" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding-right: 32px;">
                              <p style="margin: 0 0 2px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; font-weight: 600;">Contract #</p>
                              <p style="margin: 0; font-size: 13px; color: #374151; font-weight: 600;">${contract.contractNumber}</p>
                            </td>
                            <td>
                              <p style="margin: 0 0 2px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; font-weight: 600;">Date</p>
                              <p style="margin: 0; font-size: 13px; color: #374151; font-weight: 600;">${new Date(contract.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="${signingUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #047857 0%, #065f46 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 10px; letter-spacing: -0.01em; box-shadow: 0 4px 14px rgba(4, 120, 87, 0.35);">
                          Review & Sign Contract →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 28px 0 0; text-align: center;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="${signingUrl}" style="color: #047857; word-break: break-all;">${signingUrl}</a>
                  </p>
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

            <p style="margin: 24px 0 0; font-size: 11px; color: #9ca3af; text-align: center;">
              This email was sent by ${company.name || 'Ann Arbor Hardwoods'}. Please do not reply directly.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  // Send the email
  await sendMail({
    to: emailTarget,
    subject: `Contract Ready for Signature — ${contract.title}`,
    html: emailHTML,
  })

  return {
    success: true,
    message: `Contract sent to ${emailTarget}`,
    sentAt: contract.sentAt,
  }
})
