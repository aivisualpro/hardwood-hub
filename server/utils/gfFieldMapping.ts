/**
 * Maps Gravity Forms form IDs to CRM types and extracts canonical fields.
 *
 * Form IDs from annarborhardwoods.com:
 *   3 → Book an Appointment
 *   1 → Get a FAST Quote
 *   6 → Get a Quick Flooring Estimate
 *   4 → Get in Touch
 *   5 → Get in Touch with Conditional Logic (also maps to subscriber)
 */

export const GF_FORM_MAP: Record<number, { type: string; formName: string }> = {
  3: { type: 'appointment', formName: 'Book an Appointment' },
  1: { type: 'fast-quote', formName: 'Get a FAST Quote' },
  6: { type: 'flooring-estimate', formName: 'Get a Quick Flooring Estimate' },
  4: { type: 'subscriber', formName: 'Get in Touch' },
  5: { type: 'conditional-logic', formName: 'Get in Touch with Conditional Logic' },
}

export const SYNCED_FORM_IDS = Object.keys(GF_FORM_MAP).map(Number).filter(id => id !== 3)

/**
 * Takes a raw GF entry and the form field definitions, and returns a canonical CRM object.
 */
export function parseGFEntry(entry: Record<string, any>, formFields: any[] = []) {
  const formId = Number(entry.form_id)
  const mapping = GF_FORM_MAP[formId] || { type: 'other', formName: `Form ${formId}` }

  // Build a label→value map from the numeric field keys
  const labelMap: Record<string, string> = {}
  const rawFields: Record<string, any> = {}
  for (const field of formFields) {
    const id = String(field.id)
    const label = (field.label || '').toLowerCase().trim()

    if (field.inputs && Array.isArray(field.inputs)) {
      // Composite field (e.g., Name → first/last, Address → street/city/state/zip)
      for (const input of field.inputs) {
        const inputId = String(input.id)
        const inputLabel = (input.label || '').toLowerCase().trim()
        const val = entry[inputId] ?? ''
        labelMap[inputLabel] = val
        rawFields[input.label || inputId] = val
      }
    } else {
      const val = entry[id] ?? ''
      labelMap[label] = val
      rawFields[field.label || id] = val
    }
  }

  // Extract canonical contact info from various naming conventions
  const firstName = labelMap['first'] || labelMap['first name'] || ''
  const lastName = labelMap['last'] || labelMap['last name'] || ''
  const name = (firstName && lastName) ? `${firstName} ${lastName}`.trim() : (labelMap['name'] || `${firstName}${lastName}`.trim())
  const email = labelMap['email'] || labelMap['email address'] || labelMap['your email'] || ''
  const phone = labelMap['phone'] || labelMap['phone number'] || labelMap['telephone'] || ''
  const address = [
    labelMap['street address'] || labelMap['address'] || labelMap['street'] || '',
    labelMap['address line 2'] || '',
  ].filter(Boolean).join(', ')
  const city = labelMap['city'] || ''
  const state = labelMap['state / province'] || labelMap['state'] || ''
  const zip = labelMap['zip / postal code'] || labelMap['zip'] || labelMap['zip code'] || ''
  const message = labelMap['message'] || labelMap['comments'] || labelMap['comment'] || labelMap['your message'] || labelMap['details'] || ''

  return {
    gfEntryId: String(entry.id),
    gfFormId: formId,
    formName: mapping.formName,
    type: mapping.type,
    name,
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    state,
    zip,
    message,
    fields: rawFields,
    dateSubmitted: entry.date_created ? new Date(entry.date_created) : new Date(),
    dateUpdated: entry.date_updated ? new Date(entry.date_updated) : undefined,
    sourceUrl: entry.source_url || '',
    ip: entry.ip || '',
  }
}
