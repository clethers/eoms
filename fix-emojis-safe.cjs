const fs = require('fs');
const path = require('path');
const dir = 'js/workspaces';

const spv = path.join(dir, 'manager', 'SalesPipelineView.js');
let content = fs.readFileSync(spv, 'utf8');

const profileEmoji = String.fromCodePoint(0x1F464);
const clipboardEmoji = String.fromCodePoint(0x1F4CB);
const truckEmoji = String.fromCodePoint(0x1F69A);
const moneyEmoji = String.fromCodePoint(0x1F4B0);
const wrenchEmoji = String.fromCodePoint(0x1F6E0, 0xFE0F);
const pencilEmoji = String.fromCodePoint(0x270F, 0xFE0F);
const trashEmoji = String.fromCodePoint(0x1F5D1, 0xFE0F);
const lockEmoji = String.fromCodePoint(0x1F512);
const memoEmoji = String.fromCodePoint(0x1F4DD);
const eyeEmoji = String.fromCodePoint(0x1F441, 0xFE0F);

// Replace lines directly
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('class="profile-btn"')) {
        lines[i] = '                                    <button class="profile-btn" data-id="${l.id}" title="View CRM Profile" style="background-color: #6366f1; color: white; margin-right: 0.5rem; font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer;">' + profileEmoji + '</button>';
    } else if (lines[i].includes('class="view-reports-btn"')) {
        lines[i] = '                                    ${l.ocularId ? \<button class="view-reports-btn" data-id="" title="View Project Reports" style="background-color: #f59e0b; color: white; margin-right: 0.5rem; font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer;">' + clipboardEmoji + '</button>\ : \'\'}';
    } else if (lines[i].includes('class="dispatch-btn"')) {
        lines[i] = '                                    ${!l.ocularId ? \<button class="dispatch-btn" data-id="" title="Dispatch Ocular" style="background-color: #3b82f6; color: white; margin-right: 0.5rem; font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer;">' + truckEmoji + '</button>\ : \'\'}';
    } else if (lines[i].includes('class="quote-btn"')) {
        lines[i] = '                                    ${l.stage === \'SITE_VISIT_COMPLETED\' ? \<button class="quote-btn" data-id="" title="Generate Quote" style="background-color: #8b5cf6; color: white; margin-right: 0.5rem; font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer;">' + moneyEmoji + '</button>\ : \'\'}';
    } else if (lines[i].includes('class="dispatch-install-btn"')) {
        lines[i] = '                                    ${l.ocularId && !l.installationId ? \<button class="dispatch-install-btn" data-id="" title="Dispatch Install" style="background-color: #10b981; color: white; margin-right: 0.5rem; font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer;">' + wrenchEmoji + '</button>\ : \'\'}';
    }
}
fs.writeFileSync(spv, lines.join('\n').replace(/\\$\{/g, '{'), 'utf8');

const mdcv = path.join(dir, 'admin', 'MasterDataCatalogView.js');
let mdcvLines = fs.readFileSync(mdcv, 'utf8').split('\n');
for (let i = 0; i < mdcvLines.length; i++) {
    if (mdcvLines[i].includes('class="edit-btn"')) {
        mdcvLines[i] = '                                    <button class="edit-btn" data-key="${escapeHTML(c.itemKey)}" title="Edit" style="background-color: #f59e0b; color: white; font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;">' + pencilEmoji + '</button>';
    } else if (mdcvLines[i].includes('class="delete-btn"')) {
        mdcvLines[i] = '                                    <button class="delete-btn" data-key="${escapeHTML(c.itemKey)}" title="Delete" style="background-color: #ef4444; color: white; font-size: 1.2rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer;">' + trashEmoji + '</button>';
    }
}
fs.writeFileSync(mdcv, mdcvLines.join('\n').replace(/\\$\{/g, '{'), 'utf8');

const aqv = path.join(dir, 'operations', 'AssignedQueueView.js');
if (fs.existsSync(aqv)) {
    let c = fs.readFileSync(aqv, 'utf8');
    c = c.replace(/<button disabled title=".*?style=".*?>.*?<\/button>/g, match => match.replace(/>.*?<\/button>/, '>' + lockEmoji + '</button>'));
    c = c.replace(/<button class="start-inspection-btn".*?>.*?<\/button>/g, match => match.replace(/>.*?<\/button>/, '>' + memoEmoji + '</button>'));
    fs.writeFileSync(aqv, c, 'utf8');
}

const rqv = path.join(dir, 'operations', 'ReadyQueueView.js');
if (fs.existsSync(rqv)) {
    let c = fs.readFileSync(rqv, 'utf8');
    c = c.replace(/<button data-action="preview".*?>.*?<\/button>/g, match => match.replace(/>.*?<\/button>/, '>' + eyeEmoji + '</button>'));
    c = c.replace(/<button disabled title=".*?style=".*?>.*?<\/button>/g, match => match.replace(/>.*?<\/button>/, '>' + lockEmoji + '</button>'));
    c = c.replace(/<button data-action="start".*?>.*?<\/button>/g, match => match.replace(/>.*?<\/button>/, '>' + wrenchEmoji + '</button>'));
    fs.writeFileSync(rqv, c, 'utf8');
}

const hv = path.join(dir, 'operations', 'HistoryView.js');
if (fs.existsSync(hv)) {
    let c = fs.readFileSync(hv, 'utf8');
    c = c.replace(/<button data-action="preview".*?>.*?<\/button>/g, match => match.replace(/>.*?<\/button>/, '>' + eyeEmoji + '</button>'));
    c = c.replace(/<button data-action="edit".*?>.*?<\/button>/g, match => match.replace(/>.*?<\/button>/, '>' + pencilEmoji + '</button>'));
    fs.writeFileSync(hv, c, 'utf8');
}

const sdv = path.join(dir, 'operations', 'SavedDraftsView.js');
if (fs.existsSync(sdv)) {
    let c = fs.readFileSync(sdv, 'utf8');
    c = c.replace(/<button data-action="preview".*?>.*?<\/button>/g, match => match.replace(/>.*?<\/button>/, '>' + eyeEmoji + '</button>'));
    c = c.replace(/<button data-action="edit".*?>.*?<\/button>/g, match => match.replace(/>.*?<\/button>/, '>' + pencilEmoji + '</button>'));
    fs.writeFileSync(sdv, c, 'utf8');
}
