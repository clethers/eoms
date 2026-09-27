# Supabase Integration — Design

**Date:** 2026-09-27
**Status:** Draft for review
**Scope of this spec:** Phase A (data layer + schema). Phases B and C are outlined for context and get their own specs.

## 1. Background

EOMS stores all data in each browser's own IndexedDB (`js/services/localDb.js`). There is no shared backend and no authentication (`ActiveProfilePicker.js` is a dropdown). Records are free-form objects: photos and signatures are embedded as base64, ~30 material quantities are flat fields, lead stage timestamps are dynamic keys (`stageXAt`), and several views bypass the service layer and import `localDb` directly. Status strings are inconsistent across files.

The goal is to move to Supabase (Postgres + Auth + Storage + Realtime), production-ready, with every piece of data read from and written to its own table. There is no real data to migrate; production starts clean.

## 2. Governing rule: online always wins

When a connection exists, every read and write goes to Supabase directly and errors surface immediately. Offline mechanisms act only when a network call fails, and never intercept, delay, cache, or override online traffic.

One module (`js/data/gateway.js`) is the only place that decides where data goes, in a fixed order:

- **Reads:** 1) Supabase. 2) Local copy — only on network failure; UI marks it "offline – showing last saved data".
- **Writes:** 1) Supabase. 2) Local queue — only on network failure; record marked "pending sync". 3) Replay when back online; server wins on conflict.
- A real server error (permission denied, constraint violation) is **not** a network failure. It is shown to the user and never falls through to local.

No view, form, or component chooses a data source.

## 3. Phases

| Phase | Delivers | Users notice? |
|---|---|---|
| **A — Data layer + schema** (this spec) | `js/data/` layer, all views routed through it, UUIDs, canonical statuses, normalized local stores, SQL migrations (tables, RLS, functions, storage bucket), seed, env config, tests | No (except status fixes, §6) |
| B — Connect + auth | Supabase adapter, login screen, route guards, Engineering workspace, Storage uploads, Realtime, catalog↔material mapping UI | Yes |
| C — Offline fallback | Service worker (static assets only), write queue, "pending sync" UI, bundle Leaflet/Chart.js locally | Yes |

## 4. Data layer architecture (`js/data/`)

```
js/data/
  gateway.js            only decision point; Phase A: delegates to IndexedDB adapter
  adapters/indexedDb.js query-shaped: select(table, {filters, order, limit}), insert, update, remove
  adapters/supabase.js  Phase B (same interface)
  repos/                one per table (see §5): profiles, leads, leadStageHistory, inspections,
                        installations, materialLineItems, materialCodes, attachments, catalog,
                        tickets, notifications, auditLogs
  commands.js           multi-step workflows (see §4.2)
  events.js             change subscriptions: local EventTarget now, Realtime in Phase B
  mappers.js            camelCase (JS) <-> snake_case (DB)
```

### 4.1 Rules

- Views, components, and `js/shared/` import only `repos/*`, `commands.js`, and `events.js`. Nothing outside `js/data/` imports an adapter or `gateway.js`. A test enforces this.
- `js/services/localDb.js`, `dataService.js`, `userService.js`, `masterDataService.js`, `auditLogService.js`, and `js/shared/formStorage.js` are removed once their callers are migrated. `permissions.js` stays (Phase B wires it).
- Filtering, sorting, and limits are expressed as query options, never as a JS callback over a whole table.
- IDs are `crypto.randomUUID()`, generated on the device. Postgres columns also default to `gen_random_uuid()`.
- The artificial 400 ms latency in `localDb.js` is removed.
- The IndexedDB database is renamed (`eoms_local`) so devices start clean; no migration from `oims_db`.
- Demo seeding moves out of the adapter into a dev-only seed (`js/data/devSeed.js`, run only when `import.meta.env.DEV`) and `supabase/seed.sql`.

### 4.2 Commands

Every workflow that writes more than one record, or has side effects, is a command. Views call commands, not raw inserts. In Phase A each command runs in JS against IndexedDB. In Phase B each becomes one Postgres function called via RPC, so it runs in a single transaction.

| Command | Writes |
|---|---|
| `createLead` | lead (`INITIAL_CONTACT`), stage history |
| `moveLeadStage` | lead stage, stage history, audit log |
| `dispatchOcular` | inspection (`ASSIGNED_PENDING_INSPECTION`, `assigned_to`), lead → `SITE_VISIT_SCHEDULED`, history, notification to assignee |
| `saveInspectionDraft` | inspection (`DRAFT`, keeps `assigned_to`), line items, attachments |
| `submitInspection` | inspection → `PENDING_QA`, line items, attachments, notification to Customer Care + Admin |
| `reviewInspection(approve/reject)` | inspection → `APPROVED`/`REJECTED`; on approve lead → `SITE_VISIT_COMPLETED` + history; notification to assignee; audit log |
| `dispatchInstallation` | installation (`ASSIGNED_PENDING_INSTALLATION`), lead → `INSTALLATION_SCHEDULED`, history, notification. Allowed only when the inspection is `APPROVED` |
| `saveInstallationDraft` | installation (`DRAFT`), line items, attachments |
| `commissionInstallation` | installation → `COMMISSIONED`, line items, attachments, stock deduction via `material_codes.catalog_item_key`, lead → `INSTALLATION_COMPLETE` + history, notification to Customer Care + Admin |
| `createTicket` / `resolveTicket` | ticket, notification to Customer Care + Admin / resolver fields |
| `archive*` | sets `deleted_at` |

Side effects (notifications, audit logs, stage history, stock) live only in commands, never in views.

**Notification recipients:** every notification sent to an Operations user (ocular/installation dispatched, inspection approved/rejected) is also sent to every active Engineering user. Notifications to "Customer Care + Admin" go to all active users with those roles.

## 5. Schema

Migrations live in `supabase/migrations/NNNN_name.sql`, applied in order through the Supabase dashboard SQL Editor (no Docker/CLI assumed). All tables: `id uuid primary key default gen_random_uuid()` (except the catalog), `created_at`/`updated_at timestamptz` with an `updated_at` trigger. JS uses camelCase; the DB uses snake_case.

### 5.1 Tables

**`profiles`** — `id` (= `auth.users.id` in Phase B), `email` unique, `full_name`, `role` (enum `app_role`), `department`, `status` (`ACTIVE`/`SUSPENDED`).

**`sales_leads`** — `legacy_row_id` unique nullable, `name`, `email`, `phone`, `contact_info`, `installation_address`, `building_type`, `mode_of_communication`, `remarks`, `stage` (enum `lead_stage`), `ocular_id` → inspections, `installation_id` → installations, `created_by` → profiles, `deleted_at`.

**`lead_stage_history`** — `lead_id` → leads, `from_stage`, `to_stage`, `changed_by` → profiles, `changed_at`. Replaces `stageXAt` fields.

**`ocular_inspections`** — `rn_no` unique, `lead_id` → leads, `status` (enum `inspection_status`), `assigned_to` → profiles, `created_by` → profiles, `scheduled_date date`, `client_name`, `contact_no`, `location_address`, `gps_lat`/`gps_lng numeric`, `scope_of_works`, and the remaining non-material form fields as typed columns (`type_of_residency`, `work_new_installation`, `work_retrofitting`, `voltage_system`, `voltage_specify`, `main_breaker`, `spare_breaker`, `no_of_branches`, `space_provision`, `breaker_brand_type`, `breaker_design`, `breaker_mounting`, `breaker_pole`, `charger_location`, `estimate_distance`, `grounding_system`, `grounding_rod_location`, `inspected_by_name`, `witnessed_by_name`), `review_notes`, `reviewed_by` → profiles, `reviewed_at`, `deleted_at`. Column types follow the input: checkbox → boolean, number → numeric, otherwise text. The implementation plan lists every column.

**`installation_records`** — `installation_no` unique, `ocular_id` → inspections, `lead_id` → leads, `status` (enum `installation_status`), `assigned_to`, `scheduled_date`, `client_name`, `scope_of_works`, `installer_name`, `client_rep_name`, `commissioning_data jsonb`, `commissioned_at`, `deleted_at`.

**`material_codes`** — `code` primary key (e.g. `conduit_pvc`), `label`, `unit`, `sort_order`, `catalog_item_key` → catalog nullable. Seeded with the ~30 material fields on the ocular/installation forms. The Engineering role maps codes to catalog items (UI in Phase B).

**`material_line_items`** — `inspection_id` or `installation_id` (check: exactly one set), `material_code` → material_codes, `quantity numeric ≥ 0`, `other_description` (for "others" rows). Unique per (parent, code).

**`attachments`** — `inspection_id` or `installation_id` (exactly one), `kind` (`PHOTO`, `SIG_INSPECTOR`, `SIG_WITNESS`, `SIG_INSTALLER`, `SIG_CLIENT_REP`), `slot` (named photo slot on the ocular form, nullable), `storage_path`, `mime_type`, `tags`, `created_by`. Phase A stores the image as a Blob in IndexedDB keyed by `storage_path`; Phase B uploads to Storage.

**`master_data_catalog`** — `item_key text` primary key, `category`, `item_name`, `details jsonb`, `current_stock integer ≥ 0`, `unit_price numeric ≥ 0`. Production starts empty; entered by Engineering.

**`support_tickets`** — `subject`, `description`, `priority`, `status` (`OPEN`/`RESOLVED`), `client_name`, `inspection_id` nullable, `created_by`, `resolved_by`, `resolved_at`.

**`notifications`** — `user_id` → profiles (indexed), `message`, `link`, `is_read` (default false).

**`audit_logs`** — `actor_id`, `actor_email`, `actor_role`, `category`, `event_type`, `severity`, `resource_type`, `resource_id`, `description`, `changes_delta jsonb`. Insert-only.

Indexes on every foreign key, on `status`/`stage`, and on `assigned_to`.

### 5.2 Storage

Private bucket `field-attachments`, path `{inspections|installations}/{parent_id}/{attachment_id}.{ext}`. Read via signed URLs. Storage policies mirror the parent record's RLS.

### 5.3 Database functions (Phase A writes them; Phase B calls them)

One `security definer` function per command in §4.2 (`dispatch_ocular`, `submit_inspection`, `review_inspection`, `dispatch_installation`, `commission_installation`, `create_ticket`, `resolve_ticket`, `move_lead_stage`, `create_lead`). Each checks the caller's role, validates the status transition, and performs all writes in one transaction. Helper `current_app_role()` reads the caller's role from `profiles`.

## 6. Canonical statuses

The database rejects values outside these lists. Phase A updates all code to use exactly these values; this also fixes the mismatches found in the pre-launch audit (`COMPLETED`, `PENDING_APPROVAL`, `INSTALL_SCHEDULED`, `READY_FOR_INSTALLATION`).

**`inspection_status`:** `DRAFT`, `ASSIGNED_PENDING_INSPECTION`, `PENDING_QA`, `REJECTED`, `APPROVED`.
Transitions: dispatch → `ASSIGNED_PENDING_INSPECTION`; save → `DRAFT`; submit → `PENDING_QA`; review → `APPROVED` | `REJECTED`; resubmit `REJECTED` → `PENDING_QA`. Installation dispatch requires `APPROVED`.

**`installation_status`:** `ASSIGNED_PENDING_INSTALLATION`, `DRAFT`, `COMMISSIONED`.

**`lead_stage`:** `INITIAL_CONTACT`, `SITE_VISIT_SCHEDULED`, `SITE_VISIT_COMPLETED`, `QUOTE_SENT`, `QUOTE_ACCEPTED`, `INSTALLATION_SCHEDULED`, `INSTALLATION_COMPLETE`, `JOB_CHECKOUT_COMPLETE`, `CANCELED`.
Automatic moves: created → `INITIAL_CONTACT`; ocular dispatched → `SITE_VISIT_SCHEDULED`; inspection **approved** → `SITE_VISIT_COMPLETED`; installation dispatched → `INSTALLATION_SCHEDULED`; commissioned → `INSTALLATION_COMPLETE`. Quote stages, checkout, and cancel are manual. Every change writes `lead_stage_history`.

**Ticket status:** `OPEN`, `RESOLVED`. **Profile status:** `ACTIVE`, `SUSPENDED` (suspended users cannot sign in, Phase B).

## 7. Roles and access (RLS)

Enum `app_role`: `admin` (Admin/Owner), `customer_care_manager` (Customer Care), `lead_engineer` (Engineering), `field_inspector` (Operations). UI shows the friendly names.

| | Admin | Customer Care | Engineering | Operations |
|---|---|---|---|---|
| Catalog, material code mapping | edit | view | **edit** | view |
| Leads, stage history | all | edit | — | — |
| Dispatch ocular / installation | yes | yes | — | — |
| Inspections, installations, line items, attachments | all | all | view all | own (`assigned_to` or `created_by` = me) |
| QA approve / reject | yes | yes | — | — |
| Support tickets | all | view + resolve | view | create + view own |
| Notifications | own | own | own | own |
| Profiles | edit | view | view | view |
| Audit logs | view | — | — | — |

Writes to multi-step workflows go through the §5.3 functions; direct table writes are allowed only where the matrix says "edit" for single-record changes (catalog, lead info, profiles).

**Engineering workspace (Phase B):** reuses existing screens — Product Catalog (edit, landing page), Pending Inspections, Pending Installations, Calendar, Support Tickets (all read-only). Reused screens get a read-only mode that hides action buttons; RLS is the real enforcement.

## 8. Configuration

- `.env` (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. `.env.example` committed.
- The `service_role` key and database password are never placed in the app or the repo.
- Two Supabase projects recommended: **dev** (seeded, for testing) and **live** (clean).
- `supabase/seed.sql` (dev only): demo profiles, generated catalog, material codes. `material_codes` rows are also in a migration, since they are needed in production.

## 9. Testing

- Add Vitest + `fake-indexeddb`.
- Unit tests: each repo (CRUD + query options), each command (all writes + side effects + rejected transitions), mappers, gateway order (Phase A: single adapter; the ordering tests arrive with Phase B/C adapters).
- Boundary test: no file outside `js/data/` imports `adapters/` or `gateway.js`.
- SQL: `supabase/tests/verify.sql` — a script run in the dev project's SQL Editor that asserts tables, constraints, RLS enabled on every table, and status transitions via the functions, raising an error on failure.
- `npm run build` passes; manual smoke test of the full workflow in one browser.

## 10. Out of scope for Phase A

- Connecting to Supabase, login, route guards, Engineering workspace UI, Storage uploads, Realtime (Phase B).
- Service worker, offline queue, local bundling of Leaflet/Chart.js (Phase C).
- Other pre-launch audit findings not fixed by §6 (inspector queue filtering, duplicate RN error message, notification bell first render, SPA deep-link fallback). Tracked separately for the user's spot check.
- Persisting generated quotes/BOMs.
