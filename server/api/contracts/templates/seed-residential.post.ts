import { connectDB } from '../../../utils/mongoose'
import { ContractTemplate } from '../../../models/ContractTemplate'

const CONTENT = `
<div>
  <p style="text-align: right;"><strong>Flooring Service Contract #</strong><span class="template-variable" data-var="contract_number">{{contract_number}}</span></p>

  <p>This Contract for Services is made effective as of <span class="template-variable" data-var="effective_date">{{effective_date}}</span>,</p>

  <p>by and between Service Recipient, <span class="template-variable" data-var="client_name">{{client_name}}</span></p>

  <p>and Ann Arbor Hardwoods LLC ("Ann Arbor Hardwoods") of 3868 Trade Center Dr., Ann Arbor, Michigan 48108.</p>

  <h3>1. DESCRIPTION OF SERVICES.</h3>
  <p>Beginning on <span class="template-variable" data-var="work_start_date">{{work_start_date}}</span>, work will start. Ann Arbor Hardwoods will provide the Service Recipient with the flooring services described in the attached Exhibit (collectively, the "Services") Estimate and/or Invoice # <span class="template-variable" data-var="estimate_invoice_number">{{estimate_invoice_number}}</span></p>

  <p>Additional dates: <span class="template-variable" data-var="additional_dates">{{additional_dates}}</span></p>

  <p>Wood Delivery date. If applicable: <span class="template-variable" data-var="wood_delivery_date">{{wood_delivery_date}}</span></p>

  <p>Contractor shall complete this work on or before: <span class="template-variable" data-var="completion_date">{{completion_date}}</span>, pending no changes.</p>

  <h3>1. SCOPE OF WORK.</h3>
  <p>Contractor shall perform all work necessary for the completion of the flooring services specified in this Contract. Any drawings and specifications signed by both the Service Recipient and the Contractor are hereby made a part of this Contract. The Contractor hereby agrees to provide services for the installation and or sanding of flooring on an ongoing basis during the term of this agreement, for the Service Recipient in accordance with the Service Recipient's specifications in the Description of Services clause. The said installation will take place at the following address:</p>
  <p><span class="template-variable" data-var="installation_address">{{installation_address}}</span></p>

  <p><strong>Description of the Services</strong></p>
  <p>The Contractor agrees to provide the following goods and services (collectively "Services") to the Customer described in detail below or more specifically outlined in Exhibit A of this Agreement:</p>
  <p><span class="template-variable" data-var="service_description">{{service_description}}</span></p>

  <h3>2. POLICIES AND EXPECTATIONS:</h3>

  <h4 style="text-decoration: underline;">HOME PREPARATION</h4>
  <p><strong>Initials:</strong> <span class="template-variable" data-var="initials_home_prep">{{initials_home_prep}}</span></p>
  <p><strong>Appliance Preparation</strong></p>
  <p>a) A2HW may move your fridge or stove only if listed as a line item on your invoice. We do not disconnect or reconnect water lines, gas lines, toilets, or similar utilities. A licensed plumber may be required for those tasks.</p>
  <p><strong>Furniture and Wall Item Preparation</strong></p>
  <p>a) A2HW does not move furniture unless purchased as a service. All furniture and wall-mounted items (pictures, shelves, d&eacute;cor, etc.) must be removed from work areas. Sanding and installation vibrations may cause damage to items left in place.</p>
  <p>b) Local movers for assistance:<br>
  <span style="background-color: yellow;">Handle with Care (pianos): (737) 677-2000</span><br>
  <span style="background-color: yellow;">Two Men and a Truck: (734) 418-0575</span></p>
  <p><strong>Dust, Debris, and Seasonal Conditions</strong></p>
  <p>a) A2HW uses a dustless system, but some dust will still occur. If working above an unfinished basement, debris may fall through; drop cloths are recommended.</p>
  <p>b) In winter, sawdust will cling to snow and cannot be blown away. If you want to avoid sawdust outdoors, please provide an indoor cutting location (typically a garage).</p>
  <p><strong>Pet Safety</strong></p>
  <p>a) A2HW is not responsible for securing or managing pets. Pet hair may appear in the finish if pets are present in the home.</p>
  <p><strong>Parking and Walkway Safety</strong></p>
  <p>a) A2HW requires a parking space for a 6x12 trailer or work van. In snow or icy conditions, walkways and driveways must be shoveled and maintained to ensure safe access and prevent property damage.</p>
  <p><strong>Water Access for Tool Cleaning</strong></p>
  <p>a) A2HW will need access to water to clean tools used with water-based finishes. Please direct crews to your preferred location.</p>

  <h4 style="text-decoration: underline;">ACCESS REQUIREMENTS</h4>
  <p><strong>Initials:</strong> <span class="template-variable" data-var="initials_access">{{initials_access}}</span></p>
  <p><strong>Home and Electrical Access</strong></p>
  <p>a) A2HW requires access to your breaker panel and will bring a compatible breaker. If no empty breaker slot is available, we may temporarily use one connected to an appliance (such as a dryer or stove).</p>
  <p>b) Clients must provide access to all work areas, whether they are home or away. If away, a door code or lockbox key must be provided prior to the project start date.</p>

  <h4 style="text-decoration: underline;">HOMEOWNER RESPONSIBILITIES AND LIABILITY</h4>
  <p><strong>Initials:</strong> <span class="template-variable" data-var="initials_homeowner_resp">{{initials_homeowner_resp}}</span></p>
  <p><strong>Pre-Existing Conditions (Installation Issues, Wood Contamination and Building Code Compliance)</strong></p>
  <p>a) A2HW is not liable for any pre-existing conditions that affect the outcome of your flooring project. These conditions include, but are not limited to: improper nailing schedules, incorrect fasteners, inadequate subfloor thickness, oils, salts, pet stains, cleaning residues, or other contaminants that may interfere with stain or finish curing, and any structural or installation issues resulting from the home not being built or maintained to the Michigan building code.</p>
  <p>b) Any corrective work required due to these conditions &mdash; including repairs needed because the home does not meet Michigan building code standards &mdash; is the client's financial responsibility.</p>
  <p><strong>Wall, Trim, and Surface Touch-Ups</strong></p>
  <p>a) Paint touch-ups may be needed due to machine contact. When removing base or shoe mouldings, some brittle materials may break. Replacement of mouldings and any additional trips required are the homeowner's responsibility.</p>

  <h3>3. PAYMENT.</h3>
  <p>Payment shall be made to: Ann Arbor Hardwoods LLC. And mailed to: <strong>992 Rue Willette, Ypsilanti, Michigan 48198</strong>. (Home Office) The Service Recipient agrees to pay Ann Arbor Hardwoods as follows:</p>
  <p><span style="background-color: yellow;">All Projects:</span></p>
  <p>A deposit in the amount of $ <span class="template-variable" data-var="deposit_amount">{{deposit_amount}}</span> is Due <span class="template-variable" data-var="deposit_due_date">{{deposit_due_date}}</span></p>
  <p>Sign this Contract within 7 days of creation to secure your project start date. Failure to sign within 7 days will result in the loss of your reserved dates as stated in this contract.</p>
  <p>The Remaining balance of $ <span class="template-variable" data-var="remaining_balance">{{remaining_balance}}</span> is to be paid in Full upon completion of your Project. <span style="background-color: #00ff00;">Unless you have projects exceeding 1 week, there may be draw payments</span> as follows:</p>
  <p>Draw 1. <span class="template-variable" data-var="draw_1">{{draw_1}}</span></p>
  <p>Draw 2. <span class="template-variable" data-var="draw_2">{{draw_2}}</span></p>
  <p>Draw 3. <span class="template-variable" data-var="draw_3">{{draw_3}}</span></p>
  <p>Draw 4. <span class="template-variable" data-var="draw_4">{{draw_4}}</span></p>
  <p>In addition to any other right or remedy provided by law, if Service Recipient fails to pay for the services when due, Ann Arbor Hardwoods has the option to treat such failure to pay as a material breach of this Contract and may cancel this Contract and/or seek legal remedies. Any legal fees incurred by Ann Arbor Hardwoods for breach of contract will be charged to the Service Recipient. Any payments past 5 days of the agreed payment schedule will be grounds for termination of the contract. Any balances 5 days past due will incur interest.</p>

  <h3>4. CONFIDENTIALITY</h3>
  <p>Under this Agreement, Customer may provide certain confidential Information or Non-Public Personal Information ("Confidential Information") to the Contractor. The contractor will not disclose any Confidential Information to any third party except to those employees or agents of the Contractor who are required to have such information for purposes under this Agreement. The contractor shall take reasonable measures to protect the secrecy of and avoid disclosure and unauthorized use of Confidential Information. Without limiting the foregoing, the Contractor shall take at least those measures that it employs to protect its own confidential information of a similar nature and shall ensure that its employees and/or agents who have access to Confidential Information employ reasonable measures to protect the secrecy and avoid disclosure and any unauthorized use.</p>

  <h3>5. TERM.</h3>
  <p>This Contract will terminate automatically upon completion by Ann Arbor Hardwoods of the Services required by this Contract.</p>

  <h3>6. INSURANCE.</h3>
  <p>The contractor shall maintain general liability & workers' compensation. A certificate of insurance can be provided at no cost. Any additional insured requesting certificates can be provided for an additional fee.</p>

  <h3>7. WARRANTY.</h3>
  <p>Ann Arbor Hardwoods shall provide its services and meet its obligations under this Contract in a timely and workmanlike manner, using knowledge and recommendations for performing the services that meet Industry Standards set by the National Wood Flooring Association guidelines for installation, sanding, and refinishing. <strong>All projects come with a one-year limited warranty on craftsmanship only. The warranty does not cover dents or scratches caused by dropped or dragged items, dog nails, spills, water damage, climate-related issues, or chemical-related contamination. The warranty does not cover manufacturing defects or product-related issues.</strong></p>

  <h3>8. DEFAULT.</h3>
  <p>The occurrence of any of the following shall constitute a material default under this Contract:</p>
  <ol type="a">
    <li>The failure to make the required payment when due.</li>
    <li>The insolvency or bankruptcy of either party</li>
    <li>The subjection of any of either party's property to any levy, seizure, general assignment for the benefit of creditors, application or sale for or by any creditor or government agency</li>
    <li>The failure to make available or deliver the Services in the time and manner provided for in this Contract.</li>
  </ol>

  <h3>9. REMEDIES.</h3>
  <p>In addition to any and all other rights a party may have available according to law, if a party defaults by failing to substantially perform any provision, term or condition of this Contract (including without limitation the failure to make a monetary payment when due), the other party may terminate the Contract by providing written notice to the defaulting party. This notice shall describe with sufficient detail the nature of the default. The party receiving such notice shall have 7 days from the effective date of such notice to cure the default(s). Unless waived by a party providing notice, the failure to cure the default(s) within such time period shall result in the automatic termination of this Contract.</p>

  <h3>10. FORCE MAJEURE.</h3>
  <p>If performance of this Contract or any obligation under this Contract is prevented, restricted, or interfered with by causes beyond either party's reasonable control ("Force Majeure"), and if the party unable to carry out its obligations gives the other party prompt written notice of such event, then the obligations of the party invoking this provision shall be suspended to the extent necessary by such event. The term Force Majeure shall include, without limitation, acts of God, fire, explosion, vandalism, storm or other similar occurrence, orders or acts of military or civil authority, or by national emergencies, insurrections, riots, or wars, or strikes, lockouts, work stoppages, or supplier failures. The excused party shall use reasonable efforts under the circumstances to avoid or remove such causes of non-performance and shall proceed to perform with reasonable dispatch whenever such causes are removed or ceased. An act or omission shall be deemed within the reasonable control of a party if committed, omitted, or caused by such party, or its employees, officers, agents, or affiliates.</p>

  <h3>11. ARBITRATION.</h3>
  <p>Any controversies or disputes arising out of or relating to this Contract shall be resolved by binding arbitration in accordance with the then-current Commercial Arbitration Rules of the American Arbitration Association. The parties shall select a mutually acceptable arbitrator knowledgeable about issues relating to the subject matter of this Contract. In the event the parties are unable to agree to such a selection, each party will select an arbitrator and the two arbitrators in turn shall select a third arbitrator, all three of whom shall preside jointly over the matter. The arbitration shall take place at a location that is reasonably centrally located between the parties, or otherwise mutually agreed upon by the parties. All documents, materials, and information in the possession of each party that are in any way relevant to the dispute shall be made available to the other party for review and copying no later than 30 days after the notice of arbitration served. The arbitrator(s) shall not have the authority to modify any provision of this Contract or to award punitive damages. The arbitrator(s) shall have the power to issue mandatory orders and restraint orders in connection with the arbitration. The decision rendered by the arbitrator(s) shall be final and binding on the parties, and judgment may be entered in conformity with the decision in any court having jurisdiction. The agreement to arbitration shall be specifically enforceable under the prevailing arbitration law. During the continuance of any arbitration proceeding, the parties shall continue to perform their respective obligations under this Contract.</p>

  <h3>12. ENTIRE AGREEMENT.</h3>
  <p>This Contract contains the entire agreement of the parties, and there are no other promises or conditions in any other agreement whether oral or written concerning the subject matter of this Contract. This Contract supersedes any prior written or oral agreements between the parties.</p>

  <h3>13. SEVERABILITY.</h3>
  <p>If any provision of this Contract will be held to be invalid or unenforceable for any reason, the remaining provisions will continue to be valid and enforceable. Suppose a court finds that any provision of this Contract is invalid or unenforceable, but that by limiting such provision it would become valid and enforceable. In that case, such provision will be deemed to be written, construed, and enforced as so limited.</p>

  <h3>14. AMENDMENT.</h3>
  <p>This Contract may be modified or amended in writing, if the writing is signed by the party obligated under the amendment.</p>

  <h3>15. GOVERNING LAW.</h3>
  <p>This Contract shall be construed in accordance with the laws of the State of Michigan.</p>

  <h3>16. NOTICE.</h3>
  <p>Any notice or communication required or permitted under this Contract shall be sufficiently given if delivered in person or by certified mail, return receipt requested, to the address set forth in the opening paragraph or to such other address as one party may have furnished to the other in writing.</p>

  <h3>17. WAIVER OF CONTRACTUAL RIGHT.</h3>
  <p>The failure of either party to enforce any provision of this Contract shall not be construed as a waiver or limitation of that party's right to subsequently enforce and compel strict compliance with every provision of this Contract.</p>

  <h3>18. ADVERTISEMENT</h3>
  <p>Ann Arbor Hardwoods may take pictures of the project, before, during, and after, for use in advertising, promotional materials, and displays. No personal information, such as physical location or personal photos, will be used.</p>

  <h3>19. SIGNATORIES.</h3>
  <p>This Contract shall be executed on behalf of the Service Recipient by <span class="template-variable" data-var="client_name">{{client_name}}</span> and on behalf of Ann Arbor Hardwoods LLC by Michael Cornaire or Nicole Cornaire, Owners. The Contract shall be effective as of the date first written above.</p>

  <h3>20. CHANGES TO THE PROJECT OR PRICE.</h3>
  <p>Service Recipient may not make changes to the project without the Contractor's agreement. The Service Recipient must request any desired change in a timely manner to permit scheduling and completion with minimal interruption and cost increase. The cost to complete the project may increase or decrease due to: (a) changes to the project agreed to by the parties; (b) latent defects in the existing structure, "subfloor or joists" inadequate structural support, or termite/wood rot or other damage to the existing structure.) that could not reasonably have been observed by the Contractor before the work. If a latent structural defect is discovered, the Contractor will provide the Service Recipient with notice and may prepare an estimate of the anticipated increase in project costs. The parties will agree to a change to the project or cost and may be memorialized in a written Change Order in a form substantially. For any change requested by the Service Recipient or of the type described above, whether a Change Order is executed, the Service Recipient will reimburse the Contractor for all labor and material expenses and reasonable profit and overhead.</p>

  <h3>21. All EXHIBITS AND ADDENDA.</h3>
  <p>All exhibits and other documents attached hereto or referred to herein are hereby incorporated in and shall become a part of this Agreement.</p>

  <h3>22. DELAYS</h3>
  <p>Ann Arbor Hardwoods Reserves the right to delay or reschedule with proper notice and reasonable cause. The Contractor will not be held responsible for delays or rescheduling of the project due to climate-related issues such as improper moisture readings, structural issues, or accessibility, including but not limited to furniture in working areas, weather-related conditions, and power outages. The Contractor may give written or verbal notice of the anticipated delay in the project, extending the completion date.</p>

  <p>Service Recipient</p>
  <p>By______________________________________</p>
  <p>Date________________</p>
  <p>Contractor Ann Arbor Hardwoods</p>
  <p>By ______________________________________</p>
  <p>Date________________</p>
  <p>Owners Michael and Nicole Cornaire</p>

  <hr style="margin: 30px 0;">

  <h3 style="text-decoration: underline;">COMPANY POLICIES, SCHEDULING, AND PAYMENT TERMS</h3>
  <p><strong>Initials:</strong> <span class="template-variable" data-var="initials_1">{{initials_1}}</span></p>
  <p><strong>Payments, Communication and Work Hours</strong></p>
  <p>a) Payment schedules must be followed even if you are out of town. Credit card transactions may include processing fees; all other electronic payment types do not incur additional charges.</p>
  <p>b) A2HW work hours are Monday-Friday, 9:00 a.m.-5:00 p.m. Arrival and departure times may vary.</p>
  <p>c) Scheduling or access questions must be communicated directly with the onsite crew. Calls, texts and emails will not be answered outside business hours.</p>

  <h3 style="text-decoration: underline;">STAIN SELECTION, SAMPLES AND FINISH ACCESS INFORMATION</h3>
  <p><strong>Initials:</strong> <span class="template-variable" data-var="initials_2">{{initials_2}}</span></p>
  <p><strong>Stain Samples and Color Selection Process</strong></p>
  <p>a) Three stain samples are included and applied directly onto your floor at the beginning of your project. Additional samples cost $100 each.</p>
  <p>b) A fan deck will be provided for color selection. Someone must be available to choose the final color and sign the stain approval form. <strong>Stain matching to existing floors is not guaranteed.</strong></p>
  <p><strong>Access Restrictions During Stain and Finish</strong></p>
  <p>a) Access to floors will be restricted on stain and finish days. Any spill or contamination caused by the client must be repaired at the client's expense.</p>
  <p>b) Stain contains high VOCs and may have a strong odor; limit time in the home until fully dry. Finish has low VOCs and typically dissipates within one day. <strong>If the floor looks wet, stay off it.</strong></p>

  <h3 style="text-decoration: underline;">HUMIDITY REQUIREMENTS, WARRANTY CONDITIONS, AND FIDBOX POLICY</h3>
  <p><strong>Initials:</strong> <span class="template-variable" data-var="initials_3">{{initials_3}}</span></p>
  <p><strong>Required Humidity Range and Warranty Eligibility</strong></p>
  <p>a) For installation projects, indoor relative <span style="background-color: yellow; font-weight: bold;">humidity must be maintained between 35% and 50%</span>. Use hygrometers to monitor conditions throughout the home.</p>
  <p>b) A Fidbox will be installed for documentation purposes. Clients who decline a Fidbox will not receive a craftsmanship warranty.</p>

  <h3 style="text-decoration: underline;">CANCELLATION, PROJECT REDUCTIONS, AND REFUND POLICY</h3>
  <p><strong>Initials:</strong> <span class="template-variable" data-var="initials_4">{{initials_4}}</span></p>
  <p><strong>Refund Limitations for Removed Work</strong></p>
  <p>a) If any portion of the contracted work is cancelled, reduced, or removed after scheduling, only 50% of that work's value is refundable.</p>
  <p>b) This policy reflects reserved labor, scheduled crews, and payroll commitments. Additional fees may apply for late changes or rescheduling.</p>

</div>
`

const VARIABLES = [
    { key: 'contract_number', label: 'Contract #', type: 'text', defaultValue: '', required: true },
    { key: 'effective_date', label: 'Effective Date', type: 'date', defaultValue: '', required: true },
    { key: 'work_start_date', label: 'Work Start Date', type: 'date', defaultValue: '', required: true },
    { key: 'estimate_invoice_number', label: 'Estimate / Invoice #', type: 'text', defaultValue: '', required: true },
    { key: 'additional_dates', label: 'Additional Dates', type: 'text', defaultValue: '', required: false },
    { key: 'wood_delivery_date', label: 'Wood Delivery Date', type: 'date', defaultValue: '', required: false },
    { key: 'completion_date', label: 'Completion Date', type: 'date', defaultValue: '', required: false },
    { key: 'installation_address', label: 'Installation Address', type: 'textarea', defaultValue: '', required: true },
    { key: 'service_description', label: 'Service Description', type: 'textarea', defaultValue: '', required: true },
    { key: 'deposit_amount', label: 'Deposit Amount', type: 'currency', defaultValue: '', required: true },
    { key: 'deposit_due_date', label: 'Deposit Due Date', type: 'text', defaultValue: 'Upon Acceptance', required: true },
    { key: 'remaining_balance', label: 'Remaining Balance', type: 'currency', defaultValue: '', required: true },
    { key: 'draw_1', label: 'Draw 1 Value', type: 'text', defaultValue: '', required: false },
    { key: 'draw_2', label: 'Draw 2 Value', type: 'text', defaultValue: '', required: false },
    { key: 'draw_3', label: 'Draw 3 Value', type: 'text', defaultValue: '', required: false },
    { key: 'draw_4', label: 'Draw 4 Value', type: 'text', defaultValue: '', required: false },
    { key: 'client_name', label: 'Client Name', type: 'text', defaultValue: '', required: true },
    { key: 'initials_home_prep', label: 'Initials - Home Prep', type: 'text', defaultValue: '', required: true },
    { key: 'initials_access', label: 'Initials - Access', type: 'text', defaultValue: '', required: true },
    { key: 'initials_homeowner_resp', label: 'Initials - Homeowner Resp', type: 'text', defaultValue: '', required: true },
    { key: 'initials_1', label: 'Initials - Policies', type: 'text', defaultValue: '', required: true },
    { key: 'initials_2', label: 'Initials - Stain Selection', type: 'text', defaultValue: '', required: true },
    { key: 'initials_3', label: 'Initials - Humidity', type: 'text', defaultValue: '', required: true },
    { key: 'initials_4', label: 'Initials - Cancellation', type: 'text', defaultValue: '', required: true },
]

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method !== 'POST') {
        throw createError({ statusCode: 405, message: 'Method not allowed' })
    }

    const doc = await ContractTemplate.findOneAndUpdate(
      { slug: 'residential-contract-updated' },
      {
        name: 'Residential Contract updated',
        slug: 'residential-contract-updated',
        description: 'Comprehensive residential construction contract including payments, schedule, warranty, and arbitration terms.',
        content: CONTENT,
        variables: VARIABLES,
        category: 'Agreements',
        isActive: true,
        createdBy: 'system',
      },
      { upsert: true, new: true }
    )

    return { success: true, message: 'Residential Contract updated template seeded', data: doc }
})
