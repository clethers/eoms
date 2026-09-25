import { escapeHTML } from './security.js';

export function printOcularCertificate(record) {
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head>
            <title>Certificate - ${escapeHTML(record.rnNo)}</title>
            <style>
                body { font-family: sans-serif; padding: 2rem; }
                h1 { color: #1878b8; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <h1>Ocular Inspection Certificate</h1>
            <p><strong>RN No:</strong> ${escapeHTML(record.rnNo)}</p>
            <p><strong>Client:</strong> ${escapeHTML(record.clientName)}</p>
            <p><strong>Date:</strong> ${escapeHTML(record.dateTime)}</p>
            <p><strong>Address:</strong> ${escapeHTML(record.locationAddress)}</p>
            <p><strong>Status:</strong> ${escapeHTML(record.status)}</p>
        </body>
        </html>
    `);
    win.document.close();
}

export function printInstallationRegister(record) {
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head>
            <title>Installation - ${escapeHTML(record.installationNo)}</title>
            <style>
                body { font-family: sans-serif; padding: 2rem; }
                h1 { color: #1878b8; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <h1>Installation Register</h1>
            <p><strong>Installation No:</strong> ${escapeHTML(record.installationNo)}</p>
            <p><strong>Client:</strong> ${escapeHTML(record.clientName)}</p>
            <p><strong>Date:</strong> ${escapeHTML(record.dateTime)}</p>
            <p><strong>Status:</strong> ${escapeHTML(record.status)}</p>
        </body>
        </html>
    `);
    win.document.close();
}
