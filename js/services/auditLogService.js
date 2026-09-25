import { COLLECTIONS, put, getAll } from './localDb.js';

export async function logEvent({
    actorId, actorEmail, actorRole, category, eventType, severity, resourceType, resourceId, description, changesDelta
}) {
    const logEntry = {
        actorId,
        actorEmail,
        actorRole,
        category,
        eventType,
        severity,
        resourceType,
        resourceId,
        description,
        changesDelta,
        createdAt: new Date().toISOString()
    };
    return put(COLLECTIONS.AUDIT_LOGS, logEntry);
}

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

export async function exportLogsCSV() {
    const logs = await getLogs();
    if (logs.length === 0) return null;
    
    const headers = ['createdAt', 'actorEmail', 'actorRole', 'category', 'eventType', 'severity', 'resourceType', 'resourceId', 'description'];
    const csvRows = [headers.join(',')];
    
    for (const log of logs) {
        const row = headers.map(h => {
            let val = log[h] || '';
            // Escape quotes and wrap in quotes if there's a comma
            val = String(val).replace(/"/g, '""');
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                val = `"${val}"`;
            }
            return val;
        });
        csvRows.push(row.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    return url;
}
