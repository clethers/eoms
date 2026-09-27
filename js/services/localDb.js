// Data layer bridge: same exported API as the old IndexedDB version, but
// every call goes to Supabase (online-only, no local cache/fallback).
// Schema: supabase/bridge.sql. Each collection is a table whose `data` jsonb
// column holds the full record, plus a few "promoted" columns for filtering.
import { supabase } from './supabaseClient.js';

export const COLLECTIONS = {
  PROFILES: 'profiles',
  OCULAR_INSPECTIONS: 'ocularInspections',
  INSTALLATION_RECORDS: 'installationRecords',
  MASTER_DATA_CATALOG: 'masterDataCatalog',
  PHOTO_ATTACHMENTS: 'photoAttachments',
  AUDIT_LOGS: 'auditLogs',
  SUPPORT_TICKETS: 'supportTickets',
  SALES_LEADS: 'salesLeads',
  NOTIFICATIONS: 'notifications'
};

// EventTarget to emit change events
export const dbEvents = new EventTarget();

const PAGE_SIZE = 1000;

// Column types for promoted columns
const BIGINT = 'bigint';
const TEXT = 'text';
const BOOL = 'bool';
const TS = 'timestamp';
const UUID = 'uuid';

// collection -> { table, key (primary key column), recordKey (field on record), columns: { camelField: [column, type] } }
const SCHEMA = {
  [COLLECTIONS.PROFILES]: {
    table: 'profiles', key: 'id', recordKey: 'id',
    columns: {
      authUserId: ['auth_user_id', UUID],
      email: ['email', TEXT],
      fullName: ['full_name', TEXT],
      role: ['role', TEXT],
      status: ['status', TEXT]
    }
  },
  [COLLECTIONS.OCULAR_INSPECTIONS]: {
    table: 'ocular_inspections', key: 'id', recordKey: 'id',
    columns: {
      rnNo: ['rn_no', TEXT],
      status: ['status', TEXT],
      assignedTeam: ['assigned_team', BIGINT],
      createdBy: ['created_by', BIGINT],
      deletedAt: ['deleted_at', TS]
    }
  },
  [COLLECTIONS.INSTALLATION_RECORDS]: {
    table: 'installation_records', key: 'id', recordKey: 'id',
    columns: {
      ocularId: ['ocular_id', BIGINT],
      status: ['status', TEXT],
      assignedTeam: ['assigned_team', BIGINT],
      installationNo: ['installation_no', TEXT],
      deletedAt: ['deleted_at', TS]
    }
  },
  [COLLECTIONS.MASTER_DATA_CATALOG]: {
    table: 'master_data_catalog', key: 'item_key', recordKey: 'itemKey',
    columns: {
      category: ['category', TEXT]
    }
  },
  [COLLECTIONS.PHOTO_ATTACHMENTS]: {
    table: 'photo_attachments', key: 'id', recordKey: 'id',
    columns: {}
  },
  [COLLECTIONS.AUDIT_LOGS]: {
    table: 'audit_logs', key: 'id', recordKey: 'id',
    columns: {
      category: ['category', TEXT],
      severity: ['severity', TEXT],
      actorId: ['actor_id', BIGINT]
    }
  },
  [COLLECTIONS.SUPPORT_TICKETS]: {
    table: 'support_tickets', key: 'id', recordKey: 'id',
    columns: {
      status: ['status', TEXT],
      createdBy: ['created_by', BIGINT]
    }
  },
  [COLLECTIONS.SALES_LEADS]: {
    table: 'sales_leads', key: 'id', recordKey: 'id',
    columns: {
      stage: ['stage', TEXT],
      legacyRowId: ['legacy_row_id', TEXT],
      ocularId: ['ocular_id', BIGINT],
      deletedAt: ['deleted_at', TS]
    }
  },
  [COLLECTIONS.NOTIFICATIONS]: {
    table: 'notifications', key: 'id', recordKey: 'id',
    columns: {
      userId: ['user_id', BIGINT],
      isRead: ['is_read', BOOL]
    }
  }
};

// Friendly messages for unique constraints (Postgres default constraint names)
const UNIQUE_MESSAGES = {
  ocular_inspections_rn_no_key: 'RN number already exists',
  profiles_email_key: 'A profile with this email already exists',
  profiles_auth_user_id_key: 'This login is already linked to another profile',
  sales_leads_legacy_row_id_key: 'A sales lead with this legacy row ID already exists',
  sales_leads_ocular_id_key: 'A sales lead is already linked to this ocular inspection',
  master_data_catalog_pkey: 'A catalog item with this key already exists'
};

function schemaFor(collection) {
  const s = SCHEMA[collection];
  if (!s) throw new Error(`Unknown collection: ${collection}`);
  return s;
}

function toError(error, collection, action) {
  const raw = error?.message || String(error);
  let msg;
  if (error?.code === '23505') {
    const hit = Object.keys(UNIQUE_MESSAGES).find(k => raw.includes(k));
    msg = hit ? UNIQUE_MESSAGES[hit] : `Duplicate value: ${error.details || raw}`;
  } else if (error?.code === '42501' || /row-level security/i.test(raw)) {
    msg = `Permission denied (${action} ${collection}). Are you signed in with the right role?`;
  } else if (error?.code === '23514') {
    msg = `Invalid value rejected by the database: ${raw}`;
  } else if (/Failed to fetch|NetworkError|network/i.test(raw)) {
    msg = 'Cannot reach the server. Check your internet connection and try again.';
  } else {
    msg = `Database error (${action} ${collection}): ${raw}`;
  }
  const err = new Error(msg);
  err.cause = error;
  err.code = error?.code;
  return err;
}

function coerce(value, type) {
  if (value === undefined || value === null || value === '') return null;
  switch (type) {
    case BIGINT: {
      const n = typeof value === 'number' ? value : Number(String(value).trim());
      return Number.isFinite(n) && Number.isInteger(n) ? n : null;
    }
    case BOOL:
      if (typeof value === 'string') return value === 'true' || value === '1';
      return Boolean(value);
    case TEXT:
      return String(value);
    default:
      return value;
  }
}

function fromRow(collection, row) {
  if (!row) return undefined;
  const s = schemaFor(collection);
  const record = { ...(row.data || {}) };
  if (s.key === 'id') {
    record.id = row.id;
  } else {
    record[s.recordKey] = row[s.key];
  }
  record.createdAt = row.created_at ?? record.createdAt;
  record.updatedAt = row.updated_at ?? record.updatedAt;
  if (collection === COLLECTIONS.PROFILES) {
    if (row.email != null) record.email = row.email;
    if (row.full_name != null) record.fullName = row.full_name;
    if (row.role != null) record.role = row.role;
    if (row.status != null) record.status = row.status;
    record.authUserId = row.auth_user_id ?? null;
  }
  return record;
}

function toRow(collection, record) {
  const s = schemaFor(collection);
  const { id, ...rest } = record;
  const data = s.key === 'id' ? rest : { ...record };
  // authUserId lives only in its column; don't duplicate it inside data.
  if (collection === COLLECTIONS.PROFILES) delete data.authUserId;
  const row = { data };
  for (const [field, [column, type]] of Object.entries(s.columns)) {
    // Never clear the login link just because the caller's record lacks it.
    if (column === 'auth_user_id' && record[field] === undefined) continue;
    row[column] = coerce(record[field], type);
  }
  if (collection === COLLECTIONS.PROFILES && !row.status) row.status = 'ACTIVE';
  if (collection === COLLECTIONS.NOTIFICATIONS && row.is_read === null) row.is_read = false;
  return row;
}

function coerceKey(collection, key) {
  const s = schemaFor(collection);
  if (s.key === 'id') {
    const n = coerce(key, BIGINT);
    return n;
  }
  return key == null ? null : String(key);
}

function resolveIndexColumn(collection, indexName) {
  const s = schemaFor(collection);
  if (indexName === 'id' || indexName === s.recordKey) return [s.key, s.key === 'id' ? BIGINT : TEXT];
  const col = s.columns[indexName];
  if (!col) {
    throw new Error(`No index "${indexName}" on ${collection}. Add it as a promoted column in localDb.js + bridge.sql.`);
  }
  return col;
}

async function fetchAllRows(query, collection, orderCol) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query()
      .order(orderCol, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw toError(error, collection, 'read');
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export function initDB() {
  // Nothing to open: Supabase is accessed per call. Kept for main.js compatibility.
  return Promise.resolve();
}

export async function get(collection, id) {
  const s = schemaFor(collection);
  const key = coerceKey(collection, id);
  if (key === null) return undefined;
  const { data, error } = await supabase.from(s.table).select('*').eq(s.key, key).maybeSingle();
  if (error) throw toError(error, collection, 'read');
  return data ? fromRow(collection, data) : undefined;
}

export async function getAll(collection, filterFn = null) {
  const s = schemaFor(collection);
  const rows = await fetchAllRows(() => supabase.from(s.table).select('*'), collection, s.key);
  const all = rows.map(r => fromRow(collection, r));
  return filterFn ? all.filter(filterFn) : all;
}

// Support getting by index
export async function getAllByIndex(collection, indexName, key) {
  const s = schemaFor(collection);
  if (key === undefined) return getAll(collection);
  const [column, type] = resolveIndexColumn(collection, indexName);
  const value = coerce(key, type);
  const rows = await fetchAllRows(
    () => {
      const q = supabase.from(s.table).select('*');
      return value === null ? q.is(column, null) : q.eq(column, value);
    },
    collection,
    s.key
  );
  return rows.map(r => fromRow(collection, r));
}

export async function getByIndex(collection, indexName, key) {
  const s = schemaFor(collection);
  const [column, type] = resolveIndexColumn(collection, indexName);
  const value = coerce(key, type);
  if (value === null) return undefined;
  const { data, error } = await supabase
    .from(s.table)
    .select('*')
    .eq(column, value)
    .order(s.key, { ascending: true })
    .limit(1);
  if (error) throw toError(error, collection, 'read');
  return data && data.length ? fromRow(collection, data[0]) : undefined;
}

export async function put(collection, record) {
  const s = schemaFor(collection);
  const now = new Date().toISOString();

  if (!record.createdAt) {
    record.createdAt = now;
  }
  record.updatedAt = now;

  const row = toRow(collection, record);
  let saved;

  if (s.key === 'id') {
    const id = coerceKey(collection, record.id);
    if (id !== null) {
      const { data, error } = await supabase.from(s.table).update(row).eq('id', id).select();
      if (error) throw toError(error, collection, 'update');
      if (!data || data.length === 0) {
        throw new Error(`Could not save ${collection} #${id}: record not found or you do not have permission to change it.`);
      }
      saved = data[0];
    } else {
      row.created_at = record.createdAt;
      const { data, error } = await supabase.from(s.table).insert(row).select().single();
      if (error) throw toError(error, collection, 'insert');
      saved = data;
    }
    record.id = saved.id;
  } else {
    const key = coerceKey(collection, record[s.recordKey]);
    if (!key) throw new Error(`Cannot save ${collection}: missing ${s.recordKey}.`);
    row[s.key] = key;
    const { data, error } = await supabase.from(s.table).upsert(row, { onConflict: s.key }).select().single();
    if (error) throw toError(error, collection, 'save');
    saved = data;
  }

  record.createdAt = saved.created_at ?? record.createdAt;
  record.updatedAt = saved.updated_at ?? record.updatedAt;

  // Dispatch event for reactive updates
  dbEvents.dispatchEvent(new CustomEvent('change', {
    detail: { collection, action: 'put', record }
  }));

  return record;
}

export async function remove(collection, id) {
  const s = schemaFor(collection);
  const key = coerceKey(collection, id);
  if (key === null) return;
  const { data, error } = await supabase.from(s.table).delete().eq(s.key, key).select(s.key);
  if (error) throw toError(error, collection, 'delete');
  if (data && data.length) {
    dbEvents.dispatchEvent(new CustomEvent('change', {
      detail: { collection, action: 'remove', id }
    }));
  }
}
