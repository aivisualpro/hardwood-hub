import { defineEventHandler, readMultipartFormData } from 'h3'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()
  
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    return { success: false, error: 'No file uploaded' }
  }

  const fileData = formData[0]
  if (!fileData || !fileData.data) {
    return { success: false, error: 'Invalid file data' }
  }

  const csvText = fileData.data.toString('utf-8')
  const rows = csvText.split('\n').filter(Boolean)
  
  if (rows.length < 2) {
    return { success: false, error: 'Empty or invalid CSV file' }
  }

  const headers = rows[0].split(',').map(h => h.trim().toLowerCase())
  const customersToInsert = []

  for (let i = 1; i < rows.length; i++) {
    // using a simple CSV parser
    const row = rows[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    
    // Nothing is required! So we just map any fields found
    const customerData: any = {}
    
    const safeDate = (v: string) => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }

    headers.forEach((header, index) => {
      const val = row[index]
      if (!val) return

      // map common variants to the schema
      if (header.includes('first') && header.includes('name')) customerData.firstName = val
      else if (header.includes('last') && header.includes('name')) customerData.lastName = val
      else if (header === 'name') customerData.name = val
      else if (header === 'email') customerData.email = val
      else if (header === 'phone') customerData.phone = val
      else if (header === 'address') customerData.address = val
      else if (header === 'city') customerData.city = val
      else if (header === 'state') customerData.state = val
      else if (header === 'zip') customerData.zip = val
      else if (header === 'stage') customerData.stage = val
      else if (header.includes('duration') || header.includes('estimated project duration')) customerData.estimatedProjectDuration = val
      else if (header.includes('total estimate')) customerData.totalEstimate = parseFloat(val) || null
      else if (header === 'assigned to') customerData.assignedTo = val
      else if (header.includes('total tracked views')) customerData.totalTrackedViews = parseInt(val) || 0
      else if (header.includes('estimate sent on')) customerData.estimateSentOn = safeDate(val)
      else if (header.includes('initial contact date')) customerData.initialContactDate = safeDate(val)
      else if (header.includes('last follow up')) customerData.lastFollowUpSentOn = safeDate(val)
      else if (header.includes('date approved')) customerData.dateApproved = safeDate(val)
      else if (header.includes('project assigned to')) customerData.projectAssignedTo = val
      else if (header.includes('wood order date')) customerData.woodOrderDate = safeDate(val)
      else if (header === 'notes') customerData.notes = val
      else if (header === 'tags') customerData.tags = val.split(';').map(t => t.trim())
    })

    customersToInsert.push(customerData)
  }

  if (customersToInsert.length > 0) {
    await Customer.insertMany(customersToInsert)
  }

  return { success: true, count: customersToInsert.length }
})
