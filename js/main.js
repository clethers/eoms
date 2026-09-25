import { initDB } from './services/localDb.js';
import { renderProfilePicker } from './components/ActiveProfilePicker.js';
import { renderNotificationCenter } from './components/NotificationCenter.js';
import { router } from './components/Router.js';

// Force application-wide dates to Philippine Time (UTC+8)
const originalToLocaleString = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function(locales, options) {
    const opts = options || {};
    opts.timeZone = opts.timeZone || 'Asia/Manila';
    return originalToLocaleString.call(this, locales || 'en-US', opts);
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Ensure DB and demo data are initialized
        await initDB();
        
        // Setup Top Nav
        await renderNotificationCenter('notifications-container');
        await renderProfilePicker('profile-picker-container');
        
        // Init router
        await router();
    } catch (err) {
        console.error('Failed to initialize app:', err);
        document.getElementById('app-content').innerHTML = `
            <div style="padding: 2rem; color: red;">
                <h2>Initialization Error</h2>
                <pre>${err.message}</pre>
            </div>
        `;
    }
});
