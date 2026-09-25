import DashboardView from './admin/DashboardView.js';
import UserManagementView from './admin/UserManagementView.js';
import AuditLogsView from './admin/AuditLogsView.js';
import ClientDirectoryView from './admin/ClientDirectoryView.js';
import MasterDataCatalogView from './admin/MasterDataCatalogView.js';

export default class AdminWorkspace {
    async render(path) {
        const container = document.createElement('div');
        container.className = 'workspace-layout';
        
        container.innerHTML = `
            <aside class="sidebar">
                <nav class="sidebar-nav">
                    <div class="sidebar-category">Overview</div>
                    <a href="/admin/dashboard" class="${path === '/admin/dashboard' || path === '/admin' ? 'active' : ''}" data-link>System Dashboard</a>
                    
                    <div class="sidebar-category">Security & Access</div>
                    <a href="/admin/users" class="${path === '/admin/users' ? 'active' : ''}" data-link>User Management</a>
                    <a href="/admin/audit" class="${path === '/admin/audit' ? 'active' : ''}" data-link>Audit Logs</a>
                    
                    <div class="sidebar-category">Core Data</div>
                    <a href="/admin/clients" class="${path === '/admin/clients' ? 'active' : ''}" data-link>Client Directory</a>
                    <a href="/admin/inventory" class="${path === '/admin/inventory' ? 'active' : ''}" data-link>Inventory</a>
                </nav>
            </aside>
            <main class="main-view" id="admin-main">
                <!-- Content injected here -->
            </main>
        `;
        
        const main = container.querySelector('#admin-main');
        
        let view;
        if (path === '/admin/dashboard' || path === '/admin') {
            view = new DashboardView();
        } else if (path === '/admin/users') {
            view = new UserManagementView();
        } else if (path === '/admin/audit') {
            view = new AuditLogsView();
        } else if (path === '/admin/clients') {
            view = new ClientDirectoryView();
        } else if (path === '/admin/inventory') {
            view = new MasterDataCatalogView();
        }
        
        if (view) {
            main.innerHTML = '<div class="card"><div class="skeleton skeleton-title" style="width: 30%;"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div><div class="skeleton skeleton-table-row"></div></div>'; view.render().then(el => { main.innerHTML = ''; main.appendChild(el); }).catch(e => { main.innerHTML = `<div class="card"><h3 style="color:red">Error</h3><p>${e.message}</p></div>`; });
        }
        
        return container;
    }
}
