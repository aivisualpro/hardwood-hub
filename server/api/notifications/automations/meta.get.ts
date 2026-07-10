/**
 * GET /api/notifications/automations/meta
 * Everything the automation builder UI needs:
 *   - module/submodule/field registry (with live dropdown options resolved)
 *   - active employees for the assignee picker
 */
import { AUTOMATION_REGISTRY } from '../../../utils/automationRegistry'
import { Dropdown } from '../../../models/Dropdown'
import { Employee } from '../../../models/Employee'
import { connectDB } from '../../../utils/mongoose'
import { requireManager } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireManager(event)

  // Collect every dropdown name referenced by the registry, fetch in one query
  const dropdownNames = new Set<string>()
  for (const mod of AUTOMATION_REGISTRY) {
    for (const sub of mod.submodules) {
      for (const f of sub.fields) {
        if (f.dropdown)
          dropdownNames.add(f.dropdown)
      }
    }
  }

  const [dropdowns, employees] = await Promise.all([
    Dropdown.find({ name: { $in: [...dropdownNames] } }).lean(),
    Employee.find({ status: 'Active' }).select('employee email position profileImage').sort({ employee: 1 }).lean(),
  ])

  const ddMap = new Map<string, any[]>(
    dropdowns.map((d: any) => [
      d.name,
      (d.options || [])
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((o: any) => ({ value: String(o._id), label: o.label, color: o.color || '' })),
    ]),
  )

  // Serialize registry with resolved options
  const modules = AUTOMATION_REGISTRY.map(mod => ({
    key: mod.key,
    label: mod.label,
    icon: mod.icon,
    submodules: mod.submodules.map(sub => ({
      key: sub.key,
      label: sub.label,
      icon: sub.icon,
      wired: sub.wired,
      fields: sub.fields.map(f => ({
        key: f.key,
        label: f.label,
        type: f.type,
        options: f.dropdown ? (ddMap.get(f.dropdown) || []) : (f.enum || []),
      })),
    })),
  }))

  return {
    success: true,
    data: {
      modules,
      employees: employees.map((e: any) => ({
        _id: String(e._id),
        name: e.employee,
        email: e.email,
        position: e.position,
        profileImage: e.profileImage || '',
      })),
    },
  }
})
