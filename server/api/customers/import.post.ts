import { defineEventHandler, readMultipartFormData } from 'h3'
import { Customer } from '../../models/Customer'
import { connectDB } from '../../utils/mongoose'

function parseCSV(text: string) {
  let isInsideQuote = false;
  let currentToken = '';
  let currentRow: string[] = [];
  const rows: string[][] = [];
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i+1];
    
    if (char === '"') {
      if (isInsideQuote && nextChar === '"') {
        currentToken += '"';
        i++; // skip next quote
      } else {
        isInsideQuote = !isInsideQuote;
      }
    } else if (char === ',' && !isInsideQuote) {
      currentRow.push(currentToken.trim());
      currentToken = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !isInsideQuote) {
      if (char === '\r') i++;
      currentRow.push(currentToken.trim());
      if (currentRow.some(c => c)) rows.push(currentRow); // only push if not empty line
      currentRow = [];
      currentToken = '';
    } else {
      currentToken += char;
    }
  }
  
  // push remaining
  if (currentToken !== '' || text[text.length-1] === ',') {
     currentRow.push(currentToken.trim());
  }
  if (currentRow.length > 0 && currentRow.some(c => c)) {
      rows.push(currentRow);
  }
  return rows;
}

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
  const rows = parseCSV(csvText)
  
  if (rows.length < 2) {
    return { success: false, error: 'Empty or invalid CSV file' }
  }

  const headers = rows[0].map(h => h.toLowerCase())
  const customersToInsert = []

  const safeDate = (v: string) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length === 0 || !row.some(x => x)) continue;
    
    const customerData: any = {}
    
    headers.forEach((header, index) => {
      const val = row[index]
      if (val === undefined || val === '') return

      if (header === 'name') customerData.name = val
      else if (header === 'stage') customerData.stage = val
      else if (header === 'estimated project duration') customerData.estimatedProjectDuration = val
      else if (header === 'total estimate') customerData.totalEstimate = parseFloat(val.replace(/[^0-9.-]+/g,"")) || null
      else if (header === 'assigned to') customerData.assignedTo = val
      else if (header === 'total tracked views') customerData.totalTrackedViews = parseInt(val.replace(/[^0-9-]+/g,"")) || 0
      else if (header === 'estimate sent on') customerData.estimateSentOn = safeDate(val)
      else if (header === 'notes') customerData.notes = val
      else if (header === 'inital contact date' || header === 'initial contact date') customerData.initialContactDate = safeDate(val)
      else if (header === 'last follow up sent on' || header === 'last follow up') customerData.lastFollowUpSentOn = safeDate(val)
      else if (header === 'date approved') customerData.dateApproved = safeDate(val)
      else if (header === 'project assigned to:' || header === 'project assigned to') customerData.projectAssignedTo = val
      else if (header === 'wood order date') customerData.woodOrderDate = safeDate(val)
    })

    if (Object.keys(customerData).length > 0) {
      customersToInsert.push(customerData)
    }
  }

  if (customersToInsert.length > 0) {
    await Customer.insertMany(customersToInsert)
  }

  return { success: true, count: customersToInsert.length }
})
