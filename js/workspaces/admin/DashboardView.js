import { fetchDashboardMetrics } from '../../services/dataService.js';

export default class DashboardView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>System Dashboard</h2>
            <div id="admin-dashboard-content" style="display:flex; gap: 2rem; margin-top: 1rem; flex-wrap: wrap;">
                <div class="skeleton skeleton-card" style="flex: 1; min-width: 150px; height: 120px; margin: 0;"></div>
                <div class="skeleton skeleton-card" style="flex: 1; min-width: 150px; height: 120px; margin: 0;"></div>
                <div class="skeleton skeleton-card" style="flex: 1; min-width: 150px; height: 120px; margin: 0;"></div>
                <div class="skeleton skeleton-card" style="flex: 1; min-width: 150px; height: 120px; margin: 0;"></div>
            </div>
        `;

        // Render asynchronously
        this.loadDashboard(container.querySelector('#admin-dashboard-content'));

        return container;
    }

    async loadDashboard(container) {
        try {
            const metrics = await fetchDashboardMetrics();
            container.innerHTML = `
                <div style="background:var(--brand-blue-soft); padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                    <h3 style="font-size: 2rem; margin: 0; color: var(--brand-blue);">${metrics.totalInspections}</h3>
                    <p style="margin: 0.5rem 0 0; color: var(--brand-blue);">Total Inspections</p>
                </div>
                <div style="background:#fffbeb; padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                    <h3 style="font-size: 2rem; margin: 0; color: #92400e;">${metrics.pendingQA}</h3>
                    <p style="margin: 0.5rem 0 0; color: #d97706;">Pending Approval</p>
                </div>
                <div style="background:#ecfdf5; padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                    <h3 style="font-size: 2rem; margin: 0; color: #065f46;">${metrics.totalInstallations}</h3>
                    <p style="margin: 0.5rem 0 0; color: #10b981;">Installations</p>
                </div>
                <div style="background:#fef2f2; padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                    <h3 style="font-size: 2rem; margin: 0; color: #991b1b;">${metrics.openTickets}</h3>
                    <p style="margin: 0.5rem 0 0; color: #ef4444;">Open Tickets</p>
                </div>
            `;
        } catch(e) {
            container.innerHTML = `<h2 style="color:red;">Error loading dashboard: ${e.message}</h2>`;
        }
    }
}
