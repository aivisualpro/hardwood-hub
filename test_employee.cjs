const dotenv = require('dotenv')
const mongoose = require('mongoose')

dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || 'mongodb+srv://michael_db_user:A2HW1234@cluster0.jysjiw.mongodb.net/hardwoodDB'

async function main() {
  await mongoose.connect(MONGO_URI)

  // Register the schema exactly as defined in server/models/Employee.ts
  const EmployeeSchema = new mongoose.Schema(
    {
      employee: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      position: { type: String, required: true, trim: true },
      profileImage: { type: String, default: '' },
      status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
      workspace: { type: String, default: '' },
      basePay: { type: Number, default: 0 },
      gmailTokens: { type: String, default: '' },
      gmailEmail: { type: String, default: '' },
    },
    { timestamps: true, collection: 'hardwoodDB_Employees' },
  )

  const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema)

  const emp = await Employee.findById('69a8e3941ed653889cfc1406').lean()
  console.log('Employee findById result:', emp)

  await mongoose.disconnect()
}

main().catch(console.error)
