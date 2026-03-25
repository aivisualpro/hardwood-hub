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
