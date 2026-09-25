import { COLLECTIONS, getAll, put, remove } from './localDb.js';

export async function getProfiles() {
    return getAll(COLLECTIONS.PROFILES);
}

export async function createUser(profileData) {
    if (!profileData.department) profileData.department = 'Operations';
    if (!profileData.status) profileData.status = 'ACTIVE';
    return put(COLLECTIONS.PROFILES, profileData);
}

export async function updateUser(id, updates) {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === id);
    if (!profile) throw new Error('User not found');
    Object.assign(profile, updates);
    return put(COLLECTIONS.PROFILES, profile);
}
