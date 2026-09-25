import { saveOcularDraft, getOcularDraft } from '../../shared/formStorage.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { initSignaturePad } from '../../shared/signaturePad.js';
import { getItemsByCategory } from '../../services/masterDataService.js';
import { navigateTo } from '../../components/Router.js';
import { updateLeadStageByOcularId } from '../../services/dataService.js';

export default class OcularFormView {
    constructor() {
        this.step = 1;
        this.formData = {};
        this.map = null;
        this.marker = null;
    }

    async render() {
        this.container = document.createElement('div');
        this.container.className = 'card';
        this.container.style.minHeight = 'calc(100vh - 120px)';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        
        await this.loadCatalogs();
        
        // Try to load draft
        const draftId = sessionStorage.getItem('currentOcularDraftId');
        if (draftId) {
            const draft = await getOcularDraft(parseInt(draftId));
            if (draft) this.formData = draft;
        }

        this.renderStep();
        return this.container;
    }

    async loadCatalogs() {
        this.breakers = await getItemsByCategory('breakers');
        this.chargers = await getItemsByCategory('chargers');
        this.conduits = await getItemsByCategory('conduits');
        this.scopes = await getItemsByCategory('scopes');
    }

    renderStep() {
        let content = '';
        if (this.step === 1) content = this.renderStep1();
        else if (this.step === 2) content = this.renderStep2();
        else if (this.step === 3) content = this.renderStep3();
        else if (this.step === 4) content = this.renderStep4();
        
        this.container.innerHTML = `
            <h2>Ocular Inspection Form - Step ${this.step} of 4</h2>
            <form id="ocular-form" style="display: flex; flex-direction: column; flex: 1;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    ${content}
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                    ${this.step > 1 ? '<button type="button" id="prev-btn">Previous</button>' : ''}
                    ${this.step === 4 ? '<button type="button" id="save-draft-btn">Save Draft</button>' : ''}
                    ${this.step < 4 ? '<button type="button" id="next-btn">Next</button>' : ''}
                    ${this.step === 4 ? '<button type="submit" id="submit-btn" style="background-color: #10b981; color: white;">Submit for Approval</button>' : ''}
                </div>
            </form>
        `;

        this.bindEvents();
        if (this.step === 1) this.initMap();
        if (this.step === 4) {
            this.initSignatures();
            this.initPhotos();
        }
    }
    
    bindEvents() {
        const prevBtn = this.container.querySelector('#prev-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => { this.saveData(); this.step--; this.renderStep(); });
        
        const nextBtn = this.container.querySelector('#next-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => { 
            this.saveData(); 
            // NEMA 3R gate logic for step 2
            if (this.step === 1 && !this.formData.hasNema3r) {
                this.showNema3rModal(false);
                return;
            }
            this.step++; 
            this.renderStep(); 
        });

        const changeFeederBtn = this.container.querySelector('#btn-change-feeder');
        if (changeFeederBtn) {
            changeFeederBtn.addEventListener('click', () => {
                this.saveData();
                this.showNema3rModal(true);
            });
        }

        const saveBtn = this.container.querySelector('#save-draft-btn');
        if (saveBtn) saveBtn.addEventListener('click', async () => {
            this.saveData();
            await this.saveAsDraft();
            alert('Draft saved.');
            navigateTo('/ocular'); // ADD THIS
        });
        
        const form = this.container.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.saveData();
            
            if (this.inspectorPad) this.formData.inspectorSigImg = this.inspectorPad.getDataUrl();
            if (this.witnessPad) this.formData.witnessSigImg = this.witnessPad.getDataUrl();
            
            this.formData.timeEnd = new Date().toISOString();
            this.formData.createdBy = getActiveProfileId();
            this.formData.status = 'PENDING_QA';
            
            // clear QA trail
            delete this.formData.qaNotes;
            delete this.formData.qaReviewedBy;
            delete this.formData.qaReviewedAt;
            
            await saveOcularDraft(this.formData, this.formData.id);
            if (this.formData.id) {
                try {
                    await updateLeadStageByOcularId(this.formData.id, 'SITE_VISIT_COMPLETED');
                } catch(e) { console.error('Failed to auto-update lead stage:', e); }
            }
            alert('Inspection submitted for approval!');
            sessionStorage.removeItem('currentOcularDraftId');
            navigateTo('/ocular');
        });
    }

    async saveAsDraft() {
        if (this.inspectorPad) this.formData.inspectorSigImg = this.inspectorPad.getDataUrl();
        if (this.witnessPad) this.formData.witnessSigImg = this.witnessPad.getDataUrl();
        this.formData.createdBy = getActiveProfileId();
        const saved = await saveOcularDraft(this.formData, this.formData.id);
        this.formData.id = saved.id;
        sessionStorage.setItem('currentOcularDraftId', saved.id);
    }

    showNema3rModal(isChange = false) {
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';
        
        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 8px; text-align: center; max-width: 400px;">
                <h3>Feeder Path Choice</h3>
                <p>Choose the enclosure type for this installation:</p>
                <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
                    <button id="btn-main">Main Distribution</button>
                    <button id="btn-nema">NEMA 3R Enclosure</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('#btn-main').addEventListener('click', () => {
            this.formData.hasNema3r = 'NO';
            document.body.removeChild(modal);
            if (!isChange) this.step++; 
            this.renderStep();
        });
        modal.querySelector('#btn-nema').addEventListener('click', () => {
            this.formData.hasNema3r = 'YES';
            document.body.removeChild(modal);
            if (!isChange) this.step++; 
            this.renderStep();
        });
    }
    
    saveData() {
        const inputs = this.container.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'radio' && !input.checked) return;
                this.formData[input.name] = input.value;
            }
        });
        if (!this.formData.dateTime) this.formData.dateTime = new Date().toISOString().slice(0, 16);
        if (!this.formData.timeStart) this.formData.timeStart = new Date().toISOString();
    }

    renderStep1() {
        const scopeOptions = this.scopes.map(s => `<option value="${s.itemName}" ${this.formData.scopeOfWorks === s.itemName ? 'selected' : ''}>${s.itemName}</option>`).join('');
        return `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="form-group" style="margin: 0;"><label>Client Name *</label><input type="text" name="clientName" value="${this.formData.clientName || ''}" required></div>
                <div class="form-group" style="margin: 0;"><label>Contact No</label><input type="text" name="contactNo" value="${this.formData.contactNo || ''}"></div>
                <div class="form-group" style="margin: 0;"><label>RN No *</label><input type="text" name="rnNo" value="${this.formData.rnNo || ''}" required></div>
                <div class="form-group" style="margin: 0;"><label>Installation No *</label><input type="text" name="installationNo" value="${this.formData.installationNo || ''}" required></div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="form-group" style="margin: 0;">
                    <label>Scope of Works</label>
                    <select name="scopeOfWorks">
                        <option value="Site Inspection" ${this.formData.scopeOfWorks === 'Site Inspection' ? 'selected' : ''}>Site Inspection</option>
                        <option value="Installation" ${this.formData.scopeOfWorks === 'Installation' ? 'selected' : ''}>Installation</option>
                        <option value="Revisit" ${this.formData.scopeOfWorks === 'Revisit' ? 'selected' : ''}>Revisit</option>
                        <option value="Checking" ${this.formData.scopeOfWorks === 'Checking' ? 'selected' : ''}>Checking</option>
                        ${scopeOptions}
                    </select>
                </div>
                <div class="form-group" style="margin: 0;">
                    <label>Type of Residency *</label>
                    <select name="typeOfResidency" required>
                        <option value="Residential" ${this.formData.typeOfResidency === 'Residential' ? 'selected' : ''}>Residential</option>
                        <option value="Commercial" ${this.formData.typeOfResidency === 'Commercial' ? 'selected' : ''}>Commercial</option>
                        <option value="Industrial" ${this.formData.typeOfResidency === 'Industrial' ? 'selected' : ''}>Industrial</option>
                    </select>
                </div>
                <div class="form-group" style="margin: 0; grid-column: span 2;">
                    <label>Location Address *</label>
                    <textarea name="locationAddress" id="locationAddress" required rows="2" style="height: 42px;">${this.formData.locationAddress || ''}</textarea>
                </div>
            </div>

            <div class="form-group" style="margin: 0; flex: 1; display: flex; flex-direction: column;">
                <label>GPS Site Pin</label>
                <div id="map" style="width: 100%; flex: 1; min-height: 400px; border: 1px solid #ccc; border-radius: 8px;"></div>
                <input type="hidden" name="gpsPinCoordinates" id="gpsPinCoordinates" value="${this.formData.gpsPinCoordinates || ''}">
            </div>
        `;
    }

    initMap() {
        if (!window.L) return;
        const defaultLat = 14.5995;
        const defaultLng = 120.9842;
        let lat = defaultLat;
        let lng = defaultLng;

        if (this.formData.gpsPinCoordinates) {
            const parts = this.formData.gpsPinCoordinates.split(',');
            lat = parseFloat(parts[0]);
            lng = parseFloat(parts[1]);
        }

        const mapEl = this.container.querySelector('#map');
        if (!mapEl) return;

        setTimeout(() => {
            this.map = L.map(mapEl, { attributionControl: false }).setView([lat, lng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);
            
            this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
            
            const updateAddress = async (pos) => {
                const gpsInput = this.container.querySelector('#gpsPinCoordinates');
                const locInput = this.container.querySelector('#locationAddress');
                if (gpsInput) gpsInput.value = pos.lat + ', ' + pos.lng;
                
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`);
                    const data = await res.json();
                    if (data && data.display_name && locInput) {
                        locInput.value = data.display_name;
                    }
                } catch (err) {
                    console.warn('Geocoding failed', err);
                }
            };

            this.marker.on('dragend', (e) => updateAddress(e.target.getLatLng()));
            
            const fetchLocation = () => {
                const nextBtn = this.container.querySelector('#next-btn');
                if (nextBtn) {
                    nextBtn.disabled = true;
                    nextBtn.textContent = 'Fetching GPS...';
                }
                
                const restoreBtn = () => {
                    if (nextBtn) {
                        nextBtn.disabled = false;
                        nextBtn.textContent = 'Next';
                    }
                };

                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        async (position) => {
                            const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
                            this.map.flyTo([newPos.lat, newPos.lng], 18, { duration: 1.5 });
                            this.marker.setLatLng([newPos.lat, newPos.lng]);
                            await updateAddress(newPos);
                            restoreBtn();
                        },
                        (error) => {
                            console.warn('Geolocation error:', error);
                            restoreBtn();
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                } else {
                    restoreBtn();
                }
            };

            // Auto-fetch location if it's a new form without existing coordinates
            if (!this.formData.gpsPinCoordinates) {
                fetchLocation();
            }
        }, 100); 
    }

    renderStep2() {
        const isNema = this.formData.hasNema3r === 'YES';
        const brandOptions = ['GE', 'Schneider', 'ABB', 'Shihlin', 'Koten', 'Royo'].map(b => `<option value="${b}">${b}</option>`).join('');
        const mountingOptions = ['Bolt-on', 'Plug-in', 'DIN Rail Mounted', 'Fixed/Panel-Mounted Type'].map(m => `<option value="${m}">${m}</option>`).join('');
        const designOptions = ['MCB', 'MCCB'].map(d => `<option value="${d}">${d}</option>`).join('');
        const poleOptions = ['Single Pole (1P)', 'Double Pole (2P)', 'Three Pole (3P)', 'Four-Pole (4P)'].map(p => `<option value="${p}">${p}</option>`).join('');
        
        return `
            <div style="display:flex; justify-content:space-between; margin-bottom: 1rem;">
                <h3>${isNema ? 'NEMA 3R Enclosure' : 'Main Distribution Panelboard'}</h3>
                <button type="button" id="btn-change-feeder" style="font-size:0.8rem;">Change Feeder Path</button>
            </div>
            
            <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                <!-- Left Column -->
                <div style="flex: 1; min-width: 300px;">
                    <div class="form-group" style="padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                        <label style="font-size: 1.1rem; color: #1e3a8a; border-bottom: 1px solid #bfdbfe; padding-bottom: 0.5rem; margin-bottom: 1rem; display: block;">Electrical Specifications</label>
                        <div style="margin-bottom: 1rem;">
                            <label>Voltage System</label>
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.5rem;">
                                <label><input type="radio" name="voltageSystem" value="220 VAC, 1Ø, L-L" ${this.formData.voltageSystem === '220 VAC, 1Ø, L-L' || !this.formData.voltageSystem ? 'checked' : ''}> 220 VAC, 1Ø, L-L</label>
                                <label><input type="radio" name="voltageSystem" value="220 VAC, 1Ø, L-G" ${this.formData.voltageSystem === '220 VAC, 1Ø, L-G' ? 'checked' : ''}> 220 VAC, 1Ø, L-G</label>
                                <label><input type="radio" name="voltageSystem" value="Others" ${this.formData.voltageSystem === 'Others' ? 'checked' : ''}> Others</label>
                            </div>
                            <input type="text" name="voltageSpecify" placeholder="Specify if Others" value="${this.formData.voltageSpecify || ''}">
                        </div>

                        ${!isNema ? `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group" style="margin: 0;"><label>Main Breaker Rating</label>
                                    <select name="mainBreaker">
                                        <option value="40A">40A</option><option value="60A">60A</option><option value="80A">80A</option><option value="100A">100A</option>
                                    </select>
                                </div>
                                <div class="form-group" style="margin: 0;"><label>No. of Branches</label><input type="number" name="noOfBranches" value="${this.formData.noOfBranches || 0}"></div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                                <div class="form-group" style="margin: 0;"><label>Spare Breaker (40 AT, 2P)?</label>
                                    <label><input type="radio" name="spareBreaker" value="YES" ${this.formData.spareBreaker !== 'NO' ? 'checked' : ''}> YES</label>
                                    <label><input type="radio" name="spareBreaker" value="NO" ${this.formData.spareBreaker === 'NO' ? 'checked' : ''}> NO</label>
                                </div>
                                <div class="form-group" style="margin: 0;"><label>Space Provision?</label>
                                    <label><input type="radio" name="spaceProvision" value="YES" ${this.formData.spaceProvision !== 'NO' ? 'checked' : ''}> YES</label>
                                    <label><input type="radio" name="spaceProvision" value="NO" ${this.formData.spaceProvision === 'NO' ? 'checked' : ''}> NO</label>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Right Column -->
                <div style="flex: 1; min-width: 300px;">
                    <div class="form-group" style="padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                        <label style="font-size: 1.1rem; color: #1e3a8a; border-bottom: 1px solid #bfdbfe; padding-bottom: 0.5rem; margin-bottom: 1rem; display: block;">Enclosure & Terminals</label>
                        ${!isNema ? `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group" style="margin: 0;"><label>Breaker Brand/Type</label><select name="breakerBrandType">${brandOptions}</select></div>
                                <div class="form-group" style="margin: 0;"><label>Breaker Mounting</label><select name="breakerMounting">${mountingOptions}</select></div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                                <div class="form-group" style="margin: 0;"><label>Breaker Design</label><select name="breakerDesign">${designOptions}</select></div>
                                <div class="form-group" style="margin: 0;"><label>Breaker Pole</label><select name="breakerPole">${poleOptions}</select></div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                                <div class="form-group" style="margin: 0;"><label>Grounding System?</label>
                                    <label><input type="radio" name="groundingSystem" value="YES" ${this.formData.groundingSystem === 'YES' ? 'checked' : ''}> YES</label>
                                    <label><input type="radio" name="groundingSystem" value="NO" ${this.formData.groundingSystem !== 'YES' ? 'checked' : ''}> NO</label>
                                </div>
                                <div class="form-group" style="margin: 0;"><label>Grounding Rod Location (if NO)</label><textarea name="groundingRodLocation" rows="1">${this.formData.groundingRodLocation || ''}</textarea></div>
                            </div>
                        ` : `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group" style="margin: 0;"><label>NEMA 3R Breaker Rating</label><input type="text" name="nema3rBreaker" value="${this.formData.nema3rBreaker || ''}" placeholder="e.g. 40A 2P 230V"></div>
                                <div class="form-group" style="margin: 0;"><label>NEMA 3R Brand/Type</label><select name="nema3rBrandType">${brandOptions}</select></div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                                <div class="form-group" style="margin: 0;"><label>NEMA 3R Mounting</label><select name="nema3rMounting">${mountingOptions}</select></div>
                                <div class="form-group" style="margin: 0;"><label>NEMA 3R Design</label><select name="nema3rDesign">${designOptions}</select></div>
                            </div>
                            <div class="form-group" style="margin-top: 1rem;"><label>NEMA 3R Pole</label><select name="nema3rPole">${poleOptions}</select></div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderStep3() {
        const detailsStyle = "margin-bottom: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;";
        const summaryStyle = "font-weight: bold; cursor: pointer; padding: 1rem; background: #f1f5f9; border-radius: 8px; list-style: none; display: flex; justify-content: space-between; align-items: center;";
        const contentStyle = "display:flex; gap: 1rem; flex-wrap: wrap; padding: 1rem; border-top: 1px solid #e2e8f0;";

        return `
            <h3>EV Charger & Materials Schedule</h3>
            <div class="form-group"><label>Charger Location</label><input type="text" name="chargerLocation" value="${this.formData.chargerLocation || ''}"></div>
            <div class="form-group"><label>Estimate Distance (m)</label><input type="number" name="estimateDistance" value="${this.formData.estimateDistance || 0}"></div>
            
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

    renderStep4() {
        if (!this.formData.photoAttachments) this.formData.photoAttachments = {};
        
        return `
            <h3>Site Photo Attachments</h3>
            <p>Please upload exactly 4 required photos. All photos are required.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; margin-bottom: 2rem;">
                ${this.renderPhotoSlot('proposed_layout', 'Proposed Layout')}
                ${this.renderPhotoSlot('tapping_point', 'Tapping Point')}
                ${this.renderPhotoSlot('wiring_conduit', 'Wiring/Conduit Layout')}
                ${this.renderPhotoSlot('ev_charging_location', 'EV Charging Location')}
            </div>
            
            <div style="text-align: right; margin-bottom: 2rem;">
                <button type="button" id="download-photos-btn" style="background: #3b82f6;">Download Photos</button>
            </div>

            <h3>Works & Sign-off</h3>
            <div class="form-group"><label>Retrofitting Work</label><input type="text" name="workRetrofitting" value="${this.formData.workRetrofitting || ''}"></div>
            <div class="form-group"><label>New Installation</label><input type="text" name="workNewInstallation" value="${this.formData.workNewInstallation || ''}"></div>
            
            <div style="border: 1px solid #ccc; padding: 1rem; margin-top: 1rem; background: #fafafa;">
                <h4>Executive Audit Summary</h4>
                <p>Client: ${this.formData.clientName || 'N/A'}</p>
                <p>RN No: ${this.formData.rnNo || 'N/A'}</p>
                <p>Distance: ${this.formData.estimateDistance || 0}m</p>
                <p>NEMA 3R: ${this.formData.hasNema3r || 'NO'}</p>
            </div>

            <div class="form-group" style="margin-top: 1rem;">
                <label>Inspector Name & Signature</label>
                <input type="text" name="inspectedByName" value="${this.formData.inspectedByName || ''}" placeholder="Inspector Name" required>
                <canvas id="inspector-pad" width="400" height="200" style="border: 1px solid #ccc; display: block; margin-top:0.5rem;"></canvas>
                <button type="button" id="clear-inspector" style="margin-top: 0.5rem;">Clear</button>
            </div>
            <div class="form-group">
                <label>Witness Name & Signature</label>
                <input type="text" name="witnessedByName" value="${this.formData.witnessedByName || ''}" placeholder="Witness Name" required>
                <canvas id="witness-pad" width="400" height="200" style="border: 1px solid #ccc; display: block; margin-top:0.5rem;"></canvas>
                <button type="button" id="clear-witness" style="margin-top: 0.5rem;">Clear</button>
            </div>
        `;
    }

    renderPhotoSlot(key, label) {
        const hasPhoto = !!this.formData.photoAttachments[key];
        return `
            <div class="photo-slot" style="border: 1px dashed #ccc; padding: 1rem; text-align: center; background: #fafafa;">
                <label style="display: block; font-weight: bold; margin-bottom: 0.5rem;">${label}</label>
                
                <div id="preview-${key}" style="display: ${hasPhoto ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                    <img src="${hasPhoto ? this.formData.photoAttachments[key] : ''}" style="max-width: 100%; max-height: 150px; border: 1px solid #ccc;" />
                    <br/>
                    <button type="button" class="remove-photo-btn" data-key="${key}" style="margin-top: 0.5rem; font-size: 0.8rem; background: #ef4444; color: white;">Remove</button>
                </div>
                
                <div id="upload-${key}" style="display: ${hasPhoto ? 'none' : 'block'};">
                    <input type="file" class="photo-upload-input" data-key="${key}" accept="image/*" style="font-size: 0.8rem;">
                </div>
            </div>
        `;
    }

    initPhotos() {
        const fileInputs = this.container.querySelectorAll('.photo-upload-input');
        fileInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const key = e.target.dataset.key;
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const dataUrl = event.target.result;
                        if (!this.formData.photoAttachments) this.formData.photoAttachments = {};
                        this.formData.photoAttachments[key] = dataUrl;
                        
                        const previewDiv = this.container.querySelector('#preview-' + key);
                        const uploadDiv = this.container.querySelector('#upload-' + key);
                        previewDiv.querySelector('img').src = dataUrl;
                        previewDiv.style.display = 'block';
                        uploadDiv.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            });
        });

        const removeBtns = this.container.querySelectorAll('.remove-photo-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.target.dataset.key;
                if (this.formData.photoAttachments) {
                    delete this.formData.photoAttachments[key];
                }
                const previewDiv = this.container.querySelector('#preview-' + key);
                const uploadDiv = this.container.querySelector('#upload-' + key);
                previewDiv.querySelector('img').src = '';
                previewDiv.style.display = 'none';
                uploadDiv.style.display = 'block';
                const fileInput = uploadDiv.querySelector('.photo-upload-input');
                if (fileInput) fileInput.value = '';
            });
        });

        const downloadBtn = this.container.querySelector('#download-photos-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (!this.formData.photoAttachments || Object.keys(this.formData.photoAttachments).length === 0) {
                    alert('No photos to download.');
                    return;
                }
                for (const [key, dataUrl] of Object.entries(this.formData.photoAttachments)) {
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = `photo_${key}.png`;
                    a.click();
                }
            });
        }
    }

    initSignatures() {
        this.inspectorPad = initSignaturePad('inspector-pad', 'clear-inspector');
        this.witnessPad = initSignaturePad('witness-pad', 'clear-witness');
        
        if (this.formData.inspectorSigImg) {
            const ctx = document.getElementById('inspector-pad').getContext('2d');
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = this.formData.inspectorSigImg;
        }
        if (this.formData.witnessSigImg) {
            const ctx = document.getElementById('witness-pad').getContext('2d');
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = this.formData.witnessSigImg;
        }
    }
}
