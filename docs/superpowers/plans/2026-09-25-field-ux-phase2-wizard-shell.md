# EOMS Phase 2 — Shared Wizard Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared `FormWizard` class that owns step-progress chrome, a thumb-reachable pinned nav bar, and a per-step validation gate — then integrate it into `OcularFormView.js` and `InstallationFormView.js`, replacing each form's hand-rolled (and currently gate-less) nav-bar logic, with zero changes to the underlying IndexedDB data model.

**Architecture:** One new shared module (`js/shared/formWizard.js`) exposes three methods — `renderProgressBar`, `renderNavBar`, `bindNav` — that a view calls from its own `renderStep()`/`bindEvents()`. The wizard never touches `formData`, never renders step content, and never talks to `dataService`/`localDb`; each view still owns 100% of its own fields, business rules (the NEMA-3R modal, the step-0 record picker), and persistence calls. Validation is supplied BY each view as a `validateStep(stepNumber)` function checking only the fields already marked `required` in that view's existing HTML — richer checks (photo/signature completeness) are explicit Phase 4 scope, not this plan.

**Tech Stack:** Vanilla JS + Vite, plain CSS custom properties (reusing Phase 1's `--brand-*`/`--glass-*` tokens), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-25-field-ux-enhancement-design.md` (Section 6 — this plan implements Phase 2 only)

## Global Constraints

- No new npm dependencies, no framework, no CSS preprocessor.
- The wizard owns exactly three things: the step-progress bar, the pinned nav bar (Prev/Next/Submit + slots for each view's own extra buttons), and the validate-then-advance gate. It never renders step content and never contains business logic.
- Validation in this plan checks ONLY fields already marked `required` in the existing HTML (formalizing what's already there) — do not invent new required fields, and do not add photo-count or signature-blank checks (that's Phase 4).
- Reuse Phase 1 tokens for all new chrome: `--brand-green-dark`, `--glass-bg`, `--glass-blur`, `--glass-border`. Error-state red reuses the existing app convention `#ef4444`/`#dc2626` (already used for Remove/Clear buttons elsewhere in this codebase) — do not invent a new red.
- **Behavior change, called out explicitly:** Ocular's "Save Draft" button currently shows `alert('Draft saved.')` then immediately navigates to `/ocular`. This plan changes it to show the wizard's draft-status indicator inline and stay on the current step (no navigation, no alert) — this is what makes the spec's "visible draft-saved indicator" requirement actually meaningful. Installation gains no equivalent behavior; it keeps writing only on final submit, exactly as today.
- No automated test suite exists in this project. "Testing" in every task below means: run `npm run dev`, open the printed URL, and manually walk through the described interaction.
- This project has a git repository now (unlike when Phase 1's plan was first drafted). Use normal commits per task.

---

### Task 1: Create the shared FormWizard module and its CSS

**Files:**
- Create: `js/shared/formWizard.js`
- Modify: `style.css` (append a new section; do not touch any existing rule)

**Interfaces:**
- Produces: `export class FormWizard` with methods `renderProgressBar(currentStep)`, `renderNavBar(currentStep, opts)`, `bindNav(container, handlers)` — Tasks 2 and 3 both import and consume this exact class and these exact method signatures.
- `renderNavBar(currentStep, { showPrev, nextLabel, showSubmit, leftExtraHtml, rightExtraHtml, draftStatus })` — all options optional, defaults shown in the code below.
- `bindNav(container, { currentStep, onPrev, onNext, onSubmit, validateStep })` — `validateStep(currentStep)` must return `{ valid: boolean, errors: [{ field, message }] }`.

- [ ] **Step 1: Create `js/shared/formWizard.js`**

```js
export class FormWizard {
    constructor({ totalSteps }) {
        this.totalSteps = totalSteps;
    }

    renderProgressBar(currentStep) {
        let dots = '';
        for (let i = 1; i <= this.totalSteps; i++) {
            const state = i < currentStep ? 'done' : (i === currentStep ? 'active' : 'upcoming');
            dots += `<div class="wizard-step-dot wizard-step-dot--${state}">${i}</div>`;
            if (i < this.totalSteps) {
                const lineState = i < currentStep ? 'done' : 'upcoming';
                dots += `<div class="wizard-step-line wizard-step-line--${lineState}"></div>`;
            }
        }
        return `<div class="wizard-progress">${dots}</div>`;
    }

    renderNavBar(currentStep, opts = {}) {
        const {
            showPrev = currentStep > 1,
            nextLabel = 'Next',
            showSubmit = false,
            leftExtraHtml = '',
            rightExtraHtml = '',
            draftStatus = null
        } = opts;

        return `
            <div class="wizard-navbar">
                <div class="wizard-navbar-left">
                    ${showPrev ? '<button type="button" class="wizard-prev-btn">Previous</button>' : ''}
                    ${leftExtraHtml}
                </div>
                <div class="wizard-navbar-error" id="wizard-nav-error" hidden></div>
                <div class="wizard-navbar-right">
                    ${draftStatus ? `<span class="wizard-draft-status">${draftStatus}</span>` : ''}
                    ${rightExtraHtml}
                    ${!showSubmit ? `<button type="button" class="wizard-next-btn">${nextLabel}</button>` : ''}
                    ${showSubmit ? '<button type="button" class="wizard-submit-btn">Submit</button>' : ''}
                </div>
            </div>
        `;
    }

    bindNav(container, { currentStep, onPrev, onNext, onSubmit, validateStep } = {}) {
        const prevBtn = container.querySelector('.wizard-prev-btn');
        if (prevBtn && onPrev) prevBtn.addEventListener('click', onPrev);

        const advance = (callback) => {
            this.clearErrors(container);
            if (validateStep) {
                const result = validateStep(currentStep);
                if (result && result.valid === false) {
                    this.showErrors(container, result.errors || []);
                    return;
                }
            }
            callback();
        };

        const nextBtn = container.querySelector('.wizard-next-btn');
        if (nextBtn && onNext) nextBtn.addEventListener('click', () => advance(onNext));

        const submitBtn = container.querySelector('.wizard-submit-btn');
        if (submitBtn && onSubmit) submitBtn.addEventListener('click', () => advance(onSubmit));
    }

    showErrors(container, errors) {
        const summary = container.querySelector('#wizard-nav-error');
        if (summary) {
            summary.hidden = errors.length === 0;
            summary.textContent = errors.length ? `Please complete: ${errors.map(e => e.message).join(', ')}` : '';
        }
        errors.forEach(err => {
            if (!err.field) return;
            const field = container.querySelector(`[name="${err.field}"]`);
            if (field) {
                field.classList.add('wizard-field-error');
                field.addEventListener('input', () => field.classList.remove('wizard-field-error'), { once: true });
            }
        });
    }

    clearErrors(container) {
        container.querySelectorAll('.wizard-field-error').forEach(el => el.classList.remove('wizard-field-error'));
        const summary = container.querySelector('#wizard-nav-error');
        if (summary) { summary.hidden = true; summary.textContent = ''; }
    }
}
```

- [ ] **Step 2: Append wizard CSS to the end of `style.css`**

This relies on `.card` having `padding: 1.5rem` (confirmed current value — do not change it) so the progress/nav bars can bleed to the card's edges via matching negative margins.

```css

/* Form Wizard shell (shared by OcularFormView and InstallationFormView) */
.wizard-progress {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--glass-border);
  margin: -1.5rem -1.5rem 1.5rem -1.5rem;
}

.wizard-step-dot {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1.5px solid rgba(15, 23, 42, 0.2);
  color: #6b7684;
  background: transparent;
  flex-shrink: 0;
}

.wizard-step-dot--active {
  background: var(--brand-green-dark);
  border-color: var(--brand-green-dark);
  color: white;
}

.wizard-step-dot--done {
  background: #ffffff;
  border-color: var(--brand-green-dark);
  color: var(--brand-green-dark);
}

.wizard-step-line {
  width: 28px;
  height: 2px;
  flex-shrink: 0;
}

.wizard-step-line--done {
  background: var(--brand-green-dark);
}

.wizard-step-line--upcoming {
  background: rgba(15, 23, 42, 0.15);
}

.wizard-navbar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin: 1.5rem -1.5rem -1.5rem -1.5rem;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-top: 1px solid var(--glass-border);
}

.wizard-navbar-left,
.wizard-navbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.wizard-navbar-right {
  margin-left: auto;
}

.wizard-navbar-error {
  color: #dc2626;
  font-size: 0.85rem;
  flex: 1;
  text-align: center;
}

.wizard-draft-status {
  font-size: 0.8rem;
  color: #6b7684;
}

.wizard-field-error {
  border-color: #ef4444 !important;
  background: #fef2f2 !important;
}
```

- [ ] **Step 3: Verify**

Run `npm run build` — must succeed (this task adds a module nothing imports yet and CSS nothing references yet, so this is purely a syntax/build check).

- [ ] **Step 4: Commit**

```bash
git add js/shared/formWizard.js style.css
git commit -m "Add shared FormWizard module and wizard chrome CSS"
```

---

### Task 2: Integrate FormWizard into OcularFormView.js

**Files:**
- Modify: `js/workspaces/operations/OcularFormView.js`

**Interfaces:**
- Consumes: `FormWizard` from `js/shared/formWizard.js` (Task 1) — exact import path `'../../shared/formWizard.js'`.

- [ ] **Step 1: Add the import and initialize the wizard in the constructor**

Current (`js/workspaces/operations/OcularFormView.js:1-14`):
```js
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
```

Replace with:
```js
import { saveOcularDraft, getOcularDraft } from '../../shared/formStorage.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { initSignaturePad } from '../../shared/signaturePad.js';
import { getItemsByCategory } from '../../services/masterDataService.js';
import { navigateTo } from '../../components/Router.js';
import { updateLeadStageByOcularId } from '../../services/dataService.js';
import { FormWizard } from '../../shared/formWizard.js';

export default class OcularFormView {
    constructor() {
        this.step = 1;
        this.formData = {};
        this.map = null;
        this.marker = null;
        this.wizard = new FormWizard({ totalSteps: 4 });
        this.draftStatus = null;
    }
```

- [ ] **Step 2: Replace `renderStep()` to use the wizard's chrome**

Current (`js/workspaces/operations/OcularFormView.js:43-71`):
```js
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
```

Replace with:
```js
    renderStep() {
        let content = '';
        if (this.step === 1) content = this.renderStep1();
        else if (this.step === 2) content = this.renderStep2();
        else if (this.step === 3) content = this.renderStep3();
        else if (this.step === 4) content = this.renderStep4();

        const saveDraftBtnHtml = this.step === 4 ? '<button type="button" id="save-draft-btn">Save Draft</button>' : '';

        this.container.innerHTML = `
            ${this.wizard.renderProgressBar(this.step)}
            <form id="ocular-form" style="display: flex; flex-direction: column; flex: 1;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <h2>Ocular Inspection Form - Step ${this.step} of 4</h2>
                    ${content}
                </div>
            </form>
            ${this.wizard.renderNavBar(this.step, {
                showPrev: this.step > 1,
                showSubmit: this.step === 4,
                leftExtraHtml: saveDraftBtnHtml,
                draftStatus: this.draftStatus
            })}
        `;

        this.bindEvents();
        if (this.step === 1) this.initMap();
        if (this.step === 4) {
            this.initSignatures();
            this.initPhotos();
        }
    }
```

- [ ] **Step 3: Replace `bindEvents()` to wire the wizard, and add `validateStep()`**

Current (`js/workspaces/operations/OcularFormView.js:73-132`):
```js
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
```

Replace with:
```js
    bindEvents() {
        this.wizard.bindNav(this.container, {
            currentStep: this.step,
            validateStep: (step) => this.validateStep(step),
            onPrev: () => { this.saveData(); this.step--; this.renderStep(); },
            onNext: () => {
                this.saveData();
                // NEMA 3R gate logic for step 1 -> 2
                if (this.step === 1 && !this.formData.hasNema3r) {
                    this.showNema3rModal(false);
                    return;
                }
                this.step++;
                this.renderStep();
            },
            onSubmit: async () => {
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
            }
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
            this.draftStatus = 'Draft saved';
            this.renderStep();
        });
    }

    validateStep(step) {
        const errors = [];
        if (step === 1) {
            if (!this.formData.clientName) errors.push({ field: 'clientName', message: 'Client Name is required' });
            if (!this.formData.rnNo) errors.push({ field: 'rnNo', message: 'RN No is required' });
            if (!this.formData.installationNo) errors.push({ field: 'installationNo', message: 'Installation No is required' });
            if (!this.formData.locationAddress) errors.push({ field: 'locationAddress', message: 'Location Address is required' });
        } else if (step === 4) {
            if (!this.formData.inspectedByName) errors.push({ field: 'inspectedByName', message: 'Inspector Name is required' });
            if (!this.formData.witnessedByName) errors.push({ field: 'witnessedByName', message: 'Witness Name is required' });
        }
        return { valid: errors.length === 0, errors };
    }
```

- [ ] **Step 4: Verify**

Run `npm run build` — must succeed. Then run `npm run dev`, sign in as a field-crew profile, open the Ocular Inspection form and manually check:
1. The step-progress dots appear at the top, step 1 highlighted.
2. On step 1, clear the "Client Name" field and click Next — it should NOT advance; the field gets a red outline and an error summary appears in the nav bar.
3. Fill it back in, click Next — the NEMA-3R modal still appears exactly as before, and choosing an option still advances to step 2.
4. Navigate to step 4, click "Save Draft" — you should stay on step 4 and see "Draft saved" appear in the nav bar (no alert, no navigation away).
5. Clear "Inspector Name" on step 4 and click Submit — it should be blocked with an inline error, same as step 1's gate.
6. Fill it back in and submit for real — the existing submit flow (alert, navigate to `/ocular`) still fires.

- [ ] **Step 5: Commit**

```bash
git add js/workspaces/operations/OcularFormView.js
git commit -m "Integrate FormWizard into OcularFormView"
```

---

### Task 3: Integrate FormWizard into InstallationFormView.js

**Files:**
- Modify: `js/workspaces/operations/InstallationFormView.js`

**Interfaces:**
- Consumes: `FormWizard` from `js/shared/formWizard.js` (Task 1) — exact import path `'../../shared/formWizard.js'`.

- [ ] **Step 1: Add the import and initialize the wizard in the constructor**

Current (`js/workspaces/operations/InstallationFormView.js:1-16`):
```js
import { saveInstallationRecord, fetchPendingInstallations } from '../../services/dataService.js';
import { COLLECTIONS, get } from '../../services/localDb.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { initSignaturePad } from '../../shared/signaturePad.js';
import { buildInspectionSummaryHtml } from '../../shared/inspectionSummary.js';
import { escapeHTML, isValidBase64Image } from '../../shared/security.js';
import { navigateTo } from '../../components/Router.js';

export default class InstallationFormView {
    constructor() {
        this.step = 0; // Step 0 is picking an installation record
        this.formData = {};
        this.linkedOcular = null;
        this.installationRecord = null;
        this.photos = [];
    }
```

Replace with:
```js
import { saveInstallationRecord, fetchPendingInstallations } from '../../services/dataService.js';
import { COLLECTIONS, get } from '../../services/localDb.js';
import { getActiveProfileId } from '../../components/ActiveProfilePicker.js';
import { initSignaturePad } from '../../shared/signaturePad.js';
import { buildInspectionSummaryHtml } from '../../shared/inspectionSummary.js';
import { escapeHTML, isValidBase64Image } from '../../shared/security.js';
import { navigateTo } from '../../components/Router.js';
import { FormWizard } from '../../shared/formWizard.js';

export default class InstallationFormView {
    constructor() {
        this.step = 0; // Step 0 is picking an installation record
        this.formData = {};
        this.linkedOcular = null;
        this.installationRecord = null;
        this.photos = [];
        this.wizard = new FormWizard({ totalSteps: 4 });
    }
```

- [ ] **Step 2: Replace `renderStep()` to use the wizard's chrome (step 0 keeps zero wizard chrome)**

Current (`js/workspaces/operations/InstallationFormView.js:28-60`):
```js
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
                <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                    ${this.step > 1 ? '<button type="button" id="prev-btn">Previous</button>' : '<button type="button" id="cancel-btn">Cancel</button>'}
                    ${this.step < 4 ? '<button type="button" id="next-btn">Next</button>' : ''}
                    ${this.step === 4 ? '<button type="submit" id="submit-btn" style="background-color: #10b981; color: white;">Submit Installation Record</button>' : ''}
                    <button type="button" id="preview-ocular-btn" style="margin-left: auto;">Preview Ocular Inspection</button>
                </div>
            `;
        }

        this.container.innerHTML = `
            <h2>Installation Report Form ${this.step > 0 ? `- Step ${this.step} of 4` : ''}</h2>
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
```

Replace with:
```js
    async renderStep() {
        let content = '';
        if (this.step === 0) content = await this.renderStep0();
        else if (this.step === 1) content = this.renderStep1();
        else if (this.step === 2) content = this.renderStep2();
        else if (this.step === 3) content = this.renderStep3();
        else if (this.step === 4) content = this.renderStep4();

        const previewBtnHtml = '<button type="button" id="preview-ocular-btn">Preview Ocular Inspection</button>';
        const cancelBtnHtml = '<button type="button" id="cancel-btn">Cancel</button>';

        const progressHtml = this.step > 0 ? this.wizard.renderProgressBar(this.step) : '';
        const navHtml = this.step > 0 ? this.wizard.renderNavBar(this.step, {
            showPrev: this.step > 1,
            showSubmit: this.step === 4,
            leftExtraHtml: this.step === 1 ? cancelBtnHtml : '',
            rightExtraHtml: previewBtnHtml
        }) : '';

        this.container.innerHTML = `
            ${progressHtml}
            <form id="installation-form" style="display: flex; flex-direction: column; flex: 1;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <h2>Installation Report Form ${this.step > 0 ? `- Step ${this.step} of 4` : ''}</h2>
                    ${content}
                </div>
            </form>
            ${navHtml}
            <div id="ocular-preview-modal" style="display: none; margin-top: 1rem; padding: 1rem; border: 1px solid #ccc; background: #fafafa;"></div>
        `;

        this.bindEvents();
    }
```

- [ ] **Step 3: Replace `bindEvents()` to wire the wizard, and add `validateStep()`**

Current (`js/workspaces/operations/InstallationFormView.js:62-188`):
```js
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
                            dateTime: new Date().toISOString().slice(0,16),
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
                    previewBtn.textContent = 'Hide Ocular Preview';
                } else {
                    modal.style.display = 'none';
                    previewBtn.textContent = 'Preview Ocular Inspection';
                }
            });
        }
        
        if (this.step === 3) {
            const photoInput = this.container.querySelector('#photo-upload');
            const previewContainer = this.container.querySelector('#photo-preview');
            
            if (photoInput) {
                photoInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const dataUrl = event.target.result;
                            if (isValidBase64Image(dataUrl)) {
                                this.photos.push(dataUrl);
                                this.renderPhotos(previewContainer);
                            }
                        };
                        reader.readAsDataURL(file);
                    }
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
                
                if (this.installerPad) this.formData.installerSigImg = this.installerPad.getDataUrl();
                if (this.clientRepPad) this.formData.clientRepSigImg = this.clientRepPad.getDataUrl();
                
                this.formData.photoAttachments = this.photos;
                this.formData.createdBy = getActiveProfileId();
                this.formData.status = 'COMPLETED';
                
                try {
                    await saveInstallationRecord(this.formData);
                    try {
                        const { updateLeadStageByOcularId } = await import('../../services/dataService.js');
                        await updateLeadStageByOcularId(this.formData.ocularId, 'JOB_CHECKOUT_COMPLETE');
                    } catch(e) {}
                    
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
```

Replace with:
```js
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
                            dateTime: new Date().toISOString().slice(0,16),
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

        this.wizard.bindNav(this.container, {
            currentStep: this.step,
            validateStep: (step) => this.validateStep(step),
            onPrev: () => { this.saveData(); this.step--; this.renderStep(); },
            onNext: () => { this.saveData(); this.step++; this.renderStep(); },
            onSubmit: async () => {
                this.saveData();

                if (this.installerPad) this.formData.installerSigImg = this.installerPad.getDataUrl();
                if (this.clientRepPad) this.formData.clientRepSigImg = this.clientRepPad.getDataUrl();

                this.formData.photoAttachments = this.photos;
                this.formData.createdBy = getActiveProfileId();
                this.formData.status = 'COMPLETED';

                try {
                    await saveInstallationRecord(this.formData);
                    try {
                        const { updateLeadStageByOcularId } = await import('../../services/dataService.js');
                        await updateLeadStageByOcularId(this.formData.ocularId, 'JOB_CHECKOUT_COMPLETE');
                    } catch(e) {}

                    alert('Installation record submitted successfully!');
                    this.step = 0;
                    this.formData = {};
                    this.linkedOcular = null;
                    this.photos = [];
                    this.renderStep();
                } catch(err) {
                    alert('Error saving record: ' + err.message);
                }
            }
        });

        const cancelBtn = this.container.querySelector('#cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => { this.step = 0; this.linkedOcular = null; this.renderStep(); });

        const previewBtn = this.container.querySelector('#preview-ocular-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                const modal = this.container.querySelector('#ocular-preview-modal');
                if (modal.style.display === 'none') {
                    modal.innerHTML = buildInspectionSummaryHtml(this.linkedOcular);
                    modal.style.display = 'block';
                    previewBtn.textContent = 'Hide Ocular Preview';
                } else {
                    modal.style.display = 'none';
                    previewBtn.textContent = 'Preview Ocular Inspection';
                }
            });
        }
        
        if (this.step === 3) {
            const photoInput = this.container.querySelector('#photo-upload');
            const previewContainer = this.container.querySelector('#photo-preview');
            
            if (photoInput) {
                photoInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const dataUrl = event.target.result;
                            if (isValidBase64Image(dataUrl)) {
                                this.photos.push(dataUrl);
                                this.renderPhotos(previewContainer);
                            }
                        };
                        reader.readAsDataURL(file);
                    }
                });
                this.renderPhotos(previewContainer);
            }
        }

        if (this.step === 4) {
            this.installerPad = initSignaturePad('installer-pad', 'clear-installer');
            this.clientRepPad = initSignaturePad('clientrep-pad', 'clear-clientrep');
        }
    }

    validateStep(step) {
        const errors = [];
        if (step === 4) {
            if (!this.formData.installerName) errors.push({ field: 'installerName', message: 'Installer Name is required' });
            if (!this.formData.clientRepName) errors.push({ field: 'clientRepName', message: 'Client Rep Name is required' });
        }
        return { valid: errors.length === 0, errors };
    }
```

- [ ] **Step 4: Verify**

Run `npm run build` — must succeed. Then run `npm run dev`, sign in as a field-crew profile, open "All Installations" and manually check:
1. Step 0 (the record picker) renders with NO progress bar and NO wizard nav bar, exactly as before.
2. Starting a report moves to step 1: the progress bar appears, and step 1's nav bar shows "Cancel" (not "Previous") on the left and "Preview Ocular Inspection" on the right.
3. Clicking "Cancel" returns to step 0.
4. Advancing to step 4 (Summary & Sign-off), clearing "Installer Name" and clicking Submit — blocked with an inline error, same pattern as Ocular's gate.
5. Filling it back in and submitting for real — the existing submit flow (alert, reset to step 0) still fires.
6. "Preview Ocular Inspection" still opens/closes the inline summary at every step, unchanged.

- [ ] **Step 5: Commit**

```bash
git add js/workspaces/operations/InstallationFormView.js
git commit -m "Integrate FormWizard into InstallationFormView"
```

---

### Task 4: Full manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the app**

Run `npm run dev` and open the printed local URL in a browser.

- [ ] **Step 2: Full Ocular Inspection run-through**

Start a new Ocular inspection as a field-crew profile. Walk all 4 steps forward and backward (Previous) at least once. Confirm the progress dots update correctly at each step (done/active/upcoming). Trigger the NEMA-3R modal via "Change Feeder Path" on step 2 and confirm switching enclosure type still works. On step 4, save a draft (confirm "Draft saved" appears and you stay on the page), then submit for real.

- [ ] **Step 3: Full Installation Report run-through**

As a field-crew profile with a dispatched installation ready, start an Installation Report. Confirm step 0 has no wizard chrome, step 1 shows "Cancel" instead of "Previous", and "Preview Ocular Inspection" is visible and functional on every step. Submit on step 4 and confirm the success flow resets back to step 0.

- [ ] **Step 4: Report completion**

Phase 2 is complete when both run-throughs succeed with the validation gate correctly blocking incomplete required fields, and no console errors appear in the browser during either walkthrough.
