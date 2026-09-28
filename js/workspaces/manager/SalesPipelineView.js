import { liveRefresh } from '../../services/realtime.js';
import { fetchAllSalesLeads, createSalesLead, updateSalesLeadStage, bulkImportSalesLeads, archiveSalesLead, dispatchOcularFromLead, CHECKLIST_STAGES } from '../../services/dataService.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { escapeHTML } from '../../shared/security.js';
import { formatStatus } from '../../shared/statusFormatter.js';
import { getProfiles } from '../../services/userService.js';
import { btnContent } from '../../shared/icons.js';

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

// Checklist steps whose Excel date is a *scheduled* date rather than a completion date.
const SCHEDULED_STEPS = new Set(['SITE_VISIT_COMPLETED', 'INSTALLATION_SCHEDULED']);
const MODE_SUGGESTIONS = ['Call', 'Text', 'Viber', 'Email', 'Messenger', 'Website', 'Walk-in'];
const modeDatalist = (id) => `<datalist id="${id}">${MODE_SUGGESTIONS.map(m => `<option value="${m}"></option>`).join('')}</datalist>`;

const leadName = (l) => l.name || [l.firstName, l.lastName].filter(Boolean).join(' ');
const fullName = (first, last) => [first, last].map(v => String(v || '').trim()).filter(Boolean).join(' ');

/** Escape text, then turn http(s) URLs into links that open in a new tab. */
function linkify(text) {
    return escapeHTML(text || '').replace(/https?:\/\/[^\s<]+/g, (m) => {
        const trail = (m.match(/[.,;:!?)\]]+$/) || [''])[0];
        const url = trail ? m.slice(0, -trail.length) : m;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`;
    });
}

function checklistOf(l) {
    return (l.stageChecklist && typeof l.stageChecklist === 'object') ? l.stageChecklist : {};
}

/** Read-only progress timeline for the details panel. */
function timelineHtml(l) {
    const cl = checklistOf(l);
    return `<ol class="lead-timeline">${CHECKLIST_STAGES.map(code => {
        const st = cl[code] || {};
        const word = SCHEDULED_STEPS.has(code) ? 'Scheduled' : 'Done';
        return `<li class="${st.done ? 'is-done' : ''}${code === l.stage ? ' is-current' : ''}" data-step="${code}">
            <span class="lead-timeline__tick" aria-hidden="true">${st.done ? '&#10003;' : ''}</span>
            <span class="lead-timeline__label">${escapeHTML(formatStatus(code))}</span>
            <span class="lead-timeline__date">${st.date ? `${word}: ${escapeHTML(st.date)}` : (st.done ? word : '—')}</span>
        </li>`;
    }).join('')}</ol>`;
}

function detailItem(label, val) {
    return `<div class="lead-detail"><div class="lead-detail__k">${label}</div><div class="lead-detail__v">${val || '—'}</div></div>`;
}

/** Read-only Details modal body: same fields as the old inline details row. */
function detailsModalHtml(l) {
    const created = l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '';
    return `
        <div class="lead-details__grid">
            ${detailItem('RN No.', escapeHTML(l.rnNo))}
            ${detailItem('Contact Number', escapeHTML(l.phone || l.contactInfo))}
            ${detailItem('Email', escapeHTML(l.email))}
            ${detailItem('Installation Address', escapeHTML(l.installationAddress))}
            ${detailItem('Mode of Communication', escapeHTML(l.modeOfCommunication))}
            ${detailItem('Building Type', escapeHTML(l.buildingType))}
            ${detailItem('Dispatch', l.ocularId ? 'Dispatched' : 'Pending')}
            ${detailItem('Created', escapeHTML(created))}
        </div>
        <div class="lead-details__section"><div class="lead-detail__k">Progress</div>${timelineHtml(l)}</div>
        <div class="lead-details__grid">
            ${detailItem('Remarks', linkify(l.remarks) && `<div class="lead-remarks">${linkify(l.remarks)}</div>`)}
            ${detailItem('Follow-up 1', linkify(l.followUp1) && `<div class="lead-remarks">${linkify(l.followUp1)}</div>`)}
            ${detailItem('Follow-up 2', linkify(l.followUp2) && `<div class="lead-remarks">${linkify(l.followUp2)}</div>`)}
        </div>
    `;
}

function leadMatches(l, q) {
    if (!q) return true;
    return [leadName(l), l.clientId, l.rnNo, l.phone, l.email, l.contactInfo, l.installationAddress]
        .some(v => v && String(v).toLowerCase().includes(q));
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
            <h2>Clients</h2>
            <div class="form-panel">
                <h3>Add New Lead</h3>
                <form id="add-lead-form" class="form-row">
                    <div class="form-group">
                        <label>First Name</label>
                        <input type="text" name="firstName" required>
                    </div>
                    <div class="form-group">
                        <label>Last Name</label>
                        <input type="text" name="lastName">
                    </div>
                    <div class="form-group">
                        <label>Contact Number</label>
                        <input type="text" name="phone" inputmode="tel">
                    </div>
                    <div class="form-group">
                        <label>Email (optional)</label>
                        <input type="email" name="email">
                    </div>
                    <div class="form-group">
                        <label>Mode of Communication</label>
                        <input type="text" name="modeOfCommunication" list="add-lead-modes" autocomplete="off">
                        ${modeDatalist('add-lead-modes')}
                    </div>
                    <div class="form-group">
                        <label>Client ID (optional)</label>
                        <input type="text" name="clientId">
                    </div>
                    <div class="form-group">
                        <label>RN No. (optional)</label>
                        <input type="text" name="rnNo">
                    </div>
                    <div class="form-row-end">
                        <div class="form-group">
                            <label>Installation Address</label>
                            <input type="text" name="installationAddress" required>
                        </div>
                        <button type="submit">${btnContent('plus', 'Add Lead')}</button>
                        <button type="button" id="bulk-import-btn" style="background-color: #64748b; color: white;">${btnContent('upload', 'Bulk Import (Mock)')}</button>
                    </div>
                </form>
            </div>
            <div class="form-row" style="margin-bottom: 1rem;">
                <div class="form-group">
                    <label for="lead-search">Search clients</label>
                    <input type="search" id="lead-search" placeholder="Name, Client ID, RN No., phone or email">
                </div>
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
                const val = (k) => String(formData.get(k) || '').trim();
                const phone = val('phone'), email = val('email');
                await createSalesLead({
                    clientId: val('clientId'),
                    rnNo: val('rnNo'),
                    firstName: val('firstName'),
                    lastName: val('lastName'),
                    name: fullName(val('firstName'), val('lastName')),
                    email,
                    phone,
                    contactInfo: phone || email,
                    installationAddress: val('installationAddress'),
                    modeOfCommunication: val('modeOfCommunication'),
                    remarks: '',
                    followUp1: '',
                    followUp2: '',
                    createdBy: getActiveProfileId()
                });
                form.reset();
                this.refreshLeads(container.querySelector('#pipeline-table-container'));
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
                this.refreshLeads(container.querySelector('#pipeline-table-container'));
            }
        });

        this.searchQuery = '';
        container.querySelector('#lead-search').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim().toLowerCase();
            this.currentPage = 1;
            this.loadPipeline(container.querySelector('#pipeline-table-container'));
        });

        this.loadPipeline(container.querySelector('#pipeline-table-container'));
        liveRefresh('mgr-pipeline', ['sales_leads'], container, () => {
            this.allLeads = null; // force refetch
            return this.loadPipeline(container.querySelector('#pipeline-table-container'));
        });

        return container;
    }

    /** Refetch leads after a local change so the row updates now, keeping the loaded page count. */
    refreshLeads(container) {
        this.keepPage = this.currentPage;
        this.allLeads = null;
        return this.loadPipeline(container);
    }

    /** Read-only Details popup: client info, progress timeline and remarks. Edit hands off to the CRM Profile modal. */
    openDetailsModal(id, container, triggerBtn) {
        const lead = (this.allLeads || []).find(l => l.id === id);
        if (!lead) return;

        const titleId = `lead-details-title-${id}`;
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';

        modal.innerHTML = `
            <div role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1"
                 style="background: white; padding: 2rem; border-radius: 8px; width: 640px; max-width: 90vw; max-height: 90vh; overflow-y: auto;">
                <div class="page-header" style="margin-bottom: 1.5rem;">
                    <h3 id="${titleId}">${escapeHTML(lead.clientId || '')}${lead.clientId ? ' — ' : ''}${escapeHTML(leadName(lead))}</h3>
                    <span style="background: #e2e8f0; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${escapeHTML(formatStatus(lead.stage))}</span>
                </div>
                ${detailsModalHtml(lead)}
                <div class="modal-actions">
                    <button type="button" id="lead-details-edit-btn" class="btn-sm" style="background-color: #6366f1; color: white;">${btnContent('pencil', 'Edit')}</button>
                    <button type="button" id="lead-details-close-btn" class="btn-sm" style="background: #e2e8f0; color: #333;">${btnContent('x', 'Close')}</button>
                </div>
            </div>
        `;

        const dialog = modal.querySelector('[role="dialog"]');
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const closeModal = () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKeydown);
            if (modal.parentNode) document.body.removeChild(modal);
            if (triggerBtn && document.contains(triggerBtn)) triggerBtn.focus();
        };
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
                return;
            }
            if (e.key === 'Tab') {
                const focusable = Array.from(dialog.querySelectorAll(focusableSelector));
                if (focusable.length === 0) return;
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault(); last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault(); first.focus();
                }
            }
        };
        document.addEventListener('keydown', onKeydown);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        modal.querySelector('#lead-details-close-btn').addEventListener('click', closeModal);
        modal.querySelector('#lead-details-edit-btn').addEventListener('click', () => {
            closeModal();
            this.openProfile(id, container);
        });

        document.body.appendChild(modal);
        dialog.focus();
    }

    /** CRM Profile modal: view/edit every Excel field plus the progress checklist. */
    openProfile(id, container) {
        const lead = (this.allLeads || []).find(l => l.id === id);
        if (!lead) return;

        // Old leads only have `name`: prefill first/last by splitting on the first space (saved only on Save).
        let firstName = lead.firstName || '', lastName = lead.lastName || '';
        if (!firstName && !lastName && lead.name) {
            const n = String(lead.name).trim();
            const i = n.indexOf(' ');
            firstName = i > 0 ? n.slice(0, i) : n;
            lastName = i > 0 ? n.slice(i + 1).trim() : '';
        }
        const cl = checklistOf(lead);
        const val = (v) => escapeHTML(v == null ? '' : v);

        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';

        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 8px; width: 640px; max-width: 90vw; max-height: 90vh; overflow-y: auto;">
                <div class="page-header" style="margin-bottom: 1.5rem;">
                    <h3>CRM Profile: ${escapeHTML(leadName(lead))}</h3>
                    <span style="background: #e2e8f0; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${escapeHTML(formatStatus(lead.stage))}</span>
                </div>

                <form id="crm-profile-form" class="form-stack" novalidate>
                    <h4 class="crm-section-title">Client</h4>
                    <div class="field-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem;">
                        <div class="form-group"><label>Client ID</label><input type="text" name="clientId" value="${val(lead.clientId)}"></div>
                        <div class="form-group"><label>RN No.</label><input type="text" name="rnNo" value="${val(lead.rnNo)}"></div>
                        <div class="form-group"><label>First Name</label><input type="text" name="firstName" value="${val(firstName)}"></div>
                        <div class="form-group"><label>Last Name</label><input type="text" name="lastName" value="${val(lastName)}"></div>
                        <div class="form-group"><label>Contact Number</label><input type="text" name="phone" inputmode="tel" value="${val(lead.phone)}"></div>
                        <div class="form-group"><label>Email</label><input type="email" name="email" value="${val(lead.email)}"></div>
                        <div class="form-group">
                            <label>Mode of Communication</label>
                            <input type="text" name="modeOfCommunication" list="crm-modes" autocomplete="off" value="${val(lead.modeOfCommunication)}">
                            ${modeDatalist('crm-modes')}
                        </div>
                        <div class="form-group">
                            <label>Building Type</label>
                            <select name="buildingType">
                                <option value="">-- Select --</option>
                                ${['Residential', 'Commercial', 'Industrial'].map(b => `<option value="${b}" ${lead.buildingType === b ? 'selected' : ''}>${b}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1;"><label>Installation Address</label><input type="text" name="installationAddress" value="${val(lead.installationAddress)}"></div>
                    </div>

                    <h4 class="crm-section-title">Progress</h4>
                    <ol class="lead-timeline lead-timeline--edit">
                        ${CHECKLIST_STAGES.map(code => {
                            const st = cl[code] || {};
                            const word = SCHEDULED_STEPS.has(code) ? 'Scheduled' : 'Done';
                            return `<li class="${st.done ? 'is-done' : ''}${code === lead.stage ? ' is-current' : ''}" data-step="${code}">
                                <label class="lead-timeline__label"><input type="checkbox" name="cl_done_${code}" ${st.done ? 'checked' : ''}> ${escapeHTML(formatStatus(code))}</label>
                                <span class="lead-timeline__word">${word}</span>
                                <input type="date" name="cl_date_${code}" value="${val(st.date)}" aria-label="${escapeHTML(formatStatus(code))} ${word.toLowerCase()} date">
                            </li>`;
                        }).join('')}
                    </ol>

                    <h4 class="crm-section-title">Notes</h4>
                    ${lead.remarks ? `<div class="lead-remarks crm-remarks-view">${linkify(lead.remarks)}</div>` : ''}
                    <div class="form-group">
                        <label>Remarks</label>
                        <textarea name="remarks" rows="3" placeholder="Add internal notes here...">${val(lead.remarks)}</textarea>
                    </div>
                    <div class="field-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem;">
                        <div class="form-group"><label>Follow-up 1</label><textarea name="followUp1" rows="2">${val(lead.followUp1)}</textarea></div>
                        <div class="form-group"><label>Follow-up 2</label><textarea name="followUp2" rows="2">${val(lead.followUp2)}</textarea></div>
                    </div>

                    <div class="modal-actions modal-actions--split" style="margin-top: 0.5rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                        <button type="button" id="crm-archive-btn" style="background: #ef4444; color: white;">${btnContent('archive', 'Archive Lead')}</button>
                        <div>
                            <button type="button" id="crm-close-btn" style="background: #e2e8f0; color: #333;">${btnContent('x', 'Close')}</button>
                            <button type="submit" style="background: var(--brand-green); color: white;">${btnContent('save', 'Save Changes')}</button>
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
                    this.refreshLeads(container);
                } catch(err) {
                    alert('Error archiving lead: ' + err.message);
                }
            }
        });

        modal.querySelector('#crm-profile-form').addEventListener('submit', async (e2) => {
            e2.preventDefault();
            const form = e2.target;
            const formData = new FormData(form);
            const v = (k) => String(formData.get(k) || '').trim();
            const first = v('firstName'), last = v('lastName');
            const name = fullName(first, last) || lead.name || '';
            if (!name) { alert('Please enter a first or last name.'); return; }
            const email = v('email');
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Please enter a valid email address, or leave it empty.'); return; }
            const phone = v('phone');

            const stageChecklist = { ...cl };
            for (const code of CHECKLIST_STAGES) {
                const done = !!form.querySelector(`[name="cl_done_${code}"]`).checked;
                const date = v(`cl_date_${code}`) || null;
                if (done || date || stageChecklist[code]) stageChecklist[code] = { done, date };
            }

            const updates = {
                clientId: v('clientId'),
                rnNo: v('rnNo'),
                firstName: first,
                lastName: last,
                name,
                phone,
                email,
                contactInfo: phone || email,
                modeOfCommunication: v('modeOfCommunication'),
                buildingType: formData.get('buildingType'),
                installationAddress: v('installationAddress'),
                stageChecklist,
                remarks: formData.get('remarks') || '',
                followUp1: formData.get('followUp1') || '',
                followUp2: formData.get('followUp2') || ''
            };
            try {
                const { updateSalesLeadInfo } = await import('../../services/dataService.js');
                await updateSalesLeadInfo(id, updates);
                document.body.removeChild(modal);
                this.refreshLeads(container);
            } catch(err) {
                alert('Error updating CRM profile: ' + err.message);
            }
        });
    }

    async loadPipeline(container) {
        try {
            if (!this.allLeads) {
                this.allLeads = await fetchAllSalesLeads();
                this.allLeads.sort((a, b) => b.id - a.id);
                this.currentPage = this.keepPage || 1;
                this.keepPage = null;
                this.pageSize = 3; // Temporarily lowered so you can see it in action!
            }

            if (this.allLeads.length === 0) {
                container.innerHTML = '<p>No leads found. Add one above.</p>';
                return;
            }

            const q = this.searchQuery || '';
            const filtered = q ? this.allLeads.filter(l => leadMatches(l, q)) : this.allLeads;
            if (filtered.length === 0) {
                container.innerHTML = '<p>No clients match your search.</p>';
                return;
            }
            const leadsToRender = filtered.slice(0, this.currentPage * this.pageSize);
            const hasMore = leadsToRender.length < filtered.length;

            container.innerHTML = `
                <table class="leads-table" style="width: 100%; text-align: left;">
                    <thead><tr><th>Client ID</th><th>Name</th><th>Contact Number</th><th>Stage</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${leadsToRender.map(l => `
                            <tr class="lead-row" data-id="${l.id}">
                                <td class="lead-client-id">${escapeHTML(l.clientId || '')}</td>
                                <td>${escapeHTML(leadName(l))}</td>
                                <td>${escapeHTML(l.phone || l.contactInfo || '')}</td>
                                <td>
                                    <select class="stage-select" data-id="${l.id}">
                                        ${!l.stage ? `<option value="" selected>— Set status —</option>` : ''}
                                        ${STAGES.map(s => `<option value="${s}" ${s === l.stage ? 'selected' : ''}>${escapeHTML(formatStatus(s))}</option>`).join('')}
                                    </select>
                                </td>
                                <td>
                                    <div class="table-actions">
                                    <button type="button" class="details-btn btn-sm" data-id="${l.id}" title="Show details" aria-label="Details" aria-haspopup="dialog" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">${btnContent('eye', 'Details')}</button>
                                    <button class="profile-btn btn-sm" data-id="${l.id}" title="View CRM Profile" aria-label="Profile" style="background-color: #6366f1; color: white;">${btnContent('user', 'Profile')}</button>
                                    ${l.ocularId ? `<button class="view-reports-btn btn-sm" data-id="${l.id}" title="View Project Reports" aria-label="Reports" style="background-color: #f59e0b; color: white;">${btnContent('clipboard-list', 'Reports')}</button>` : ''}
                                    ${!l.ocularId ? `<button class="dispatch-btn btn-sm" data-id="${l.id}" title="Dispatch Ocular" aria-label="Dispatch" style="background-color: var(--brand-green); color: white;">${btnContent('truck', 'Dispatch')}</button>` : ''}
                                    ${l.stage === 'SITE_VISIT_COMPLETED' ? `<button class="quote-btn btn-sm" data-id="${l.id}" title="Generate Quote" aria-label="Quote" style="background-color: #8b5cf6; color: white;">${btnContent('file-text', 'Quote')}</button>` : ''}
                                    ${l.ocularId && !l.installationId ? `<button class="dispatch-install-btn btn-sm" data-id="${l.id}" title="Dispatch Install" aria-label="Install">${btnContent('wrench', 'Install')}</button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${hasMore ? `<div style="text-align: center; margin-top: 1rem;"><button id="load-more-btn" style="padding: 0.5rem 2rem; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">${btnContent('chevrons-down', 'Load More')}</button></div>` : ''}
            </div>

            <!-- View Reports Modal -->
            <div id="reports-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
                <div class="print-modal-content" style="background: white; padding: 2rem; border-radius: 8px; width: 900px; max-width: 95vw; max-height: 90vh; overflow-y: auto; position: relative;">
                    <div class="print-hide toolbar" style="position: absolute; top: 1rem; right: 1rem; gap: 0.5rem;">
                        <button type="button" id="print-reports-btn" style="background: var(--brand-green); color: white;">${btnContent('printer', 'Print / PDF')}</button>
                        <button type="button" id="close-reports-btn" style="background: #e2e8f0;">${btnContent('x', 'Close')}</button>
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
                    if (!newStage) return; // placeholder re-selected: no-op, don't save
                    try {
                        await updateSalesLeadStage(id, newStage);
                        this.refreshLeads(container);
                    } catch(err) {
                        alert('Error updating stage: ' + err.message);
                    }
                });
            });

            // Details: read-only popup dialog (no re-fetch; edit continues into the CRM Profile modal).
            container.querySelectorAll('.details-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const b = e.currentTarget;
                    const id = parseInt(b.dataset.id, 10);
                    this.openDetailsModal(id, container, b);
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
                                <button id="quote-cancel" style="background: #e2e8f0; color: #333;">${btnContent('x', 'Cancel')}</button>
                                <button id="quote-confirm" style="background: #8b5cf6; color: white;">${btnContent('file-text', 'Save & Send Quote')}</button>
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
                            this.refreshLeads(container);
                        } catch(err) {
                            alert('Error sending quote: ' + err.message);
                        }
                    });
                });
            });

            container.querySelectorAll('.profile-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.openProfile(parseInt(e.currentTarget.dataset.id, 10), container));
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
                                <button id="dispatch-cancel" style="background: #e2e8f0; color: #333;">${btnContent('x', 'Cancel')}</button>
                                <button id="dispatch-confirm" style="background: var(--brand-green); color: white;">${btnContent('truck', 'Dispatch')}</button>
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
                            this.refreshLeads(container);
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
                                <button id="dispatch-install-cancel" style="background: #e2e8f0; color: #333;">${btnContent('x', 'Cancel')}</button>
                                <button id="dispatch-install-confirm">${btnContent('wrench', 'Dispatch')}</button>
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
                            this.refreshLeads(container);
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
                            this.refreshLeads(container);
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
