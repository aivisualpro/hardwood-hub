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

    return {
      success: true,
      data: {
        _id: contract._id,
        title: contract.title,
        contractNumber: contract.contractNumber,
        customerName: contract.customerName,
        content: mergedHTML,
        variableValues: contract.variableValues,
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
    const { signature } = body

    if (!signature) {
      throw createError({ statusCode: 400, message: 'Signature is required' })
    }

    contract.customerSignature = signature
    contract.customerSignatureDate = new Date()
    contract.status = 'signed'
    // Clear the token so the link can't be reused
    contract.signingToken = ''
    await contract.save()

    return {
      success: true,
      message: 'Contract signed successfully',
      signedAt: contract.customerSignatureDate,
    }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
