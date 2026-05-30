// POST /api/upload/cloudinary
// Receives a base64 image from the client, uploads to Cloudinary, returns the secure URL
// The client should send { file: <base64 data URL string> }
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryUploadSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  })

  const raw = await readBody(event)
  const { file, folder } = parseBody(CloudinaryUploadSchema, raw)

  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: folder || 'hardwood-hub/uploads',
      resource_type: 'auto',
    })

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    }
  }
  catch (e: any) {
    throw createError({ statusCode: 500, message: e.message })
  }
})
