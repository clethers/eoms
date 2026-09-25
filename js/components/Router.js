import { renderWorkspaceSwitcher } from './WorkspaceSwitcher.js';
import { getActiveProfileId } from './ActiveProfilePicker.js';
import { getProfiles } from '../services/userService.js';

const routes = [
    { prefix: '/admin', importFn: () => import('../workspaces/AdminWorkspace.js') },
    { prefix: '/manager', importFn: () => import('../workspaces/ManagerWorkspace.js') },
    { prefix: '/ocular', importFn: () => import('../workspaces/OperationsWorkspace.js') }
];

export async function navigateTo(url) {
    history.pushState(null, null, url);
    await router();
}

export async function router() {
    let path = location.pathname;
    
    // Default route logic
    if (path === '/' || path === '') {
        const activeId = getActiveProfileId();
        let defaultPath = '/ocular';
        
        if (activeId) {
            const profiles = await getProfiles();
            const profile = profiles.find(p => p.id === activeId);
            if (profile) {
                if (profile.role === 'admin') defaultPath = '/admin';
                else if (profile.role === 'field_inspector') defaultPath = '/ocular';
                else defaultPath = '/manager';
            }
        }
        
        path = defaultPath;
        history.replaceState(null, null, path);
    }
    
    // Update workspace switcher
    renderWorkspaceSwitcher('workspace-switcher-container', path);
    
    const match = routes.find(r => path.startsWith(r.prefix));
    const container = document.getElementById('app-content');
    
    if (match) {
        try {
            const module = await match.importFn();
            // Assuming each workspace exports a default class with a render(path) method
            const WorkspaceClass = module.default;
            const view = new WorkspaceClass();
            container.innerHTML = '';
            
            const element = await view.render(path);
            if (element) {
                container.appendChild(element);
            }
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="card" style="margin: 2rem;"><h2>Error loading workspace</h2><pre>${e.message}</pre></div>`;
        }
    } else {
        container.innerHTML = `<div class="card" style="margin: 2rem;"><h2>404 - Not Found</h2><p>The path ${path} does not exist.</p></div>`;
    }
}

// Global click listener for router links
document.body.addEventListener('click', e => {
    // Find closest anchor tag with data-link
    const link = e.target.closest('a[data-link]');
    if (link) {
        e.preventDefault();
        navigateTo(link.getAttribute('href'));
    }
});

window.addEventListener('popstate', router);
