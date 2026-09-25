import { escapeHTML } from './security.js';

export function buildInspectionSummaryHtml(item) {
    if (!item) return '<p>No data available</p>';
    
    return `
        <div class="inspection-summary">
            <h3>Ocular Inspection Summary: ${escapeHTML(item.rnNo || 'N/A')}</h3>
            <p><strong>Client:</strong> ${escapeHTML(item.clientName || 'N/A')}</p>
            <p><strong>Date:</strong> ${escapeHTML(item.dateTime || 'N/A')}</p>
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
        </div>
    `;
}
