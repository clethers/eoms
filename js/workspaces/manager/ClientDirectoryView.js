import { formatDateTime } from '../../shared/dateFormat.js';
import { fetchAllInspections } from '../../services/dataService.js';
import { escapeHTML } from '../../shared/security.js';
import { printOcularCertificate } from '../../shared/certificates.js';

export default class ClientDirectoryView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>Inspection Records</h2>
            <div id="clients-table-container" style="margin-top: 1rem;">
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
            </div>
        `;

        this.loadClients(container.querySelector('#clients-table-container'));

        return container;
    }

    async loadClients(container) {
        try {
            const inspections = await fetchAllInspections();
            if (inspections.length === 0) {
                container.innerHTML = '<p>No clients found.</p>';
                return;
            }
            container.innerHTML = `
                <table style="width: 100%; text-align: left;">
                    <thead><tr><th>RN No</th><th>Client Name</th><th>Address</th><th>Date</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${inspections.map(i => `
                            <tr>
                                <td>${escapeHTML(i.rnNo)}</td>
                                <td>${escapeHTML(i.clientName)}</td>
                                <td>${escapeHTML(i.locationAddress || 'N/A')}</td>
                                <td>${escapeHTML(formatDateTime(i.dateTime))}</td>
                                <td>
                                    <button class="print-btn btn-sm" data-id="${i.id}">Print Certificate</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.querySelectorAll('.print-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const record = inspections.find(ins => ins.id === id);
                    if (record) printOcularCertificate(record);
                });
            });
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Failed to load clients: ${e.message}</p>`;
        }
    }
}
