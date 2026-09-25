import { escapeHTML } from './security.js';

export function buildInstallationSummaryHtml(item) {
    if (!item) return '<p>No installation data available</p>';
    
    return `
        <div class="inspection-summary">
            <h3>Installation Report: ${escapeHTML(item.installationNo || 'N/A')}</h3>
            <p><strong>Client:</strong> ${escapeHTML(item.clientName || 'N/A')}</p>
            <p><strong>Date:</strong> ${escapeHTML(item.dateTime || 'N/A')}</p>
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
            ${item.photos && item.photos.length > 0 ? `
                <hr style="margin: 1rem 0;" />
                <h4>Photos</h4>
                <div style="display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem;">
                    ${item.photos.map(p => `<img src="${p.dataUrl}" style="height: 100px; border-radius: 4px; border: 1px solid #ccc;" title="${escapeHTML(p.tags)}"/>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}
