import { COLLECTIONS, put, getAll } from './localDb.js';
import { getActiveProfile, getActiveProfileId } from '../components/ActiveProfilePicker.js';

export async function logEvent({
    actorId, actorEmail, actorName, actorRole, category, eventType, severity, resourceType, resourceId, resourceLabel, description, changesDelta
}) {
    const logEntry = {
        actorId,
        actorEmail,
        actorName,
        actorRole,
        category,
        eventType,
        severity,
        resourceType,
        resourceId,
        resourceLabel,
        description,
        changesDelta: changesDelta ? sanitizeDelta(changesDelta) : changesDelta,
        createdAt: new Date().toISOString()
    };
    return put(COLLECTIONS.AUDIT_LOGS, logEntry);
}

// ---------- Change tracking helpers ----------

/** The signed-in user as { actorId, actorEmail, actorName, actorRole }; falls back to a profiles lookup, else System. */
export async function currentActor() {
    const p = getActiveProfile();
    if (p) return { actorId: p.id, actorEmail: p.email, actorName: p.fullName || p.email, actorRole: p.role };
    const id = getActiveProfileId();
    try {
        const profiles = await getAll(COLLECTIONS.PROFILES);
        const row = profiles.find(x => String(x.id) === String(id));
        if (row) return { actorId: row.id, actorEmail: row.email, actorName: row.fullName || row.email, actorRole: row.role };
    } catch (e) { /* fall through */ }
    return { actorId: id, actorEmail: 'System', actorName: 'System', actorRole: 'System' };
}

/** Data-URL images never go into the log. */
function sanitizeValue(v, key = '') {
    if (typeof v === 'string' && v.startsWith('data:')) {
        return /sign/i.test(key) ? '[signature]' : '[photo]';
    }
    if (Array.isArray(v)) return v.map(x => sanitizeValue(x, key));
    if (v && typeof v === 'object') {
        const out = {};
        for (const [k, x] of Object.entries(v)) out[k] = sanitizeValue(x, k);
        return out;
    }
    return v;
}

function sanitizeDelta(delta) {
    const out = {};
    for (const [k, d] of Object.entries(delta)) {
        out[k] = { from: sanitizeValue(d && d.from, k), to: sanitizeValue(d && d.to, k) };
    }
    return out;
}

const isBlank = v => v === undefined || v === null || v === '';
function sameValue(a, b) {
    if (isBlank(a) && isBlank(b)) return true;
    if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    return String(a) === String(b);
}

/** { key: { from, to } } for the given keys whose value differs between before and after (blank values count as equal). */
export function diffFields(before, after, keys) {
    const delta = {};
    for (const k of keys) {
        const from = before ? before[k] : undefined;
        const to = after ? after[k] : undefined;
        if (!sameValue(from, to)) delta[k] = { from: isBlank(from) ? '' : from, to: isBlank(to) ? '' : to };
    }
    return delta;
}

/** 'YYYY-MM-DD' -> 'Sep 29, 2026' (no timezone shift). */
export function formatDay(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return String(ymd || '');
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

function checklistText(step) {
    if (!step || (!step.done && !step.date)) return 'Not done';
    const word = step.done ? 'Done' : 'Not done';
    return step.date ? `${word} · ${formatDay(step.date)}` : word;
}

/** Per-step checklist changes, keyed 'stageChecklist.<STEP>' with readable from/to text. */
export function diffChecklist(beforeCl, afterCl) {
    const b = (beforeCl && typeof beforeCl === 'object') ? beforeCl : {};
    const a = (afterCl && typeof afterCl === 'object') ? afterCl : {};
    const delta = {};
    for (const code of new Set([...Object.keys(b), ...Object.keys(a)])) {
        const from = checklistText(b[code]), to = checklistText(a[code]);
        if (from !== to) delta[`stageChecklist.${code}`] = { from, to };
    }
    return delta;
}

/** Log an edit; never throws (a logging failure must not block the save). Skips empty deltas unless `always`. */
export async function recordAudit(entry, { always = false } = {}) {
    try {
        const delta = entry.changesDelta;
        const hasDelta = delta && Object.keys(delta).length > 0;
        if (!always && !hasDelta) return null;
        const actor = await currentActor();
        return await logEvent({ severity: 'INFO', ...actor, ...entry, changesDelta: hasDelta ? delta : undefined });
    } catch (e) {
        console.error('Audit log failed:', e);
        return null;
    }
}

export const leadLabel = (l) => {
    const name = (l && (l.name || [l.firstName, l.lastName].filter(Boolean).join(' '))) || 'Unnamed';
    return `Client · ${name}${l && l.clientId ? ` (${l.clientId})` : ''}`;
};

// ---------- Reading ----------

export async function getLogs(filters = {}) {
    let logs = await getAll(COLLECTIONS.AUDIT_LOGS);

    // Apply filters
    if (filters.category) logs = logs.filter(l => l.category === filters.category);
    if (filters.severity) logs = logs.filter(l => l.severity === filters.severity);
    if (filters.actorId) logs = logs.filter(l => l.actorId === filters.actorId);

    // Sort descending by date
    logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return logs;
}

/** CSV text from pre-formatted rows (array of arrays; first row is the header). */
export function toCSV(rows) {
    return rows.map(r => r.map(v => {
        const s = String(v ?? '');
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
}

export async function exportLogsCSV() {
    const logs = await getLogs();
    if (logs.length === 0) return null;
    const headers = ['createdAt', 'actorEmail', 'actorRole', 'category', 'eventType', 'severity', 'resourceType', 'resourceId', 'description'];
    const csv = toCSV([headers, ...logs.map(l => headers.map(h => l[h] || ''))]);
    return URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
}
