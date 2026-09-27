import { getLogs, exportLogsCSV } from '../../services/auditLogService.js';
import { escapeHTML } from '../../shared/security.js';
import { btnContent } from '../../shared/icons.js';

export default class AuditLogsView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <div class="page-header">
                <h2>Audit Logs</h2>
                <button id="export-csv-btn">${btnContent('sheet', 'Export CSV')}</button>
            </div>
            <div class="toolbar">
                <input type="text" id="filter-actor" placeholder="Filter by Actor Email">
                <select id="filter-category">
                    <option value="">All Categories</option>
                    <option value="AUTHENTICATION">Authentication</option>
                    <option value="FORM_INSPECTION">Form Inspection</option>
                    <option value="MANAGER_APPROVAL">Manager Approval</option>
                    <option value="FIELD_DISPATCH">Field Dispatch</option>
                    <option value="CUSTOMER_CARE">Customer Care</option>
                    <option value="ADMIN_RBAC">Admin RBAC</option>
                    <option value="DATA_EXPORT">Data Export</option>
                    <option value="CLIENT_RECORDS">Client Records</option>
                </select>
                <button id="apply-filters-btn">${btnContent('filter', 'Apply Filters')}</button>
            </div>
            <div id="logs-table-container" style="margin-top: 1rem;">
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
            </div>
        `;

        const exportBtn = container.querySelector('#export-csv-btn');
        exportBtn.addEventListener('click', async () => {
            try {
                const url = await exportLogsCSV();
                if (!url) {
                    alert('No logs to export.');
                    return;
                }
                const a = document.createElement('a');
                a.href = url;
                a.download = 'audit_logs.csv';
                a.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                alert('Error exporting logs: ' + err.message);
            }
        });

        const applyFiltersBtn = container.querySelector('#apply-filters-btn');
        applyFiltersBtn.addEventListener('click', () => {
            this.loadLogs(container.querySelector('#logs-table-container'), {
                actor: container.querySelector('#filter-actor').value,
                category: container.querySelector('#filter-category').value
            });
        });

        this.loadLogs(container.querySelector('#logs-table-container'));

        return container;
    }

    async loadLogs(container, filters = {}) {
        try {
            let logs = await getLogs();
            if (filters.actor) {
                logs = logs.filter(l => l.actorEmail && l.actorEmail.toLowerCase().includes(filters.actor.toLowerCase()));
            }
            if (filters.category) {
                logs = logs.filter(l => l.category === filters.category);
            }
            
            if (logs.length === 0) {
                container.innerHTML = '<p>No logs found.</p>';
                return;
            }
            container.innerHTML = `
                <table style="width: 100%; text-align: left;">
                    <thead><tr><th>Date</th><th>Actor</th><th>Event</th><th>Resource</th><th>Category</th></tr></thead>
                    <tbody>
                        ${logs.map(l => `
                            <tr>
                                <td>${new Date(l.createdAt).toLocaleString()}</td>
                                <td>${escapeHTML(l.actorEmail)}</td>
                                <td>${escapeHTML(l.eventType)}</td>
                                <td>${escapeHTML(l.resourceType)}</td>
                                <td>${escapeHTML(l.category)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Failed to load logs: ${e.message}</p>`;
        }
    }
}
