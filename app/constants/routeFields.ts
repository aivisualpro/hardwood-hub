/**
 * ROUTE_FIELDS — field registry for field-level security
 *
 * Lists the gateable fields per menu route. Each entry defines a field key
 * (matching the API/model property name) and a human-readable label for the
 * workspace editor UI.
 *
 * Rules:
 * - Only list fields that make sense to gate (user-editable, business-sensitive)
 * - Never list internal/sensitive tokens (gmailTokens, calendarTokens, sessionEpoch)
 * - Never list system fields (_id, createdAt, updatedAt)
 */
export const ROUTE_FIELDS: Record<string, { key: string, label: string }[]> = {
  '/hr/employees': [
    { key: 'employee', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'position', label: 'Position' },
    { key: 'status', label: 'Status' },
    { key: 'workspace', label: 'Workspace' },
    { key: 'basePay', label: 'Base Pay' },
  ],

  '/crm/pipeline': [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'status', label: 'Status' },
    { key: 'totalEstimate', label: 'Total Estimate' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'notes', label: 'Notes' },
  ],

  '/crm/products': [
    { key: 'sku', label: 'SKU' },
    { key: 'description', label: 'Description' },
    { key: 'salesPrice', label: 'Sales Price' },
    { key: 'costPrice', label: 'Cost Price' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'type', label: 'Type' },
    { key: 'unit', label: 'Unit' },
  ],

  '/tasks': [
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'assignees', label: 'Assignees' },
    { key: 'dueDate', label: 'Due Date' },
  ],

  '/crm/contracts': [
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'content', label: 'Content' },
    { key: 'notes', label: 'Notes' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'customerEmail', label: 'Customer Email' },
  ],
}
