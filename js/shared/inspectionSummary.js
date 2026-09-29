import { formatDateTime } from './dateFormat.js';
import { escapeHTML, isValidBase64Image } from './security.js';
import { toPhotoList } from './imageCompress.js';

const OCULAR_PHOTO_SLOTS = [
    ['proposed_layout', 'Proposed Layout'],
    ['tapping_point', 'Tapping Point'],
    ['wiring_conduit', 'Wiring/Conduit Layout'],
    ['ev_charging_location', 'EV Charging Location']
];

// Each slot may hold a single data-URL string (legacy) or an array of them.
function renderPhotoSection(item) {
    const pa = item.photoAttachments;
    if (!pa || typeof pa !== 'object' || Array.isArray(pa)) return '';
    const known = new Set(OCULAR_PHOTO_SLOTS.map(([k]) => k));
    const slots = OCULAR_PHOTO_SLOTS.concat(Object.keys(pa).filter(k => !known.has(k)).map(k => [k, k]));
    const blocks = slots.map(([key, label]) => {
        const list = toPhotoList(pa[key]).filter(isValidBase64Image);
        if (!list.length) return '';
        return `
            <div style="margin-bottom: 0.75rem;">
                <p style="margin-bottom: 0.25rem;"><strong>${escapeHTML(label)}</strong> (${list.length})</p>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${list.map((src, i) => `<img src="${src}" loading="lazy" alt="${escapeHTML(label)} ${i + 1}" style="height: 100px; max-width: 100%; border-radius: 4px; border: 1px solid #ccc;"/>`).join('')}
                </div>
            </div>`;
    }).join('');
    return blocks.trim() ? `<hr style="margin: 1rem 0;" /><h4>Site Photos</h4>${blocks}` : '';
}

export function buildInspectionSummaryHtml(item) {
    if (!item) return '<p>No data available</p>';
    
    return `
        <div class="inspection-summary">
            <h3>Inspection Summary: ${escapeHTML(item.rnNo || 'N/A')}</h3>
            <p><strong>Client:</strong> ${escapeHTML(item.clientName || 'N/A')}</p>
            <p><strong>Date:</strong> ${escapeHTML(formatDateTime(item.dateTime))}</p>
            <p><strong>Scope:</strong> ${escapeHTML(item.scopeOfWorks || 'N/A')}</p>
            <p><strong>Address:</strong> ${escapeHTML(item.locationAddress || 'N/A')}</p>
            <hr style="margin: 1rem 0;" />
            <h4>Signatures</h4>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <div>
                    <p>Inspector: ${escapeHTML(item.inspectedByName || 'N/A')}</p>
                    ${item.inspectorSigImg ? `<img src="${item.inspectorSigImg}" style="max-width: 150px; border: 1px solid #ccc;"/>` : ''}
                </div>
                <div>
                    <p>Witness: ${escapeHTML(item.witnessedByName || 'N/A')}</p>
                    ${item.witnessSigImg ? `<img src="${item.witnessSigImg}" style="max-width: 150px; border: 1px solid #ccc;"/>` : ''}
                </div>
            </div>
            ${renderPhotoSection(item)}
        </div>
    `;
}
