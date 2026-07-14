import { verifySessionToken } from '../../lib/session'
import { Employee } from '../../models/Employee'
// GET /api/auth/me — return current authenticated user from session
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  // "Not logged in" is a normal state, not an error — return 200 with
  // success:false instead of throwing 401. This keeps the browser console
  // clean on /login (the auth plugin probes this endpoint on every load)
  // and useAuth() only checks res.success anyway.
  const token = getCookie(event, 'hardwood_session')
  if (!token)
    return { success: false, data: null }

  const session = verifySessionToken(token)
  if (!session)
    return { success: false, data: null }

  await connectDB()
  const employee = await Employee.findById(session.id).lean<any>()
  if (!employee)
    return { success: false, data: null }

  if (employee.status === 'Inactive')
    throw createError({ statusCode: 403, message: 'Account deactivated' })

  return {
    success: true,
    data: {
      _id: String(employee._id),
      employee: employee.employee,
      email: employee.email,
      position: employee.position,
      profileImage: employee.profileImage,
      status: employee.status,
      workspace: employee.workspace ? String(employee.workspace) : '',
    },
  }
})
