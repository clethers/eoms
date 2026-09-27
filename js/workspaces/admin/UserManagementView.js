import { getProfiles, createUser } from '../../services/userService.js';
import { escapeHTML } from '../../shared/security.js';
import { formatStatus } from '../../shared/statusFormatter.js';

export default class UserManagementView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>Users</h2>
            <div class="form-panel">
                <h3>Add New User</h3>
                <form id="add-user-form" class="form-row">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" name="fullName" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="tel" name="phone">
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select name="role" required>
                            <option value="operations">Operations</option>
                            <option value="customer_care_manager">Manager</option>
                            <option value="lead_engineer">Lead Engineer</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit">Add User</button>
                </form>
            </div>
            <div id="users-table-container">
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
            </div>
        `;

        const form = container.querySelector('#add-user-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            try {
                await createUser({
                    fullName: formData.get('fullName'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    role: formData.get('role'),
                    department: 'Operations', // Default
                    status: 'ACTIVE'
                });
                form.reset();
                this.loadUsers(container.querySelector('#users-table-container'));
            } catch (err) {
                alert('Error creating user: ' + err.message);
            }
        });

        this.loadUsers(container.querySelector('#users-table-container'));

        return container;
    }

    async loadUsers(container) {
        try {
            const profiles = await getProfiles();
            container.innerHTML = `
                <table style="width: 100%; text-align: left;">
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${profiles.map(p => `
                            <tr>
                                <td>${escapeHTML(p.fullName)}</td>
                                <td>${escapeHTML(p.email)}</td>
                                <td>${escapeHTML(p.role)}</td>
                                <td><span style="background: ${p.status === 'ACTIVE' ? '#d1fae5' : '#fee2e2'}; color: ${p.status === 'ACTIVE' ? '#065f46' : '#991b1b'}; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${escapeHTML(formatStatus(p.status))}</span></td>
                                <td>
                                    <button class="user-profile-btn btn-sm" data-id="${p.id}" title="Staff Profile" style="background-color: #6366f1; color: white;">Profile</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.querySelectorAll('.user-profile-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    const profile = profiles.find(p => p.id === id);
                    if (!profile) return;

                    const modal = document.createElement('div');
                    modal.style.position = 'fixed';
                    modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
                    modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
                    modal.style.zIndex = '1000';
                    
                    modal.innerHTML = `
                        <div style="background: white; padding: 2rem; border-radius: 8px; width: 400px; max-width: 90vw;">
                            <h3 style="margin-top: 0;">Staff Profile: ${escapeHTML(profile.fullName)}</h3>
                            <form id="staff-profile-form" class="form-stack">
                                <div class="form-group">
                                    <label>Email Address</label>
                                    <input type="email" name="email" value="${escapeHTML(profile.email)}" required>
                                </div>
                                <div class="form-group">
                                    <label>Phone Number</label>
                                    <input type="text" name="phone" value="${escapeHTML(profile.phone || '')}" placeholder="+63 912 345 6789">
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Role</label>
                                        <select name="role">
                                            <option value="operations" ${profile.role === 'operations' ? 'selected' : ''}>Operations</option>
                                            <option value="customer_care_manager" ${profile.role === 'customer_care_manager' ? 'selected' : ''}>Manager</option>
                                            <option value="lead_engineer" ${profile.role === 'lead_engineer' ? 'selected' : ''}>Lead Engineer</option>
                                            <option value="admin" ${profile.role === 'admin' ? 'selected' : ''}>Admin</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Status</label>
                                        <select name="status">
                                            <option value="ACTIVE" ${profile.status === 'ACTIVE' ? 'selected' : ''}>Active</option>
                                            <option value="SUSPENDED" ${profile.status === 'SUSPENDED' ? 'selected' : ''}>Suspended</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Department</label>
                                    <input type="text" name="department" value="${escapeHTML(profile.department || '')}">
                                </div>
                                <div class="modal-actions">
                                    <button type="button" id="staff-close-btn" style="background: #e2e8f0; color: #333;">Close</button>
                                    <button type="submit" style="background: var(--brand-green); color: white;">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    
                    modal.querySelector('#staff-close-btn').addEventListener('click', () => {
                        document.body.removeChild(modal);
                    });

                    modal.querySelector('#staff-profile-form').addEventListener('submit', async (e2) => {
                        e2.preventDefault();
                        const formData = new FormData(e2.target);
                        const updates = {
                            email: formData.get('email'),
                            phone: formData.get('phone'),
                            role: formData.get('role'),
                            status: formData.get('status'),
                            department: formData.get('department')
                        };
                        
                        try {
                            const { updateUser } = await import('../../services/userService.js');
                            await updateUser(id, updates);
                            document.body.removeChild(modal);
                            this.loadUsers(container);
                        } catch(err) {
                            alert('Error updating staff profile: ' + err.message);
                        }
                    });
                });
            });

        } catch (e) {
            container.innerHTML = `<p style="color:red;">Failed to load users: ${e.message}</p>`;
        }
    }
}
