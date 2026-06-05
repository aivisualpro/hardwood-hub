import { ProjectCommunication } from '../../models/ProjectCommunication'
import { connectDB } from '../../utils/mongoose'
import { requirePermission } from '../../utils/requirePermission'
import { ProjectCommunicationUpdateSchema, objectId, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  await requirePermission(event, '/project-communication')
  const id = objectId(getRouterParam(event, 'id'))

  if (!id)
    throw createError({ statusCode: 400, message: 'ID is required' })

  if (event.method === 'PUT') {
    const raw = await readBody(event)
    const data = parseBody(ProjectCommunicationUpdateSchema, raw)
    const doc = await ProjectCommunication.findByIdAndUpdate(id, data, { new: true })
    if (!doc)
      throw createError({ statusCode: 404, message: 'Not found' })
    return { success: true, data: doc }
  }

  if (event.method === 'DELETE') {
    const doc = await ProjectCommunication.findByIdAndDelete(id)
    if (!doc)
      throw createError({ statusCode: 404, message: 'Not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
