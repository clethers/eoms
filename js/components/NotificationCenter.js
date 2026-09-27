import { getAll, put, COLLECTIONS, dbEvents } from '../services/localDb.js';
import { getActiveProfileId, profileEvents } from './ActiveProfilePicker.js';
import { escapeHTML } from '../shared/security.js';

export async function renderNotificationCenter(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const render = async () => {
        const userId = getActiveProfileId();
        if (!userId) {
            container.innerHTML = '';
            return;
        }

        const notifications = await getAll(COLLECTIONS.NOTIFICATIONS, n => n.userId === userId);
        const unreadCount = notifications.filter(n => !n.isRead).length;

        // Sort latest first
        notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        container.innerHTML = `
            <div id="bell-icon" style="font-size: 1.5rem; position: relative; color: white;">
                &#x1F514;&#xFE0E;
                ${unreadCount > 0 ? `<span style="position: absolute; top: -5px; right: -5px; background: red; color: white; border-radius: 50%; font-size: 0.75rem; padding: 2px 6px;">${unreadCount}</span>` : ''}
            </div>
            <div id="notif-dropdown" style="display: none; position: absolute; top: 100%; right: 0; background: white; border: 1px solid #ccc; border-radius: 4px; width: 300px; max-height: 400px; overflow-y: auto; z-index: 2000; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: #333;">
                <h4 style="margin: 0; padding: 1rem; border-bottom: 1px solid #eee; background: #f8fafc;">Notifications</h4>
                ${notifications.length === 0 ? '<p style="padding: 1rem; margin: 0; text-align: center; color: #666;">No notifications</p>' : ''}
                <ul style="list-style: none; margin: 0; padding: 0;">
                    ${notifications.map(n => `
                        <li data-id="${n.id}" class="notif-item" style="padding: 1rem; border-bottom: 1px solid #eee; cursor: pointer; background: ${n.isRead ? 'white' : 'var(--brand-blue-soft)'};">
                            <p style="margin: 0; font-size: 0.9rem;">${escapeHTML(n.message)}</p>
                            <small style="color: #64748b;">${new Date(n.createdAt).toLocaleString()}</small>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;

        const bell = container.querySelector('#bell-icon');
        const dropdown = container.querySelector('#notif-dropdown');

        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });

        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        container.querySelectorAll('.notif-item').forEach(li => {
            li.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.dataset.id, 10);
                const notif = notifications.find(n => n.id === id);
                if (notif && !notif.isRead) {
                    notif.isRead = true;
                    await put(COLLECTIONS.NOTIFICATIONS, notif);
                    render(); // Re-render to update unread count and styles
                }
                
                // If there's a link, navigate
                if (notif && notif.link) {
                    window.history.pushState(null, '', notif.link);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                    dropdown.style.display = 'none';
                }
            });
        });
    };

    // Initial render
    await render();

    // Re-render on profile change or db update
    profileEvents.addEventListener('profileChanged', render);
    dbEvents.addEventListener('notifications_changed', render);
}
