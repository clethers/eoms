import * as localDb from './services/localDb.js';
import { supabase } from './services/supabaseClient.js';
import {
    renderProfilePicker,
    setActiveProfile,
    clearActiveProfile,
    profileEvents,
    roleHome,
    isPathAllowed,
    isSignOutInProgress
} from './components/ActiveProfilePicker.js';
import { renderNotificationCenter } from './components/NotificationCenter.js';
import { renderLoginView, loadProfileForUser } from './components/LoginView.js';
import { router } from './components/Router.js';

// Force application-wide dates to Philippine Time (UTC+8)
const originalToLocaleString = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function(locales, options) {
    const opts = options || {};
    opts.timeZone = opts.timeZone || 'Asia/Manila';
    return originalToLocaleString.call(this, locales || 'en-US', opts);
};

let appBooted = false;

function showInitError(err) {
    console.error('Failed to initialize app:', err);
    const pre = document.createElement('pre');
    pre.textContent = err?.message || String(err);
    const box = document.createElement('div');
    box.style.cssText = 'padding: 2rem; color: red;';
    box.innerHTML = '<h2>Initialization Error</h2>';
    box.appendChild(pre);
    const content = document.getElementById('app-content');
    content.innerHTML = '';
    content.appendChild(box);
}

function showLogin(message = '') {
    appBooted = false;
    clearActiveProfile();
    document.body.classList.add('auth-locked');
    document.getElementById('workspace-switcher-container').innerHTML = '';
    document.getElementById('notifications-container').innerHTML = '';
    document.getElementById('profile-picker-container').innerHTML = '';
    renderLoginView(document.getElementById('app-content'), {
        message,
        onSignedIn: (profileRow) => bootApp(profileRow, { goHome: true })
    });
}

async function bootApp(profileRow, { goHome }) {
    const profile = setActiveProfile(profileRow);
    appBooted = true;
    document.body.classList.remove('auth-locked');
    document.getElementById('app-content').innerHTML = '';

    try {
        // localDb may still expose an init hook; call it if present.
        if (typeof localDb.initDB === 'function') await localDb.initDB();

        await renderNotificationCenter('notifications-container');
        renderProfilePicker('profile-picker-container');
        profileEvents.dispatchEvent(new Event('profileChanged'));

        const home = roleHome(profile.role) || '/';
        const path = location.pathname;
        if (goHome || path === '/' || path === '' || !isPathAllowed(profile.role, path)) {
            history.replaceState(null, null, home);
        }
        await router();
    } catch (err) {
        showInitError(err);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('auth-locked');

    // Any sign-out (button, token expiry, other tab) returns to the login
    // screen. A full reload guarantees no workspace state or listeners from
    // the previous user survive. Keep this callback synchronous: awaiting
    // supabase calls inside onAuthStateChange can deadlock supabase-js.
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            sessionStorage.removeItem('activeProfileId');
            // The Sign out button redirects itself once the server logout has
            // finished; only redirect here for other sign-outs (expiry, other tab).
            if (appBooted && !isSignOutInProgress()) {
                appBooted = false;
                setTimeout(() => location.replace('/'), 0);
            }
        }
    });

    try {
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (!session?.user) {
            showLogin();
            return;
        }
        const result = await loadProfileForUser(session.user);
        if (result.error) {
            showLogin(result.error);
            return;
        }
        await bootApp(result.profile, { goHome: false });
    } catch (err) {
        console.error('Auth check failed:', err);
        showLogin("Couldn't check your sign-in. Please sign in again.");
    }
});
