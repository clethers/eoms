import { buildInspectionSummaryHtml } from '../../shared/inspectionSummary.js';
import { escapeHTML } from '../../shared/security.js';

export default class ReadyQueueView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `<h2>All Installations</h2><div id="ready-list">Loading...</div><div id="preview-container"></div>`;
        
        const listDiv = container.querySelector('#ready-list');
        const previewDiv = container.querySelector('#preview-container');
        
        try {
            const { getAll, COLLECTIONS, get } = await import('../../services/localDb.js');
            const items = await getAll(COLLECTIONS.INSTALLATION_RECORDS, i => i.status === 'ASSIGNED_PENDING_INSTALLATION' && !i.deletedAt);
            
            if (items.length === 0) {
                listDiv.innerHTML = `<p>No pending installations.</p>`;
            } else {
                listDiv.innerHTML = `
                    <table style="width: 100%; text-align: left; margin-bottom: 1rem;">
                        <thead><tr><th>Inst No</th><th>Client</th><th>Scheduled Date</th><th>Action</th></tr></thead>
                        <tbody>
                            ${items.map(i => {
                                let isLocked = false;
                                let lockReason = '';
                                if (i.scheduledDate) {
                                    const sched = new Date(i.scheduledDate);
                                    const now = new Date();
                                    sched.setHours(0,0,0,0);
                                    now.setHours(0,0,0,0);
                                    if (sched > now) {
                                        isLocked = true;
                                        lockReason = 'Unlocks on ' + new Date(i.scheduledDate).toLocaleDateString();
                                    }
                                }
                                return `
                                <tr>
                                    <td>${escapeHTML(i.installationNo)}</td>
                                    <td>${escapeHTML(i.clientName)}</td>
                                    <td>${escapeHTML(i.scheduledDate ? new Date(i.scheduledDate).toLocaleString() : 'Not Scheduled')}</td>
                                    <td>
                                        <button data-action="preview" data-id="${i.id}" data-ocular="${i.ocularId}" title="View Ocular Summary" style="font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer;">👁️</button>
                                        ${isLocked 
                                            ? `<button disabled title="${lockReason}" style="background-color:#ccc; color:#666; cursor:not-allowed; font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; margin-left: 0.5rem;">🔒</button>` 
                                            : `<button data-action="start" data-id="${i.id}" title="Start Install" style="font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; background-color: var(--brand-green); color: white; margin-left: 0.5rem;">🛠️</button>`
                                        }
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
                
                listDiv.addEventListener('click', async (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;
                    const id = parseInt(btn.dataset.id, 10);
                    const item = items.find(x => x.id === id);
                    
                    if (btn.dataset.action === 'preview') {
                        const ocularId = parseInt(btn.dataset.ocular, 10);
                        const ocular = await get(COLLECTIONS.OCULAR_INSPECTIONS, ocularId);
                        if (ocular) {
                            previewDiv.innerHTML = buildInspectionSummaryHtml(ocular);
                        } else {
                            previewDiv.innerHTML = '<p>Ocular record not found.</p>';
                        }
                    } else if (btn.dataset.action === 'start') {
                        window.history.pushState(null, '', '/ocular/installation');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    }
                });
            }
        } catch (e) {
            listDiv.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
        }
        
        return container;
    }
}
