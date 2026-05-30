import { Employee } from '../../models/Employee'
// GET /api/employees  — list all
// POST /api/employees — create
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { EmployeeCreateSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)

  if (event.method === 'GET') {
    const employees = await Employee.find().sort({ createdAt: -1 }).lean()
    return { success: true, data: employees }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const data = parseBody(EmployeeCreateSchema, raw)
    const doc = await Employee.create(data)
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
