# EOMS Phase 1 — Branding & Glass Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's invented blue theme with the real EcoWorks brand palette (green/blue/amber derived from `mats/ecoworks-logo.png`), add the logo to the header, and apply a lightweight glass (frosted/blurred) treatment to navigation chrome only — with zero changes to business logic or the offline data layer.

**Architecture:** Pure presentation-layer change. `style.css` gains a token system (`--brand-*`, `--glass-*`) that replaces the old `--primary`/`--header-bg`/`--bg-color` variables; existing selectors are repointed to the new tokens. Five JS view files that currently hardcode the old blue outside the stylesheet are repointed to the same tokens (four via `var()`, since they render into the live DOM; one — `certificates.js` — hardcoded directly, since it opens a standalone print window that doesn't inherit the page's CSS).

**Tech Stack:** Vanilla JS + Vite, single global `style.css`, no build step changes, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-25-field-ux-enhancement-design.md` (Sections 4 and 5 specifically — this plan implements Phase 1 only)

## Global Constraints

- No new npm dependencies, no framework, no CSS preprocessor — plain CSS custom properties only.
- Glass (`backdrop-filter: blur`) applies ONLY to `#app-header` and `.sidebar`. Nothing else in this plan gets blur — cards, tables, inputs, buttons, KPI tiles all stay fully opaque.
- Color role split is strict: `--brand-green` is used ONLY for actions/active-state (buttons, active nav/tab). `--brand-blue` is used ONLY for identity/information (logo, KPI numbers, "today" highlight, unread-notification tint). Never swap the two.
- `--brand-amber` is declared in this plan but not wired into any component — it's reserved for a future status/warning pass.
- This project has **no git repository**. There are no commit steps in this plan — each task ends with a manual verification step instead. If you want git history for this work, initialize a repo before starting (`git init` + an initial commit of the current state), then commit after each task using the task's title as the message.
- No automated test suite exists in this project. "Testing" in every task below means: run `npm run dev`, open the printed URL in a browser, and visually confirm the described state. Do not add a test framework as part of this plan — that's out of scope per the spec's constraints.

---

### Task 1: Add brand & glass design tokens, update page background

**Files:**
- Modify: `style.css:1-22` (the `:root` block and the `body` rule)

**Interfaces:**
- Produces: CSS custom properties `--text-main`, `--border-color` (unchanged, kept), `--brand-green`, `--brand-green-dark`, `--brand-green-soft`, `--brand-blue`, `--brand-blue-soft`, `--brand-amber`, `--glass-bg`, `--glass-border`, `--glass-blur` — every later task in this plan consumes these exact names.
- Removes: `--primary`, `--bg-color`, `--header-bg` (confirmed unused anywhere outside `style.css` before this plan; Tasks 2-5 replace every usage).

- [ ] **Step 1: Replace the `:root` block**

Current (`style.css:1-7`):
```css
:root {
  --primary: #2563eb;
  --bg-color: #f3f4f6;
  --header-bg: #ffffff;
  --text-main: #1f2937;
  --border-color: #e5e7eb;
}
```

Replace with:
```css
:root {
  --text-main: #1f2937;
  --border-color: #e5e7eb;

  --brand-green: #4c8c2a;
  --brand-green-dark: #3f7422;
  --brand-green-soft: #e3efd6;
  --brand-blue: #1878b8;
  --brand-blue-soft: #dcecf7;
  --brand-amber: #f2ad3d;

  --glass-bg: rgba(255, 255, 255, 0.55);
  --glass-border: rgba(255, 255, 255, 0.7);
  --glass-blur: 16px;
}
```

- [ ] **Step 2: Update the `body` rule's background**

Current (`style.css:15-22`):
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  height: 100vh;
}
```

Replace the `background-color` line with a `background` shorthand carrying the gradient (a gradient is not valid for `background-color`):
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: linear-gradient(160deg, #eef6f0 0%, #e2f0ee 45%, #d8ecf3 100%);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  height: 100vh;
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`, open the app in a browser. Expected: the app still loads (nothing else references `--primary`/`--bg-color`/`--header-bg` yet, so this step alone will make the header and buttons render with browser-default fallback colors — that's expected and gets fixed in Tasks 2-4). Confirm the page background is now a soft green-to-blue wash instead of flat grey.

---

### Task 2: Apply glass chrome to the header and sidebar

**Files:**
- Modify: `style.css:24-33` (`#app-header`)
- Modify: `style.css:92-97` (`.sidebar`)

**Interfaces:**
- Consumes: `--glass-bg`, `--glass-border`, `--glass-blur` from Task 1.

- [ ] **Step 1: Update `#app-header`**

Current:
```css
#app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--header-bg);
  padding: 0 1rem;
  height: 60px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
```

Replace with:
```css
#app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  padding: 0 1rem;
  height: 60px;
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Update `.sidebar`**

Current:
```css
.sidebar {
  width: 250px;
  background: #ffffff;
  border-right: 1px solid var(--border-color);
  padding: 1rem 0;
}
```

Replace with:
```css
.sidebar {
  width: 250px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-right: 1px solid var(--glass-border);
  padding: 1rem 0;
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`, open the app, navigate to any workspace with a sidebar (e.g. `/admin`). Expected: the header and sidebar show a frosted, translucent look — the green-to-blue page background should be faintly visible/blurred through both. The sidebar's nav links and the header's content should still be fully legible (this is chrome, not content, so some translucency is correct and intended).

---

### Task 3: Re-point active and hover nav states to the green/blue split

**Files:**
- Modify: `style.css:64-72` (`.workspace-switcher a.active`, `.workspace-switcher a:hover:not(.active)`)
- Modify: `style.css:115-119` (`.sidebar-nav a.active`)
- Modify: `style.css:111-113` (`.sidebar-nav a:hover`)

**Interfaces:**
- Consumes: `--brand-green`, `--brand-green-soft`, `--brand-blue-soft` from Task 1.

- [ ] **Step 1: Update `.workspace-switcher a.active` and its hover sibling**

Current:
```css
.workspace-switcher a.active {
  background: #eff6ff;
  color: var(--primary);
}

.workspace-switcher a:hover:not(.active) {
  background: #f3f4f6;
  color: var(--text-main);
}
```

Replace with:
```css
.workspace-switcher a.active {
  background: var(--brand-green-soft);
  color: var(--brand-green);
}

.workspace-switcher a:hover:not(.active) {
  background: var(--brand-blue-soft);
  color: var(--text-main);
}
```

- [ ] **Step 2: Update `.sidebar-nav a:hover` and `.sidebar-nav a.active`**

Current:
```css
.sidebar-nav a:hover {
  background: #f9fafb;
}
```
```css
.sidebar-nav a.active {
  background: #eff6ff;
  color: var(--primary);
  border-left-color: var(--primary);
}
```

Replace with:
```css
.sidebar-nav a:hover {
  background: var(--brand-blue-soft);
}
```
```css
.sidebar-nav a.active {
  background: var(--brand-green-soft);
  color: var(--brand-green);
  border-left-color: var(--brand-green);
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. In the header's workspace switcher, confirm the active workspace link shows a green tint/text, and hovering an inactive link shows a light blue tint. In any sidebar, confirm the active page link is green (fill, text, and left border), and hovering an inactive link shows a light blue tint.

---

### Task 4: Re-point primary buttons to green

**Files:**
- Modify: `style.css:136-148` (`button`, `button:hover`)

**Interfaces:**
- Consumes: `--brand-green`, `--brand-green-dark` from Task 1.

- [ ] **Step 1: Update the button rules**

Current:
```css
button {
  cursor: pointer;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  background: var(--primary);
  color: white;
  font-weight: 500;
}

button:hover {
  background: #1d4ed8;
}
```

Replace with:
```css
button {
  cursor: pointer;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  background: var(--brand-green);
  color: white;
  font-weight: 500;
}

button:hover {
  background: var(--brand-green-dark);
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Open any view with a button (e.g. Admin → User Management → any "Add"/"Save" button). Expected: buttons are green, and darken slightly on hover. Confirm no button anywhere in the app is still blue (a leftover blue button would mean some view sets its own inline `background` instead of relying on this rule — note it, but do not fix it in this plan; it's out of scope for Phase 1's file list).

---

### Task 5: Add the EcoWorks logo to the header

**Files:**
- Modify: `index.html:16-19` (the `.logo` div)
- Modify: `style.css:45-49` (`.logo` rule; add a new `.logo-mark` rule)
- Verify exists: `public/ecoworks-logo.png` (already copied from `mats/ecoworks-logo.png` earlier in this session)

**Interfaces:**
- Consumes: `--brand-blue` from Task 1.

- [ ] **Step 1: Confirm the logo asset is in place**

Run: check that `public/ecoworks-logo.png` exists (it was copied there earlier in this project's session). If it's missing, copy it: the source is `mats/ecoworks-logo.png` in the project root.

- [ ] **Step 2: Update the header markup**

Current (`index.html`):
```html
  <header id="app-header">
    <div class="header-left">
      <div class="logo">EOMS</div>
    </div>
```

Replace with:
```html
  <header id="app-header">
    <div class="header-left">
      <div class="logo"><img src="/ecoworks-logo.png" alt="EcoWorks" class="logo-mark">EOMS</div>
    </div>
```

- [ ] **Step 3: Update the `.logo` CSS rule and add `.logo-mark`**

Current:
```css
.logo {
  font-weight: bold;
  font-size: 1.25rem;
  color: var(--primary);
}
```

Replace with:
```css
.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: bold;
  font-size: 1.25rem;
  color: var(--brand-blue);
}

.logo-mark {
  height: 28px;
  width: 28px;
  object-fit: contain;
}
```

- [ ] **Step 4: Verify**

Run `npm run dev`, open the app. Expected: the EcoWorks logo mark appears to the left of the "EOMS" wordmark in the header, vertically centered, and the "EOMS" text is now blue instead of the old blue-2563eb (visually similar shade but now token-driven).

---

### Task 6: Re-point the Admin dashboard's blue KPI tile

**Files:**
- Modify: `js/workspaces/admin/DashboardView.js:28-31`

**Interfaces:**
- Consumes: `--brand-blue`, `--brand-blue-soft` from Task 1.
- Note: only the "Total Inspections" tile changes. The pending/installations/tickets tiles use amber/green/red for semantic status and are unrelated to this rebrand — do not touch them.

- [ ] **Step 1: Update the tile's inline styles**

Current (`js/workspaces/admin/DashboardView.js:28-31`):
```js
                <div style="background:#eff6ff; padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                    <h3 style="font-size: 2rem; margin: 0; color: #1e3a8a;">${metrics.totalInspections}</h3>
                    <p style="margin: 0.5rem 0 0; color: #3b82f6;">Total Inspections</p>
                </div>
```

Replace with:
```js
                <div style="background:var(--brand-blue-soft); padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                    <h3 style="font-size: 2rem; margin: 0; color: var(--brand-blue);">${metrics.totalInspections}</h3>
                    <p style="margin: 0.5rem 0 0; color: var(--brand-blue);">Total Inspections</p>
                </div>
```

- [ ] **Step 2: Verify**

Run `npm run dev`, sign in as the admin profile, open the Admin dashboard. Expected: the "Total Inspections" tile shows the light-blue-soft background and brand-blue text; the other three tiles (Pending Approval, Installations, Open Tickets) are visually unchanged.

---

### Task 7: Re-point the Analytics dashboard's blue KPI tile

**Files:**
- Modify: `js/workspaces/manager/AnalyticsDashboardView.js:60-63`

**Interfaces:**
- Consumes: `--brand-blue`, `--brand-blue-soft` from Task 1.
- Note: only the "Total Sales Leads" tile changes. "Completed Installations" (green) and "Quote Win Rate" (purple) are semantic status colors, unrelated to this rebrand — do not touch them. The Chart.js doughnut/bar series colors (lines ~103 and ~120) are categorical chart colors, not the brand-blue identity color — also out of scope for this plan.

- [ ] **Step 1: Update the tile's inline styles**

Current (`js/workspaces/manager/AnalyticsDashboardView.js:60-63`):
```js
                    <div style="background: #eff6ff; padding: 1.5rem; border-radius: 8px; border: 1px solid #bfdbfe; text-align: center;">
                        <h3 style="margin: 0; color: #1e3a8a; font-size: 1rem;">Total Sales Leads</h3>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #2563eb; margin-top: 0.5rem;">${totalLeads}</div>
                    </div>
```

Replace with:
```js
                    <div style="background: var(--brand-blue-soft); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(24,120,184,0.35); text-align: center;">
                        <h3 style="margin: 0; color: var(--brand-blue); font-size: 1rem;">Total Sales Leads</h3>
                        <div style="font-size: 2.5rem; font-weight: bold; color: var(--brand-blue); margin-top: 0.5rem;">${totalLeads}</div>
                    </div>
```

- [ ] **Step 2: Verify**

Run `npm run dev`, sign in as a manager profile, open the Analytics dashboard. Expected: the "Total Sales Leads" tile shows the brand-blue-soft background with a matching border and brand-blue text; "Completed Installations" and "Quote Win Rate" tiles, and both charts below, are visually unchanged.

---

### Task 8: Re-point the notification center's unread highlight

**Files:**
- Modify: `js/components/NotificationCenter.js:32`

**Interfaces:**
- Consumes: `--brand-blue-soft` from Task 1.

- [ ] **Step 1: Update the unread-notification background**

Current (`js/components/NotificationCenter.js:32`):
```js
                        <li data-id="${n.id}" class="notif-item" style="padding: 1rem; border-bottom: 1px solid #eee; cursor: pointer; background: ${n.isRead ? 'white' : '#eff6ff'};">
```

Replace with:
```js
                        <li data-id="${n.id}" class="notif-item" style="padding: 1rem; border-bottom: 1px solid #eee; cursor: pointer; background: ${n.isRead ? 'white' : 'var(--brand-blue-soft)'};">
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Trigger at least one unread notification (e.g. submit an Ocular inspection as a field-crew profile, then switch to a manager profile) and open the notification bell dropdown. Expected: unread notifications show a light blue background; read ones show white.

---

### Task 9: Re-point the calendar's "today" highlight

**Files:**
- Modify: `js/workspaces/manager/CalendarView.js:88` and `js/workspaces/manager/CalendarView.js:92`

**Interfaces:**
- Consumes: `--brand-blue`, `--brand-blue-soft` from Task 1.
- Note: the ocular/install event chips a few lines below (`#dbeafe`/`#3b82f6`/`#1e3a8a` for ocular events, green shades for install events) are a categorical event-type color code, not the brand-blue identity color — out of scope for this plan.

- [ ] **Step 1: Update the "today" cell background**

Current (`js/workspaces/manager/CalendarView.js:88`):
```js
            const bg = isToday ? '#eff6ff' : 'white';
```

Replace with:
```js
            const bg = isToday ? 'var(--brand-blue-soft)' : 'white';
```

- [ ] **Step 2: Update the "today" date-number color**

Current (`js/workspaces/manager/CalendarView.js:92`):
```js
                    <div style="text-align: right; font-size: 0.9rem; font-weight: ${isToday ? 'bold' : 'normal'}; color: ${isToday ? '#2563eb' : '#64748b'}; margin-bottom: 0.5rem;">${day}</div>
```

Replace with:
```js
                    <div style="text-align: right; font-size: 0.9rem; font-weight: ${isToday ? 'bold' : 'normal'}; color: ${isToday ? 'var(--brand-blue)' : '#64748b'}; margin-bottom: 0.5rem;">${day}</div>
```

- [ ] **Step 3: Verify**

Run `npm run dev`, sign in as a manager, open the Dispatch Calendar. Expected: today's cell has a light blue background and a bold blue date number; other days are unchanged; ocular (blue-ish) and install (green-ish) event chips within cells are visually unchanged.

---

### Task 10: Re-point the certificate print header color

**Files:**
- Modify: `js/shared/certificates.js:11`
- Modify: `js/shared/certificates.js:35`

**Interfaces:**
- Produces: no CSS variable usage here — this is a standalone `window.open` document that does not inherit the main page's `style.css`, so the brand-blue value is hardcoded directly instead of referencing a token.

- [ ] **Step 1: Update `printOcularCertificate`'s heading color**

Current (`js/shared/certificates.js:11`):
```js
                h1 { color: #2563eb; }
```

Replace with:
```js
                h1 { color: #1878b8; }
```

- [ ] **Step 2: Update `printInstallationRegister`'s heading color**

Current (`js/shared/certificates.js:35`):
```js
                h1 { color: #2563eb; }
```

Replace with:
```js
                h1 { color: #1878b8; }
```

- [ ] **Step 3: Verify**

Run `npm run dev`. From the Admin or Manager Client Directory, print an ocular certificate, and separately print an installation register from the Installations Register view. Expected: both printed documents show the "Ocular Inspection Certificate" / "Installation Register" heading in the new brand blue (`#1878b8`) instead of the old `#2563eb`.

---

### Task 11: Full manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the app**

Run `npm run dev` and open the printed local URL in a browser.

- [ ] **Step 2: Walk the Phase 1 checklist from the spec**

Confirm each of the following (per `docs/superpowers/specs/2026-09-25-field-ux-enhancement-design.md`, Section 10):
- Header: EcoWorks logo visible, glass/frosted background, blue "EOMS" wordmark.
- Sidebar (any workspace): glass/frosted background, active link green with green left border, hover shows light blue.
- A primary button anywhere in the app: green fill, darker green on hover.
- Admin dashboard KPI tiles: "Total Inspections" tile is blue-toned; others unchanged.
- Analytics dashboard KPI tiles: "Total Sales Leads" tile is blue-toned; others and both charts unchanged.
- Notification dropdown: unread items have a light blue background.
- Dispatch calendar: today's cell has a light blue background and bold blue date number.
- A printed ocular certificate and a printed installation register: heading is the new brand blue.

- [ ] **Step 3: Note any leftover blue**

If you spot any element still showing the old `#2563eb`/`#eff6ff` blue that isn't one of the "out of scope" elements called out in Tasks 6, 7, and 9 (semantic status tiles, chart series colors, calendar event-type chips), note it — it means a file outside this plan's scope also hardcodes the old blue and should be scoped into a follow-up, not silently patched here.

- [ ] **Step 4: Report completion**

Phase 1 is complete when every item in Step 2 checks out and no unexpected leftover blue was found in Step 3.
