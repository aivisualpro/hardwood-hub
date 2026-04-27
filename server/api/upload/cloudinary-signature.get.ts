import { v2 as cloudinary } from 'cloudinary'

/**
 * Returns a signed Cloudinary direct-upload payload.
 *
 * Query params:
 *   folder        — Cloudinary folder, default 'hardwood-hub/uploads'
 *   resourceType  — 'image' | 'raw' | 'auto' | 'video', default 'image'
 *                   Use 'raw' for PDFs, zips, etc.
 *
 * The browser then POSTs the file (as multipart/form-data) directly to
 * `uploadUrl` along with the returned signature/timestamp/apiKey/folder.
 * This bypasses Vercel's 4.5MB body limit entirely.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const { folder, resourceType } = getQuery(event)

  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  })

  const folderStr = (folder as string) || 'hardwood-hub/uploads'
  const resourceTypeStr = (resourceType as string) || 'image'

  const timestamp = Math.round(Date.now() / 1000)

  // Only params that are part of the signed request need to go in here
  const paramsToSign: Record<string, any> = {
    timestamp,
    folder: folderStr,
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    config.cloudinaryApiSecret as string,
  )

  return {
    success: true,
    signature,
    timestamp,
    cloudName: config.cloudinaryCloudName,
    apiKey: config.cloudinaryApiKey,
    folder: folderStr,
    resourceType: resourceTypeStr,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/${resourceTypeStr}/upload`,
  }
})
