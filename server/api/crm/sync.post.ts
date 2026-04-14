/**
 * POST /api/crm/sync
 * Syncs all Gravity Forms entries into MongoDB.
 * Skips entries that already exist (by gfEntryId).
 * Returns counts of new and existing entries.
 */
import { connectDB } from '../../utils/mongoose'
import { gfGetAllEntries, gfGetForm } from '../../utils/gravityForms'
import { SYNCED_FORM_IDS, parseGFEntry } from '../../utils/gfFieldMapping'
import { CrmSubmission } from '../../models/CrmSubmission'
import { Customer } from '../../models/Customer'
import { fetchCalendlyAppointments } from '../../utils/calendly'

export default defineEventHandler(async () => {
  await connectDB()

  let totalNew = 0
  let totalExisting = 0
  const errors: string[] = []

  for (const formId of SYNCED_FORM_IDS) {
    try {
      // Fetch form definition (for field labels) and all entries
      const [form, entries] = await Promise.all([
        gfGetForm(formId),
        gfGetAllEntries(formId),
      ])

      const formFields = form?.fields || []

      for (const rawEntry of entries) {
        const parsed = parseGFEntry(rawEntry, formFields)

        // Upsert: only insert if not already existing
        const result = await CrmSubmission.updateOne(
          { gfEntryId: parsed.gfEntryId },
          { $setOnInsert: parsed },
          { upsert: true },
        )

        if (result.upsertedCount > 0) {
          totalNew++

          // Migrate unique new CRM submissions directly into the main Customer collection
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
                   notes: `Synced from Gravity Forms: ${parsed.formName}. Message: ${parsed.message}`,
                   stage: 'SUBSCRIBERS',
                   initialContactDate: parsed.dateSubmitted
                })
             }
          }
        } else {
          totalExisting++
        }
      }
    } catch (err: any) {
      const msg = err.message || String(err)
      // Provide helpful guidance if the API is not enabled
      if (msg.includes('404') || msg.includes('rest_no_route')) {
        errors.push(
          `Form ${formId}: API not reachable. Please enable the Gravity Forms REST API in WordPress Admin → Forms → Settings → REST API. Check the "Enable access to the API" checkbox and save.`,
        )
      } else {
        errors.push(`Form ${formId}: ${msg}`)
      }
    }
  }

  // Sync Calendly Appointments
  try {
    const config = useRuntimeConfig()
    if (config.calendlyAccessToken) {
      console.log('[CRM Sync] Starting Calendly sync...')
      const calendlyApps = await fetchCalendlyAppointments()
      console.log(`[CRM Sync] Calendly returned ${calendlyApps.length} appointments`)
      
      for (const parsed of calendlyApps) {
        // Upsert: insert new, update existing
        const result = await CrmSubmission.updateOne(
          { gfEntryId: parsed.gfEntryId },
          { $set: parsed },
          { upsert: true },
        )

        if (result.upsertedCount > 0) {
          totalNew++

          // Migrate unique new CRM submissions directly into the main Customer collection
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
        } else {
          totalExisting++
        }
      }
      console.log(`[CRM Sync] Calendly done. New: ${totalNew}, Existing: ${totalExisting}`)
    } else {
      console.warn('[CRM Sync] No CALENDLY_ACCESS_TOKEN found, skipping Calendly sync')
    }
  } catch (err: any) {
    console.error('[CRM Sync] Calendly Error:', err.message || err)
    errors.push(`Calendly Sync Error: ${err.message || String(err)}`)
  }

  return {
    success: errors.length === 0 || totalNew > 0,
    synced: totalNew,
    existing: totalExisting,
    total: totalNew + totalExisting,
    errors: errors.length > 0 ? errors : undefined,
    hint: errors.length > 0 && totalNew === 0
      ? 'The Gravity Forms REST API may not be enabled on your WordPress site. Go to WP Admin → Forms → Settings → REST API and enable it.'
      : undefined,
  }
})
