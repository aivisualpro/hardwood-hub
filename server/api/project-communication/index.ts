import { ProjectCommunication } from '../../models/ProjectCommunication'
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { ProjectCommunicationWriteSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/project-communication')

  if (event.method === 'GET') {
    const docs = await ProjectCommunication.find().sort({ createdAt: -1 }).lean<any[]>()
    return { success: true, data: docs }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const data = parseBody(ProjectCommunicationWriteSchema, raw)
    const doc = await ProjectCommunication.create(data)
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
