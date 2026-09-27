/** Local "YYYY-MM-DDTHH:mm" for a datetime-local input default. */
export function localDateTimeInputValue(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Readable date/time, e.g. "Sep 27, 2026, 2:44 PM". Offset-less values
 * ("2026-09-27T14:44") are treated as local time. Returns the fallback when
 * empty and the raw value when unparseable.
 */
export function formatDateTime(value, fallback = 'N/A') {
    if (!value) return fallback;
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
}
