/**
 * GET  /api/dropdowns        — list all dropdowns
 * GET  /api/dropdowns?name=X — get a specific dropdown by name
 * POST /api/dropdowns        — create or update a dropdown
 * PUT  /api/dropdowns        — update a specific dropdown option
 */
import { connectDB } from '../../utils/mongoose'
import { Dropdown } from '../../models/Dropdown'

export default defineEventHandler(async (event) => {
  await connectDB()

  if (event.method === 'GET') {
    const query = getQuery(event)
    if (query.name) {
      const dropdown = await Dropdown.findOne({ name: query.name }).lean()
      return { success: true, data: dropdown }
    }
    const dropdowns = await Dropdown.find().sort({ name: 1 }).lean()
    return { success: true, data: dropdowns }
  }

  if (event.method === 'POST') {
    const body = await readBody(event)
    if (!body.name) {
      throw createError({ statusCode: 400, message: 'name is required' })
    }

    const result = await Dropdown.findOneAndUpdate(
      { name: body.name },
      { $set: { name: body.name, options: body.options || [] } },
      { upsert: true, new: true, lean: true }
    )

    return { success: true, data: result }
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
        { _id: body.dropdownId, 'options._id': body.optionId },
        { $set: setFields }
      )
      const updated = await Dropdown.findById(body.dropdownId).lean()
      return { success: true, data: updated }
    }
    // Full dropdown update
    if (body._id) {
      const result = await Dropdown.findByIdAndUpdate(
        body._id,
        { $set: { name: body.name, options: body.options } },
        { new: true, lean: true }
      )
      return { success: true, data: result }
    }
    throw createError({ statusCode: 400, message: 'Missing _id or dropdownId+optionId' })
  }

  if (event.method === 'DELETE') {
    const body = await readBody(event)
    // Delete a single option from a dropdown
    if (body.dropdownId && body.optionId) {
      await Dropdown.updateOne(
        { _id: body.dropdownId },
        { $pull: { options: { _id: body.optionId } } }
      )
      const updated = await Dropdown.findById(body.dropdownId).lean()
      return { success: true, data: updated }
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
