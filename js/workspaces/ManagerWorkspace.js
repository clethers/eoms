import QAReviewQueueView from './manager/QAReviewQueueView.js';
import SalesPipelineView from './manager/SalesPipelineView.js';
import PendingSiteVisitsView from './manager/PendingSiteVisitsView.js';
import ClientDirectoryView from './manager/ClientDirectoryView.js';
import InstallationsRegisterView from './manager/InstallationsRegisterView.js';
import SupportTicketsHubView from './manager/SupportTicketsHubView.js';
import CalendarView from './manager/CalendarView.js';
import AnalyticsDashboardView from './manager/AnalyticsDashboardView.js';
import { getActiveProfile } from '../components/ActiveProfilePicker.js';

export default class ManagerWorkspace {
    async render(path) {
        // Customer Care lands on Clients; other roles keep For Review as the /manager default.
        if (path === '/manager' && getActiveProfile()?.role === 'customer_care_manager') {
            path = '/manager/pipeline';
            history.replaceState(null, null, path);
        }
        const container = document.createElement('div');
        container.className = 'workspace-layout';
        
        container.innerHTML = `
            <aside class="sidebar">
                <nav class="sidebar-nav">
                    <div class="sidebar-category">Operations & Review</div>
                    <a href="/manager/qa" class="${path === '/manager/qa' || path === '/manager' ? 'active' : ''}" data-link>For Review</a>
                    <a href="/manager/pendingvisits" class="${path === '/manager/pendingvisits' ? 'active' : ''}" data-link>Pending Inspections</a>
                    <a href="/manager/calendar" class="${path === '/manager/calendar' ? 'active' : ''}" data-link>Calendar</a>
                    
                    <div class="sidebar-category">CRM & Business</div>
                    <a href="/manager/analytics" class="${path === '/manager/analytics' ? 'active' : ''}" data-link>Reports</a>
                    <a href="/manager/pipeline" class="${path === '/manager/pipeline' ? 'active' : ''}" data-link>Clients</a>
                    <a href="/manager/clientsearch" class="${path === '/manager/clientsearch' ? 'active' : ''}" data-link>Inspection Records</a>
                    
                    <div class="sidebar-category">Fulfillment & Support</div>
                    <a href="/manager/installations" class="${path === '/manager/installations' ? 'active' : ''}" data-link>Installations</a>
                    <a href="/manager/tickets" class="${path === '/manager/tickets' ? 'active' : ''}" data-link>Support Tickets</a>
                </nav>
            </aside>
            <main class="main-view" id="manager-main">
                <!-- Content injected here -->
            </main>
        `;
        
        const main = container.querySelector('#manager-main');
        
        let view;
        if (path === '/manager/qa' || path === '/manager') {
            view = new QAReviewQueueView();
        } else if (path === '/manager/analytics') {
            view = new AnalyticsDashboardView();
        } else if (path === '/manager/pipeline') {
            view = new SalesPipelineView();
        } else if (path === '/manager/pendingvisits') {
            view = new PendingSiteVisitsView();
        } else if (path === '/manager/calendar') {
            view = new CalendarView();
        } else if (path === '/manager/clientsearch') {
            view = new ClientDirectoryView();
        } else if (path === '/manager/installations') {
            view = new InstallationsRegisterView();
        } else if (path === '/manager/tickets') {
            view = new SupportTicketsHubView();
        } else {
            main.innerHTML = `<div class="card"><h2>Placeholder</h2><p>View for ${path}</p></div>`;
        }
        
        if (view) {
            main.innerHTML = '<div class="card"><div class="skeleton skeleton-title" style="width: 30%;"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div>'; view.render().then(el => { main.innerHTML = ''; main.appendChild(el); }).catch(e => { main.innerHTML = `<div class="card"><h3 style="color:red">Error</h3><p>${e.message}</p></div>`; });
        }
        
        return container;
    }
}
