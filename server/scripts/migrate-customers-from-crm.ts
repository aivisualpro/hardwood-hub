// Migrate CrmSubmissions → Customers
// Original: server/api/customers/migrate.post.ts
import { CrmSubmission } from '../models/CrmSubmission'
import { Customer } from '../models/Customer'

/**
 * Run with:
 *   npx tsx server/scripts/migrate-customers-from-crm.ts
 *
 * Requires MONGODB_URI (and any other env vars used by the logic below) to be
 * set in your environment, e.g.:
 *   MONGODB_URI=... npx tsx server/scripts/migrate-customers-from-crm.ts
 *
 * This file was extracted from server/api/customers/migrate.post.ts and is intentionally NOT
 * an HTTP route — it runs once manually and should never be re-added to server/api/.
 */
import 'dotenv/config'
import mongoose from 'mongoose'

async function run() {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI is not set')
    await mongoose.connect(uri)
    console.log('[DB] Connected')

    try {
            // (DB connection handled by run() wrapper above)
      const submissions = await CrmSubmission.find().sort({ createdAt: 1 })
      let count = 0

      for (const sub of submissions) {
        if (!sub.email && !sub.phone) continue

        // Attempt to find existing customer by email or phone
        const filter: any[] = []
        if (sub.email) filter.push({ email: sub.email })
        if (sub.phone) filter.push({ phone: sub.phone })

        let existing = await Customer.findOne({ $or: filter })

        if (!existing) {
          existing = new Customer({
            name: sub.name,
            firstName: sub.firstName,
            lastName: sub.lastName,
            email: sub.email,
            phone: sub.phone,
            address: sub.address,
            city: sub.city,
            state: sub.state,
            zip: sub.zip,
            type: 'lead',
            status: 'new',
            stage: 'contact made',
            tags: ['crm-lead'],
            createdAt: sub.createdAt,
          })
          count++
          await existing.save()
        } else {
          // Update missing fields
          let modified = false
          if (!existing.name && sub.name) { existing.name = sub.name; modified = true }
          if (!existing.firstName && sub.firstName) { existing.firstName = sub.firstName; modified = true }
          if (!existing.lastName && sub.lastName) { existing.lastName = sub.lastName; modified = true }
          if (!existing.address && sub.address) { existing.address = sub.address; modified = true }
          if (!existing.city && sub.city) { existing.city = sub.city; modified = true }
          if (!existing.state && sub.state) { existing.state = sub.state; modified = true }
          if (!existing.zip && sub.zip) { existing.zip = sub.zip; modified = true }

          if (!existing.tags || !existing.tags.includes('crm-lead')) {
            if (!existing.tags) existing.tags = []
            existing.tags.push('crm-lead')
            modified = true
          }

          if (!existing.stage || existing.stage !== 'contact made') {
            existing.stage = 'contact made'
            modified = true
          }

          if (modified) await existing.save()
        }
      }

      return { success: true, count, totalSubmissions: submissions.length }
    } finally {
        await mongoose.disconnect()
        console.log('[DB] Disconnected')
    }
}

run().catch(err => { console.error(err); process.exit(1) })
