export default defineEventHandler((event) => {
  const url = getRequestURL(event).pathname
  
  if (url.startsWith('/api/bigquery')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Legacy BigQuery endpoints are removed',
    })
  }

  // Same for any raw 'users' endpoints if those were fully renamed to 'employees'
  // But strictly stopping bigquery resolves the current Vue router warning.
})
