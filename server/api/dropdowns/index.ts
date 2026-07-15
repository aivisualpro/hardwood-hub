import { Dropdown } from '../../models/Dropdown'
/**
 * GET  /api/dropdowns        — list all dropdowns
 * GET  /api/dropdowns?name=X — get a specific dropdown by name
 * POST /api/dropdowns        — create or update a dropdown
 * PUT  /api/dropdowns        — update a specific dropdown option
 */
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager, requireStaff } from '../../utils/requireRole'
import { DropdownWriteSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()

  if (event.node.req.method === 'GET') {
    requireStaff(event)
  }
  else {
    requireAdmin(event)
  }

  // Stringify ObjectId fields so they survive Nitro JSON serialization on Vercel
  const serializeDropdown = (dd: any) => {
    if (!dd)
      return dd
    return {
      ...dd,
      _id: String(dd._id),
      options: (dd.options || []).map((o: any) => ({ ...o, _id: String(o._id) })),
    }
  }

  if (event.method === 'GET') {
    const query = getQuery(event)

    if (query.name) {
      const dropdown: any = await Dropdown.findOne({ name: query.name }).lean()
      if (dropdown?.options) {
        dropdown.options.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      }
      return { success: true, data: serializeDropdown(dropdown) }
    }
    const dropdowns = await Dropdown.find().sort({ name: 1 }).lean()
    for (const dd of dropdowns) {
      if (dd.options) {
        dd.options.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      }
    }
    return { success: true, data: dropdowns.map(serializeDropdown) }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const body = parseBody(DropdownWriteSchema, raw)

    // Preserve existing option _ids — records elsewhere (e.g. pipeline.status)
    // reference them. For incoming options without an _id, try to recover the
    // id of the existing option with the same label so saves never orphan refs.
    const existing: any = await Dropdown.findOne({ name: body.name }).lean()
    const byId = new Map<string, any>()
    const byLabel = new Map<string, any>()
    for (const o of existing?.options || []) {
      byId.set(String(o._id), o)
      if (o.label)
        byLabel.set(String(o.label).trim().toLowerCase(), o)
    }
    const options = (body.options || []).map((o: any) => {
      if (o._id && byId.has(String(o._id)))
        return o
      const match = !o._id && o.label ? byLabel.get(String(o.label).trim().toLowerCase()) : null
      return match ? { ...o, _id: match._id } : o
    })

    const result = await Dropdown.findOneAndUpdate(
      { name: body.name },
      { $set: { name: body.name, options } },
      { upsert: true, new: true, lean: true },
    )

    return { success: true, data: serializeDropdown(result) }
  }

  if (event.method === 'PUT') {
    const body = await readBody(event)
    // Update a single option within a dropdown
    if (body.dropdownId && body.optionId && body.patch) {
      const setFields: Record<string, any> = {}
      for (const [key, val] of Object.entries(body.patch)) {
        setFields[`options.$.${key}`] = val
      }
      await Dropdown.updateOne(
        { '_id': body.dropdownId, 'options._id': body.optionId },
        { $set: setFields },
      )
      const updated = await Dropdown.findById(body.dropdownId).lean()
      return { success: true, data: serializeDropdown(updated) }
    }
    // Full dropdown update
    if (body._id) {
      const result = await Dropdown.findByIdAndUpdate(
        body._id,
        { $set: { name: body.name, options: body.options } },
        { new: true, lean: true },
      )
      return { success: true, data: serializeDropdown(result) }
    }
    // Reorder options (PATCH-style via PUT with reorder flag)
    if (body.dropdownId && body.reorderedOptions) {
      const result: any = await Dropdown.findByIdAndUpdate(
        body.dropdownId,
        { $set: { options: body.reorderedOptions } },
        { new: true, lean: true },
      )
      if (result?.options) {
        result.options.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      }
      return { success: true, data: serializeDropdown(result) }
    }
    throw createError({ statusCode: 400, message: 'Missing _id or dropdownId+optionId' })
  }

  if (event.method === 'DELETE') {
    const body = await readBody(event)
    // Delete a single option from a dropdown
    if (body.dropdownId && body.optionId) {
      await Dropdown.updateOne(
        { _id: body.dropdownId },
        { $pull: { options: { _id: body.optionId } } },
      )
      const updated = await Dropdown.findById(body.dropdownId).lean()
      return { success: true, data: serializeDropdown(updated) }
    }
    // Delete entire dropdown
    if (body._id) {
      await Dropdown.findByIdAndDelete(body._id)
      return { success: true }
    }
    throw createError({ statusCode: 400, message: 'Missing _id or dropdownId+optionId' })
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
