/**
 * POST /api/crm/webhook
 * Real-time sync from Gravity Forms.
 * 
 * To use this: 
 * 1. Install "Gravity Forms Webhooks" Add-on in WordPress.
 * 2. Go to Form Settings → Webhooks and add a new webhook.
 * 3. Set Request URL to: https://your-domain.com/api/crm/webhook
 * 4. Set Request Method to: POST
 * 5. Set Format to: JSON
 */
import { connectDB } from '../../utils/mongoose'
import { gfGetForm } from '../../utils/gravityForms'
import { parseGFEntry } from '../../utils/gfFieldMapping'
import { CrmSubmission, ICrmSubmission } from '../../models/CrmSubmission'
import { logActivity } from '../../utils/logActivity'


export default defineEventHandler(async (event) => {
  await connectDB()

  const entry = await readBody(event)
  if (!entry || !entry.id || !entry.form_id) {
    throw createError({ statusCode: 400, message: 'Invalid Gravity Forms entry payload' })
  }

  const formId = Number(entry.form_id)
  
  try {
    // Fetch form definition to get correct field labels for parsing
    const form = await gfGetForm(formId)
    const formFields = form?.fields || []
    
    // Parse using our canonical mapping logic
    const parsed = parseGFEntry(entry, formFields)
    
    // Upsert into MongoDB
    const result = await CrmSubmission.findOneAndUpdate(
      { gfEntryId: parsed.gfEntryId },
      { $set: parsed },
      { upsert: true, new: true, lean: true }
    ) as ICrmSubmission | null

    // Log Activity for new lead
    await logActivity({
      user: 'Gravity Forms',
      action: 'create',
      module: 'crm',
      description: `New submission: ${parsed.formName} (from ${parsed.name || 'Anonymous'})`,
      targetId: result?._id?.toString(),
      targetName: parsed.name || parsed.formName,
      metadata: {
        formId,
        entryId: entry.id,
      }
    })
 
    console.log(`[CRM Webhook] Synced entry #${entry.id} from Form #${entry.form_id} (${parsed.formName})`)

    return {
      success: true,
      id: result?._id,
      gfEntryId: entry.id,
      action: result ? 'sync' : 'ignored'
    }
  } catch (err: any) {
    console.error(`[CRM Webhook Error] Form ${formId}:`, err.message)
    throw createError({
      statusCode: 500,
      message: `Failed to sync webhook entry: ${err.message}`
    })
  }
})
