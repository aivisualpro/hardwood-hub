// POST /api/upload/company-logo
// Uploads a company logo to Cloudinary, returns the secure URL
import { v2 as cloudinary } from 'cloudinary'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()

    cloudinary.config({
        cloud_name: config.cloudinaryCloudName,
        api_key: config.cloudinaryApiKey,
        api_secret: config.cloudinaryApiSecret,
    })

    const body = await readBody(event)
    const { file } = body

    if (!file) {
        throw createError({ statusCode: 400, message: 'No file provided' })
    }

    const result = await cloudinary.uploader.upload(file, {
        folder: 'hardwood-hub/company',
        resource_type: 'image',
        transformation: [
            { quality: 'auto', fetch_format: 'auto' },
        ],
    })

    return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
    }
})
