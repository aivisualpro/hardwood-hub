import { defineEventHandler } from 'h3'
import { CrmSubmission } from '../../models/CrmSubmission'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async () => {
  await connectDB()
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
        stage: 'subscribers',
        tags: ['subscribers'],
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
      
      if (!existing.tags || !existing.tags.includes('subscribers')) {
        if (!existing.tags) existing.tags = []
        existing.tags.push('subscribers')
        modified = true
      }
      
      if (!existing.stage || existing.stage !== 'subscribers') {
        existing.stage = 'subscribers'
        modified = true
      }
      
      if (modified) await existing.save()
    }
  }

  return { success: true, count, totalSubmissions: submissions.length }
})
