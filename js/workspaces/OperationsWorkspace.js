import HomeView from './operations/HomeView.js';
import OcularFormView from './operations/OcularFormView.js';
import AssignedQueueView from './operations/AssignedQueueView.js';
import ReadyQueueView from './operations/ReadyQueueView.js';
import InstallationFormView from './operations/InstallationFormView.js';
import HistoryView from './operations/HistoryView.js';
import SavedDraftsView from './operations/SavedDraftsView.js';
import SupportTicketsView from './operations/SupportTicketsView.js';

export default class OperationsWorkspace {
    async render(path) {
        const container = document.createElement('div');
        container.className = 'workspace-layout';
        
        container.innerHTML = `
            <aside class="sidebar">
                <nav class="sidebar-nav">
                    <div class="sidebar-category">Overview</div>
                    <a href="/ocular/home" class="${path === '/ocular/home' ? 'active' : ''}" data-link>Home</a>

                    <div class="sidebar-category">Field Work</div>
                    <a href="/ocular" class="${path === '/ocular' ? 'active' : ''}" data-link>Site Inspection</a>
                    <a href="/ocular/assigned" class="${path === '/ocular/assigned' ? 'active' : ''}" data-link>Pending Inspection</a>
                    
                    <div class="sidebar-category">INSTALLATIONS</div>
                    <a href="/ocular/ready" class="${path === '/ocular/ready' ? 'active' : ''}" data-link>All Installations</a>
                    <a href="/ocular/installation" class="${path === '/ocular/installation' ? 'active' : ''}" data-link>Installation Form</a>
                    
                    <div class="sidebar-category">Activity & Support</div>
                    <a href="/ocular/drafts" class="${path === '/ocular/drafts' ? 'active' : ''}" data-link>Saved Drafts</a>
                    <a href="/ocular/history" class="${path === '/ocular/history' ? 'active' : ''}" data-link>My History</a>
                    <a href="/ocular/tickets" class="${path === '/ocular/tickets' ? 'active' : ''}" data-link>Help & Support</a>
                </nav>
            </aside>
            <main class="main-view" id="operations-main">
                <!-- Content injected here -->
            </main>
        `;
        
        const main = container.querySelector('#operations-main');
        
        let view;
        if (path === '/ocular/home') view = new HomeView();
        else if (path === '/ocular') view = new OcularFormView();
        else if (path === '/ocular/assigned') view = new AssignedQueueView();
        else if (path === '/ocular/ready') view = new ReadyQueueView();
        else if (path === '/ocular/installation') view = new InstallationFormView();
        else if (path === '/ocular/drafts') view = new SavedDraftsView();
        else if (path === '/ocular/history') view = new HistoryView();
        else if (path === '/ocular/tickets') view = new SupportTicketsView();
        else {
            main.innerHTML = `<div class="card"><h2>Placeholder</h2><p>Path ${path} is not found.</p></div>`;
        }
        
        if (view) {
            main.innerHTML = '<div class="card"><div class="skeleton skeleton-title" style="width: 30%;"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div>'; view.render().then(el => { main.innerHTML = ''; main.appendChild(el); }).catch(e => { main.innerHTML = `<div class="card"><h3 style="color:red">Error</h3><p>${e.message}</p></div>`; });
        }
        
        return container;
    }
}
