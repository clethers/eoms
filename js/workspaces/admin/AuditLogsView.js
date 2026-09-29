import { getLogs } from '../../services/auditLogService.js';
import { getProfiles } from '../../services/userService.js';
import { escapeHTML } from '../../shared/security.js';
import { btnContent, icon } from '../../shared/icons.js';
import { toEntries, filterEntries, entriesToCSV, changeRows, splitRecord, formatTimestamp } from './auditLogFormat.js';

const PAGE_SIZE = 50;
const esc = (v) => escapeHTML(v === undefined || v === null ? '' : String(v));

export default class AuditLogsView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card audit-logs';

        container.innerHTML = `
            <div class="page-header">
                <h2>Audit Logs</h2>
                <button type="button" id="export-csv-btn">${btnContent('download', 'Export CSV')}</button>
            </div>
            <div class="toolbar audit-toolbar">
                <div class="audit-search">
                    ${icon('search')}
                    <input type="search" id="audit-q" placeholder="Search actor, event or record" aria-label="Search actor, event or record">
                </div>
                <select id="audit-role" aria-label="Role"><option value="">All roles</option></select>
                <select id="audit-event" aria-label="Event"><option value="">All events</option></select>
                <label class="audit-date">From <input type="date" id="audit-from"></label>
                <label class="audit-date">To <input type="date" id="audit-to"></label>
            </div>
            <div id="logs-table-container">
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
            </div>
        `;

        this.container = container;
        this.entries = [];
        this.shown = PAGE_SIZE;

        const onFilter = () => { this.shown = PAGE_SIZE; this.renderTable(); };
        ['#audit-q', '#audit-role', '#audit-event', '#audit-from', '#audit-to'].forEach(sel => {
            container.querySelector(sel).addEventListener('input', onFilter);
            container.querySelector(sel).addEventListener('change', onFilter);
        });

        container.querySelector('#export-csv-btn').addEventListener('click', () => this.exportCSV());

        const tableHost = container.querySelector('#logs-table-container');
        tableHost.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-log-index]');
            if (btn) { this.openChanges(this.filtered[Number(btn.dataset.logIndex)], btn); return; }
            if (e.target.closest('#audit-load-more')) { this.shown += PAGE_SIZE; this.renderTable(); }
        });

        this.loadLogs();
        return container;
    }

    filters() {
        const c = this.container;
        return {
            q: c.querySelector('#audit-q').value,
            role: c.querySelector('#audit-role').value,
            event: c.querySelector('#audit-event').value,
            from: c.querySelector('#audit-from').value,
            to: c.querySelector('#audit-to').value
        };
    }

    async loadLogs() {
        const host = this.container.querySelector('#logs-table-container');
        try {
            const [logs, profiles] = await Promise.all([getLogs(), getProfiles().catch(() => [])]);
            const byId = new Map(profiles.map(p => [String(p.id), p]));
            this.entries = toEntries(logs, byId);
            this.fillSelect('#audit-role', this.entries.map(e => e.role));
            this.fillSelect('#audit-event', this.entries.map(e => e.event));
            this.renderTable();
        } catch (e) {
            host.innerHTML = `<p style="color:#b91c1c;">Failed to load logs: ${esc(e.message)}</p>`;
        }
    }

    fillSelect(sel, values) {
        const select = this.container.querySelector(sel);
        const opts = [...new Set(values.filter(v => v && v !== '—'))].sort((a, b) => a.localeCompare(b));
        select.insertAdjacentHTML('beforeend', opts.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(''));
    }

    renderTable() {
        const host = this.container.querySelector('#logs-table-container');
        this.filtered = filterEntries(this.entries, this.filters());
        const page = this.filtered.slice(0, this.shown);
        const eye = btnContent('eye', 'Changes');

        const rows = page.map((e, i) => {
            const rec = splitRecord(e.record);
            const changes = e.changes
                ? `<button type="button" class="btn-sm audit-changes-btn" data-log-index="${i}" aria-haspopup="dialog">${eye}</button>`
                : '<span class="audit-none" title="No change details recorded">—</span>';
            return `<tr>
                <td><span class="audit-actor" title="${esc(e.email)}">${esc(e.actor)}</span></td>
                <td>${esc(e.event)}</td>
                <td class="audit-record">${esc(rec.main)}${rec.sub ? `<br><small>${esc(rec.sub)}</small>` : ''}</td>
                <td><span class="audit-role ${e.roleClass}">${esc(e.role)}</span></td>
                <td>${changes}</td>
                <td class="audit-ts">${esc(e.when)}</td>
            </tr>`;
        }).join('');

        host.innerHTML = `
            <div class="table-responsive">
                <table class="audit-table">
                    <thead><tr><th>Actor</th><th>Event</th><th>Record</th><th>Role</th><th>Changes</th><th>Timestamp</th></tr></thead>
                    <tbody>${rows || `<tr><td colspan="6" class="audit-empty">${this.entries.length ? 'No logs match these filters.' : 'No logs found.'}</td></tr>`}</tbody>
                </table>
            </div>
            <p class="audit-count">Showing ${page.length} of ${this.filtered.length} entries${this.filtered.length !== this.entries.length ? ` (${this.entries.length} total)` : ''}</p>
            ${this.filtered.length > page.length ? `<div style="text-align:center; margin-top:0.75rem;"><button type="button" id="audit-load-more" style="padding: 0.5rem 2rem; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">${btnContent('chevrons-down', 'Load More')}</button></div>` : ''}
        `;
    }

    exportCSV() {
        const rows = this.filtered || [];
        if (!rows.length) { alert('No logs to export.'); return; }
        const url = URL.createObjectURL(new Blob(['﻿' + entriesToCSV(rows)], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'audit_logs.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /** Before/after dialog (same overlay + focus pattern as the Clients Details popup). */
    openChanges(entry, triggerBtn) {
        if (!entry) return;
        const { rows, notes } = changeRows(entry.log);
        const titleId = 'audit-changes-title';

        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';

        const table = rows.length ? `
            <div class="table-responsive">
                <table class="audit-diff">
                    <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                    <tbody>${rows.map(r => `<tr>
                        <td class="audit-diff__field">${esc(r.field)}</td>
                        <td><span class="audit-before">${esc(r.before)}</span></td>
                        <td><span class="audit-after">${esc(r.after)}</span></td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>` : '';

        modal.innerHTML = `
            <div role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1" class="audit-dialog"
                 style="background: white; padding: 1.5rem; border-radius: 8px; width: 640px; max-width: 90vw; max-height: 90vh; overflow-y: auto;">
                <h3 id="${titleId}" style="margin: 0 0 0.25rem;">${esc(entry.event)} · ${esc(entry.record)}</h3>
                <p class="audit-dialog__meta">${esc(entry.actor)} · ${esc(formatTimestamp(entry.log.createdAt))}</p>
                ${table}
                ${notes ? `<div class="audit-notes"><strong>Review notes:</strong> ${esc(notes)}</div>` : ''}
                <div class="modal-actions">
                    <button type="button" id="audit-changes-close" class="btn-sm">${btnContent('x', 'Close')}</button>
                </div>
            </div>
        `;

        const dialog = modal.querySelector('[role="dialog"]');
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const closeModal = () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKeydown);
            if (modal.parentNode) document.body.removeChild(modal);
            if (triggerBtn && document.contains(triggerBtn)) triggerBtn.focus();
        };
        const onKeydown = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
            if (e.key === 'Tab') {
                const focusable = Array.from(dialog.querySelectorAll(focusableSelector));
                if (focusable.length === 0) return;
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener('keydown', onKeydown);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        modal.querySelector('#audit-changes-close').addEventListener('click', closeModal);

        document.body.appendChild(modal);
        modal.querySelector('#audit-changes-close').focus();
    }
}
