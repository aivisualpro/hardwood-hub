/**
 * GET  /api/public/estimate-response/:token — fetch estimate info for the public response page
 * POST /api/public/estimate-response/:token — submit client response (approve/change_request/decline)
 *
 * This is a PUBLIC endpoint — no auth required.
 * The /api/public/ prefix is whitelisted in apiAuth + permissions middleware.
 */
import { Estimate } from '../../../models/Estimate'
import { AppSetting } from '../../../models/AppSetting'
import { connectDB } from '../../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, message: 'Response token is required' })
  }

  const estimate = await Estimate.findOne({ responseToken: token })
  if (!estimate) {
    throw createError({ statusCode: 404, message: 'Estimate not found or link has expired' })
  }

  // ─── GET: Return estimate info for the public page ───
  if (event.method === 'GET') {
    const settingsDoc = await AppSetting.findOne({ key: 'companyProfile' }).lean() as any
    const company = settingsDoc?.value || {}

    return {
      success: true,
      data: {
        _id: estimate._id,
        title: estimate.title,
        estimateNumber: estimate.estimateNumber,
        customerName: estimate.customerName,
        createdAt: estimate.createdAt,
        company: {
          name: company.name || '',
          logo: company.logo || '',
          brandColor: company.brandColor || '#84CC16',
          phone1: company.phone1 || company.phone || '',
          email: company.email || '',
          website: company.website || '',
        },
        alreadyResponded: !!estimate.clientResponse?.action,
        clientResponse: estimate.clientResponse?.action
          ? {
              action: estimate.clientResponse.action,
              message: estimate.clientResponse.message || '',
              respondedAt: estimate.clientResponse.respondedAt,
            }
          : null,
      },
    }
  }

  // ─── POST: Submit client response ───
  if (event.method === 'POST') {
    // Check if already responded
    if (estimate.clientResponse?.action) {
      return {
        success: false,
        alreadyResponded: true,
        message: 'You have already submitted your response for this estimate.',
        clientResponse: {
          action: estimate.clientResponse.action,
          respondedAt: estimate.clientResponse.respondedAt,
        },
      }
    }

    const body = await readBody(event)
    const action = body.action as string
    const message = (body.message as string || '').trim()

    if (!['approved', 'change_request', 'declined'].includes(action)) {
      throw createError({ statusCode: 400, message: 'Invalid action. Must be approved, change_request, or declined.' })
    }

    if (action === 'change_request' && !message) {
      throw createError({ statusCode: 400, message: 'Please describe the changes you would like.' })
    }

    // Save client response
    estimate.clientResponse = {
      action,
      message: message || '',
      respondedAt: new Date(),
    }

    // Update estimate status to match the response
    estimate.status = action

    await estimate.save()

    console.log(`[estimate-response] ✅ Client responded "${action}" for estimate ${estimate.estimateNumber} (token: ${token.substring(0, 8)}...)`)

    return {
      success: true,
      message: action === 'approved'
        ? 'Thank you! Your estimate has been approved.'
        : action === 'change_request'
          ? 'Thank you! Your change request has been submitted.'
          : 'Your response has been recorded.',
    }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
