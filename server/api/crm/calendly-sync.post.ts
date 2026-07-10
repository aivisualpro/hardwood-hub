import { CrmSubmission } from '../../models/CrmSubmission'
import { Customer } from '../../models/Customer'
import { Dropdown } from '../../models/Dropdown'
import { Pipeline } from '../../models/Pipeline'
import { classifyAppointmentType, fetchCalendlyAppointments } from '../../utils/calendly'
/**
 * POST /api/crm/calendly-sync
 * Lightweight Calendly-only sync endpoint.
 * Pulls all events from Calendly API and upserts into MongoDB.
 * Also auto-assigns pipeline stages:
 *   - phone consultation booked   → "Phone Call"
 *   - in-home appointment booked  → "In-home Appointment"
 *   - appointment canceled (not rescheduled) → "Lost"
 */
import { connectDB } from '../../utils/mongoose'
import { logger } from '../../utils/logger'
const log = logger('[calendly-sync.post]')

// ─── Pipeline stage resolution ───────────────────────────────────────────────

interface StageIds {
  phone: string | null
  inHome: string | null
  lost: string | null
}

const STAGE_DEFS = [
  { key: 'phone', match: /phone\s*call|phone/i, label: 'Phone Call', color: '#0ea5e9', icon: 'i-lucide-phone' },
  { key: 'inHome', match: /in[\s-]?home/i, label: 'In-home Appointment', color: '#8b5cf6', icon: 'i-lucide-home' },
  { key: 'lost', match: /^lost$|lost/i, label: 'Lost', color: '#ef4444', icon: 'i-lucide-x-circle' },
] as const

/**
 * Resolve the "Customer Status" dropdown option ids used for automation.
 * Missing options are auto-created (under the "Quote" category for the
 * appointment stages) so the automation always works.
 */
async function resolveStageIds(): Promise<StageIds> {
  const ids: StageIds = { phone: null, inHome: null, lost: null }

  let dropdown = await Dropdown.findOne({ name: 'Customer Status' })
  if (!dropdown) {
    dropdown = await Dropdown.create({ name: 'Customer Status', options: [] })
  }

  let changed = false
  for (const def of STAGE_DEFS) {
    let opt = dropdown.options.find((o: any) => def.match.test(o.label || ''))
    if (!opt) {
      dropdown.options.push({
        label: def.label,
        value: def.label.toLowerCase().replace(/\s+/g, '-'),
        color: def.color,
        icon: def.icon,
        order: dropdown.options.length,
        category: def.key === 'lost' ? '' : 'Quote',
      })
      opt = dropdown.options[dropdown.options.length - 1]
      changed = true
      log.info(`Created missing pipeline stage "${def.label}"`)
    }
    ids[def.key] = String(opt._id)
  }

  if (changed)
    await dropdown.save()

  return ids
}

// ─── Stage transition logic ──────────────────────────────────────────────────

/**
 * Apply the pipeline stage for one appointment.
 * Only moves records that are still in an "early" stage (unset, Phone Call or
 * In-home Appointment) — never downgrades someone further along the pipeline.
 */
async function applyPipelineStage(parsed: any, stages: StageIds, allowResurrect = false) {
  if (!parsed.email && !parsed.phone)
    return

  const meeting = parsed.fields?.meetingScheduled
  const aptType = parsed.fields?.appointmentType || classifyAppointmentType(parsed.formName)
  const isCanceled = meeting?.eventStatus === 'canceled'
  const isRescheduled = meeting?.rescheduled === true

  // Rescheduled bookings: the replacement event drives the stage — do nothing.
  if (isCanceled && isRescheduled)
    return

  // Determine target stage
  let targetStage: string | null = null
  if (isCanceled) {
    targetStage = stages.lost
  }
  else if (aptType === 'in-home') {
    targetStage = stages.inHome
  }
  else if (aptType === 'phone') {
    targetStage = stages.phone
  }

  if (!targetStage)
    return

  const query: any[] = []
  if (parsed.email)
    query.push({ email: parsed.email })
  if (parsed.phone)
    query.push({ phone: parsed.phone })

  const record = await Pipeline.findOne({ $or: query }).select('status initialContactDate name')
  if (!record)
    return

  const current = record.status ? String(record.status) : null

  // Stages we're allowed to move FROM automatically.
  // A genuinely NEW active booking may also resurrect a record from "Lost" —
  // routine re-syncs never override a manual "Lost".
  const movable = new Set<string | null>([null, stages.phone, stages.inHome])
  if (!isCanceled && allowResurrect)
    movable.add(stages.lost)
  if (!movable.has(current))
    return // customer already progressed past appointment stages — don't touch

  // Don't downgrade in-home back to phone
  if (targetStage === stages.phone && current === stages.inHome)
    return

  if (current === targetStage)
    return // already there

  record.status = targetStage as any
  if (!record.initialContactDate && parsed.dateSubmitted)
    record.initialContactDate = parsed.dateSubmitted
  await record.save()

  const label = targetStage === stages.lost ? 'Lost' : targetStage === stages.inHome ? 'In-home Appointment' : 'Phone Call'
  log.info(`Pipeline stage → "${label}" for ${record.name || parsed.email || parsed.phone}`)
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default defineEventHandler(async () => {
  await connectDB()

  const config = useRuntimeConfig()
  if (!config.calendlyAccessToken) {
    return { success: false, error: 'No CALENDLY_ACCESS_TOKEN configured' }
  }

  let totalNew = 0
  let totalUpdated = 0

  try {
    log.info('[Calendly Sync] Starting lightweight Calendly sync...')
    const calendlyApps = await fetchCalendlyAppointments()
    log.info(`[Calendly Sync] Fetched ${calendlyApps.length} appointments from Calendly API`)

    const stages = await resolveStageIds()

    // Process oldest meeting first so the most recent booking decides the final stage
    calendlyApps.sort((a: any, b: any) => {
      const ta = new Date(a.fields?.meetingScheduled?.startTime || a.dateSubmitted).getTime()
      const tb = new Date(b.fields?.meetingScheduled?.startTime || b.dateSubmitted).getTime()
      return ta - tb
    })

    for (const parsed of calendlyApps) {
      // Snapshot the previous state so automation only fires on real changes
      const existing = await CrmSubmission.findOne({ gfEntryId: parsed.gfEntryId })
        .select('fields.meetingScheduled')
        .lean() as any

      const result = await CrmSubmission.updateOne(
        { gfEntryId: parsed.gfEntryId },
        { $set: parsed },
        { upsert: true },
      )

      const isNew = result.upsertedCount > 0
      const prevMeeting = existing?.fields?.meetingScheduled
      const newMeeting = parsed.fields?.meetingScheduled
      const stateChanged = !existing
        || prevMeeting?.eventStatus !== newMeeting?.eventStatus
        || (prevMeeting?.rescheduled === true) !== (newMeeting?.rescheduled === true)

      if (isNew) {
        totalNew++

        // Migrate unique new CRM submissions into both Customer and Pipeline collections
        if (parsed.email || parsed.phone) {
          const query: any[] = []
          if (parsed.email)
            query.push({ email: parsed.email })
          if (parsed.phone)
            query.push({ phone: parsed.phone })

          const customerData = {
            name: parsed.name,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            email: parsed.email,
            phone: parsed.phone,
            address: parsed.address,
            city: parsed.city,
            state: parsed.state,
            zip: parsed.zip,
            notes: `Synced from Calendly: ${parsed.formName}. Message: ${parsed.message}`,
            stage: 'contact made',
            initialContactDate: parsed.dateSubmitted,
          }

          const existsInCustomer = await Customer.exists({ $or: query })
          if (!existsInCustomer) {
            await Customer.create(customerData)
          }
          const existsInPipeline = await Pipeline.exists({ $or: query })
          if (!existsInPipeline) {
            await Pipeline.create(customerData)
          }
        }
      }
      else if (result.modifiedCount > 0) {
        totalUpdated++
      }

      // Auto stage assignment.
      // Active bookings: always apply (idempotent — only ever upgrades records
      // still in early stages, so it also backfills existing appointments).
      // Cancellations: only on state change, so a manually rescued record
      // isn't repeatedly forced back to "Lost".
      const isActiveBooking = newMeeting?.eventStatus !== 'canceled'
      if (isNew || stateChanged || isActiveBooking) {
        try {
          await applyPipelineStage(parsed, stages, isNew || stateChanged)
        }
        catch (err: any) {
          log.warn(`Stage automation failed for ${parsed.email || parsed.gfEntryId}: ${err.message || err}`)
        }
      }
    }

    log.info(`[Calendly Sync] Done. New: ${totalNew}, Updated: ${totalUpdated}, Total: ${calendlyApps.length}`)

    return {
      success: true,
      synced: totalNew,
      updated: totalUpdated,
      total: calendlyApps.length,
    }
  }
  catch (err: any) {
    log.error('[Calendly Sync] Error:', err.message || err)
    return {
      success: false,
      error: err.message || String(err),
    }
  }
})
