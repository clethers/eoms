export function renderWorkspaceSwitcher(containerId, currentPath) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="workspace-switcher">
            <a href="/ocular" class="${currentPath.startsWith('/ocular') ? 'active' : ''}" data-link>Operations</a>
            <a href="/manager" class="${currentPath.startsWith('/manager') ? 'active' : ''}" data-link>Manager</a>
            <a href="/admin" class="${currentPath.startsWith('/admin') ? 'active' : ''}" data-link>Admin</a>
        </div>
    `;
}
