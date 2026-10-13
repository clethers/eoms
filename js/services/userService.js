import { COLLECTIONS, getAll, put, remove } from './localDb.js';
import { recordAudit, diffFields } from './auditLogService.js';
import { supabase } from './supabaseClient.js';

const userLabel = (p) => `User · ${(p && (p.fullName || p.email)) || 'Unknown'}`;
const USER_AUDIT_FIELDS = ['fullName', 'email', 'phone', 'role', 'status', 'department', 'deletedAt'];

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

/** A removed (soft-deleted) user: suspended with a deletedAt stamp. */
export const isRemovedUser = (p) => !!(p && p.deletedAt);

/** Why `target` can't be removed by `actorId` (null when allowed). */
export function removeBlockReason(target, profiles, actorId) {
    if (!target) return 'User not found.';
    if (actorId !== null && actorId !== undefined && String(target.id) === String(actorId)) return "You can't remove your own account.";
    if (target.role === 'admin' && target.status !== 'SUSPENDED' && !isRemovedUser(target)) {
        const activeAdmins = profiles.filter(p => p.role === 'admin' && (!p.status || p.status === 'ACTIVE') && !isRemovedUser(p));
        if (activeAdmins.length <= 1) return "This is the last active admin. Add or activate another admin first.";
    }
    return null;
}

/** Soft delete: suspend + stamp deletedAt/deletedBy (no schema change). */
export async function removeUser(id, actorId) {
    const profiles = await getProfiles();
    const reason = removeBlockReason(profiles.find(p => p.id === id), profiles, actorId);
    if (reason) throw new Error(reason);
    return updateUser(id, { status: 'SUSPENDED', deletedAt: new Date().toISOString(), deletedBy: actorId ?? null }, {
        eventType: 'REMOVE_USER', verb: 'User removed'
    });
}

export async function restoreUser(id) {
    return updateUser(id, { status: 'ACTIVE', deletedAt: null, deletedBy: null }, {
        eventType: 'RESTORE_USER', verb: 'User restored'
    });
}

/** Admin sets another user's password via the admin_set_user_password RPC. The password is never logged or audited. */
export async function setUserPassword(id, newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === id);
    if (!profile) throw new Error('User not found');
    const { error } = await supabase.rpc('admin_set_user_password', { target_profile_id: id, new_password: newPassword });
    if (error) {
        const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message || '');
        if (missing) throw new Error('Password reset is not set up yet. Run the SQL migration first (supabase/admin_set_password.sql).');
        if (error.code === '42501') throw new Error('Only an active admin can set passwords.');
        if (error.code === 'P0002') throw new Error('This user has no linked login account.');
        throw new Error('Could not set password. Please try again.');
    }
    await recordAudit({
        category: 'ADMIN_RBAC',
        eventType: 'PASSWORD_RESET',
        resourceType: 'USER',
        resourceId: profile.id,
        resourceLabel: userLabel(profile),
        description: `Password reset: ${profile.fullName || profile.email || id}`
    }, { always: true });
}

export async function updateUser(id, updates, { eventType = 'UPDATE_USER', verb = 'User updated' } = {}) {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === id);
    if (!profile) throw new Error('User not found');
    const before = { ...profile };
    Object.assign(profile, updates);
    const saved = await put(COLLECTIONS.PROFILES, profile);
    await recordAudit({
        category: 'ADMIN_RBAC',
        eventType,
        resourceType: 'USER',
        resourceId: profile.id,
        resourceLabel: userLabel(before),
        description: `${verb}: ${before.fullName || before.email || id}`,
        changesDelta: diffFields(before, profile, USER_AUDIT_FIELDS.filter(k => k in updates))
    }, eventType === 'UPDATE_USER' ? undefined : { always: true });
    return saved;
}
