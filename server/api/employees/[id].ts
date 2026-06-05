import { Employee } from '../../models/Employee'
// GET    /api/employees/:id
// PUT    /api/employees/:id
// DELETE /api/employees/:id
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { stripHiddenFields, sanitizeWriteBody } from '../../utils/applyFieldPermissions'
import { EmployeeUpdateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/hr/employees')
  const id = objectId(getRouterParam(event, 'id'))

  if (event.method === 'GET') {
    const doc = await Employee.findById(id).lean()
    if (!doc)
      throw createError({ statusCode: 404, message: 'Employee not found' })
    return { success: true, data: stripHiddenFields(event, '/hr/employees', doc) }
  }

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(EmployeeUpdateSchema, raw)
    const cleaned = sanitizeWriteBody(event, '/hr/employees', data)
    const updated = await Employee.findByIdAndUpdate(id, { $set: cleaned }, { returnDocument: 'after', runValidators: true }).lean()
    if (!updated)
      throw createError({ statusCode: 404, message: 'Employee not found' })
    return { success: true, data: stripHiddenFields(event, '/hr/employees', updated) }
  }

  if (event.method === 'DELETE') {
    const deleted = await Employee.findByIdAndDelete(id).lean()
    if (!deleted)
      throw createError({ statusCode: 404, message: 'Employee not found' })
    return { success: true, message: 'Employee deleted' }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
