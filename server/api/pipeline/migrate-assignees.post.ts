/**
 * POST /api/pipeline/migrate-assignees
 *
 * One-time migration:
 * 1. Backs up hardwoodDB_pipeline → hardwoodDB_pipeline_backup
 * 2. Converts assignedTo & projectAssignedTo from comma-separated strings
 *    to arrays of Employee ObjectIds
 */
import { defineEventHandler } from 'h3'
import mongoose from 'mongoose'
import { Pipeline } from '../../models/Pipeline'
import { Employee } from '../../models/Employee'
import { connectDB } from '../../utils/mongoose'
import { requireManager } from '../../utils/requireRole'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)

  const db = mongoose.connection.db
  if (!db)
    throw createError({ statusCode: 500, message: 'No database connection' })

  // ── Step 1: Backup ──────────────────────────────────────────────────────────
  const backupName = 'hardwoodDB_pipeline_backup'
  const existing = await db.listCollections({ name: backupName }).toArray()
  if (existing.length > 0) {
    await db.dropCollection(backupName)
  }
  await db.collection('hardwoodDB_pipeline').aggregate([{ $out: backupName }]).toArray()

  const backupCount = await db.collection(backupName).countDocuments()
  const sourceCount = await db.collection('hardwoodDB_pipeline').countDocuments()

  // ── Step 2: Build employee lookup ──────────────────────────────────────────
  const employees = await Employee.find({}).lean()
  // Map by email (lowercase), name (lowercase), and _id string
  const empByEmail = new Map<string, any>()
  const empByName = new Map<string, any>()
  const empById = new Map<string, any>()

  for (const emp of employees) {
    if (emp.email) empByEmail.set(emp.email.toLowerCase(), emp)
    if ((emp as any).employee) empByName.set((emp as any).employee.toLowerCase(), emp)
    empById.set(String(emp._id), emp)
  }

  function resolveToObjectId(val: string): mongoose.Types.ObjectId | null {
    const v = val.trim()
    if (!v) return null

    // Already an ObjectId string?
    if (mongoose.Types.ObjectId.isValid(v) && empById.has(v)) {
      return new mongoose.Types.ObjectId(v)
    }
    // Match by email
    const byEmail = empByEmail.get(v.toLowerCase())
    if (byEmail) return byEmail._id
    // Match by name
    const byName = empByName.get(v.toLowerCase())
    if (byName) return byName._id

    return null
  }

  // ── Step 3: Migrate documents ──────────────────────────────────────────────
  const allPipelines = await Pipeline.find({}).lean()
  let migratedCount = 0
  let skippedCount = 0
  const unmatchedValues: string[] = []

  for (const doc of allPipelines) {
    const updates: Record<string, any> = {}

    // Process assignedTo
    const assignedToRaw = (doc as any).assignedTo
    if (typeof assignedToRaw === 'string' && assignedToRaw.trim()) {
      const parts = assignedToRaw.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
      const ids: mongoose.Types.ObjectId[] = []
      for (const part of parts) {
        const oid = resolveToObjectId(part)
        if (oid) {
          ids.push(oid)
        }
        else {
          unmatchedValues.push(`assignedTo: "${part}" (doc ${doc._id})`)
        }
      }
      updates.assignedTo = ids
    }
    else if (!Array.isArray(assignedToRaw)) {
      updates.assignedTo = []
    }

    // Process projectAssignedTo
    const projectAssignedToRaw = (doc as any).projectAssignedTo
    if (typeof projectAssignedToRaw === 'string' && projectAssignedToRaw.trim()) {
      const parts = projectAssignedToRaw.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
      const ids: mongoose.Types.ObjectId[] = []
      for (const part of parts) {
        const oid = resolveToObjectId(part)
        if (oid) {
          ids.push(oid)
        }
        else {
          unmatchedValues.push(`projectAssignedTo: "${part}" (doc ${doc._id})`)
        }
      }
      updates.projectAssignedTo = ids
    }
    else if (!Array.isArray(projectAssignedToRaw)) {
      updates.projectAssignedTo = []
    }

    if (Object.keys(updates).length > 0) {
      await Pipeline.updateOne({ _id: doc._id }, { $set: updates })
      migratedCount++
    }
    else {
      skippedCount++
    }
  }

  return {
    success: true,
    backup: {
      collection: backupName,
      documentCount: backupCount,
      sourceCount,
    },
    migration: {
      totalDocuments: allPipelines.length,
      migrated: migratedCount,
      skipped: skippedCount,
      unmatchedValues,
    },
  }
})
