/**
 * POST /api/crm/calendly-sync
 * Lightweight Calendly-only sync endpoint.
 * Pulls all events from Calendly API and upserts into MongoDB.
 * Much faster than the full /api/crm/sync which also syncs Gravity Forms.
 */
import { connectDB } from '../../utils/mongoose'
import { CrmSubmission } from '../../models/CrmSubmission'
import { Customer } from '../../models/Customer'
import { fetchCalendlyAppointments } from '../../utils/calendly'

export default defineEventHandler(async () => {
  await connectDB()

  const config = useRuntimeConfig()
  if (!config.calendlyAccessToken) {
    return { success: false, error: 'No CALENDLY_ACCESS_TOKEN configured' }
  }

  let totalNew = 0
  let totalUpdated = 0

  try {
    console.log('[Calendly Sync] Starting lightweight Calendly sync...')
    const calendlyApps = await fetchCalendlyAppointments()
    console.log(`[Calendly Sync] Fetched ${calendlyApps.length} appointments from Calendly API`)

    for (const parsed of calendlyApps) {
      const result = await CrmSubmission.updateOne(
        { gfEntryId: parsed.gfEntryId },
        { $set: parsed },
        { upsert: true },
      )

      if (result.upsertedCount > 0) {
        totalNew++

        // Migrate unique new CRM submissions into the main Customer collection
        if (parsed.email || parsed.phone) {
          const query: any[] = []
          if (parsed.email) query.push({ email: parsed.email })
          if (parsed.phone) query.push({ phone: parsed.phone })

          const exists = await Customer.exists({ $or: query })
          if (!exists) {
            await Customer.create({
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
              stage: 'SUBSCRIBERS',
              initialContactDate: parsed.dateSubmitted
            })
          }
        }
      } else if (result.modifiedCount > 0) {
        totalUpdated++
      }
    }

    console.log(`[Calendly Sync] Done. New: ${totalNew}, Updated: ${totalUpdated}, Total: ${calendlyApps.length}`)

    return {
      success: true,
      synced: totalNew,
      updated: totalUpdated,
      total: calendlyApps.length,
    }
  } catch (err: any) {
    console.error('[Calendly Sync] Error:', err.message || err)
    return {
      success: false,
      error: err.message || String(err),
    }
  }
})
