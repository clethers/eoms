// On-device image compression. Photos are stored as base64 data URLs inside
// Supabase jsonb records, so we downscale + re-encode as JPEG before storing.

const DEFAULTS = { maxDim: 1600, quality: 0.7 };

function isImageFile(file) {
    if (!file) return false;
    if (file.type) return file.type.startsWith('image/');
    // Some mobile browsers omit the MIME type; fall back to the extension.
    return /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i.test(file.name || '');
}

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode image'));
        img.src = src;
    });
}

// Returns { source, width, height, close() } for something drawable on a canvas.
async function decode(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            // imageOrientation:'from-image' applies EXIF rotation (default in modern browsers anyway).
            const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
            return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close && bmp.close() };
        } catch (_) {
            try {
                const bmp = await createImageBitmap(file);
                return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close && bmp.close() };
            } catch (_) { /* fall through to <img> decoding */ }
        }
    }
    // <img> decoding: modern browsers honour EXIF orientation (image-orientation: from-image default).
    const url = await readAsDataUrl(file);
    const img = await loadImageElement(url);
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
}

/**
 * Compress an image File/Blob to a JPEG data URL whose longest side is <= maxDim.
 * @returns {Promise<string>} data:image/jpeg;base64,...
 */
export async function compressImage(file, { maxDim = DEFAULTS.maxDim, quality = DEFAULTS.quality } = {}) {
    if (!isImageFile(file)) {
        throw new Error(`"${(file && file.name) || 'File'}" is not an image. Please choose a photo (JPG, PNG, etc.).`);
    }
    let decoded;
    try {
        decoded = await decode(file);
    } catch (err) {
        throw new Error(`Could not read "${file.name || 'photo'}" as an image. It may be an unsupported format.`);
    }
    try {
        const { width, height } = decoded;
        if (!width || !height) throw new Error(`"${file.name || 'photo'}" has no image data.`);
        const scale = Math.min(1, maxDim / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // JPEG has no alpha: paint white so transparent PNGs don't turn black.
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(decoded.source, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Release canvas memory promptly (matters on phones).
        canvas.width = canvas.height = 0;
        return dataUrl;
    } finally {
        decoded.close();
    }
}

/**
 * Compress several files one at a time (keeps peak memory low on phones).
 * Non-image / undecodable files are skipped and reported in `errors`.
 * @returns {Promise<{ dataUrls: string[], errors: string[] }>}
 */
export async function compressImages(files, opts = {}) {
    const dataUrls = [];
    const errors = [];
    for (const file of Array.from(files || [])) {
        try {
            dataUrls.push(await compressImage(file, opts));
        } catch (err) {
            errors.push(err && err.message ? err.message : String(err));
        }
    }
    return { dataUrls, errors };
}

/**
 * Normalise any stored photo value to an array of data-URL strings.
 * Accepts: string, array of strings, array of {dataUrl} objects, or nullish.
 */
export function toPhotoList(value) {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    return arr
        .map(p => (typeof p === 'string' ? p : (p && typeof p.dataUrl === 'string' ? p.dataUrl : '')))
        .filter(Boolean);
}
