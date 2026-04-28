// Catch-all for /api/version requests (triggered by browser extensions or
// service-worker health checks). Returns a simple JSON response so the
// request never falls through to the Vue Router and produces warnings.
export default defineEventHandler(() => {
  return { version: '1.0.0' }
})
