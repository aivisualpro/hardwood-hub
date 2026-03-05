// Captures the request body for mutation requests so the activity logger can read it
export default defineEventHandler(async (event) => {
    const url = event.path || ''
    const method = event.method

    // Only capture body for mutation API requests
    if (!url.startsWith('/api/') || !['POST', 'PUT'].includes(method)) return
    if (url.includes('/api/activities')) return

    try {
        const body = await readBody(event)
            // Store on event for the activity logger middleware to consume
            ; (event as any)._capturedBody = body
        // Re-attach body so downstream handlers can read it
        // Nitro caches the parsed body, so subsequent readBody calls return the same value
    } catch {
        // Silently ignore — some routes may not have a body
    }
})
