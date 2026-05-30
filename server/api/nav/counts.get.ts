import { ActivityLog } from '../../models/ActivityLog'
import { Category } from '../../models/Category'
import { Contract } from '../../models/Contract'
import { CrmSubmission } from '../../models/CrmSubmission'
import { Customer } from '../../models/Customer'
import { DailyProduction } from '../../models/DailyProduction'
import { Employee } from '../../models/Employee'
import { Pipeline } from '../../models/Pipeline'
import { Product } from '../../models/Product'
import { ProjectCommunication } from '../../models/ProjectCommunication'
import { Skill } from '../../models/Skill'
import { StainSignOff } from '../../models/StainSignOff'
import { Task } from '../../models/Task'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()

  const [
    totalCategory,
    totalSkills,
    unreadActivities,
    totalEmployees,
    totalTasks,
    totalProjComm,
    totalDailyProd,
    totalCustomers,
    totalClients,
    totalContracts,
    totalStainSignOff,
    totalProducts,
    totalsByType,
  ] = await Promise.all([
    Category.countDocuments(),
    Skill.countDocuments(),
    ActivityLog.countDocuments({ isRead: false }),
    Employee.countDocuments(),
    Task.countDocuments(),
    ProjectCommunication.countDocuments(),
    DailyProduction.countDocuments(),
    Pipeline.countDocuments(),
    Customer.countDocuments(),
    Contract.countDocuments(),
    StainSignOff.countDocuments(),
    Product.countDocuments(),
    CrmSubmission.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ])

  const crmCounts: Record<string, number> = {}
  for (const r of totalsByType) {
    crmCounts[r._id] = r.count
  }

  const counts: Record<string, number> = {
    '/admin/category-tree': totalCategory,
    '/admin/skills': totalSkills,
    '/admin/activities': unreadActivities,
    '/hr/employees': totalEmployees,
    '/tasks': totalTasks,
    '/project-communication': totalProjComm,
    '/daily-production': totalDailyProd,
    '/crm/pipeline': totalCustomers,
    '/crm/customers': totalClients,
    '/crm/products': totalProducts,
    '/crm/contracts': totalContracts,
    '/external/stain-sign-off': totalStainSignOff,
    '/crm/appointments': crmCounts.appointment || 0,
    '/crm/flooring-estimate': crmCounts['flooring-estimate'] || 0,
  }

  return {
    success: true,
    data: counts,
  }
})
