/**
 * POST /api/documents/migrate
 *
 * One-time migration: moves all embedded documents from
 * hardwoodDB_pipeline.documents → hardwoodDB_Documents collection.
 *
 * After running, sets pipeline.documents = [] to avoid duplicates.
 */
import { defineEventHandler } from 'h3'
import { Pipeline } from '../../models/Pipeline'
import { Document } from '../../models/Document'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  const method = event.node.req.method
  if (method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Use POST to run migration' })
  }

  await connectDB()

  // Find all pipeline records that have embedded documents
  const pipelines = await Pipeline.find({
    'documents.0': { $exists: true },
  }).lean()

  let totalMigrated = 0
  let pipelinesProcessed = 0

  for (const pipeline of pipelines) {
    const docs = (pipeline as any).documents || []
    if (docs.length === 0) continue

    const newDocs = docs.map((doc: any) => ({
      projectId: (pipeline as any)._id,
      customerId: (pipeline as any).customerId || null,
      date: doc.date || new Date(),
      documentType: doc.documentType || '',
      files: (doc.files || []).map((f: any) => ({
        url: f.url,
        name: f.name || '',
        size: f.size || 0,
        type: f.type || '',
      })),
      uploadedAt: doc.uploadedAt || doc.date || new Date(),
      createdAt: doc.uploadedAt || doc.date || new Date(),
      updatedAt: doc.uploadedAt || doc.date || new Date(),
    }))

    // Insert all documents for this pipeline
    await Document.insertMany(newDocs)
    totalMigrated += newDocs.length

    // Clear the embedded documents array
    await Pipeline.updateOne(
      { _id: (pipeline as any)._id },
      { $set: { documents: [] } },
    )

    pipelinesProcessed++
  }

  return {
    success: true,
    message: `Migration complete. Migrated ${totalMigrated} document(s) from ${pipelinesProcessed} pipeline record(s).`,
    totalMigrated,
    pipelinesProcessed,
  }
})
