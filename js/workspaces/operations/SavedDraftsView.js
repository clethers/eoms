import { formatDateTime } from '../../shared/dateFormat.js';
import { fetchMySubmittedInspections } from '../../services/dataService.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { buildInspectionSummaryHtml } from '../../shared/inspectionSummary.js';
import { escapeHTML } from '../../shared/security.js';
import { navigateTo } from '../../components/Router.js';
import { formatStatus } from '../../shared/statusFormatter.js';

export default class SavedDraftsView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>Drafts</h2>
            <div id="drafts-list">Loading...</div>
            <div id="history-preview-modal" style="display: none; margin-top: 1rem; padding: 1rem; border: 1px solid #ccc; position: relative;">
                <button id="close-preview" style="position: absolute; right: 1rem; top: 1rem;">Close</button>
                <div id="history-preview-content"></div>
            </div>
        `;

        const listDiv = container.querySelector('#drafts-list');
        const previewModal = container.querySelector('#history-preview-modal');
        const previewContent = container.querySelector('#history-preview-content');
        
        container.querySelector('#close-preview').addEventListener('click', () => {
            previewModal.style.display = 'none';
        });

        try {
            const allItems = await fetchMySubmittedInspections(getActiveProfileId());
            const items = allItems.filter(i => i.status === 'DRAFT');
            if (items.length === 0) {
                listDiv.innerHTML = '<p>No saved drafts found.</p>';
            } else {
                listDiv.innerHTML = `
                    <table style="width: 100%; text-align: left; margin-bottom: 1rem;">
                        <thead><tr><th>RN No</th><th>Client</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>
                            ${items.map(i => `
                                <tr>
                                    <td>${escapeHTML(i.rnNo || 'Draft')}</td>
                                    <td>${escapeHTML(i.clientName || 'N/A')}</td>
                                    <td>${escapeHTML(formatDateTime(i.dateTime))}</td>
                                    <td><span style="padding: 0.2rem 0.5rem; background: #e2e8f0; border-radius: 4px; font-size: 0.85rem;">${escapeHTML(formatStatus(i.status || 'DRAFT'))}</span></td>
                                    <td>
                                        <div class="table-actions">
                                        <button class="btn-sm" data-action="preview" data-id="${i.id}" title="View Summary">View</button>
                                        <button class="btn-sm" data-action="edit" data-id="${i.id}" title="Edit" style="background: var(--brand-green); color: white;">Edit</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                
                listDiv.addEventListener('click', (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;
                    const id = parseInt(btn.dataset.id, 10);
                    const item = items.find(x => x.id === id);
                    
                    if (btn.dataset.action === 'preview') {
                        previewContent.innerHTML = buildInspectionSummaryHtml(item);
                        if (item.qaNotes) {
                            previewContent.innerHTML += `<div style="margin-top: 1rem; padding: 1rem; background: #fef2f2; border: 1px solid #fca5a5;"><strong>Reviewer Notes:</strong> ${escapeHTML(item.qaNotes)}</div>`;
                        }
                        previewModal.style.display = 'block';
                    } else if (btn.dataset.action === 'edit') {
                        sessionStorage.setItem('currentOcularDraftId', id);
                        if (item.qaNotes) alert('QA Notes: ' + item.qaNotes);
                        navigateTo('/ocular');
                    }
                });
            }
        } catch (e) {
            listDiv.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
        }
        
        return container;
    }
}
