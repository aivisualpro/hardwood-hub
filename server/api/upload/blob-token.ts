import { handleUpload } from '@vercel/blob/client'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  try {
    const jsonResponse = await handleUpload({
      body,
      request: toWebRequest(event),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return {
          allowedContentTypes: ['application/pdf'],
          tokenPayload: JSON.stringify({ authorized: true }),
        }
      },
      onUploadCompleted: async () => {
        // no-op — upload result is handled client-side
      },
    })

    return jsonResponse
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
    })
  }
})

