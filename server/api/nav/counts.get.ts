import { ActivityLog } from '../../models/ActivityLog'
import { Category } from '../../models/Category'
import { ChangeOrder } from '../../models/ChangeOrder'
import { Contract } from '../../models/Contract'
import { CrmSubmission } from '../../models/CrmSubmission'
import { Customer } from '../../models/Customer'
import { DailyProduction } from '../../models/DailyProduction'
import { Employee } from '../../models/Employee'
import { Estimate } from '../../models/Estimate'
import { LearningResource } from '../../models/LearningResource'
import { Pipeline } from '../../models/Pipeline'
import { Product } from '../../models/Product'
import { ProjectCommunication } from '../../models/ProjectCommunication'
import { Skill } from '../../models/Skill'
import { StainSignOff } from '../../models/StainSignOff'
import { Task } from '../../models/Task'
import { Notification } from '../../models/Notification'
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  await connectDB()

  // Per-user unread notifications count (for the sidebar bell badge)
  const sessionId = (event.context as any).session?.id
  const unreadNotifications = sessionId
    ? await Notification.countDocuments({ recipientId: sessionId, readAt: null })
    : 0

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
    totalEstimates,
    totalChangeOrders,
    learningCounts,
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
    Estimate.countDocuments(),
    ChangeOrder.countDocuments(),
    LearningResource.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    CrmSubmission.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ])

  const crmCounts: Record<string, number> = {}
  for (const r of totalsByType) {
    crmCounts[r._id] = r.count
  }

  // Build learning center category lookup
  const lcCounts: Record<string, number> = {}
  for (const r of learningCounts) {
    lcCounts[r._id] = r.count
  }

  const counts: Record<string, number> = {
    '/notifications': unreadNotifications,
    '/admin/category-tree': totalCategory,
    '/admin/skills': totalSkills,
    '/admin/activities': unreadActivities,
    '/hr/employees': totalEmployees,
    '/tasks': totalTasks,
    '/project-communication': totalProjComm,
    '/daily-production': totalDailyProd,
    '/stain-sign-off': totalStainSignOff,
    '/crm/pipeline': totalCustomers,
    '/crm/customers': totalClients,
    '/crm/products': totalProducts,
    '/crm/estimates': totalEstimates,
    '/crm/contracts': totalContracts,
    '/crm/quickquotes': crmCounts['flooring-estimate'] || 0,
    '/crm/change-orders': totalChangeOrders,
    '/external/stain-sign-off': totalStainSignOff,
    '/crm/appointments': crmCounts.appointment || 0,
    '/crm/flooring-estimate': crmCounts['flooring-estimate'] || 0,
    // Learning Center sub-pages
    '/learning-center/skill-guide': lcCounts['app-skill-guide'] || 0,
    '/learning-center/video-resources': lcCounts['video-resources'] || 0,
    '/learning-center/nwfa-documentation': lcCounts['nwfa-documentation'] || 0,
    '/learning-center/installation-guidelines': lcCounts['installation-guidelines'] || 0,
  }

  return {
    success: true,
    data: counts,
  }
})
