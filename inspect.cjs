const mongoose = require('mongoose')

async function main() {
  const uri = 'mongodb+srv://michael_db_user:A2HW1234@cluster0.jysjiw.mongodb.net/hardwoodDB'
  await mongoose.connect(uri)
  console.log('Connected to DB')

  const EmployeeSchema = new mongoose.Schema({}, { strict: false })
  const Employee = mongoose.model('Employee', EmployeeSchema, 'hardwoodDB_Employees')

  const employees = await Employee.find().lean()
  console.log('Employees:')
  employees.forEach((e) => {
    console.log({
      _id: e._id,
      employee: e.employee,
      email: e.email,
    })
  })

  await mongoose.disconnect()
}

main().catch(console.error)
