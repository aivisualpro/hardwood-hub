// POST /api/contracts/templates/seed
// Seeds the Change Order template
import { connectDB } from '../../../utils/mongoose'
import { ContractTemplate } from '../../../models/ContractTemplate'

const CHANGE_ORDER_CONTENT = `<p>This Change Order, made on <span class="template-variable" data-var="change_order_date">{{change_order_date}}</span> modifies the Flooring Contract Agreement <span class="template-variable" data-var="agreement_number">{{agreement_number}}</span> ("Agreement") between the Parties. For the consideration below, <span class="template-variable" data-var="company_name">{{company_name}}</span> will furnish all labor necessary to complete the following changes:</p>
<p></p>
<hr>
<p></p>
<p><strong>Description of Changes:</strong></p>
<p><span class="template-variable" data-var="change_description">{{change_description}}</span></p>
<p></p>
<hr>
<p></p>
<p><strong>Estimated new total:</strong> <span class="template-variable" data-var="estimated_new_total">{{estimated_new_total}}</span></p>
<p></p>
<p>This work is governed by the terms of the Agreement as set forth in the attached itemized invoice. The estimated date for Substantial Completion is <span class="template-variable" data-var="completion_date">{{completion_date}}</span></p>
<p></p>
<hr>
<p></p>
<table>
<tbody>
<tr>
<td><p><strong>Client's Signature</strong></p><p></p><p>________________________________</p></td>
<td><p><strong>Date</strong></p><p></p><p>________________________________</p></td>
</tr>
<tr>
<td><p><strong>Contractor's Signature</strong></p><p></p><p>________________________________</p></td>
<td><p><strong>Date</strong></p><p></p><p>________________________________</p></td>
</tr>
</tbody>
</table>`

const CHANGE_ORDER_VARIABLES = [
    { key: 'change_order_date', label: 'Change Order Date', type: 'date', defaultValue: '', required: true },
    { key: 'agreement_number', label: 'Agreement / Contract #', type: 'text', defaultValue: '', required: true },
    { key: 'company_name', label: 'Company Name', type: 'text', defaultValue: 'Ann Arbor Hardwoods LLC', required: false },
    { key: 'change_description', label: 'Description of Changes', type: 'textarea', defaultValue: '', required: true },
    { key: 'estimated_new_total', label: 'Estimated New Total', type: 'currency', defaultValue: '', required: true },
    { key: 'completion_date', label: 'Substantial Completion Date', type: 'date', defaultValue: '', required: true },
    { key: 'client_name', label: 'Client Name', type: 'text', defaultValue: '', required: true },
    { key: 'change_order_number', label: 'Change Order #', type: 'text', defaultValue: '', required: true },
]

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method !== 'POST') {
        throw createError({ statusCode: 405, message: 'Method not allowed' })
    }

    // Only seed if it doesn't exist
    const existing = await ContractTemplate.findOne({ slug: 'change-order' }).lean()
    if (existing) {
        return { success: true, message: 'Change Order template already exists', data: existing }
    }

    const doc = await ContractTemplate.create({
        name: 'Change Order',
        slug: 'change-order',
        description: 'Modifies an existing Flooring Contract Agreement with specified changes, new total, and completion timeline.',
        content: CHANGE_ORDER_CONTENT,
        variables: CHANGE_ORDER_VARIABLES,
        category: 'Agreements',
        isActive: true,
        createdBy: 'system',
    })

    return { success: true, message: 'Change Order template seeded', data: doc }
})
