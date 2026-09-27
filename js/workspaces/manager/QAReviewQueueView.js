import { liveRefresh } from '../../services/realtime.js';
import { fetchPendingQAInspections, updateInspectionStatus } from '../../services/dataService.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { buildInspectionSummaryHtml } from '../../shared/inspectionSummary.js';
import { escapeHTML } from '../../shared/security.js';

export default class QAReviewQueueView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>Inspection Approval</h2>
            <div id="qa-queue-container" style="margin-top: 1rem;">
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
            </div>
        `;

        const previewModal = document.createElement('div');
        previewModal.style.display = 'none';
        previewModal.style.position = 'fixed';
        previewModal.style.top = '0'; previewModal.style.left = '0'; previewModal.style.width = '100%'; previewModal.style.height = '100%';
        previewModal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        previewModal.style.zIndex = '1000';
        
        previewModal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 8px; width: 800px; max-width: 90vw; max-height: 90vh; overflow-y: auto; margin: 5vh auto; position: relative;">
                <button type="button" id="close-preview" style="position: absolute; top: 1rem; right: 1rem; background: #e2e8f0; height: var(--control-h);">Close</button>
                <div id="preview-content"></div>
            </div>
        `;
        document.body.appendChild(previewModal);

        previewModal.querySelector('#close-preview').addEventListener('click', () => {
            previewModal.style.display = 'none';
        });

        this.loadQueue(container.querySelector('#qa-queue-container'), previewModal, previewModal.querySelector('#preview-content'));
        liveRefresh('mgr-qa', ['ocular_inspections'], container, () => this.loadQueue(container.querySelector('#qa-queue-container'), previewModal, previewModal.querySelector('#preview-content')));

        return container;
    }

    async loadQueue(container, previewModal, previewContent) {
        try {
            const items = await fetchPendingQAInspections();
            if (items.length === 0) {
                container.innerHTML = '<p>No inspections pending approval.</p>';
                return;
            }
            container.innerHTML = `
                <table style="width: 100%; text-align: left;">
                    <thead><tr><th>RN No</th><th>Client</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${items.map(i => `
                            <tr>
                                <td>${escapeHTML(i.rnNo || 'Draft')}</td>
                                <td>${escapeHTML(i.clientName || 'N/A')}</td>
                                <td>
                                    <div class="table-actions">
                                    <button class="qa-action-btn btn-sm" data-id="${i.id}" data-action="preview">View Summary</button>
                                    <button class="qa-action-btn btn-sm" data-id="${i.id}" data-action="approve" style="background: #10b981; color: white;">Approve</button>
                                    <button class="qa-action-btn btn-sm" data-id="${i.id}" data-action="reject" style="background: #ef4444; color: white;">Reject</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.querySelectorAll('.qa-action-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const action = e.target.dataset.action;
                    const item = items.find(x => x.id === id);

                    if (action === 'preview') {
                        previewContent.innerHTML = buildInspectionSummaryHtml(item);
                        previewModal.style.display = 'block';
                        return;
                    }

                    let qaNotes = '';
                    
                    if (action === 'reject') {
                        qaNotes = prompt('Enter reason for rejection:');
                        if (qaNotes === null) return; // User cancelled
                    }

                    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
                    
                    try {
                        const { updateInspectionStatus, updateLeadStageByOcularId } = await import('../../services/dataService.js');
                        await updateInspectionStatus(id, newStatus, {
                            qaReviewedBy: getActiveProfileId(),
                            qaReviewedAt: new Date().toISOString(),
                            qaNotes: qaNotes
                        });
                        
                        // Only approval advances the lead; a failure here must not block approval.
                        if (action === 'approve') {
                            try {
                                await updateLeadStageByOcularId(id, 'SITE_VISIT_COMPLETED');
                            } catch (stageErr) {
                                console.error('Failed to update lead stage after approval:', stageErr);
                            }
                        }
                        
                        alert('Status updated!');
                        this.loadQueue(container, previewModal, previewContent);
                        previewModal.style.display = 'none';
                    } catch(err) {
                        alert('Error: ' + err.message);
                    }
                });
            });
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Error loading approval queue: ${e.message}</p>`;
        }
    }
}
