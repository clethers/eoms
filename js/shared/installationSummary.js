import { formatDateTime } from './dateFormat.js';
import { escapeHTML, isValidBase64Image } from './security.js';

// Photos may be stored as data-URL strings or as { dataUrl, tags } objects,
// under photoAttachments (current) or photos (legacy).
function collectPhotos(item) {
    const raw = Array.isArray(item.photoAttachments) ? item.photoAttachments
        : Array.isArray(item.photos) ? item.photos : [];
    return raw
        .map(p => (typeof p === 'string' ? { dataUrl: p, tags: '' } : (p && typeof p.dataUrl === 'string' ? { dataUrl: p.dataUrl, tags: p.tags || '' } : null)))
        .filter(p => p && isValidBase64Image(p.dataUrl));
}

export function buildInstallationSummaryHtml(item) {
    if (!item) return '<p>No installation data available</p>';
    const photos = collectPhotos(item);
    
    return `
        <div class="inspection-summary">
            <h3>Installation Report: ${escapeHTML(item.installationNo || 'N/A')}</h3>
            <p><strong>Client:</strong> ${escapeHTML(item.clientName || 'N/A')}</p>
            <p><strong>Date:</strong> ${escapeHTML(formatDateTime(item.dateTime))}</p>
            <p><strong>Scope:</strong> ${escapeHTML(item.scopeOfWorks || 'N/A')}</p>
            <p><strong>Commissioning Data:</strong> ${escapeHTML(item.commissioningData || 'N/A')}</p>
            <hr style="margin: 1rem 0;" />
            <h4>Signatures</h4>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <div>
                    <p>Installer</p>
                    ${item.installerSigImg ? `<img src="${item.installerSigImg}" style="max-width: 150px; border: 1px solid #ccc;"/>` : 'No signature'}
                </div>
                <div>
                    <p>Client Rep</p>
                    ${item.clientSigImg ? `<img src="${item.clientSigImg}" style="max-width: 150px; border: 1px solid #ccc;"/>` : 'No signature'}
                </div>
            </div>
            ${photos.length > 0 ? `
                <hr style="margin: 1rem 0;" />
                <h4>Photos (${photos.length})</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; padding-bottom: 1rem;">
                    ${photos.map(p => `<img src="${p.dataUrl}" loading="lazy" style="height: 100px; max-width: 100%; border-radius: 4px; border: 1px solid #ccc;" title="${escapeHTML(p.tags)}"/>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}
