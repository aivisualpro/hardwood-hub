/**
 * GET  /api/public/estimate-response/:token — fetch estimate info for the public response page
 * POST /api/public/estimate-response/:token — submit client response (approve/change_request/decline)
 *
 * This is a PUBLIC endpoint — no auth required.
 * The /api/public/ prefix is whitelisted in apiAuth + permissions middleware.
 */
import { Estimate } from '../../../models/Estimate'
import { AppSetting } from '../../../models/AppSetting'
import { Employee } from '../../../models/Employee'
import { connectDB } from '../../../utils/mongoose'
import { fireAutomations } from '../../../utils/automationEngine'

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

    // Add 'received' to timeline if not already present
    const hasReceived = estimate.statusTimeline?.some((t: any) => t.action === 'received')
    const hasResponded = estimate.statusTimeline?.some((t: any) => ['approved', 'change_request', 'declined'].includes(t.action))
    
    if (!hasReceived && !hasResponded) {
      if (!estimate.statusTimeline) {
        estimate.statusTimeline = []
      }
      estimate.statusTimeline.push({
        action: 'received',
        timestamp: new Date(),
        performedBy: 'Client',
      })
      const beforeStatus = { ...estimate.toObject() }
      estimate.status = 'received'
      await estimate.save()
      fireAutomations({ module: 'crm', submodule: 'estimates', action: 'update', before: beforeStatus, after: estimate.toObject(), actor: { name: estimate.customerName || 'Client' } })
    }

    const respondedTimelineEntry = estimate.statusTimeline?.find((t: any) => ['approved', 'change_request', 'declined'].includes(t.action))

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
        alreadyResponded: !!respondedTimelineEntry,
        clientResponse: respondedTimelineEntry
          ? {
              action: respondedTimelineEntry.action,
              message: respondedTimelineEntry.message || '',
              respondedAt: respondedTimelineEntry.timestamp,
            }
          : null,
      },
    }
  }

  // ─── POST: Submit client response ───
  if (event.method === 'POST') {
    // Check if already responded
    const respondedTimelineEntry = estimate.statusTimeline?.find((t: any) => ['approved', 'change_request', 'declined'].includes(t.action))
    if (respondedTimelineEntry) {
      return {
        success: false,
        alreadyResponded: true,
        message: 'You have already submitted your response for this estimate.',
        clientResponse: {
          action: respondedTimelineEntry.action,
          respondedAt: respondedTimelineEntry.timestamp,
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
    if (!estimate.statusTimeline) {
      estimate.statusTimeline = []
    }

    let performedBy = 'System'
    if (action === 'approved') {
      const query = getQuery(event)
      const queryEmail = query?.email as string || ''
      if (queryEmail) {
        performedBy = queryEmail
      }
      else {
        const sentEntry = [...estimate.statusTimeline].reverse().find((t: any) => t.action === 'sent')
        performedBy = sentEntry?.sentToEmail || estimate.customerEmail || 'Client'
      }
    }
    else {
      const emp = await Employee.findOne({ email: 'michael@annarborhardwoods.com' }).lean() as any
      performedBy = emp?.employee || 'Michael Cornaire'
    }

    estimate.statusTimeline.push({
      action,
      message: message || '',
      timestamp: new Date(),
      performedBy,
    })

    // Update estimate status to match the response
    const beforeDoc = { ...estimate.toObject() }
    estimate.status = action

    await estimate.save()

    fireAutomations({ module: 'crm', submodule: 'estimates', action: 'update', before: beforeDoc, after: estimate.toObject(), actor: { name: estimate.customerName || 'Client' } })

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
