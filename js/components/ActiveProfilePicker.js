import { getProfiles } from '../services/userService.js';
import { navigateTo } from './Router.js';

export const profileEvents = new EventTarget();

export async function renderProfilePicker(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const profiles = await getProfiles();
    
    const select = document.createElement('select');
    select.className = 'profile-picker';
    
    let activeId = sessionStorage.getItem('activeProfileId');
    // Default to the first profile if none selected
    if (!activeId && profiles.length > 0) {
        activeId = profiles[0].id.toString();
        sessionStorage.setItem('activeProfileId', activeId);
    }
    
    profiles.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.fullName} (${p.role})`;
        if (p.id.toString() === activeId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    
    select.addEventListener('change', (e) => {
        const newId = e.target.value;
        sessionStorage.setItem('activeProfileId', newId);
        
        profileEvents.dispatchEvent(new Event('profileChanged'));
        
        // redirect to primary workspace as convenience
        const profile = profiles.find(p => p.id.toString() === newId);
        if (profile) {
            if (profile.role === 'admin') navigateTo('/admin');
            else if (profile.role === 'field_inspector') navigateTo('/ocular/home');
            else navigateTo('/manager');
        }
    });
    
    container.innerHTML = '';
    container.appendChild(select);
}

export function getActiveProfileId() {
    let id = sessionStorage.getItem('activeProfileId');
    return id ? parseInt(id, 10) : null;
}
