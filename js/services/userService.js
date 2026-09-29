import { COLLECTIONS, getAll, put, remove } from './localDb.js';
import { recordAudit, diffFields } from './auditLogService.js';

const userLabel = (p) => `User · ${(p && (p.fullName || p.email)) || 'Unknown'}`;
const USER_AUDIT_FIELDS = ['fullName', 'email', 'phone', 'role', 'status', 'department'];

export async function getProfiles() {
    return getAll(COLLECTIONS.PROFILES);
}

export async function createUser(profileData) {
    if (!profileData.department) profileData.department = 'Operations';
    if (!profileData.status) profileData.status = 'ACTIVE';
    const saved = await put(COLLECTIONS.PROFILES, profileData);
    await recordAudit({
        category: 'ADMIN_RBAC',
        eventType: 'CREATE_USER',
        resourceType: 'USER',
        resourceId: saved.id,
        resourceLabel: userLabel(saved),
        description: `User added: ${saved.fullName || saved.email || saved.id}`
    }, { always: true });
    return saved;
}

export async function updateUser(id, updates) {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === id);
    if (!profile) throw new Error('User not found');
    const before = { ...profile };
    Object.assign(profile, updates);
    const saved = await put(COLLECTIONS.PROFILES, profile);
    await recordAudit({
        category: 'ADMIN_RBAC',
        eventType: 'UPDATE_USER',
        resourceType: 'USER',
        resourceId: profile.id,
        resourceLabel: userLabel(before),
        description: `User updated: ${before.fullName || before.email || id}`,
        changesDelta: diffFields(before, profile, USER_AUDIT_FIELDS.filter(k => k in updates))
    });
    return saved;
}
