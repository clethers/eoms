import { getActiveProfileId } from './ActiveProfilePicker.js';
import { getProfiles } from '../services/userService.js';

export async function renderWorkspaceSwitcher(containerId, currentPath) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const allTabs = [
        { href: '/ocular', label: 'Operations' },
        { href: '/manager', label: 'Manager' },
        { href: '/admin', label: 'Admin' }
    ];

    // Only show the tab matching the active profile's role - a profile
    // should never be able to jump into a workspace outside its own role.
    let allowedHref = null;
    const activeId = getActiveProfileId();
    if (activeId) {
        const profiles = await getProfiles();
        const profile = profiles.find(p => p.id === activeId);
        if (profile) {
            if (profile.role === 'admin') allowedHref = '/admin';
            else if (profile.role === 'field_inspector') allowedHref = '/ocular';
            else allowedHref = '/manager';
        }
    }

    const tabs = allowedHref ? allTabs.filter(t => t.href === allowedHref) : allTabs;

    container.innerHTML = `
        <div class="workspace-switcher">
            ${tabs.map(t => `<a href="${t.href}" class="${currentPath.startsWith(t.href) ? 'active' : ''}" data-link>${t.label}</a>`).join('')}
        </div>
    `;
}
