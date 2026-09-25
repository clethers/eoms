export function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

export function isValidBase64Image(str) {
    if (!str) return false;
    return str.startsWith('data:image/') && str.includes(';base64,');
}

export function isSafeRedirectUrl(url) {
    if (!url) return false;
    // Only allow relative paths
    return url.startsWith('/') && !url.startsWith('//');
}
