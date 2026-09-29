import { saveInstallationRecord, fetchPendingInstallations } from '../../services/dataService.js';
import { COLLECTIONS, get } from '../../services/localDb.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { initSignaturePad } from '../../shared/signaturePad.js';
import { localDateTimeInputValue } from '../../shared/dateFormat.js';
import { buildInspectionSummaryHtml } from '../../shared/inspectionSummary.js';
import { escapeHTML, isValidBase64Image } from '../../shared/security.js';
import { navigateTo } from '../../components/Router.js';
import { compressImages, toPhotoList } from '../../shared/imageCompress.js';
import { btnContent, icon, setBtnLabel } from '../../shared/icons.js';

const MAX_INSTALLATION_PHOTOS = 30;

export default class InstallationFormView {
    constructor() {
        this.step = 0; // Step 0 is picking an installation record
        this.formData = {};
        this.linkedOcular = null;
        this.installationRecord = null;
        this.photos = [];
    }

    async render() {
        this.container = document.createElement('div');
        this.container.className = 'card';
        this.container.style.minHeight = 'calc(100vh - 120px)';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        await this.renderStep();
        return this.container;
    }

    async renderStep() {
        let content = '';
        if (this.step === 0) content = await this.renderStep0();
        else if (this.step === 1) content = this.renderStep1();
        else if (this.step === 2) content = this.renderStep2();
        else if (this.step === 3) content = this.renderStep3();
        else if (this.step === 4) content = this.renderStep4();
        
        let nav = '';
        if (this.step > 0) {
            nav = `
                <div class="form-nav">
                    <div class="form-nav__start">
                        ${this.step > 1 ? `<button type="button" id="prev-btn">${btnContent('chevron-left', 'Previous')}</button>` : `<button type="button" id="cancel-btn">${btnContent('x', 'Cancel')}</button>`}
                        <button type="button" id="preview-ocular-btn">${btnContent('eye', 'Preview Inspection')}</button>
                    </div>
                    <div class="form-nav__end">
                        ${this.step < 4 ? `<button type="button" id="next-btn">${btnContent('chevron-right', 'Next', true)}</button>` : ''}
                        ${this.step === 4 ? `<button type="submit" id="submit-btn">${btnContent('send', 'Submit Installation Record')}</button>` : ''}
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = `
            <h2>New Installation ${this.step > 0 ? `- Step ${this.step} of 4` : ''}</h2>
            <form id="installation-form" style="display: flex; flex-direction: column; flex: 1;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    ${content}
                </div>
                ${nav}
            </form>
            <div id="ocular-preview-modal" style="display: none; margin-top: 1rem; padding: 1rem; border: 1px solid #ccc; background: #fafafa;"></div>
        `;

        this.bindEvents();
    }
    
    bindEvents() {
        if (this.step === 0) {
            const startBtns = this.container.querySelectorAll('.start-btn');
            startBtns.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    try {
                        const idx = parseInt(e.target.dataset.idx, 10);
                        this.installationRecord = this.readyInstallations[idx];
                        
                        let safeOcularId = this.installationRecord.ocularId;
                        if (typeof safeOcularId === 'object' && safeOcularId !== null) {
                            safeOcularId = safeOcularId.id;
                        }

                        this.linkedOcular = await get(COLLECTIONS.OCULAR_INSPECTIONS, safeOcularId);
                        
                        this.formData = {
                            id: this.installationRecord.id, // Update the existing installation record
                            ocularId: safeOcularId,
                            installationNo: this.installationRecord.installationNo,
                            clientName: this.installationRecord.clientName,
                            scopeOfWorks: this.linkedOcular ? this.linkedOcular.scopeOfWorks : '',
                            dateTime: localDateTimeInputValue(),
                            // Pre-populate with ocular values if available
                            conduitPvc: this.linkedOcular ? (this.linkedOcular.conduitPvc || 0) : 0,
                            conduitEmt: this.linkedOcular ? (this.linkedOcular.conduitEmt || 0) : 0,
                            conduitBlackFlexible: this.linkedOcular ? (this.linkedOcular.conduitBlackFlexible || 0) : 0,
                            boxUtility: this.linkedOcular ? (this.linkedOcular.boxUtility || 0) : 0,
                            boxSquare: this.linkedOcular ? (this.linkedOcular.boxSquare || 0) : 0,
                            liquidTightConnectorQty: this.linkedOcular ? (this.linkedOcular.liquidTightConnectorQty || 0) : 0
                        };
                        this.step = 1;
                        await this.renderStep();
                    } catch (err) {
                        alert('Error starting report: ' + err.message);
                        console.error(err);
                    }
                });
            });
            return;
        }

        const prevBtn = this.container.querySelector('#prev-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => { this.saveData(); this.step--; this.renderStep(); });
        
        const cancelBtn = this.container.querySelector('#cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => { this.step = 0; this.linkedOcular = null; this.renderStep(); });
        
        const nextBtn = this.container.querySelector('#next-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => { this.saveData(); this.step++; this.renderStep(); });
        
        const previewBtn = this.container.querySelector('#preview-ocular-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                const modal = this.container.querySelector('#ocular-preview-modal');
                if (modal.style.display === 'none') {
                    modal.innerHTML = buildInspectionSummaryHtml(this.linkedOcular);
                    modal.style.display = 'block';
                    setBtnLabel(previewBtn, 'Hide Inspection Preview');
                } else {
                    modal.style.display = 'none';
                    setBtnLabel(previewBtn, 'Preview Inspection');
                }
            });
        }
        
        if (this.step === 3) {
            const photoInput = this.container.querySelector('#photo-upload');
            const previewContainer = this.container.querySelector('#photo-preview');
            
            if (photoInput) {
                photoInput.addEventListener('change', async (e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = '';
                    await this.addPhotos(files, previewContainer);
                });
                // initial render
                this.renderPhotos(previewContainer);
            }
        }

        const form = this.container.querySelector('form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                this.saveData();

                if (this.processingPhotos) {
                    alert('Photos are still processing. Please wait a moment.');
                    return;
                }
                const missing = [];
                if (!this.installerPad || this.installerPad.isEmpty()) missing.push('Installer signature');
                if (!this.clientRepPad || this.clientRepPad.isEmpty()) missing.push('Client rep signature');
                if (!this.photos || this.photos.length < 1) missing.push('At least 1 installation photo (Step 3)');
                if (missing.length) {
                    alert('Cannot submit yet. Missing:\n- ' + missing.join('\n- '));
                    return;
                }
                
                if (this.installerPad) this.formData.installerSigImg = this.installerPad.getDataUrl();
                if (this.clientRepPad) this.formData.clientRepSigImg = this.clientRepPad.getDataUrl();
                
                this.formData.photoAttachments = this.photos;
                this.formData.createdBy = getActiveProfileId();
                this.formData.status = 'COMMISSIONED';
                
                try {
                    // saveInstallationRecord also moves the linked lead to INSTALLATION_COMPLETE
                    await saveInstallationRecord(this.formData);
                    
                    alert('Installation record submitted successfully!');
                    this.step = 0;
                    this.formData = {};
                    this.linkedOcular = null;
                    this.photos = [];
                    this.renderStep();
                } catch(err) {
                    alert('Error saving record: ' + err.message);
                }
            });
        }
        
        if (this.step === 4) {
            this.installerPad = initSignaturePad('installer-pad', 'clear-installer');
            this.clientRepPad = initSignaturePad('clientrep-pad', 'clear-clientrep');
        }
    }

    async addPhotos(files, container) {
        if (!files.length || this.processingPhotos) return;
        this.photos = toPhotoList(this.photos);
        const room = MAX_INSTALLATION_PHOTOS - this.photos.length;
        const accepted = files.slice(0, Math.max(0, room));
        const skipped = files.length - accepted.length;

        this.setPhotoProcessing(true);
        let result;
        try {
            result = await compressImages(accepted);
        } finally {
            this.setPhotoProcessing(false);
        }
        this.photos.push(...result.dataUrls.filter(isValidBase64Image));
        this.renderPhotos(container);

        const msgs = [];
        if (skipped > 0) msgs.push(`Maximum ${MAX_INSTALLATION_PHOTOS} photos. ${skipped} photo${skipped === 1 ? ' was' : 's were'} skipped.`);
        if (result.errors.length) msgs.push(...result.errors);
        if (msgs.length) alert(msgs.join(`
`));
    }

    setPhotoProcessing(on) {
        this.processingPhotos = on;
        const el = this.container.querySelector('#photo-processing');
        if (el) el.style.display = on ? 'block' : 'none';
        ['#prev-btn', '#next-btn', '#cancel-btn', '#submit-btn', '#photo-upload'].forEach(sel => {
            const node = this.container.querySelector(sel);
            if (node) node.disabled = on;
        });
    }

    renderPhotos(container) {
        if (!container) return;
        this.photos = toPhotoList(this.photos);
        container.innerHTML = this.photos.map((p, idx) => `
            <div class="photo-thumb">
                <img src="${p}" alt="Photo ${idx + 1}" loading="lazy" />
                <button type="button" class="photo-thumb-remove" data-idx="${idx}" aria-label="Remove photo ${idx + 1}">${icon('x')}</button>
            </div>
        `).join('');
        const count = this.container.querySelector('#photo-count');
        if (count) count.textContent = `${this.photos.length} / ${MAX_INSTALLATION_PHOTOS}`;
        const upload = this.container.querySelector('#photo-upload');
        if (upload) upload.style.display = this.photos.length >= MAX_INSTALLATION_PHOTOS ? 'none' : '';

        container.querySelectorAll('.photo-thumb-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.processingPhotos) return;
                this.photos.splice(parseInt(btn.dataset.idx, 10), 1);
                this.renderPhotos(container);
            });
        });
    }

    saveData() {
        const inputs = this.container.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name && input.type !== 'file') {
                this.formData[input.name] = input.value;
            }
        });
    }

    async renderStep0() {
        this.readyInstallations = await fetchPendingInstallations(getActiveProfileId());
        
        // Filter out locked ones
        this.readyInstallations = this.readyInstallations.filter(i => {
            if (!i.scheduledDate) return true;
            const sched = new Date(i.scheduledDate);
            const now = new Date();
            sched.setHours(0,0,0,0);
            now.setHours(0,0,0,0);
            return sched <= now;
        });

        if (this.readyInstallations.length === 0) {
            return `<p>No installations are ready for your team today.</p>`;
        }
        return `
            <p>Select a dispatched installation to begin:</p>
            <table style="width: 100%; text-align: left; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #ccc;">
                        <th style="padding: 0.5rem;">Inst No</th>
                        <th style="padding: 0.5rem;">Client</th>
                        <th style="padding: 0.5rem;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.readyInstallations.map((i, idx) => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 0.5rem;">${escapeHTML(i.installationNo)}</td>
                            <td style="padding: 0.5rem;">${escapeHTML(i.clientName)}</td>
                            <td style="padding: 0.5rem;"><button type="button" class="start-btn btn-sm" data-idx="${idx}" title="Start Report" aria-label="Start Report">${btnContent('play', 'Start Report')}</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderStep1() {
        return `
            <div class="field-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="form-group"><label>Installation No</label><input type="text" name="installationNo" value="${this.formData.installationNo || ''}" readonly style="background: #f3f4f6;"></div>
                <div class="form-group"><label>Client Name</label><input type="text" name="clientName" value="${this.formData.clientName || ''}" readonly></div>
                <div class="form-group"><label>Scope of Works</label><input type="text" name="scopeOfWorks" value="${this.formData.scopeOfWorks || ''}" readonly></div>
            </div>
            
            <div class="form-group">
                <label>Commissioning Data / Asset Serials (Notes)</label>
                <textarea name="commissioningData" rows="4">${this.formData.commissioningData || ''}</textarea>
            </div>
        `;
    }

    renderStep2() {
        const detailsStyle = "margin-bottom: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;";
        const summaryStyle = "font-weight: bold; cursor: pointer; padding: 1rem; background: #f1f5f9; border-radius: 8px; list-style: none; display: flex; justify-content: space-between; align-items: center;";
        const contentStyle = "display:flex; gap: 1rem; flex-wrap: wrap; padding: 1rem; border-top: 1px solid #e2e8f0;";

        return `
            <h4>Actual Materials Used</h4>
            
            <details style="${detailsStyle}">
                <summary style="${summaryStyle}">Conduit (Linear) <span>▼</span></summary>
                <div style="${contentStyle}">
                    <label>PVC: <input type="number" name="conduitPvc" value="${this.formData.conduitPvc || 0}" style="width: 60px;"></label>
                    <label>EMT: <input type="number" name="conduitEmt" value="${this.formData.conduitEmt || 0}" style="width: 60px;"></label>
                    <label>IMC: <input type="number" name="conduitImc" value="${this.formData.conduitImc || 0}" style="width: 60px;"></label>
                    <label>RSC: <input type="number" name="conduitRsc" value="${this.formData.conduitRsc || 0}" style="width: 60px;"></label>
                    <label>PVC Moulding: <input type="number" name="conduitPvcMoulding" value="${this.formData.conduitPvcMoulding || 0}" style="width: 60px;"></label>
                    <label>Black Flexible: <input type="number" name="conduitBlackFlexible" value="${this.formData.conduitBlackFlexible || 0}" style="width: 60px;"></label>
                    <label>Orange Flexible: <input type="number" name="conduitPvcFlexibleOrange" value="${this.formData.conduitPvcFlexibleOrange || 0}" style="width: 60px;"></label>
                    <div style="display:flex; gap: 0.5rem; align-items: center;">
                        <label>Other:</label>
                        <input type="text" name="conduitOtherType" placeholder="Type" value="${this.formData.conduitOtherType || ''}" style="width: 100px;">
                        <input type="number" name="conduitOtherQty" value="${this.formData.conduitOtherQty || 0}" style="width: 60px;">
                    </div>
                </div>
            </details>

            <details style="${detailsStyle}">
                <summary style="${summaryStyle}">Liquid-tight Fittings <span>▼</span></summary>
                <div style="${contentStyle}">
                    <label>Connector Qty: <input type="number" name="liquidTightConnectorQty" value="${this.formData.liquidTightConnectorQty !== undefined ? this.formData.liquidTightConnectorQty : 4}" style="width: 60px;"></label>
                    <label>Flex Length (cm): <input type="text" name="liquidTightFlexLength" value="${this.formData.liquidTightFlexLength || ''}" style="width: 80px;"></label>
                </div>
            </details>

            <details style="${detailsStyle}">
                <summary style="${summaryStyle}">Elbows (90°) <span>▼</span></summary>
                <div style="${contentStyle}">
                    <label>EMT 90°: <input type="number" name="elbowEmt90" value="${this.formData.elbowEmt90 || 0}" style="width: 60px;"></label>
                    <label>IMC 90°: <input type="number" name="elbowImc90" value="${this.formData.elbowImc90 || 0}" style="width: 60px;"></label>
                    <label>RSC 90°: <input type="number" name="elbowRsc90" value="${this.formData.elbowRsc90 || 0}" style="width: 60px;"></label>
                </div>
            </details>

            <details style="${detailsStyle}">
                <summary style="${summaryStyle}">Conduit Bodies <span>▼</span></summary>
                <div style="${contentStyle}">
                    <label>LB: <input type="number" name="bodyLb" value="${this.formData.bodyLb || 0}" style="width: 60px;"></label>
                    <label>LR: <input type="number" name="bodyLr" value="${this.formData.bodyLr || 0}" style="width: 60px;"></label>
                    <label>LL: <input type="number" name="bodyLl" value="${this.formData.bodyLl || 0}" style="width: 60px;"></label>
                    <label>Body-C: <input type="number" name="bodyC" value="${this.formData.bodyC || 0}" style="width: 60px;"></label>
                    <label>Body-T: <input type="number" name="bodyT" value="${this.formData.bodyT || 0}" style="width: 60px;"></label>
                </div>
            </details>

            <details style="${detailsStyle}">
                <summary style="${summaryStyle}">Connectors / Couplings / Clamps <span>▼</span></summary>
                <div style="${contentStyle}">
                    <label>EMT Connector (Set Screw): <input type="number" name="connectorEmtSetScrew" value="${this.formData.connectorEmtSetScrew || 0}" style="width: 60px;"></label>
                    <label>EMT Connector (Compression): <input type="number" name="connectorEmtCompression" value="${this.formData.connectorEmtCompression || 0}" style="width: 60px;"></label>
                    <label>EMT Coupling (Set Screw): <input type="number" name="couplingEmtSetScrew" value="${this.formData.couplingEmtSetScrew || 0}" style="width: 60px;"></label>
                    <label>EMT Coupling (Compression): <input type="number" name="couplingEmtCompression" value="${this.formData.couplingEmtCompression || 0}" style="width: 60px;"></label>
                    <label>Clamp (2-hole): <input type="number" name="clampCTwoHole" value="${this.formData.clampCTwoHole || 0}" style="width: 60px;"></label>
                    <label>Clamp (1-hole): <input type="number" name="clampCOneHole" value="${this.formData.clampCOneHole || 0}" style="width: 60px;"></label>
                    <label>Strap Malleable: <input type="number" name="clampStrapMalleable" value="${this.formData.clampStrapMalleable || 0}" style="width: 60px;"></label>
                </div>
            </details>

            <details style="${detailsStyle}">
                <summary style="${summaryStyle}">Electrical Boxes <span>▼</span></summary>
                <div style="${contentStyle}">
                    <label>Utility: <input type="number" name="boxUtility" value="${this.formData.boxUtility || 0}" style="width: 60px;"></label>
                    <label>Square: <input type="number" name="boxSquare" value="${this.formData.boxSquare || 0}" style="width: 60px;"></label>
                    <label>Octagon: <input type="number" name="boxOctagon" value="${this.formData.boxOctagon || 0}" style="width: 60px;"></label>
                    <label>Junction: <input type="number" name="boxJunction" value="${this.formData.boxJunction || 0}" style="width: 60px;"></label>
                    <div style="display:flex; gap: 0.5rem; align-items: center;">
                        <label>Other Box Notes:</label>
                        <input type="text" name="boxOthers" placeholder="e.g. 1 NEMA Enclosure" value="${this.formData.boxOthers || ''}" style="width: 200px;">
                    </div>
                </div>
            </details>
        `;
    }
    
    renderStep3() {
        return `
            <h3>Photo Attachments</h3>
            <p>Upload photos of the completed installation (at least 1, up to ${MAX_INSTALLATION_PHOTOS}). You can select several photos at once.</p>
            <div class="form-group">
                <input type="file" id="photo-upload" accept="image/*" multiple>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="photo-processing" id="photo-processing" style="display: none; margin-top: 0;">Processing photos…</span>
                <span class="photo-count" id="photo-count" style="margin-left: auto;">${this.photos.length} / ${MAX_INSTALLATION_PHOTOS}</span>
            </div>
            <div id="photo-preview" class="photo-thumbs" style="margin-top: 0.5rem; min-height: 110px; border: 1px dashed #ccc; padding: 1rem;"></div>
        `;
    }

    renderStep4() {
        return `
            <h3>Summary & Sign-off</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
                <div class="form-group sig-field" style="margin: 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                    <label style="font-size: 1.1rem; border-bottom: 1px solid var(--brand-blue-soft); padding-bottom: 0.5rem; margin-bottom: 1rem; display: block;">Installer Name & Signature</label>
                    <input type="text" name="installerName" value="${this.formData.installerName || ''}" placeholder="Enter Installer Name" required>
                    <canvas id="installer-pad" width="400" height="200" style="border: 1px solid #ccc; display: block; width: 100%; border-radius: 4px; background: white;"></canvas>
                    <div class="sig-actions"><button type="button" id="clear-installer" class="btn-danger">${btnContent('eraser', 'Clear Signature')}</button></div>
                </div>
                <div class="form-group sig-field" style="margin: 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                    <label style="font-size: 1.1rem; border-bottom: 1px solid var(--brand-blue-soft); padding-bottom: 0.5rem; margin-bottom: 1rem; display: block;">Client Rep Name & Signature</label>
                    <input type="text" name="clientRepName" value="${this.formData.clientRepName || ''}" placeholder="Enter Client Rep Name" required>
                    <canvas id="clientrep-pad" width="400" height="200" style="border: 1px solid #ccc; display: block; width: 100%; border-radius: 4px; background: white;"></canvas>
                    <div class="sig-actions"><button type="button" id="clear-clientrep" class="btn-danger">${btnContent('eraser', 'Clear Signature')}</button></div>
                </div>
            </div>
        `;
    }
}
