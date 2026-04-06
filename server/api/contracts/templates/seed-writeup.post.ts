import { connectDB } from '../../../utils/mongoose'
import { ContractTemplate } from '../../../models/ContractTemplate'

const CONTENT = `
<style>
  .wu-table { width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 14px; }
  .wu-table th, .wu-table td { border: 1px solid #ccc; padding: 8px 12px; }
  .wu-header { background-color: #374151; color: white; text-align: center; font-weight: bold; font-size: 16px; letter-spacing: 0.5px; }
  .wu-label { font-weight: bold; width: 20%; color: #111827; }
  .wu-val { width: 30%; color: #4b5563; }
</style>

<h2 style="font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 12px;">Employee Write Up</h2>

<table class="wu-table">
  <tr>
    <td colspan="4" class="wu-header">Employee Information</td>
  </tr>
  <tr>
    <td class="wu-label">Employee Name:</td>
    <td class="wu-val"><span class="template-variable" data-var="employee_name">{{employee_name}}</span></td>
    <td class="wu-label">Date:</td>
    <td class="wu-val"><span class="template-variable" data-var="writeup_date">{{writeup_date}}</span></td>
  </tr>
  <tr>
    <td class="wu-label">Employee ID:</td>
    <td class="wu-val"><span class="template-variable" data-var="employee_id">{{employee_id}}</span></td>
    <td class="wu-label">Job Title:</td>
    <td class="wu-val"><span class="template-variable" data-var="job_title">{{job_title}}</span></td>
  </tr>
  <tr>
    <td class="wu-label">Manager:</td>
    <td class="wu-val"><span class="template-variable" data-var="manager_name">{{manager_name}}</span></td>
    <td class="wu-label">Department:</td>
    <td class="wu-val"><span class="template-variable" data-var="department">{{department}}</span></td>
  </tr>

  <tr>
    <td colspan="4" class="wu-header">Type of Warning</td>
  </tr>
  <tr>
    <td colspan="4" style="color: #4b5563;">
      <span class="template-variable" data-var="warning_type">{{warning_type}}</span>
    </td>
  </tr>

  <tr>
    <td colspan="4" class="wu-header">Type of Offenses</td>
  </tr>
  <tr>
    <td colspan="4" style="color: #4b5563;">
      <span class="template-variable" data-var="offenses">{{offenses}}</span>
      <br><br>
      <strong>Other Details:</strong> <span class="template-variable" data-var="other_offense">{{other_offense}}</span>
    </td>
  </tr>

  <tr>
    <td colspan="4" class="wu-header">Details</td>
  </tr>
  <tr>
    <td colspan="4">
      <p style="margin: 0 0 8px 0;"><strong>Description of Infraction:</strong></p>
      <p style="white-space: pre-wrap; color: #4b5563; margin-bottom: 24px;"><span class="template-variable" data-var="infraction_desc">{{infraction_desc}}</span></p>
      
      <p style="margin: 0 0 8px 0;"><strong>Plan for Improvement:</strong></p>
      <p style="white-space: pre-wrap; color: #4b5563; margin-bottom: 24px;"><span class="template-variable" data-var="improvement_plan">{{improvement_plan}}</span></p>

      <p style="margin: 0 0 8px 0;"><strong>Consequences of Infractions:</strong></p>
      <p style="white-space: pre-wrap; color: #4b5563; margin-bottom: 12px;"><span class="template-variable" data-var="consequences">{{consequences}}</span></p>
    </td>
  </tr>

  <tr>
    <td colspan="4" class="wu-header">Acknowledgment of Receipt of Warnings</td>
  </tr>
  <tr>
    <td colspan="4">
      <p style="font-size: 13px; color: #374151; margin: 10px 0 30px 0;">
        By signing this form, you confirm that you understand the information in this warning. You also confirm that you and your manager have discussed the warning and a plan for improvement. Signing this form does not necessarily indicate that you agree with this warning.
      </p>
      
      <table style="width: 100%; border: none;">
        <tr>
          <td style="border: none; padding: 0; width: 45%;">
            <div style="border-bottom: 1px solid #111; min-height: 50px; position: relative;">
               <!-- System automatically renders Employee Signature below the document -->
               <div style="color: #9ca3af; font-size: 11px; padding: 10px;">(Employee Signature will populate automatically below)</div>
            </div>
            <p style="font-size: 12px; margin: 4px 0 0 0; color: #111;">Employee Signature</p>
          </td>
          <td style="border: none; width: 10%;"></td>
          <td style="border: none; padding: 0; width: 45%;">
            <div style="border-bottom: 1px solid #111; min-height: 50px;"></div>
            <p style="font-size: 12px; margin: 4px 0 0 0; color: #111;">Date</p>
          </td>
        </tr>
      </table>

      <br><br>

      <table style="width: 100%; border: none;">
        <tr>
          <td style="border: none; padding: 0; width: 45%;">
            <div style="border-bottom: 1px solid #111; min-height: 50px; display: flex; align-items: flex-end;">
              <span class="template-variable" data-var="manager_signature">{{manager_signature}}</span>
            </div>
            <p style="font-size: 12px; margin: 4px 0 0 0; color: #111;">Manager Signature</p>
          </td>
          <td style="border: none; width: 10%;"></td>
          <td style="border: none; padding: 0; width: 45%;">
            <div style="border-bottom: 1px solid #111; min-height: 50px; display: flex; align-items: flex-end;">
              <span class="template-variable" data-var="writeup_date">{{writeup_date}}</span>
            </div>
            <p style="font-size: 12px; margin: 4px 0 0 0; color: #111;">Date</p>
          </td>
        </tr>
      </table>
      <br>
    </td>
  </tr>
</table>
`

const VARIABLES = [
    { key: 'employee_name', label: 'Employee Name (Client)', type: 'text', defaultValue: '', required: true },
    { key: 'writeup_date', label: 'Write Up Date', type: 'date', defaultValue: '', required: true },
    { key: 'employee_id', label: 'Employee ID', type: 'text', defaultValue: '', required: false },
    { key: 'job_title', label: 'Job Title', type: 'text', defaultValue: '', required: false },
    { key: 'manager_name', label: 'Manager Name', type: 'text', defaultValue: '', required: true },
    { key: 'department', label: 'Department', type: 'text', defaultValue: '', required: false },
    { key: 'warning_type', label: 'Type of Warning (First/Second/Final)', type: 'text', defaultValue: 'First Warning', required: true },
    { key: 'offenses', label: 'Offenses (Tardiness, Substandard Work, etc)', type: 'text', defaultValue: '', required: true },
    { key: 'other_offense', label: 'Other Offense Details', type: 'text', defaultValue: 'N/A', required: false },
    { key: 'infraction_desc', label: 'Description of Infraction', type: 'textarea', defaultValue: '', required: true },
    { key: 'improvement_plan', label: 'Plan for Improvement', type: 'textarea', defaultValue: '', required: true },
    { key: 'consequences', label: 'Consequences of Infractions', type: 'textarea', defaultValue: '', required: true },
    { key: 'manager_signature', label: 'Manager Signature', type: 'signature', defaultValue: '', required: true },
]

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method !== 'POST') {
        throw createError({ statusCode: 405, message: 'Method not allowed' })
    }

    const doc = await ContractTemplate.findOneAndUpdate(
      { slug: 'employee-write-up' },
      {
        name: 'Employee Write Up',
        slug: 'employee-write-up',
        description: 'Standard multi-step employee disciplinary write-up form with manager and employee signatures.',
        content: CONTENT,
        variables: VARIABLES,
        category: 'HR',
        isActive: true,
        createdBy: 'system',
      },
      { upsert: true, new: true }
    )

    return { success: true, message: 'Employee Write Up template seeded', data: doc }
})
