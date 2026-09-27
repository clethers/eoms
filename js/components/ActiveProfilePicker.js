// Signed-in user state + header user badge.
// (File name kept for import compatibility: getActiveProfileId / profileEvents
// are imported across the app.)
import { supabase } from '../services/supabaseClient.js';
import { escapeHTML } from '../shared/security.js';

export const profileEvents = new EventTarget();

const ROLE_LABELS = {
    admin: 'Admin/Owner',
    customer_care_manager: 'Customer Care',
    lead_engineer: 'Engineering',
    operations: 'Operations'
};

// Workspace prefixes each role may open. Admin sees everything.
const ROLE_PREFIXES = {
    admin: ['/admin', '/manager', '/ocular'],
    customer_care_manager: ['/manager'],
    lead_engineer: ['/manager'],
    operations: ['/ocular']
};

let activeProfile = null;

export function roleLabel(role) {
    return ROLE_LABELS[role] || role || '';
}

export function roleHome(role) {
    if (role === 'admin') return '/admin';
    if (role === 'operations') return '/ocular/home';
    if (role === 'customer_care_manager' || role === 'lead_engineer') return '/manager';
    return null;
}

export function allowedPrefixes(role) {
    return ROLE_PREFIXES[role] || [];
}

export function isPathAllowed(role, path) {
    return allowedPrefixes(role).some(p => path === p || path.startsWith(p + '/'));
}

/** The signed-in user's profile ({ id, email, fullName, role, status }) or null. */
export function getActiveProfile() {
    return activeProfile;
}

export function setActiveProfile(row) {
    activeProfile = {
        id: Number(row.id),
        email: row.email,
        fullName: row.full_name ?? row.fullName ?? row.email,
        role: row.role,
        status: row.status
    };
    sessionStorage.setItem('activeProfileId', String(activeProfile.id));
    return activeProfile;
}

export function clearActiveProfile() {
    activeProfile = null;
    sessionStorage.removeItem('activeProfileId');
}

/**
 * Signs out. If the server call fails (e.g. no network) the local session
 * would survive, so drop the stored supabase token manually as a fallback.
 */
export async function signOutEverywhereLocal() {
    let failed = false;
    try {
        const { error } = await supabase.auth.signOut();
        if (error) failed = true;
    } catch (err) {
        failed = true;
    }
    if (failed) {
        try {
            await supabase.auth.signOut({ scope: 'local' });
        } catch (_) { /* ignore */ }
        try {
            Object.keys(localStorage)
                .filter(k => /^sb-.*-auth-token/.test(k))
                .forEach(k => localStorage.removeItem(k));
        } catch (_) { /* ignore */ }
    }
    clearActiveProfile();
}

/** Renders "<name> · <role>" and a Sign out button into the header. */
export function renderProfilePicker(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const p = activeProfile;
    if (!p) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="user-badge">
            <div class="user-badge-text">
                <span class="user-badge-name">${escapeHTML(p.fullName || '')}</span>
                <span class="user-badge-role">${escapeHTML(roleLabel(p.role))}</span>
            </div>
            <button type="button" class="signout-btn">Sign out</button>
        </div>
    `;

    const btn = container.querySelector('.signout-btn');
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Signing out...';
        await signOutEverywhereLocal();
        // SIGNED_OUT listener in main.js reloads to the login screen; this is a
        // fallback in case the event didn't fire (e.g. network error on signOut).
        clearActiveProfile();
        location.replace('/');
    });
}

export function getActiveProfileId() {
    let id = sessionStorage.getItem('activeProfileId');
    return id ? parseInt(id, 10) : null;
}
