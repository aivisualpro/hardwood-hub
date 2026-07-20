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
import { fireAutomations } from '../../../utils/automationEngine'

/**
 * Timeline entries that belong to the CURRENT send cycle (everything after the
 * most recent 'sent' entry). This makes resends work correctly: when a revised
 * estimate is re-sent after a client already responded (e.g. change_request),
 * the old response no longer blocks them from responding to the new version.
 */
function currentCycleEntries(estimate: any): any[] {
  const tl: any[] = estimate.statusTimeline || []
  let lastSentIdx = -1
  tl.forEach((t: any, i: number) => {
    if (t.action === 'sent') lastSentIdx = i
  })
  return tl.slice(lastSentIdx + 1)
}

const RESPONSE_ACTIONS = ['approved', 'change_request', 'declined']

/** Best-effort identification of the responding client for timeline attribution */
function resolveClientIdentity(event: any, estimate: any): string {
  const query = getQuery(event)
  const queryEmail = (query?.email as string || '').trim()
  if (queryEmail) return queryEmail
  const sentEntry = [...(estimate.statusTimeline || [])].reverse().find((t: any) => t.action === 'sent')
  return sentEntry?.sentToEmail || estimate.customerEmail || 'Client'
}

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

    const cycle = currentCycleEntries(estimate)
    const hasReceived = cycle.some((t: any) => t.action === 'received')
    const hasResponded = cycle.some((t: any) => RESPONSE_ACTIONS.includes(t.action))

    // Add 'received' to the timeline the first time the client opens this send
    if (!hasReceived && !hasResponded) {
      if (!estimate.statusTimeline) {
        estimate.statusTimeline = []
      }
      const beforeStatus = { ...estimate.toObject() }
      estimate.statusTimeline.push({
        action: 'received',
        timestamp: new Date(),
        performedBy: 'Client',
      })
      estimate.status = 'received'
      await estimate.save()
      fireAutomations({ module: 'crm', submodule: 'estimates', action: 'update', before: beforeStatus, after: estimate.toObject(), actor: { name: estimate.customerName || 'Client' } })
    }

    const respondedTimelineEntry = cycle.find((t: any) => RESPONSE_ACTIONS.includes(t.action))

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
    // Check if already responded for the CURRENT send cycle
    const respondedTimelineEntry = currentCycleEntries(estimate).find((t: any) => RESPONSE_ACTIONS.includes(t.action))
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
    const action = body?.action as string
    const message = (body?.message as string || '').trim()

    if (!RESPONSE_ACTIONS.includes(action)) {
      throw createError({ statusCode: 400, message: 'Invalid action. Must be approved, change_request, or declined.' })
    }

    if (action === 'change_request' && !message) {
      throw createError({ statusCode: 400, message: 'Please describe the changes you would like.' })
    }

    // Save client response
    if (!estimate.statusTimeline) {
      estimate.statusTimeline = []
    }

    // The response is always performed by the client — attribute it to their
    // email so the timeline reads correctly (was previously mis-attributed to
    // a hard-coded employee for change_request / declined).
    const performedBy = resolveClientIdentity(event, estimate)

    const beforeDoc = { ...estimate.toObject() }
    estimate.statusTimeline.push({
      action,
      message: message || '',
      timestamp: new Date(),
      performedBy,
    })

    // Update estimate status to match the response
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
