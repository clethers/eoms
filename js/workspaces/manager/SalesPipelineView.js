import { liveRefresh } from '../../services/realtime.js';
import { fetchAllSalesLeads, createSalesLead, updateSalesLeadStage, bulkImportSalesLeads, archiveSalesLead, dispatchOcularFromLead } from '../../services/dataService.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { escapeHTML } from '../../shared/security.js';
import { formatStatus } from '../../shared/statusFormatter.js';
import { getProfiles } from '../../services/userService.js';

// Crew picker for dispatch modals: active Operations crew only, no default selection.
async function buildCrewSelectHtml(selectId) {
    let crew = [];
    try {
        const profiles = await getProfiles();
        crew = profiles.filter(p => p.role === 'operations' && (!p.status || p.status === 'ACTIVE'));
        crew.sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
    } catch (e) {
        console.error('Failed to load crew list:', e);
    }
    if (crew.length === 0) {
        return `<select id="${selectId}" disabled><option value="">No active Operations users</option></select>`;
    }
    return `<select id="${selectId}" required>
        <option value="" selected disabled>Select crew member…</option>
        ${crew.map(p => `<option value="${Number(p.id)}">${escapeHTML(p.fullName || p.email || ('User ' + p.id))}</option>`).join('')}
    </select>`;
}

export const STAGES = [
    'INITIAL_CONTACT',
    'SITE_VISIT_SCHEDULED',
    'SITE_VISIT_COMPLETED',
    'QUOTE_SENT',
    'QUOTE_ACCEPTED',
    'INSTALLATION_SCHEDULED',
    'INSTALLATION_COMPLETE',
    'JOB_CHECKOUT_COMPLETE',
    'CANCELED'
];

export default class SalesPipelineView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>Sales Pipeline</h2>
            <div class="form-panel">
                <h3>Add New Lead</h3>
                <form id="add-lead-form" class="form-row">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" name="name" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email">
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" name="phone">
                    </div>
                    <div class="form-row-end">
                        <div class="form-group">
                            <label>Installation Address</label>
                            <input type="text" name="installationAddress" required>
                        </div>
                        <button type="submit">Add Lead</button>
                        <button type="button" id="bulk-import-btn" style="background-color: #64748b; color: white;">Bulk Import (Mock)</button>
                    </div>
                </form>
            </div>
            <div id="pipeline-table-container">
                <div class="skeleton skeleton-title"></div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                </div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
            </div>
        `;

        const form = container.querySelector('#add-lead-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            try {
                await createSalesLead({
                    name: formData.get('name'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    installationAddress: formData.get('installationAddress'),
                    modeOfCommunication: 'Email',
                    remarks: '',
                    createdBy: getActiveProfileId()
                });
                form.reset();
                this.loadPipeline(container.querySelector('#pipeline-table-container'));
            } catch (err) {
                alert('Error creating lead: ' + err.message);
            }
        });

        const bulkBtn = container.querySelector('#bulk-import-btn');
        bulkBtn.addEventListener('click', async () => {
            if (confirm('Import 3 mock leads?')) {
                const rows = [
                    { legacyRowId: 'MOCK1', name: 'Corp A', email: 'a@corp.com', phone: '09171234567', installationAddress: '123 Main St', modeOfCommunication: 'Phone', remarks: '', createdBy: getActiveProfileId(), stage: 'INITIAL_CONTACT', stageINITIAL_CONTACTAt: new Date().toISOString() },
                    { legacyRowId: 'MOCK2', name: 'Corp B', email: 'b@corp.com', phone: '09177654321', installationAddress: '456 Side St', modeOfCommunication: 'Email', remarks: '', createdBy: getActiveProfileId(), stage: 'SITE_VISIT_SCHEDULED', stageSITE_VISIT_SCHEDULEDAt: new Date().toISOString() },
                    { legacyRowId: 'MOCK3', name: 'Corp C', email: 'c@corp.com', phone: '09181112222', installationAddress: '789 High St', modeOfCommunication: 'Website', remarks: '', createdBy: getActiveProfileId(), stage: 'INITIAL_CONTACT', stageINITIAL_CONTACTAt: new Date().toISOString() }
                ];
                for (const r of rows) await createSalesLead(r);
                this.loadPipeline(container.querySelector('#pipeline-table-container'));
            }
        });

        this.loadPipeline(container.querySelector('#pipeline-table-container'));
        liveRefresh('mgr-pipeline', ['sales_leads'], container, () => {
            this.allLeads = null; // force refetch
            return this.loadPipeline(container.querySelector('#pipeline-table-container'));
        });

        return container;
    }

    async loadPipeline(container) {
        try {
            if (!this.allLeads) {
                this.allLeads = await fetchAllSalesLeads();
                this.allLeads.sort((a, b) => b.id - a.id);
                this.currentPage = 1;
                this.pageSize = 3; // Temporarily lowered so you can see it in action!
            }

            if (this.allLeads.length === 0) {
                container.innerHTML = '<p>No leads found. Add one above.</p>';
                return;
            }

            const leadsToRender = this.allLeads.slice(0, this.currentPage * this.pageSize);
            const hasMore = leadsToRender.length < this.allLeads.length;

            container.innerHTML = `
                <table style="width: 100%; text-align: left;">
                    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Stage</th><th>Dispatch Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${leadsToRender.map(l => `
                            <tr>
                                <td>${escapeHTML(l.name)}</td>
                                <td>${escapeHTML(l.email || l.contactInfo || '')}</td>
                                <td>${escapeHTML(l.phone || '')}</td>
                                <td>${escapeHTML(l.installationAddress)}</td>
                                <td>
                                    <select class="stage-select" data-id="${l.id}">
                                        ${STAGES.map(s => `<option value="${s}" ${s === l.stage ? 'selected' : ''}>${escapeHTML(formatStatus(s))}</option>`).join('')}
                                    </select>
                                </td>
                                <td>
                                    ${l.ocularId 
                                        ? `<span style="background: #d1fae5; color: #065f46; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">Dispatched</span>` 
                                        : `<span style="background: #fef3c7; color: #92400e; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">Pending</span>`}
                                </td>
                                <td>
                                    <div class="table-actions">
                                    <button class="profile-btn btn-sm" data-id="${l.id}" title="View CRM Profile" style="background-color: #6366f1; color: white;">Profile</button>
                                    ${l.ocularId ? `<button class="view-reports-btn btn-sm" data-id="${l.id}" title="View Project Reports" style="background-color: #f59e0b; color: white;">Reports</button>` : ''}
                                    ${!l.ocularId ? `<button class="dispatch-btn btn-sm" data-id="${l.id}" title="Dispatch Ocular" style="background-color: var(--brand-green); color: white;">Dispatch</button>` : ''}
                                    ${l.stage === 'SITE_VISIT_COMPLETED' ? `<button class="quote-btn btn-sm" data-id="${l.id}" title="Generate Quote" style="background-color: #8b5cf6; color: white;">Quote</button>` : ''}
                                    ${l.ocularId && !l.installationId ? `<button class="dispatch-install-btn btn-sm" data-id="${l.id}" title="Dispatch Install" style="background-color: #10b981; color: white;">Install</button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${hasMore ? `<div style="text-align: center; margin-top: 1rem;"><button id="load-more-btn" style="padding: 0.5rem 2rem; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">Load More</button></div>` : ''}
            </div>

            <!-- View Reports Modal -->
            <div id="reports-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
                <div class="print-modal-content" style="background: white; padding: 2rem; border-radius: 8px; width: 900px; max-width: 95vw; max-height: 90vh; overflow-y: auto; position: relative;">
                    <div class="print-hide toolbar" style="position: absolute; top: 1rem; right: 1rem; gap: 0.5rem;">
                        <button type="button" id="print-reports-btn" style="background: var(--brand-green); color: white;">Print / PDF</button>
                        <button type="button" id="close-reports-btn" style="background: #e2e8f0;">Close</button>
                    </div>
                    <h2 style="margin-top: 0;">Project Reports</h2>
                    <div style="display: flex; gap: 2rem; margin-top: 1rem;">
                        <div id="reports-ocular-content" style="flex: 1; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; background: #f8fafc;"></div>
                        <div id="reports-install-content" style="flex: 1; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; background: #f8fafc;"></div>
                    </div>
                </div>
            </div>

        `;

            const loadMoreBtn = container.querySelector('#load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener('click', () => {
                    this.currentPage++;
                    this.loadPipeline(container);
                });
            }

            container.querySelectorAll('.stage-select').forEach(sel => {
                sel.addEventListener('change', async (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const newStage = e.target.value;
                    try {
                        await updateSalesLeadStage(id, newStage);
                    } catch(err) {
                        alert('Error updating stage: ' + err.message);
                    }
                });
            });

            container.querySelectorAll('.view-reports-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const lead = this.allLeads.find(l => l.id === id);
                    if (!lead) return;

                    const reportsModal = container.querySelector('#reports-modal');
                    const ocularContainer = container.querySelector('#reports-ocular-content');
                    const installContainer = container.querySelector('#reports-install-content');

                    const { get, COLLECTIONS } = await import('../../services/localDb.js');
                    const { buildInspectionSummaryHtml } = await import('../../shared/inspectionSummary.js');
                    const { buildInstallationSummaryHtml } = await import('../../shared/installationSummary.js');

                    ocularContainer.innerHTML = '<p>Loading...</p>';
                    installContainer.innerHTML = '<p>Loading...</p>';
                    reportsModal.style.display = 'flex';

                    let ocular = null;
                    if (lead.ocularId) {
                        let ocularId = lead.ocularId;
                        if (typeof ocularId === 'object' && ocularId !== null) ocularId = ocularId.id;
                        ocular = await get(COLLECTIONS.OCULAR_INSPECTIONS, ocularId);
                    }
                    ocularContainer.innerHTML = ocular ? buildInspectionSummaryHtml(ocular) : '<p>No inspection report available.</p>';

                    let install = null;
                    if (lead.installationId) {
                        let installId = lead.installationId;
                        if (typeof installId === 'object' && installId !== null) installId = installId.id;
                        install = await get(COLLECTIONS.INSTALLATION_RECORDS, installId);
                    }
                    installContainer.innerHTML = install ? buildInstallationSummaryHtml(install) : '<p>No installation report available.</p>';
                });
            });

            const closeReportsBtn = container.querySelector('#close-reports-btn');
            if (closeReportsBtn) {
                closeReportsBtn.addEventListener('click', () => {
                    container.querySelector('#reports-modal').style.display = 'none';
                });
            }

            const printReportsBtn = container.querySelector('#print-reports-btn');
            if (printReportsBtn) {
                printReportsBtn.addEventListener('click', () => {
                    window.print();
                });
            }

            container.querySelectorAll('.quote-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const lead = this.allLeads.find(l => l.id === id);
                    if (!lead) return;

                    const { get, COLLECTIONS } = await import('../../services/localDb.js');
                    const { getCatalog } = await import('../../services/masterDataService.js');
                    
                    let ocularId = lead.ocularId;
                    if (typeof ocularId === 'object' && ocularId !== null) ocularId = ocularId.id;
                    const ocular = ocularId ? await get(COLLECTIONS.OCULAR_INSPECTIONS, ocularId) : null;
                    const catalog = await getCatalog();

                    // Generate BOM from ocular
                    const bom = [];
                    if (ocular) {
                        // Example mapping of form fields to catalog
                        const mapping = {
                            conduitPvc: { key: 'cond-pvc20', name: '20mm PVC Conduit' },
                            conduitEmt: { key: 'cond-emt', name: 'EMT Conduit' },
                            boxUtility: { key: 'box-util', name: 'Utility Box' },
                            breakerMain: { key: 'b-100a', name: 'Main Breaker (100A)' },
                            chargerType: { key: 'c-7kw', name: 'AC Charger (7kW)' } // Just an example
                        };

                        for (const [formKey, mapData] of Object.entries(mapping)) {
                            const qty = parseInt(ocular[formKey], 10);
                            if (qty && qty > 0) {
                                const cItem = catalog.find(c => c.itemKey === mapData.key);
                                bom.push({
                                    name: cItem ? cItem.itemName : mapData.name,
                                    qty: qty,
                                    unitPrice: cItem ? (cItem.unitPrice || 0) : 0
                                });
                            }
                        }
                        
                        // Add some dummy items if BOM is empty for demo purposes
                        if (bom.length === 0) {
                            bom.push({ name: 'Generic Wiring Pack', qty: 1, unitPrice: 2500 });
                            bom.push({ name: 'Standard Breaker Box', qty: 1, unitPrice: 3500 });
                        }
                    }

                    const modal = document.createElement('div');
                    modal.className = 'print-hide';
                    modal.style.position = 'fixed';
                    modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
                    modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
                    modal.style.zIndex = '1000';
                    
                    modal.innerHTML = `
                        <div style="background: white; padding: 2rem; border-radius: 8px; width: 500px; max-height: 90vh; overflow-y: auto;">
                            <h3 style="margin-top:0;">Generate Quote: ${escapeHTML(lead.name)}</h3>
                            
                            <h4>Bill of Materials</h4>
                            <table style="width:100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.9rem;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #ccc; text-align: left;">
                                        <th>Item</th><th>Qty</th><th>Unit (₱)</th><th>Total</th>
                                    </tr>
                                </thead>
                                <tbody id="bom-tbody">
                                    ${bom.map((item, idx) => `
                                        <tr style="border-bottom: 1px solid #eee;">
                                            <td>${escapeHTML(item.name)}</td>
                                            <td>${item.qty}</td>
                                            <td><input type="number" class="bom-price" data-idx="${idx}" value="${item.unitPrice}" style="width: 80px; padding: 0.2rem;"></td>
                                            <td class="bom-line-total">₱${(item.qty * item.unitPrice).toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>

                            <div class="form-group" style="margin-top: 1rem;">
                                <label>Miscellaneous / Buffer (₱)</label>
                                <input type="number" id="quote-misc" value="0">
                            </div>
                            <div class="form-group">
                                <label>Labor & Services (₱)</label>
                                <input type="number" id="quote-labor" value="5000">
                            </div>
                            <div class="form-group">
                                <label>Total Quote Amount (₱)</label>
                                <input type="number" id="quote-total" readonly style="background: #f3f4f6; font-weight: bold; font-size: 1.2rem; color: #059669;">
                            </div>
                            
                            <div class="modal-actions">
                                <button id="quote-cancel" style="background: #e2e8f0; color: #333;">Cancel</button>
                                <button id="quote-confirm" style="background: #8b5cf6; color: white;">Save & Send Quote</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    const miscInput = modal.querySelector('#quote-misc');
                    const laborInput = modal.querySelector('#quote-labor');
                    const totalInput = modal.querySelector('#quote-total');
                    const priceInputs = modal.querySelectorAll('.bom-price');
                    const totalCells = modal.querySelectorAll('.bom-line-total');

                    const recalcTotal = () => {
                        let matTotal = 0;
                        priceInputs.forEach((input, idx) => {
                            const p = parseFloat(input.value) || 0;
                            const qty = bom[idx].qty;
                            const lineTotal = p * qty;
                            totalCells[idx].textContent = '₱' + lineTotal.toLocaleString();
                            matTotal += lineTotal;
                        });

                        const misc = parseFloat(miscInput.value) || 0;
                        const labor = parseFloat(laborInput.value) || 0;
                        const grandTotal = matTotal + misc + labor;
                        totalInput.value = grandTotal;
                    };

                    priceInputs.forEach(inp => inp.addEventListener('input', recalcTotal));
                    miscInput.addEventListener('input', recalcTotal);
                    laborInput.addEventListener('input', recalcTotal);
                    
                    // initial calc
                    recalcTotal();

                    modal.querySelector('#quote-cancel').addEventListener('click', () => {
                        document.body.removeChild(modal);
                    });

                    modal.querySelector('#quote-confirm').addEventListener('click', async () => {
                        try {
                            const { updateSalesLeadStage } = await import('../../services/dataService.js');
                            // In a real app we'd save the quote object here
                            await updateSalesLeadStage(id, 'QUOTE_SENT');
                            document.body.removeChild(modal);
                            this.loadPipeline(container);
                        } catch(err) {
                            alert('Error sending quote: ' + err.message);
                        }
                    });
                });
            });

            container.querySelectorAll('.profile-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const lead = this.allLeads.find(l => l.id === id);
                    if (!lead) return;

                    const modal = document.createElement('div');
                    modal.style.position = 'fixed';
                    modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
                    modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
                    modal.style.zIndex = '1000';
                    
                    modal.innerHTML = `
                        <div style="background: white; padding: 2rem; border-radius: 8px; width: 500px; max-width: 90vw; max-height: 90vh; overflow-y: auto;">
                            <div class="page-header" style="margin-bottom: 1.5rem;">
                                <h3>CRM Profile: ${escapeHTML(lead.name)}</h3>
                                <span style="background: #e2e8f0; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${escapeHTML(formatStatus(lead.stage))}</span>
                            </div>
                            
                            <form id="crm-profile-form" class="form-stack">
                                <div class="form-group">
                                    <label>Client / Company Name</label>
                                    <input type="text" name="name" value="${escapeHTML(lead.name)}" required>
                                </div>
                                <div class="form-group">
                                    <label>Email</label>
                                    <input type="email" name="email" value="${escapeHTML(lead.email || lead.contactInfo || '')}">
                                </div>
                                <div class="form-group">
                                    <label>Phone Number</label>
                                    <input type="tel" name="phone" value="${escapeHTML(lead.phone || '')}">
                                </div>
                                <div class="form-group">
                                    <label>Installation Address</label>
                                    <input type="text" name="installationAddress" value="${escapeHTML(lead.installationAddress)}" required>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Mode of Communication</label>
                                        <select name="modeOfCommunication">
                                            <option value="Phone" ${lead.modeOfCommunication === 'Phone' ? 'selected' : ''}>Phone</option>
                                            <option value="Email" ${lead.modeOfCommunication === 'Email' ? 'selected' : ''}>Email</option>
                                            <option value="Website" ${lead.modeOfCommunication === 'Website' ? 'selected' : ''}>Website</option>
                                            <option value="In-Person" ${lead.modeOfCommunication === 'In-Person' ? 'selected' : ''}>In-Person</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Building Type</label>
                                        <select name="buildingType">
                                            <option value="">-- Select --</option>
                                            <option value="Residential" ${lead.buildingType === 'Residential' ? 'selected' : ''}>Residential</option>
                                            <option value="Commercial" ${lead.buildingType === 'Commercial' ? 'selected' : ''}>Commercial</option>
                                            <option value="Industrial" ${lead.buildingType === 'Industrial' ? 'selected' : ''}>Industrial</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>CRM Notes & Remarks</label>
                                    <textarea name="remarks" rows="4" placeholder="Add internal notes here...">${escapeHTML(lead.remarks || '')}</textarea>
                                </div>
                                
                                <div class="modal-actions modal-actions--split" style="margin-top: 0.5rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                                    <button type="button" id="crm-archive-btn" style="background: #ef4444; color: white;">Archive Lead</button>
                                    <div>
                                        <button type="button" id="crm-close-btn" style="background: #e2e8f0; color: #333;">Close</button>
                                        <button type="submit" style="background: var(--brand-green); color: white;">Save Changes</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    
                    modal.querySelector('#crm-close-btn').addEventListener('click', () => {
                        document.body.removeChild(modal);
                    });
                    
                    modal.querySelector('#crm-archive-btn').addEventListener('click', async () => {
                        if (confirm('Are you sure you want to archive this lead?')) {
                            document.body.removeChild(modal);
                            try {
                                const { archiveSalesLead } = await import('../../services/dataService.js');
                                await archiveSalesLead(id);
                                this.loadPipeline(container);
                            } catch(err) {
                                alert('Error archiving lead: ' + err.message);
                            }
                        }
                    });

                    modal.querySelector('#crm-profile-form').addEventListener('submit', async (e2) => {
                        e2.preventDefault();
                        const formData = new FormData(e2.target);
                        const updates = {
                            name: formData.get('name'),
                            email: formData.get('email'),
                            phone: formData.get('phone'),
                            installationAddress: formData.get('installationAddress'),
                            modeOfCommunication: formData.get('modeOfCommunication'),
                            buildingType: formData.get('buildingType'),
                            remarks: formData.get('remarks')
                        };
                        try {
                            const { updateSalesLeadInfo } = await import('../../services/dataService.js');
                            await updateSalesLeadInfo(id, updates);
                            document.body.removeChild(modal);
                            this.loadPipeline(container);
                        } catch(err) {
                            alert('Error updating CRM profile: ' + err.message);
                        }
                    });
                });
            });

            container.querySelectorAll('.dispatch-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const crewSelectHtml = await buildCrewSelectHtml('dispatch-assignee');
                    
                    const modal = document.createElement('div');
                    modal.style.position = 'fixed';
                    modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
                    modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
                    modal.style.zIndex = '1000';
                    
                    modal.innerHTML = `
                        <div style="background: white; padding: 2rem; border-radius: 8px; width: 400px;">
                            <h3>Schedule & Dispatch Ocular</h3>
                            <div class="form-group">
                                <label>RN Number</label>
                                <input type="text" id="dispatch-rn" value="RN-${Date.now().toString().slice(-6)}">
                            </div>
                            <div class="form-group">
                                <label>Assign Crew Member</label>
                                ${crewSelectHtml}
                            </div>
                            <div class="form-group">
                                <label>Scheduled Date & Time</label>
                                <input type="datetime-local" id="dispatch-date" required>
                            </div>
                            <div class="modal-actions">
                                <button id="dispatch-cancel" style="background: #e2e8f0; color: #333;">Cancel</button>
                                <button id="dispatch-confirm" style="background: var(--brand-green); color: white;">Dispatch</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    
                    modal.querySelector('#dispatch-cancel').addEventListener('click', () => {
                        document.body.removeChild(modal);
                    });
                    
                    modal.querySelector('#dispatch-confirm').addEventListener('click', async () => {
                        const rnNo = modal.querySelector('#dispatch-rn').value;
                        const teamId = parseInt(modal.querySelector('#dispatch-assignee').value, 10);
                        if (modal.querySelector('#dispatch-assignee').disabled) { alert('No active Operations users to dispatch to.'); return; }
                        const scheduledDate = modal.querySelector('#dispatch-date').value;
                        
                        if (!rnNo || !teamId || !scheduledDate) {
                            alert('Please fill out all fields.');
                            return;
                        }
                        
                        document.body.removeChild(modal);
                        try {
                            await dispatchOcularFromLead(id, teamId, rnNo, scheduledDate);
                            alert('Inspection successfully scheduled and dispatched!');
                            this.loadPipeline(container);
                        } catch(err) {
                            alert('Error dispatching: ' + err.message);
                        }
                    });
                });
            });

            container.querySelectorAll('.dispatch-install-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const crewSelectHtml = await buildCrewSelectHtml('dispatch-install-assignee');
                    
                    const modal = document.createElement('div');
                    modal.style.position = 'fixed';
                    modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
                    modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
                    modal.style.zIndex = '1000';
                    
                    modal.innerHTML = `
                        <div style="background: white; padding: 2rem; border-radius: 8px; width: 400px;">
                            <h3>Schedule & Dispatch Installation</h3>
                            <div class="form-group">
                                <label>Installation Number</label>
                                <input type="text" id="dispatch-install-no" value="INST-${Date.now().toString().slice(-6)}">
                            </div>
                            <div class="form-group">
                                <label>Assign Crew Member</label>
                                ${crewSelectHtml}
                            </div>
                            <div class="form-group">
                                <label>Scheduled Date & Time</label>
                                <input type="datetime-local" id="dispatch-install-date" required>
                            </div>
                            <div class="modal-actions">
                                <button id="dispatch-install-cancel" style="background: #e2e8f0; color: #333;">Cancel</button>
                                <button id="dispatch-install-confirm" style="background: #10b981; color: white;">Dispatch</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    
                    modal.querySelector('#dispatch-install-cancel').addEventListener('click', () => {
                        document.body.removeChild(modal);
                    });
                    
                    modal.querySelector('#dispatch-install-confirm').addEventListener('click', async () => {
                        const instNo = modal.querySelector('#dispatch-install-no').value;
                        const teamId = parseInt(modal.querySelector('#dispatch-install-assignee').value, 10);
                        if (modal.querySelector('#dispatch-install-assignee').disabled) { alert('No active Operations users to dispatch to.'); return; }
                        const scheduledDate = modal.querySelector('#dispatch-install-date').value;
                        
                        if (!instNo || !teamId || !scheduledDate) {
                            alert('Please fill out all fields.');
                            return;
                        }
                        
                        document.body.removeChild(modal);
                        try {
                            const { dispatchInstallationFromLead } = await import('../../services/dataService.js');
                            await dispatchInstallationFromLead(id, teamId, instNo, scheduledDate);
                            alert('Installation successfully scheduled and dispatched!');
                            this.loadPipeline(container);
                        } catch(err) {
                            alert('Error dispatching: ' + err.message);
                        }
                    });
                });
            });

            container.querySelectorAll('.archive-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    if (confirm('Archive this lead?')) {
                        try {
                            await archiveSalesLead(id);
                            this.loadPipeline(container);
                        } catch(err) {
                            alert('Error archiving lead: ' + err.message);
                        }
                    }
                });
            });
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Failed to load pipeline: ${e.message}</p>`;
        }
    }
}
