import { getAll, COLLECTIONS } from '../../services/localDb.js';
import { getCatalog } from '../../services/masterDataService.js';
import { formatStatus } from '../../shared/statusFormatter.js';

export default class AnalyticsDashboardView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>Reports</h2>
            <div id="analytics-content">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; margin-top: 1rem;">
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="skeleton skeleton-card" style="height: 300px;"></div>
                    <div class="skeleton skeleton-card" style="height: 300px;"></div>
                </div>
            </div>
        `;

        // Render asynchronously
        this.loadDashboard(container.querySelector('#analytics-content'));

        return container;
    }

    async loadDashboard(container) {
        try {
            const leads = await getAll(COLLECTIONS.SALES_LEADS);
            const oculars = await getAll(COLLECTIONS.OCULAR_INSPECTIONS);
            const installs = await getAll(COLLECTIONS.INSTALLATION_RECORDS);
            const catalog = await getCatalog();

            // Calculate KPIs
            const totalLeads = leads.length;
            const completedInstalls = installs.filter(i => i.status === 'COMMISSIONED').length;
            
            // Win/Loss calculation
            const wonLeads = leads.filter(l => l.stage === 'QUOTE_ACCEPTED' || l.stage.includes('INSTALLATION') || l.stage === 'JOB_CHECKOUT_COMPLETE').length;
            const lostLeads = leads.filter(l => l.stage === 'CANCELED').length;
            const winRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

            // Leads by Stage for Pie Chart
            const stageCounts = {};
            leads.forEach(l => {
                const stageLabel = formatStatus(l.stage); stageCounts[stageLabel] = (stageCounts[stageLabel] || 0) + 1;
            });

            // Low Stock Items for Bar Chart
            const lowStockItems = catalog
                .filter(c => c.currentStock !== undefined && c.currentStock < 50)
                .sort((a, b) => a.currentStock - b.currentStock)
                .slice(0, 5);

            container.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div style="background: var(--brand-blue-soft); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(24,120,184,0.35); text-align: center;">
                        <h3 style="margin: 0; color: var(--brand-blue); font-size: 1rem;">Total Sales Leads</h3>
                        <div style="font-size: 2.5rem; font-weight: bold; color: var(--brand-blue); margin-top: 0.5rem;">${totalLeads}</div>
                    </div>
                    <div style="background: #ecfdf5; padding: 1.5rem; border-radius: 8px; border: 1px solid #a7f3d0; text-align: center;">
                        <h3 style="margin: 0; color: #064e3b; font-size: 1rem;">Completed Installations</h3>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #10b981; margin-top: 0.5rem;">${completedInstalls}</div>
                    </div>
                    <div style="background: #fdf4ff; padding: 1.5rem; border-radius: 8px; border: 1px solid #fbcfe8; text-align: center;">
                        <h3 style="margin: 0; color: #701a75; font-size: 1rem;">Quote Win Rate</h3>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #d946ef; margin-top: 0.5rem;">${winRate}%</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div style="border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; background: white;">
                        <h3 style="margin-top: 0; text-align: center;">Clients by Stage</h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="pipelineChart"></canvas>
                        </div>
                    </div>
                    <div style="border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; background: white;">
                        <h3 style="margin-top: 0; text-align: center;">Critical Low Stock Items</h3>
                        ${lowStockItems.length > 0 ? `
                            <div style="position: relative; height: 300px; width: 100%;">
                                <canvas id="inventoryChart"></canvas>
                            </div>
                        ` : `<p style="text-align: center; color: #10b981; margin-top: 4rem;">All inventory levels are healthy!</p>`}
                    </div>
                </div>
            `;

            // Wait for DOM to paint before initializing charts
            setTimeout(() => {
                const ctxPipeline = document.getElementById('pipelineChart');
                if (ctxPipeline) {
                    new Chart(ctxPipeline, {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(stageCounts).map(s => s.replace(/_/g, ' ')),
                            datasets: [{
                                data: Object.values(stageCounts),
                                backgroundColor: [
                                    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#14b8a6'
                                ]
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                }

                const ctxInventory = document.getElementById('inventoryChart');
                if (ctxInventory && lowStockItems.length > 0) {
                    new Chart(ctxInventory, {
                        type: 'bar',
                        data: {
                            labels: lowStockItems.map(item => item.itemName.substring(0, 15) + '...'),
                            datasets: [{
                                label: 'Current Stock',
                                data: lowStockItems.map(item => item.currentStock),
                                backgroundColor: '#ef4444'
                            }]
                        },
                        options: { 
                            responsive: true, 
                            maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true } }
                        }
                    });
                } else if (ctxInventory) {
                    ctxInventory.parentElement.innerHTML += '<p style="text-align:center; color: #10b981; margin-top: 2rem;">All inventory levels are healthy!</p>';
                }
            }, 100);

        } catch(e) {
            container.innerHTML = `<p style="color:red;">Error loading dashboard: ${e.message}</p>`;
        }
    }
}
