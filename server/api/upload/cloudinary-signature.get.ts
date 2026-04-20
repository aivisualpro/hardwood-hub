import { v2 as cloudinary } from 'cloudinary'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const { folder } = getQuery(event)

  cloudinary.config({
      cloud_name: config.cloudinaryCloudName,
      api_key: config.cloudinaryApiKey,
      api_secret: config.cloudinaryApiSecret,
  })

  const timestamp = Math.round((new Date()).getTime() / 1000)
  const paramsToSign = {
    timestamp,
    folder: folder || 'hardwood-hub/uploads'
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    config.cloudinaryApiSecret
  )

  return {
    success: true,
    signature,
    timestamp,
    cloudName: config.cloudinaryCloudName,
    apiKey: config.cloudinaryApiKey,
    folder: paramsToSign.folder
  }
})
