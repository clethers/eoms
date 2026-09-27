import { formatDateTime } from '../../shared/dateFormat.js';
import { fetchAllInstallations } from '../../services/dataService.js';
import { escapeHTML } from '../../shared/security.js';
import { printInstallationRegister } from '../../shared/certificates.js';

export default class InstallationsRegisterView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>Installations Register</h2>
            <div id="installations-table-container" style="margin-top: 1rem;">
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
            </div>
        `;

        this.loadInstallations(container.querySelector('#installations-table-container'));

        return container;
    }

    async loadInstallations(container) {
        try {
            const installations = await fetchAllInstallations();
            if (installations.length === 0) {
                container.innerHTML = '<p>No installations found.</p>';
                return;
            }
            container.innerHTML = `
                <table style="width: 100%; text-align: left;">
                    <thead><tr><th>Inst. No</th><th>Client Name</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${installations.map(i => `
                            <tr>
                                <td>${escapeHTML(i.installationNo)}</td>
                                <td>${escapeHTML(i.clientName)}</td>
                                <td>${escapeHTML(formatDateTime(i.dateTime))}</td>
                                <td>${escapeHTML(i.status)}</td>
                                <td>
                                    <button class="print-btn" data-id="${i.id}">Print Register</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.querySelectorAll('.print-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const record = installations.find(ins => ins.id === id);
                    if (record) printInstallationRegister(record);
                });
            });
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Failed to load installations: ${e.message}</p>`;
        }
    }
}
