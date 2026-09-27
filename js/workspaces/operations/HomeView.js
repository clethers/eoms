import { liveRefresh } from '../../services/realtime.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { getProfiles } from '../../services/userService.js';
import { fetchAllAssignedInspections, fetchPendingInstallations, fetchMySubmittedInspections } from '../../services/dataService.js';
import { navigateTo } from '../../components/Router.js';
import { escapeHTML } from '../../shared/security.js';
import { btnContent } from '../../shared/icons.js';

export default class HomeView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';

        container.innerHTML = `
            <div id="home-content">
                <div class="skeleton skeleton-title" style="width: 40%;"></div>
                <div style="display:flex; gap: 1.5rem; margin-top: 1rem; flex-wrap: wrap;">
                    <div class="skeleton skeleton-card" style="flex: 1; min-width: 150px; height: 100px;"></div>
                    <div class="skeleton skeleton-card" style="flex: 1; min-width: 150px; height: 100px;"></div>
                    <div class="skeleton skeleton-card" style="flex: 1; min-width: 150px; height: 100px;"></div>
                    <div class="skeleton skeleton-card" style="flex: 1; min-width: 150px; height: 100px;"></div>
                </div>
            </div>
        `;

        this.loadHome(container.querySelector('#home-content'));
        liveRefresh('ops-home', ['ocular_inspections', 'installation_records'], container, () => this.loadHome(container.querySelector('#home-content')));

        return container;
    }

    async loadHome(container) {
        try {
            const profileId = getActiveProfileId();
            const profiles = await getProfiles();
            const profile = profiles.find(p => p.id === profileId);
            const fullName = profile ? profile.fullName : 'there';

            const [assigned, ready, mySubmissions] = await Promise.all([
                fetchAllAssignedInspections(),
                fetchPendingInstallations(),
                fetchMySubmittedInspections(profileId)
            ]);

            const draftCount = mySubmissions.filter(i => i.status === 'DRAFT').length;
            const rejectedCount = mySubmissions.filter(i => i.status === 'REJECTED').length;

            container.innerHTML = `
                <h2 style="margin-top: 0;">Welcome back, ${escapeHTML(fullName)}</h2>
                <p style="color: #6b7684; margin-top: -0.5rem;">Here's what's on your plate today.</p>

                <div style="display:flex; gap: 1.5rem; margin-top: 1.5rem; margin-bottom: 2rem; flex-wrap: wrap;">
                    <div class="home-stat" data-link-to="/ocular/assigned" style="cursor:pointer; background: var(--brand-blue-soft); padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                        <h3 style="font-size: 2rem; margin: 0; color: var(--brand-blue);">${assigned.length}</h3>
                        <p style="margin: 0.5rem 0 0; color: var(--brand-blue);">My Inspections</p>
                    </div>
                    <div class="home-stat" data-link-to="/ocular/ready" style="cursor:pointer; background: var(--brand-blue-soft); padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                        <h3 style="font-size: 2rem; margin: 0; color: var(--brand-blue);">${ready.length}</h3>
                        <p style="margin: 0.5rem 0 0; color: var(--brand-blue);">My Installations</p>
                    </div>
                    <div class="home-stat" data-link-to="/ocular/drafts" style="cursor:pointer; background:#fffbeb; padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                        <h3 style="font-size: 2rem; margin: 0; color: #92400e;">${draftCount}</h3>
                        <p style="margin: 0.5rem 0 0; color: #d97706;">Drafts</p>
                    </div>
                    <div class="home-stat" data-link-to="/ocular/history" style="cursor:pointer; background:#fef2f2; padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                        <h3 style="font-size: 2rem; margin: 0; color: #991b1b;">${rejectedCount}</h3>
                        <p style="margin: 0.5rem 0 0; color: #ef4444;">Needs Revision</p>
                    </div>
                </div>

                <div style="display:flex; gap: 1rem; flex-wrap: wrap;">
                    <button id="home-new-inspection-btn" style="padding: 0.75rem 1.5rem; font-size: 1rem;">${btnContent('plus', 'New Inspection')}</button>
                    <button id="home-tickets-btn" style="padding: 0.75rem 1.5rem; font-size: 1rem; background: #e2e8f0; color: #334155;">${btnContent('lifebuoy', 'Support Tickets')}</button>
                </div>
            `;

            container.querySelectorAll('.home-stat').forEach(el => {
                el.addEventListener('click', () => navigateTo(el.dataset.linkTo));
            });

            const newBtn = container.querySelector('#home-new-inspection-btn');
            if (newBtn) newBtn.addEventListener('click', () => navigateTo('/ocular'));

            const ticketsBtn = container.querySelector('#home-tickets-btn');
            if (ticketsBtn) ticketsBtn.addEventListener('click', () => navigateTo('/ocular/tickets'));
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Error loading home: ${e.message}</p>`;
        }
    }
}
