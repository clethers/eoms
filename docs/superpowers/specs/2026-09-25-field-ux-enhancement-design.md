# EOMS Field Operations UX Enhancement — Design Spec

**Date:** 2026-09-25
**Status:** Draft, pending review
**Author context:** Drafted collaboratively in chat; this file consolidates those decisions into one place before implementation planning.

## 1. Problem

EOMS is an offline-first, vanilla-JS field-service app (electrical installation/inspection, EcoWorks brand) with three workspaces: Admin, Manager, Operations. The Operations workspace — used by field crews on tablets, outdoors, on-site — was built desktop-first: dense layout, small touch targets, ad-hoc multi-step form navigation, and no visual identity beyond a generic blue Bootstrap-like theme (`style.css`). Three concrete pain points were confirmed: confusing multi-step navigation, too much density/scrolling, and clunky touch interactions (signature pad, photo capture, GPS map pin).

## 2. Goals

1. Make the Operations workspace genuinely usable on a tablet in the field.
2. Give the app a real visual identity, based on the actual EcoWorks brand mark, not an invented one.
3. Make the UI "smart" — reduce user error, reduce re-entry of known data, explain unfamiliar technical fields, and surface what needs attention instead of flat lists.

## 3. Constraints

- Stay within the existing vanilla JS + Vite + single global `style.css` architecture. No frameworks, no new UI libraries.
- No backend/API changes. All work is presentation-layer; `dataService.js`/`localDb.js` contracts are unchanged except where Section 7 explicitly extends stored data (last-used dispatch values).
- No automated test suite exists today. Verification is manual, on a real tablet or Chrome DevTools tablet emulation.
- This is not a git repository. This spec and any implementation are saved as plain files; commit history is not available as a safety net, so changes should be made in small, independently-verifiable steps.

## 4. Visual identity

The app's color scheme is derived from the actual EcoWorks logo (`mats/ecoworks-logo.png`, copied to `public/ecoworks-logo.png`), not invented:

- `--brand-green` `#4c8c2a` (from the logo's leaf swoosh) — **actions only**: primary buttons, active nav/tab state. Never used for chrome or informational elements.
- `--brand-blue` `#1878b8` (from the logo's gear/skyline) — **structure and information only**: the logo wordmark, KPI tiles, "today" highlights, unread-notification tint, informational chips. Never used for buttons.
- `--brand-amber` `#f2ad3d` (from the logo's sunburst) — reserved for later status/warning use; not wired into any component yet.
- Soft tints (`--brand-green-soft #e3efd6`, `--brand-blue-soft #dcecf7`) back the active/hover states above.

This is a strict two-color split (green = do, blue = know), confirmed with the user, so the palette stays legible as a system rather than decorative.

### Glass UI

A lightweight frosted-glass treatment (`--glass-bg: rgba(255,255,255,0.55)`, `--glass-blur: 16px`, `--glass-border: rgba(255,255,255,0.7)`) applies **only to chrome**: `#app-header`, `.sidebar`, modals (dispatch, quote, preview), and the notification dropdown. It explicitly does **not** apply to anything a user reads data from or writes data into — cards, tables, form fields, the signature pad, photo tiles. This split exists because field crews use tablets outdoors, where translucent/blurred panels lose contrast in direct sunlight; chrome can afford it, content cannot.

A working sample of this (login screen + Ocular form step) was built as a design-canvas mockup and approved as the direction: [artifact reference, not reproduced here — see chat history].

## 5. Phase 1 — Foundation (tokens, brand, glass shell)

**Status: designed, implementation pending approval of this spec.**

Scope: `style.css`, `index.html`, and 5 JS files that currently hardcode blue outside the stylesheet (`DashboardView.js`, `AnalyticsDashboardView.js`, `NotificationCenter.js`, `CalendarView.js` render into the live DOM and switch to `var(--brand-blue)`/`var(--brand-blue-soft)`; `certificates.js` opens a standalone print window that doesn't inherit page CSS variables, so its heading color is hardcoded to `#1878b8` directly).

Changes:
- Add the brand/glass tokens above to `:root`.
- `body` background becomes a soft green-to-blue gradient wash (replacing flat grey), matching the mockup.
- `#app-header` and `.sidebar` get the glass treatment; everything else stays opaque.
- `.logo` gains the EcoWorks mark image next to the "EOMS" wordmark, colored blue.
- Active/selected states go green; hover states go blue-soft.
- `button` (primary actions) goes green; blue is removed from buttons entirely.

This phase applies app-wide immediately (it's a token/asset swap, low risk, and the user confirmed a global rollout is preferable to an inconsistent partial one).

## 6. Phase 2 — Shared wizard shell

**Scope:** `OcularFormView.js` (4 steps) and `InstallationFormView.js` (5 steps, with a step-0 record picker before the wizard proper), which currently each hand-roll their own step-navigation logic, including an identical ~15-line nav-bar block and no per-step validation at all today (only native HTML `required` firing on final submit).

Extract `js/shared/formWizard.js`, a small `FormWizard` class owning exactly three things — nav chrome and the validation gate, nothing else:

- `renderProgressBar(currentStep)` — the sticky top step-dot row from the Phase 1 mockup (green = current/completed, neutral = upcoming), using the Phase 1 brand tokens.
- `renderNavBar(currentStep, { showPrev, nextLabel, showSubmit, leftExtraHtml, rightExtraHtml, draftStatus })` — a bar **pinned to the bottom of the viewport** (a real layout change: `position: fixed`, with bottom padding added to the scrollable content area so nothing hides behind it). `leftExtraHtml`/`rightExtraHtml` are raw HTML slots each view fills with its own one-off buttons — Ocular's "Save Draft" on step 4, Installation's always-visible "Preview Ocular Inspection" and its step-1 "Cancel" (replacing "Previous"). `draftStatus` renders the saved/autosave-failed indicator only when a view passes one in.
- `bindNav(container, { onPrev, onNext, onSubmit, validateStep })` — wires the buttons. On "Next", it calls the view's own `validateStep(stepNumber)` (each view defines its required fields — only it knows them); if that returns errors, Next is blocked, the specific empty/invalid fields get an inline error state, and a summary appears at the nav bar. Nothing advances silently.

**What stays entirely in each view, unchanged in shape:** `renderStep()` content, `saveData()` field-scraping, and all business logic — including Ocular's NEMA-3R-choice modal (the view's own `onNext` callback shows the modal instead of advancing, exactly as it does today; the wizard needs no special hook for this) and Installation's step-0 record-picker screen (rendered with zero wizard chrome, before the wizard mounts at all, exactly as today).

**Deliberately not changed:** Installation gains no draft/autosave behavior — it keeps writing only on final submit, as it does today. The draft-saved indicator lights up only for Ocular, which already has `saveOcularDraft`. This is presentational — no changes to what gets written to `ocularInspections`/`installationRecords` in IndexedDB.

## 7. Phase 3 — Touch interaction upgrades

Targeted fixes for the three confirmed pain points, built on the Phase 1 tokens:
- **Signature pad** (`signaturePad.js`): larger canvas, visible clear/redo controls sized for a thumb.
- **Photo capture**: replace the current small file-input-style control with large tap-to-capture tiles, one per required photo slot.
- **GPS map** (`OcularFormView.js`'s Leaflet step): larger pin/confirm controls, plus a manual-adjust affordance for GPS drift, addressing the current fiddly pin-drop.

## 8. Phase 4 — Smart UI layer

Four concrete behaviors, each mapped to an existing pain point rather than added speculatively:

### 8.1 Fewer mistakes (guardrails)
- The wizard's per-step validation (Phase 2) blocks "Submit for Approval" when required photos or signatures are missing, with an inline explanation of what's missing — not a silent disabled button.
- A confirmation step is added before irreversible actions that don't already have one: submitting an Ocular inspection with incomplete data, and (on the Manager side) approving a QA review before a quote/BOM has been generated for it.

### 8.2 Less to remember (smart defaults)
- `InstallationFormView.js` already pre-fills materials from the linked Ocular's estimates — this pattern is extended to: remembering the last inspector/date pairing used when a manager dispatches a similar job from `SalesPipelineView.js`, and defaulting the GPS pin to the last confirmed site location when re-visiting a known site (matched by client/site address in `ClientDirectoryView`'s data).
- This requires one small, additive data change: storing a `lastConfirmedLocation` on the client/site record via `dataService.js`, read-only convenience data, not a new entity.

### 8.3 Explains itself (contextual help)
- Small inline help affordances next to technical fields most likely to be unfamiliar to a less-experienced field tech: enclosure type (NEMA 3R vs. main distribution branch), bus bar material, grounding type. Tapping shows a short plain-language explanation. Content-only addition; no new component beyond a reusable tooltip/popover pattern.

### 8.4 Surfaces what matters (prioritization)
- `DashboardView.js` and `AnalyticsDashboardView.js` currently show a flat KPI grid. Reorder so pending-QA count, rejected inspections awaiting resubmission, and low-stock catalog items lead the layout instead of sitting alongside routine totals.
- Queue views (`AssignedQueueView.js`, `QAReviewQueueView.js`, `PendingSiteVisitsView.js`) sort overdue and previously-rejected items to the top of the list instead of insertion/date order.

## 9. Non-goals

- No real authentication backend. The login screen mockup replaces the informal `ActiveProfilePicker.js` visually, but wiring real auth is a backend change outside this spec's scope (noted as a Phase 2 item in `permissions.js`'s own comments).
- No changes to Admin or Manager workspace layouts beyond the Phase 1 token/brand pass — deeper layout work there is a future spec if needed, once the Operations-workspace pattern is validated.
- No dark mode. Not requested; the single-theme approach matches how the rest of the app is already built.

## 10. Testing approach

No automated suite exists. Each phase is verified manually on a real tablet (or Chrome DevTools tablet emulation as a fallback) before moving to the next:
- Phase 1: visual check of header, sidebar, buttons, KPI tiles, calendar, notifications, one printed certificate.
- Phase 2: full Ocular and Installation form run-throughs, including back/forward navigation and an intentionally incomplete submission to confirm the validation gate fires.
- Phase 3: signature capture, photo capture, and GPS pin placement on an actual touchscreen.
- Phase 4: an intentionally incomplete submission (guardrails), a repeat-site dispatch (defaults), a tap on a help icon (contextual help), and a queue containing a mix of overdue/rejected/normal items (prioritization).

## 11. Open questions

- None blocking. Phase 1 is ready to implement pending sign-off on this spec.
