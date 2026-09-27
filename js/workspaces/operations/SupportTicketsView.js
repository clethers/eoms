import { fetchSupportTickets, createSupportTicket, fetchMySubmittedInspections } from '../../services/dataService.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { escapeHTML } from '../../shared/security.js';
import { formatStatus } from '../../shared/statusFormatter.js';

export default class SupportTicketsView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>Support Tickets</h2>
            <div class="form-panel">
                <h3>File New Ticket</h3>
                <form id="file-ticket-form" class="form-stack">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Client Name</label>
                            <input type="text" name="clientName" required>
                        </div>
                        <div class="form-group">
                            <label>Related Ocular (Optional)</label>
                            <select name="ocularId" id="ticket-ocular-select">
                                <option value="">None</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Priority</label>
                            <select name="priority" required>
                                <option value="NORMAL">Normal</option>
                                <option value="HIGH">High</option>
                                <option value="LOW">Low</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Subject</label>
                        <input type="text" name="subject" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" rows="3" required></textarea>
                    </div>
                    <div>
                        <button type="submit" style="height: var(--control-h);">Submit Ticket</button>
                    </div>
                </form>
            </div>
            <div id="tickets-list">
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
            </div>
        `;

        this.populateOcularDropdown(container.querySelector('#ticket-ocular-select'));

        const form = container.querySelector('#file-ticket-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            try {
                await createSupportTicket({
                    clientName: formData.get('clientName'),
                    ocularId: formData.get('ocularId') ? parseInt(formData.get('ocularId'), 10) : null,
                    priority: formData.get('priority'),
                    subject: formData.get('subject'),
                    description: formData.get('description'),
                    createdBy: getActiveProfileId()
                });
                form.reset();
                this.loadTickets(container.querySelector('#tickets-list'));
                alert('Ticket filed successfully.');
            } catch (err) {
                alert('Error creating ticket: ' + err.message);
            }
        });

        this.loadTickets(container.querySelector('#tickets-list'));

        return container;
    }

    async populateOcularDropdown(selectEl) {
        try {
            const items = await fetchMySubmittedInspections(getActiveProfileId());
            items.forEach(i => {
                const opt = document.createElement('option');
                opt.value = i.id;
                opt.textContent = `${i.rnNo || 'Draft'} - ${i.clientName}`;
                selectEl.appendChild(opt);
            });
        } catch (e) {
            console.error('Failed to load inspections for dropdown', e);
        }
    }

    async loadTickets(container) {
        try {
            const allTickets = await fetchSupportTickets();
            const myTickets = allTickets.filter(t => t.createdBy === getActiveProfileId());
            
            if (myTickets.length === 0) {
                container.innerHTML = '<p>You have no support tickets.</p>';
                return;
            }
            container.innerHTML = `
                <table style="width: 100%; text-align: left;">
                    <thead><tr><th>Date</th><th>Subject</th><th>Priority</th><th>Status</th></tr></thead>
                    <tbody>
                        ${myTickets.map(t => `
                            <tr>
                                <td>${new Date(t.createdAt).toLocaleString()}</td>
                                <td>${escapeHTML(t.subject)}</td>
                                <td>${escapeHTML(t.priority)}</td>
                                <td>${escapeHTML(formatStatus(t.status))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Failed to load tickets: ${e.message}</p>`;
        }
    }
}
