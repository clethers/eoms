// Printable A4 certificates. The build*Html functions are pure (no DOM or
// data-layer access) so they can be rendered/tested outside the app; the
// print* functions open a window, fill it and print.
import { escapeHTML, isValidBase64Image } from './security.js';
import { formatDateTime } from './dateFormat.js';
import { formatStatus } from './statusFormatter.js';

// Brand tokens (mirrors style.css :root; the print window has no app CSS)
const BLUE = '#1878b8';
const BLUE_DARK = '#0f4f7a';
const BLUE_DEEP = '#0b3a5c';
const BLUE_SOFT = '#dcecf7';
const GREEN = '#4c8c2a';
const GREEN_SOFT = '#e3efd6';
const RED = '#b42318';
const RED_SOFT = '#fde7e5';
const AMBER = '#f2ad3d';

const OCULAR_PHOTO_SLOTS = [
    ['proposed_layout', 'Proposed Layout'],
    ['tapping_point', 'Tapping Point'],
    ['wiring_conduit', 'Wiring/Conduit Layout'],
    ['ev_charging_location', 'EV Charging Location']
];

// [field, label, category]
const MATERIALS = [
    ['conduitPvc', 'PVC Conduit', 'Conduit (Linear)'],
    ['conduitEmt', 'EMT Conduit', 'Conduit (Linear)'],
    ['conduitImc', 'IMC Conduit', 'Conduit (Linear)'],
    ['conduitRsc', 'RSC Conduit', 'Conduit (Linear)'],
    ['conduitPvcMoulding', 'PVC Moulding', 'Conduit (Linear)'],
    ['conduitBlackFlexible', 'Black Flexible Conduit', 'Conduit (Linear)'],
    ['conduitPvcFlexibleOrange', 'Orange PVC Flexible Conduit', 'Conduit (Linear)'],
    ['conduitOtherQty', 'Other Conduit', 'Conduit (Linear)'],
    ['liquidTightConnectorQty', 'Liquid-tight Connector', 'Liquid-tight Fittings'],
    ['elbowEmt90', 'EMT Elbow 90°', 'Elbows'],
    ['elbowImc90', 'IMC Elbow 90°', 'Elbows'],
    ['elbowRsc90', 'RSC Elbow 90°', 'Elbows'],
    ['bodyLb', 'Conduit Body LB', 'Conduit Bodies'],
    ['bodyLr', 'Conduit Body LR', 'Conduit Bodies'],
    ['bodyLl', 'Conduit Body LL', 'Conduit Bodies'],
    ['bodyC', 'Conduit Body C', 'Conduit Bodies'],
    ['bodyT', 'Conduit Body T', 'Conduit Bodies'],
    ['connectorEmtSetScrew', 'EMT Connector (Set Screw)', 'Connectors / Couplings / Clamps'],
    ['connectorEmtCompression', 'EMT Connector (Compression)', 'Connectors / Couplings / Clamps'],
    ['couplingEmtSetScrew', 'EMT Coupling (Set Screw)', 'Connectors / Couplings / Clamps'],
    ['couplingEmtCompression', 'EMT Coupling (Compression)', 'Connectors / Couplings / Clamps'],
    ['clampCTwoHole', 'C-Clamp (2-hole)', 'Connectors / Couplings / Clamps'],
    ['clampCOneHole', 'C-Clamp (1-hole)', 'Connectors / Couplings / Clamps'],
    ['clampStrapMalleable', 'Strap (Malleable)', 'Connectors / Couplings / Clamps'],
    ['boxUtility', 'Utility Box', 'Electrical Boxes'],
    ['boxSquare', 'Square Box', 'Electrical Boxes'],
    ['boxOctagon', 'Octagon Box', 'Electrical Boxes'],
    ['boxJunction', 'Junction Box', 'Electrical Boxes']
];

// ---------- small helpers ----------

const esc = v => escapeHTML(v == null ? '' : String(v));
const has = v => v !== undefined && v !== null && String(v).trim() !== '';
const safeImg = src => (typeof src === 'string' && isValidBase64Image(src)) ? src : '';

function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

/** Today's date/time in Manila, same shape as formatDateTime. */
export function issuedDateManila(d = new Date()) {
    return d.toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
}

function defaultLogoUrl() {
    try {
        if (typeof window !== 'undefined' && window.location) return window.location.origin + '/ecoworks-logo.png';
    } catch (e) { /* ignore */ }
    return '/ecoworks-logo.png';
}

function yesNoPill(value, yesText = 'YES', noText = 'NO') {
    if (!has(value)) return '';
    const yes = String(value).toUpperCase() === 'YES';
    return `<span class="pill ${yes ? 'pill-yes' : 'pill-no'}">${esc(yes ? yesText : noText)}</span>`;
}

/**
 * rows: [label, htmlValue, { full?: bool }] — htmlValue must already be escaped.
 * Empty values are skipped; returns '' when nothing is left.
 */
function fieldGrid(rows) {
    const kept = rows.filter(r => has(r[1]));
    if (!kept.length) return '';
    let html = '';
    let pending = [];
    const flush = () => {
        if (!pending.length) return;
        html += `<div class="row">${pending.map(cell).join('')}${pending.length === 1 ? '<div class="cell empty"></div>' : ''}</div>`;
        pending = [];
    };
    const cell = ([label, value]) => `<div class="cell"><div class="lbl">${esc(label)}</div><div class="val">${value}</div></div>`;
    for (const r of kept) {
        if (r[2] && r[2].full) {
            flush();
            html += `<div class="row">${cell(r).replace('class="cell"', 'class="cell full"')}</div>`;
        } else {
            pending.push(r);
            if (pending.length === 2) flush();
        }
    }
    flush();
    return `<div class="grid">${html}</div>`;
}

function section(no, title, ref, body, flow = false) {
    return `
        <section class="sec${flow ? ' sec-flow' : ''}">
            <div class="sec-head">
                <span class="sec-title"><span class="sec-no">${no}.</span> ${esc(title)}</span>
                ${ref ? `<span class="sec-ref">${ref}</span>` : ''}
            </div>
            ${body || '<div class="nodata">No data recorded.</div>'}
        </section>`;
}

function materialRows(rec) {
    const rows = [];
    for (const [field, label, category] of MATERIALS) {
        const q = num(rec[field]);
        if (q <= 0) continue;
        let name = label;
        if (field === 'conduitOtherQty' && has(rec.conduitOtherType)) name = `Other Conduit (${rec.conduitOtherType})`;
        rows.push({ name, category, qty: q });
    }
    if (has(rec.liquidTightFlexLength) && String(rec.liquidTightFlexLength).trim() !== '0') {
        rows.push({ name: 'Liquid-tight Flexible Length', category: 'Liquid-tight Fittings', qty: `${rec.liquidTightFlexLength} cm` });
    }
    if (has(rec.boxOthers)) {
        rows.push({ name: 'Other Boxes / Enclosures', category: 'Electrical Boxes', qty: rec.boxOthers });
    }
    return rows;
}

function materialsTable(rec, qtyHeader) {
    const rows = materialRows(rec);
    if (!rows.length) return '';
    // Two side-by-side tables keep long lists compact on one page.
    const half = rows.length > 4 ? Math.ceil(rows.length / 2) : rows.length;
    const table = (list, offset) => `
        <table class="tbl">
            <thead><tr><th style="width:9%">#</th><th>Item</th><th style="width:26%" class="num">${esc(qtyHeader)}</th></tr></thead>
            <tbody>
                ${list.map((r, i) => `<tr><td>${offset + i + 1}</td><td class="strong">${esc(r.name)}</td><td class="num strong">${esc(r.qty)}</td></tr>`).join('')}
            </tbody>
        </table>`;
    const right = rows.slice(half);
    return `<div class="tbls">${table(rows.slice(0, half), 0)}${right.length ? table(right, half) : '<div></div>'}</div>`;
}

/** string -> [string], array -> array, falsy -> [] */
function toArray(v) {
    if (Array.isArray(v)) return v;
    return v ? [v] : [];
}

function photoGallery(photos) {
    const valid = photos.filter(p => p.src);
    if (!valid.length) return '';
    const dense = valid.length > 10 ? ' dense' : valid.length > 4 ? ' many' : '';
    return `<div class="gallery${dense}">${valid.map((p, i) => `
        <figure class="photo">
            <div class="ph-img"><img src="${p.src}" alt=""></div>
            <figcaption>${i + 1}. ${esc(p.label)}</figcaption>
        </figure>`).join('')}</div>`;
}

function signatureBlock(heading, sigImg, name, role) {
    const src = safeImg(sigImg);
    return `
        <div class="sig">
            <div class="sig-head">${esc(heading)}</div>
            <div class="sig-img">${src ? `<img src="${src}" alt="">` : '<span class="sig-missing">No signature on file</span>'}</div>
            <div class="sig-line"></div>
            <div class="sig-name">${esc(has(name) ? name : '—')}</div>
            <div class="sig-role">${esc(role)}</div>
        </div>`;
}

function badge(certified, text) {
    return `<div class="badge ${certified ? 'badge-ok' : 'badge-pending'}">${esc(text)}</div>`;
}

function page({ title, docTitle, subtitle, badgeHtml, docRef, watermark, footerLabel, footerType, body, logoUrl }) {
    const logo = esc(logoUrl || defaultLogoUrl());
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
${watermark ? `<div class="watermark">${esc(watermark)}</div>` : ''}
<div class="doc">
    <header class="hdr">
        <div class="brand">
            <img class="logo" src="${logo}" alt="EcoWorks">
            <div>
                <div class="co">ECOWORKS BUILDING SYSTEMS CORPORATION</div>
                <div class="co-sub">ELECTRICAL INFRASTRUCTURE &amp; EV CHARGING SOLUTIONS</div>
            </div>
        </div>
        <div class="meta">
            ${badgeHtml}
            <div class="meta-line"><b>DOCREF:</b> ${esc(docRef)}</div>
            <div class="meta-line"><b>DATE ISSUED:</b> ${esc(issuedDateManila())}</div>
        </div>
    </header>
    <div class="banner">
        <div class="banner-title">${esc(docTitle)}</div>
        <div class="banner-sub">${esc(subtitle)}</div>
    </div>
    ${body}
    <footer class="ftr">
        <span>&copy; 2026 EcoWorks Building Systems Corporation. Official ${esc(footerLabel)}.</span>
        <span>Generated via EOMS | ${esc(footerType)}</span>
    </footer>
</div>
</body>
</html>`;
}

// ---------- Site Inspection Report ----------

/** Slot values may be a single data URL (old) or an array of data URLs (multi-upload). */
function ocularPhotos(r) {
    const att = r.photoAttachments;
    if (!att || typeof att !== 'object' || Array.isArray(att)) return [];
    const out = [];
    for (const [key, label] of OCULAR_PHOTO_SLOTS) {
        const list = toArray(att[key]).map(safeImg).filter(Boolean);
        list.forEach((src, i) => out.push({ src, label: list.length > 1 ? `${label} (${i + 1} of ${list.length})` : label }));
    }
    return out;
}

export function buildOcularCertificateHtml(record, opts = {}) {
    const r = record || {};
    const approved = r.status === 'APPROVED';
    const rn = r.rnNo || 'N/A';
    const rnRef = `RN: ${esc(rn)}`;
    const isNema = String(r.hasNema3r).toUpperCase() === 'YES';

    const voltage = r.voltageSystem === 'Others' && has(r.voltageSpecify)
        ? `Others — ${esc(r.voltageSpecify)}`
        : esc(r.voltageSystem);

    const s1 = fieldGrid([
        ['Client Name', esc(r.clientName)],
        ['Contact No.', esc(r.contactNo)],
        ['Location Address', esc(r.locationAddress), { full: true }],
        ['GPS Coordinates', esc(r.gpsPinCoordinates)],
        ['Inspection Date / Time', has(r.dateTime) ? esc(formatDateTime(r.dateTime)) : ''],
        ['Scope of Works', esc(r.scopeOfWorks)],
        ['Type of Residency', esc(r.typeOfResidency)],
        ['Retrofitting Work', esc(r.workRetrofitting)],
        ['New Installation', esc(r.workNewInstallation)],
        ['Installation No.', esc(r.installationNo)]
    ]);

    const s2 = fieldGrid([
        ['Feeder Path', has(r.hasNema3r) ? (isNema ? 'NEMA 3R Enclosure' : 'Main Distribution Panelboard') : ''],
        ['Voltage System', voltage],
        ...(isNema ? [
            ['NEMA 3R Breaker Rating', esc(r.nema3rBreaker)],
            ['NEMA 3R Brand / Type', esc(r.nema3rBrandType)],
            ['NEMA 3R Design', esc(r.nema3rDesign)],
            ['NEMA 3R Mounting', esc(r.nema3rMounting)],
            ['NEMA 3R Pole', esc(r.nema3rPole)]
        ] : [
            ['Main Breaker Rating', esc(r.mainBreaker)],
            ['No. of Branches', has(r.noOfBranches) ? esc(r.noOfBranches) : ''],
            ['Spare Breaker (40 AT, 2P)', yesNoPill(r.spareBreaker, 'YES (Available)', 'NO (Not Available)')],
            ['Space Provision', yesNoPill(r.spaceProvision, 'YES (Provision Available)', 'NO (No Provision)')],
            ['Breaker Brand / Type', esc(r.breakerBrandType)],
            ['Breaker Design', esc(r.breakerDesign)],
            ['Breaker Mounting', esc(r.breakerMounting)],
            ['Breaker Pole', esc(r.breakerPole)],
            ['Grounding System', yesNoPill(r.groundingSystem, 'YES (Existing)', 'NO (To Be Provided)')],
            ['Grounding Rod Location', esc(r.groundingRodLocation)]
        ]),
        ['Charger Location', esc(r.chargerLocation)],
        ['Estimated Distance', num(r.estimateDistance) > 0 ? `${esc(r.estimateDistance)} m` : '']
    ]);

    const s3 = materialsTable(r, 'Est. Qty');

    const photos = ocularPhotos(r);
    const s4 = photoGallery(photos);

    const s5 = `<div class="sigs">
        ${signatureBlock('INSPECTED & CERTIFIED BY', r.inspectorSigImg, r.inspectedByName, 'Site Inspector, EcoWorks Operations')}
        ${signatureBlock('WITNESSED & CONFIRMED BY', r.witnessSigImg, r.witnessedByName, 'Client Witness / Representative')}
    </div>`;

    const qa = approved && has(r.qaNotes)
        ? fieldGrid([['QA Notes', esc(r.qaNotes), { full: true }]])
        : '';
    const s5ref = approved
        ? `${has(r.qaReviewedAt) ? `QA REVIEWED ${esc(formatDateTime(r.qaReviewedAt).toUpperCase())} &nbsp;` : ''}<span class="pill pill-yes">QA PASSED ✓</span>`
        : esc(formatStatus(r.status).toUpperCase());

    const body = [
        section(1, 'Client & Site Information', rnRef, s1),
        section(2, 'Electrical Assessment', rnRef, s2),
        section(3, 'Materials Estimate', rnRef, s3),
        section(4, 'Photo Evidence', `${photos.length} PHOTO(S)`, s4, true),
        section(5, 'Sign-off & Attestation', s5ref, s5 + (qa ? `<div style="margin-top:5px">${qa}</div>` : ''))
    ].join('');

    return page({
        title: `Site Inspection Report - ${rn}`,
        docTitle: 'Site Inspection Report',
        subtitle: `EV charger site survey & electrical readiness assessment  •  RN ${rn}`,
        badgeHtml: approved ? badge(true, '✓ QA APPROVED') : badge(false, formatStatus(r.status).toUpperCase()),
        docRef: `ECO-OCULAR-${rn}`,
        watermark: approved ? '' : 'NOT APPROVED',
        footerLabel: 'Site Inspection Report',
        footerType: 'Inspection',
        body,
        logoUrl: opts.logoUrl
    });
}

// ---------- Installation Handover / Work Order ----------

/** photoAttachments: array of data-URL strings or of {dataUrl, caption|tags} objects. */
function installationPhotos(rec) {
    const list = Array.isArray(rec.photoAttachments) ? rec.photoAttachments
        : Array.isArray(rec.photos) ? rec.photos : [];
    return list.map(p => {
        if (typeof p === 'string') return { src: safeImg(p), caption: '' };
        if (p && typeof p === 'object') {
            const cap = p.caption || (Array.isArray(p.tags) ? p.tags.join(', ') : p.tags);
            return { src: safeImg(p.dataUrl || p.src), caption: has(cap) ? String(cap) : '' };
        }
        return { src: '', caption: '' };
    })
        .filter(p => p.src)
        .map((p, i) => ({ src: p.src, label: p.caption || `Photo ${i + 1}` }));
}

function roughInSummary(o) {
    const conduits = MATERIALS.filter(m => m[2] === 'Conduit (Linear)' && num(o[m[0]]) > 0)
        .map(m => `${m[0] === 'conduitOtherQty' && has(o.conduitOtherType) ? o.conduitOtherType : m[1].replace(' Conduit', '')} ×${num(o[m[0]])}`);
    const boxes = MATERIALS.filter(m => m[2] === 'Electrical Boxes' && num(o[m[0]]) > 0)
        .map(m => `${m[1]} ×${num(o[m[0]])}`);
    if (has(o.boxOthers)) boxes.push(o.boxOthers);
    return {
        conduit: conduits.join(', '),
        boxes: boxes.join(', ')
    };
}

export function buildInstallationCertificateHtml(record, ocular, opts = {}) {
    const r = record || {};
    const o = ocular || null;
    const commissioned = r.status === 'COMMISSIONED';
    const instNo = r.installationNo || 'N/A';
    const instRef = `INST NO: ${esc(instNo)}`;

    let s1;
    if (o) {
        const isNema = String(o.hasNema3r).toUpperCase() === 'YES';
        const rough = roughInSummary(o);
        s1 = fieldGrid([
            ['Client Name', esc(o.clientName || r.clientName)],
            ['Inspection Date', has(o.dateTime) ? esc(formatDateTime(o.dateTime)) : ''],
            ['Location Address', esc(o.locationAddress), { full: true }],
            ['Voltage System', o.voltageSystem === 'Others' && has(o.voltageSpecify) ? `Others — ${esc(o.voltageSpecify)}` : esc(o.voltageSystem)],
            [isNema ? 'NEMA 3R Breaker' : 'Main Breaker', esc(isNema ? o.nema3rBreaker : o.mainBreaker)],
            ...(isNema ? [] : [
                ['Spare Breaker (40 AT, 2P)', yesNoPill(o.spareBreaker, 'YES (Available)', 'NO (Not Available)')],
                ['Grounding System', yesNoPill(o.groundingSystem, 'YES (Existing)', 'NO (To Be Provided)')]
            ]),
            ['Conduit Rough-in', esc(rough.conduit)],
            ['Boxes / Enclosures', esc(rough.boxes)]
        ]);
    } else {
        s1 = '<div class="nodata">Inspection record not linked.</div>';
    }

    const s2grid = fieldGrid([
        ['Installation No.', esc(instNo)],
        ['Installation Date', has(r.dateTime) ? esc(formatDateTime(r.dateTime)) : ''],
        ['Client Name', esc(r.clientName)],
        ['Scope of Works', esc(r.scopeOfWorks || (o && o.scopeOfWorks))],
        ['Installed By', esc(r.installerName)],
        ['Client Representative', esc(r.clientRepName)],
        ['Commissioning Status', commissioned ? '<span class="pill pill-yes">PASSED ✓</span>' : `<span class="pill pill-pending">${esc(formatStatus(r.status).toUpperCase())}</span>`]
    ]);
    const notes = has(r.commissioningData)
        ? `<div class="notes"><div class="lbl">Commissioning Data / Asset Serials</div><div class="notes-body">${esc(r.commissioningData)}</div></div>`
        : '';
    const s2 = s2grid || notes ? s2grid + notes : '';

    const s3 = materialsTable(r, 'Qty Used');

    const photos = installationPhotos(r);
    const s4 = photoGallery(photos);

    const s5 = `<div class="sigs">
        ${signatureBlock('CERTIFIED & HANDED OVER BY', r.installerSigImg, r.installerName, 'Installer, EcoWorks Operations')}
        ${signatureBlock('ACCEPTED & RECEIVED BY', r.clientRepSigImg || r.clientSigImg, r.clientRepName, 'Client Representative')}
    </div>`;

    const body = [
        section(1, 'Summary of Site Inspection', o && has(o.rnNo) ? `RN: ${esc(o.rnNo)}` : '', s1),
        section(2, 'Installation & Commissioning', instRef, s2),
        section(3, 'Materials Installed', instRef, s3),
        section(4, 'Photo Evidence', `${photos.length} PHOTO(S)`, s4, true),
        section(5, 'Handover & Acceptance', instRef, s5)
    ].join('');

    return page({
        title: `${commissioned ? 'Handover Certificate' : 'Installation Work Order'} - ${instNo}`,
        docTitle: commissioned ? 'Certificate of Installation Handover & Commissioning' : 'Installation Work Order',
        subtitle: commissioned
            ? `EV charging infrastructure installed, tested and handed over  •  ${instNo}`
            : `Installation record — not yet commissioned  •  ${instNo}`,
        badgeHtml: commissioned ? badge(true, '✓ HANDOVER CERTIFIED') : badge(false, formatStatus(r.status).toUpperCase()),
        docRef: commissioned ? `ECO-HANDOVER-${instNo}` : `ECO-WORKORDER-${instNo}`,
        watermark: commissioned ? '' : 'NOT COMMISSIONED',
        footerLabel: commissioned ? 'Installation Handover Certificate' : 'Installation Work Order',
        footerType: commissioned ? 'Handover Certificate' : 'Installation Work Order',
        body,
        logoUrl: opts.logoUrl
    });
}

// ---------- print stylesheet ----------

const CSS = `
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; }
body {
    font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f2937; font-size: 9.5pt; line-height: 1.3;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.doc { width: 100%; max-width: 190mm; margin: 0 auto; position: relative; z-index: 1; }
@media screen { body { background: #e5e7eb; padding: 16px 0; } .doc { background: #fff; padding: 10mm; max-width: 210mm; box-shadow: 0 2px 12px rgba(0,0,0,.15); } }

.hdr { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-bottom: 8px; border-bottom: 2.5px solid ${BLUE}; }
.brand { display: flex; align-items: center; gap: 10px; }
.logo { height: 42px; width: auto; }
.co { font-size: 12.5pt; font-weight: 800; color: ${BLUE_DEEP}; letter-spacing: .2px; }
.co-sub { font-size: 7.5pt; font-weight: 600; color: ${GREEN}; letter-spacing: .8px; margin-top: 2px; }
.meta { text-align: right; font-size: 7.5pt; color: #374151; white-space: nowrap; }
.meta-line { margin-top: 2px; }
.meta b { color: ${BLUE_DEEP}; }
.badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 800; font-size: 8.5pt; letter-spacing: .5px; margin-bottom: 4px; }
.badge-ok { background: ${GREEN}; color: #fff; }
.badge-pending { background: #fff4e0; color: #92400e; border: 1.5px solid ${AMBER}; }

.banner { margin: 7px 0 4px; padding: 6px 12px; border-radius: 4px; background: linear-gradient(90deg, ${BLUE_DEEP} 0%, ${BLUE_DARK} 45%, ${BLUE} 100%); color: #fff; }
.banner-title { font-size: 13pt; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; }
.banner-sub { font-size: 7.5pt; opacity: .9; margin-top: 2px; }

.sec { margin-top: 6px; break-inside: avoid; page-break-inside: avoid; }
.sec-flow { break-inside: auto; page-break-inside: auto; }
.sec-head { break-after: avoid; page-break-after: avoid; display: flex; justify-content: space-between; align-items: center; background: ${BLUE_SOFT}; border-left: 4px solid ${BLUE}; padding: 4px 8px; margin-bottom: 4px; }
.sec-title { font-weight: 800; font-size: 8.8pt; text-transform: uppercase; color: ${BLUE_DEEP}; letter-spacing: .4px; }
.sec-no { color: ${BLUE}; }
.sec-ref { font-size: 7.5pt; font-weight: 700; color: ${BLUE_DARK}; }
.nodata { font-style: italic; color: #6b7280; padding: 6px 8px; border: 1px dashed #cbd5e1; font-size: 8.5pt; }

.grid { border: 1px solid #cbd5e1; border-bottom: none; }
.row { display: flex; border-bottom: 1px solid #cbd5e1; }
.cell { flex: 1 1 50%; padding: 2px 7px; min-width: 0; display: flex; align-items: baseline; gap: 6px; }
.cell + .cell { border-left: 1px solid #cbd5e1; }
.cell.full { flex-basis: 100%; }
.cell.empty { background: #f8fafc; }
.lbl { flex: 0 0 38%; font-size: 6.6pt; font-weight: 700; text-transform: uppercase; color: #6b7280; letter-spacing: .3px; }
.cell.full .lbl { flex-basis: 18.2%; }
.notes .lbl { display: block; }
.val { flex: 1; min-width: 0; font-weight: 700; color: #111827; font-size: 8.8pt; word-wrap: break-word; overflow-wrap: anywhere; }

.pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 7.5pt; font-weight: 800; letter-spacing: .3px; }
.pill-yes { background: ${GREEN_SOFT}; color: ${GREEN}; border: 1px solid ${GREEN}; }
.pill-no { background: ${RED_SOFT}; color: ${RED}; border: 1px solid ${RED}; }
.pill-pending { background: #fff4e0; color: #92400e; border: 1px solid ${AMBER}; }

.tbls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: start; }
.tbl { width: 100%; border-collapse: collapse; font-size: 8pt; }
.cat { display: block; font-size: 6.3pt; font-weight: 400; color: #6b7280; }
.tbl th { background: ${BLUE_DARK}; color: #fff; text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: .4px; padding: 3px 7px; }
.tbl td { padding: 1.5px 6px; border-bottom: 1px solid #e2e8f0; }
.tbl tbody tr:nth-child(even) td { background: #f5f9fc; }
.tbl tr { break-inside: avoid; }
.num { text-align: right; }
.strong { font-weight: 700; }

.notes { border: 1px solid #cbd5e1; border-top: none; padding: 4px 7px; }
.notes-body { white-space: pre-wrap; font-size: 8.8pt; overflow-wrap: anywhere; }

.gallery { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.photo { border: 1px solid #cbd5e1; border-radius: 3px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
.ph-img { height: 27mm; background: #f1f5f9; display: flex; align-items: center; justify-content: center; }
.ph-img img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.gallery.many { grid-template-columns: repeat(5, 1fr); gap: 5px; }
.gallery.many .ph-img { height: 23mm; }
.gallery.dense { grid-template-columns: repeat(6, 1fr); gap: 4px; }
.gallery.dense .ph-img { height: 19mm; }
.photo figcaption { font-size: 7pt; font-weight: 700; padding: 3px 5px; color: ${BLUE_DEEP}; border-top: 1px solid #e2e8f0; background: #f8fafc; }

.sigs { display: flex; gap: 12px; }
.sig { flex: 1; border: 1px solid #cbd5e1; border-radius: 3px; padding: 6px 10px; text-align: center; break-inside: avoid; }
.sig-head { font-size: 7pt; font-weight: 800; color: ${BLUE_DARK}; letter-spacing: .5px; text-align: left; }
.sig-img { height: 14mm; display: flex; align-items: flex-end; justify-content: center; }
.sig-img img { max-height: 100%; max-width: 70%; object-fit: contain; }
.sig-missing { font-size: 7.5pt; color: #9ca3af; font-style: italic; padding-bottom: 4px; }
.sig-line { border-top: 1.2px solid #111827; margin: 2px 12% 3px; }
.sig-name { font-weight: 800; font-size: 9.5pt; text-transform: uppercase; }
.sig-role { font-size: 7pt; color: #6b7280; }

.ftr { display: flex; justify-content: space-between; gap: 10px; margin-top: 10px; padding-top: 5px; border-top: 1px solid #cbd5e1; font-size: 6.8pt; color: #6b7280; }

.watermark {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 72pt; font-weight: 900; color: rgba(180, 35, 24, 0.08); white-space: nowrap;
    letter-spacing: 6px; z-index: 5; pointer-events: none;
}
`;

// ---------- print flow ----------

/** Resolve once every <img> in the document has loaded/failed, or after timeoutMs. */
function waitForImages(doc, timeoutMs = 3000) {
    const imgs = Array.from(doc.images || []);
    const each = imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        if (typeof img.decode === 'function') return img.decode().catch(() => {});
        return new Promise(res => { img.onload = img.onerror = () => res(); });
    });
    const timeout = new Promise(res => setTimeout(res, timeoutMs));
    return Promise.race([Promise.all(each), timeout]);
}

/**
 * Open a print window (synchronously, so the popup counts as user-initiated),
 * fill it with the HTML produced by buildHtml (may be async), then print once
 * images are ready and close after printing finishes.
 */
async function openAndPrint(buildHtml) {
    const win = window.open('', '_blank');
    if (!win) {
        alert('The print window was blocked. Please allow pop-ups for this site and try again.');
        return;
    }
    try {
        win.document.open();
        win.document.write('<!DOCTYPE html><html><head><title>Preparing certificate…</title></head><body style="font-family:sans-serif;padding:2rem;color:#475569">Preparing certificate…</body></html>');
        win.document.close();

        const html = await buildHtml();
        if (win.closed) return;
        win.document.open();
        win.document.write(html);
        win.document.close();

        await waitForImages(win.document);
        if (win.closed) return;
        win.onafterprint = () => { try { win.close(); } catch (e) { /* ignore */ } };
        win.focus();
        win.print();
    } catch (err) {
        console.error('Certificate print failed:', err);
        try { win.close(); } catch (e) { /* ignore */ }
        alert('Could not generate the certificate: ' + (err && err.message ? err.message : err));
    }
}

export function printOcularCertificate(record) {
    return openAndPrint(() => buildOcularCertificateHtml(record));
}

export function printInstallationRegister(record) {
    return openAndPrint(async () => {
        let ocular = null;
        let ocularId = record && record.ocularId;
        if (ocularId && typeof ocularId === 'object') ocularId = ocularId.id;
        if (ocularId) {
            try {
                const { COLLECTIONS, get } = await import('../services/localDb.js');
                ocular = (await get(COLLECTIONS.OCULAR_INSPECTIONS, ocularId)) || null;
            } catch (err) {
                console.warn('Could not load linked ocular record for certificate:', err);
            }
        }
        return buildInstallationCertificateHtml(record, ocular);
    });
}
