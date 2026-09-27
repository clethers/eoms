import { getActiveProfile, allowedPrefixes } from './ActiveProfilePicker.js';

export async function renderWorkspaceSwitcher(containerId, currentPath) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const allTabs = [
        { href: '/ocular', label: 'Operations' },
        { href: '/manager', label: 'Manager' },
        { href: '/admin', label: 'Admin' }
    ];

    // Only show tabs for workspaces the signed-in role may open.
    const profile = getActiveProfile();
    const allowed = profile ? allowedPrefixes(profile.role) : [];
    const tabs = allTabs.filter(t => allowed.includes(t.href));

    container.innerHTML = `
        <div class="workspace-switcher">
            ${tabs.map(t => `<a href="${t.href}" class="${currentPath.startsWith(t.href) ? 'active' : ''}" data-link>${t.label}</a>`).join('')}
        </div>
    `;
}
