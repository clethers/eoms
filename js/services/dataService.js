import * as db from './localDb.js';
import { logEvent } from './auditLogService.js';
import { getCatalog } from './masterDataService.js';
import { getActiveProfileId } from '../components/ActiveProfilePicker.js';

const { COLLECTIONS, get, getAll, put, remove, getByIndex, getAllByIndex, dbEvents } = db;

// -- Ocular Inspections --

export async function fetchReadyInspections(teamId = null) {
  return getAll(COLLECTIONS.OCULAR_INSPECTIONS, (item) => {
    let match = item.status === 'READY_FOR_INSTALLATION' && !item.deletedAt;
    if (teamId) {
      match = match && item.assignedTeam === teamId;
    }
    return match;
  });
}

export async function fetchPendingInstallations(teamId = null) {
  return getAll(COLLECTIONS.INSTALLATION_RECORDS, (item) => {
    let match = item.status === 'ASSIGNED_PENDING_INSTALLATION' && !item.deletedAt;
    if (teamId) {
      match = match && item.assignedTeam === teamId;
    }
    return match;
  });
}

export async function fetchAssignedInspections(teamId) {
  return getAll(COLLECTIONS.OCULAR_INSPECTIONS, (item) => 
    item.status === 'ASSIGNED_PENDING_INSPECTION' && item.assignedTeam === teamId && !item.deletedAt
  );
}

export async function fetchAllAssignedInspections() {
  return getAll(COLLECTIONS.OCULAR_INSPECTIONS, (item) => 
    item.status === 'ASSIGNED_PENDING_INSPECTION' && !item.deletedAt
  );
}

export async function fetchPendingQAInspections() {
  return getAllByIndex(COLLECTIONS.OCULAR_INSPECTIONS, 'status', 'PENDING_QA');
}

export async function fetchMySubmittedInspections(profileId) {
  return getAllByIndex(COLLECTIONS.OCULAR_INSPECTIONS, 'createdBy', profileId);
}

export async function updateInspectionStatus(id, newStatus, extra = {}) {
  const record = await get(COLLECTIONS.OCULAR_INSPECTIONS, id);
  if (!record) throw new Error('Inspection not found');
  Object.assign(record, { status: newStatus }, extra);
  
  if (newStatus === 'APPROVED' && record.assignedTeam) {
    await createNotification(record.assignedTeam, `Inspection approved: ${record.rnNo}`, '/ocular/history');
  } else if (newStatus === 'REJECTED' && record.assignedTeam) {
    await createNotification(record.assignedTeam, `Inspection needs revision: ${record.rnNo}`, '/ocular/history');
  }

  return put(COLLECTIONS.OCULAR_INSPECTIONS, record);
}

export async function assignInspectionTeam(id, teamId) {
  const record = await get(COLLECTIONS.OCULAR_INSPECTIONS, id);
  if (!record) throw new Error('Inspection not found');
  record.assignedTeam = teamId;
  record.status = 'ASSIGNED_PENDING_INSPECTION';
  return put(COLLECTIONS.OCULAR_INSPECTIONS, record);
}

export async function fetchAllInspections() {
  return getAll(COLLECTIONS.OCULAR_INSPECTIONS, item => !item.deletedAt);
}

export async function fetchFullInspectionByRnNo(rnNo) {
  return getByIndex(COLLECTIONS.OCULAR_INSPECTIONS, 'rnNo', rnNo);
}

export async function archiveInspection(id) {
  const record = await get(COLLECTIONS.OCULAR_INSPECTIONS, id);
  if (record) {
    record.deletedAt = new Date().toISOString();
    return put(COLLECTIONS.OCULAR_INSPECTIONS, record);
  }
}

// Merge form data onto the existing record so dispatch fields (assignedTeam, scheduledDate, ocularId, ...) survive.
async function mergeWithExisting(collection, formData) {
  if (formData && formData.id) {
    const existing = await get(collection, formData.id);
    if (existing) return Object.assign({}, existing, formData, { id: existing.id });
  }
  return formData;
}

export async function saveOcularInspection(formData) {
  formData = await mergeWithExisting(COLLECTIONS.OCULAR_INSPECTIONS, formData);
  const result = await put(COLLECTIONS.OCULAR_INSPECTIONS, formData);
  if (formData.status === 'PENDING_QA') {
    // Notify Customer Care + Admin (never block the save on a notification failure)
    try {
      const profiles = await getAll(COLLECTIONS.PROFILES);
      const managers = profiles.filter(p => p.role === 'customer_care_manager' || p.role === 'admin');
      for (const m of managers) {
          await createNotification(m.id, `New inspection for review: ${formData.rnNo}`, '/manager/qa');
      }
    } catch(e) {
      console.error('Error notifying managers of ocular submission:', e);
    }
  }
  return result;
}

// -- Installations --

export async function fetchInstallationByOcularId(ocularId) {
  const results = await getAllByIndex(COLLECTIONS.INSTALLATION_RECORDS, 'ocularId', ocularId);
  return results.length > 0 ? results[0] : null;
}

export async function fetchAllInstallations() {
  return getAll(COLLECTIONS.INSTALLATION_RECORDS);
}

export async function saveInstallationRecord(formData) {
  formData = await mergeWithExisting(COLLECTIONS.INSTALLATION_RECORDS, formData);
  const result = await put(COLLECTIONS.INSTALLATION_RECORDS, formData);
  
  if (formData.status === 'COMMISSIONED') {
    // Notify all Managers (never block the save on a notification failure)
    try {
      const profiles = await getAll(COLLECTIONS.PROFILES);
      const managers = profiles.filter(p => p.role === 'customer_care_manager' || p.role === 'admin');
      for (const m of managers) {
          await createNotification(m.id, `Installation completed: ${formData.installationNo}`, '/manager/pipeline');
      }
    } catch(e) {
      console.error('Error notifying managers of installation:', e);
    }

    // Move linked lead to INSTALLATION_COMPLETE
    if (formData.ocularId) {
      try {
        await updateLeadStageByOcularId(formData.ocularId, 'INSTALLATION_COMPLETE');
      } catch(e) {
        console.error('Error updating lead stage for installation:', e);
      }
    }
    
    // Deduct stock
    try {
      await deductStockForInstallation(formData);
    } catch(e) {
      console.error('Error deducting stock:', e);
    }
  }
  
  return result;
}

// -- Support Tickets --

export async function fetchSupportTickets() {
  return getAll(COLLECTIONS.SUPPORT_TICKETS);
}

export async function createSupportTicket(ticketData) {
  ticketData.status = 'OPEN';
  const result = await put(COLLECTIONS.SUPPORT_TICKETS, ticketData);
  
  // Notify all Managers
  const profiles = await getAll(COLLECTIONS.PROFILES);
  const managers = profiles.filter(p => p.role === 'customer_care_manager' || p.role === 'admin');
  for (const m of managers) {
      await createNotification(m.id, `New support ticket: ${ticketData.subject}`, '/manager/tickets');
  }
  
  return result;
}

export async function resolveSupportTicket(id, resolvedBy) {
  const ticket = await get(COLLECTIONS.SUPPORT_TICKETS, id);
  if (!ticket) throw new Error('Ticket not found');
  ticket.status = 'RESOLVED';
  ticket.resolvedBy = resolvedBy;
  ticket.resolvedAt = new Date().toISOString();
  return put(COLLECTIONS.SUPPORT_TICKETS, ticket);
}

// -- Sales Leads --

// Stage progress checklist (lead.stageChecklist): { [code]: { done, date: 'YYYY-MM-DD' | null } }
export const CHECKLIST_STAGES = [
  'INITIAL_CONTACT', 'SITE_VISIT_SCHEDULED', 'SITE_VISIT_COMPLETED', 'QUOTE_SENT',
  'QUOTE_ACCEPTED', 'INSTALLATION_SCHEDULED', 'INSTALLATION_COMPLETE', 'JOB_CHECKOUT_COMPLETE'
];

/** Today's date in Manila as YYYY-MM-DD. */
export function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** When the app moves a lead to `code`, tick that checklist step (keeps an existing date). */
function markChecklistDone(lead, code) {
  if (!CHECKLIST_STAGES.includes(code)) return;
  const cl = (lead.stageChecklist && typeof lead.stageChecklist === 'object') ? { ...lead.stageChecklist } : {};
  const cur = cl[code];
  if (cur && cur.done) return;
  cl[code] = { done: true, date: (cur && cur.date) || manilaToday() };
  lead.stageChecklist = cl;
}

export async function fetchAllSalesLeads() {
  return getAll(COLLECTIONS.SALES_LEADS, item => !item.deletedAt);
}

export async function createSalesLead(leadData) {
  leadData.stage = 'INITIAL_CONTACT';
  leadData.stageINITIAL_CONTACTAt = new Date().toISOString();
  markChecklistDone(leadData, 'INITIAL_CONTACT');
  return put(COLLECTIONS.SALES_LEADS, leadData);
}

export async function updateSalesLeadStage(id, stage) {
  const lead = await get(COLLECTIONS.SALES_LEADS, id);
  if (!lead) throw new Error('Lead not found');
  
  const oldStage = lead.stage;
  lead.stage = stage;
  lead[`stage${stage}At`] = new Date().toISOString();
  markChecklistDone(lead, stage);
  
  const profileId = getActiveProfileId();
  let email = 'System', role = 'System';
  try {
      const { getProfiles } = await import('./userService.js');
      const profiles = await getProfiles();
      const p = profiles.find(x => x.id === profileId);
      if (p) { email = p.email; role = p.role; }
  } catch(e) {}
  
  // Create audit log
  await logEvent({
      actorId: profileId,
      actorEmail: email,
      actorRole: role,
      category: 'CUSTOMER_CARE',
      eventType: 'UPDATE_STAGE',
      severity: 'INFO',
      resourceType: 'LEAD',
      resourceId: id,
      description: `Stage updated from ${oldStage || 'No status'} to ${stage}`
  });
  
  return put(COLLECTIONS.SALES_LEADS, lead);
}

export async function updateSalesLeadInfo(id, updates) {
  const lead = await get(COLLECTIONS.SALES_LEADS, id);
  if (!lead) throw new Error('Lead not found');
  
  Object.assign(lead, updates);
  
  const profileId = getActiveProfileId();
  let email = 'System', role = 'System';
  try {
      const { getProfiles } = await import('./userService.js');
      const profiles = await getProfiles();
      const p = profiles.find(x => x.id === profileId);
      if (p) { email = p.email; role = p.role; }
  } catch(e) {}
  
  await logEvent({
      actorId: profileId,
      actorEmail: email,
      actorRole: role,
      category: 'CUSTOMER_CARE',
      eventType: 'UPDATE_INFO',
      severity: 'INFO',
      resourceType: 'LEAD',
      resourceId: id,
      description: `CRM Profile updated for ${lead.name}`
  });
  
  return put(COLLECTIONS.SALES_LEADS, lead);
}

export async function updateSalesLeadOcularId(id, ocularId) {
  const lead = await get(COLLECTIONS.SALES_LEADS, id);
  if (!lead) throw new Error('Lead not found');
  lead.ocularId = ocularId;
  return put(COLLECTIONS.SALES_LEADS, lead);
}

export async function updateLeadStageByOcularId(ocularId, newStage) {
  const leads = await getAll(COLLECTIONS.SALES_LEADS);
  const lead = leads.find(l => l.ocularId === ocularId);
  if (lead) {
      const oldStage = lead.stage;
      lead.stage = newStage;
      lead[`stage${newStage}At`] = new Date().toISOString();
      markChecklistDone(lead, newStage);
      
      const profileId = getActiveProfileId();
      let email = 'System', role = 'System';
      try {
          const { getProfiles } = await import('./userService.js');
          const profiles = await getProfiles();
          const p = profiles.find(x => x.id === profileId);
          if (p) { email = p.email; role = p.role; }
      } catch(e) {}
      
      await logEvent({
          actorId: profileId,
          actorEmail: email,
          actorRole: role,
          category: 'CUSTOMER_CARE',
          eventType: 'UPDATE_STAGE',
          severity: 'INFO',
          resourceType: 'LEAD',
          resourceId: lead.id,
          description: `Auto-updated stage from ${oldStage || 'No status'} to ${newStage} via Operations`
      });
      
      return put(COLLECTIONS.SALES_LEADS, lead);
  }
}

export async function archiveSalesLead(id) {
  const record = await get(COLLECTIONS.SALES_LEADS, id);
  if (record) {
    record.deletedAt = new Date().toISOString();
    return put(COLLECTIONS.SALES_LEADS, record);
  }
}

export async function dispatchOcularFromLead(leadId, teamId, rnNo, scheduledDate = '') {
  const lead = await get(COLLECTIONS.SALES_LEADS, leadId);
  if (!lead) throw new Error('Lead not found');

  const inspectionData = {
    clientName: lead.name,
    contactNo: lead.contactInfo || lead.phone || lead.email || '',
    locationAddress: lead.installationAddress,
    rnNo: rnNo,
    scopeOfWorks: 'Site Inspection',
    status: 'ASSIGNED_PENDING_INSPECTION',
    assignedTeam: teamId,
    scheduledDate: scheduledDate, // NEW FIELD
    createdAt: new Date().toISOString()
  };
  
  const savedInspection = await put(COLLECTIONS.OCULAR_INSPECTIONS, inspectionData);
  
  lead.ocularId = savedInspection.id;
  lead.stage = 'SITE_VISIT_SCHEDULED';
  lead['stageSITE_VISIT_SCHEDULEDAt'] = new Date().toISOString();
  markChecklistDone(lead, 'SITE_VISIT_SCHEDULED');
  await put(COLLECTIONS.SALES_LEADS, lead);

  await createNotification(teamId, `New inspection assigned: ${rnNo} – ${lead.name}`, '/ocular/assigned');
  
  return savedInspection;
}

export async function dispatchInstallationFromLead(leadId, teamId, installationNo, scheduledDate = '') {
  const lead = await get(COLLECTIONS.SALES_LEADS, leadId);
  if (!lead) throw new Error('Lead not found');

  // Need to get ocular data to copy over specifics if needed, but we can just use lead data for now
  const installationData = {
    ocularId: lead.ocularId,
    clientName: lead.name,
    installationNo: installationNo,
    status: 'ASSIGNED_PENDING_INSTALLATION',
    assignedTeam: teamId,
    scheduledDate: scheduledDate,
    createdAt: new Date().toISOString()
  };
  
  const savedInstallation = await put(COLLECTIONS.INSTALLATION_RECORDS, installationData);
  
  lead.installationId = savedInstallation.id;
  lead.stage = 'INSTALLATION_SCHEDULED';
  lead['stageINSTALLATION_SCHEDULEDAt'] = new Date().toISOString();
  markChecklistDone(lead, 'INSTALLATION_SCHEDULED');
  await put(COLLECTIONS.SALES_LEADS, lead);

  await createNotification(teamId, `New installation assigned: ${installationNo} – ${lead.name}`, '/ocular/ready');
  
  return savedInstallation;
}

export async function bulkImportSalesLeads(rows) {
  for (const row of rows) {
    await put(COLLECTIONS.SALES_LEADS, row);
  }
}

// -- Dashboard Metrics --

export async function fetchDashboardMetrics() {
  const [inspections, installations, tickets, leads] = await Promise.all([
    getAll(COLLECTIONS.OCULAR_INSPECTIONS),
    getAll(COLLECTIONS.INSTALLATION_RECORDS),
    getAll(COLLECTIONS.SUPPORT_TICKETS),
    getAll(COLLECTIONS.SALES_LEADS)
  ]);
  
  return {
    totalInspections: inspections.filter(i => !i.deletedAt).length,
    pendingQA: inspections.filter(i => i.status === 'PENDING_QA' && !i.deletedAt).length,
    totalInstallations: installations.length,
    openTickets: tickets.filter(t => t.status === 'OPEN').length,
    activeLeads: leads.filter(l => !l.deletedAt && l.stage !== 'CANCELED' && l.stage !== 'JOB_CHECKOUT_COMPLETE').length
  };
}

// -- Realtime alternative --

export function onDataChange(collection, callback) {
  const handler = (e) => {
    if (e.detail.collection === collection) {
      callback(e.detail);
    }
  };
  dbEvents.addEventListener('change', handler);
  return () => dbEvents.removeEventListener('change', handler);
}

export async function createNotification(userId, message, link = '') {
  const notif = {
    userId,
    message,
    link,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  await put(COLLECTIONS.NOTIFICATIONS, notif);
  dbEvents.dispatchEvent(new Event('notifications_changed'));
}


export async function deductStockForInstallation(formData) {
  const catalog = await getCatalog();
  
  // Mapping of form field keys to catalog itemKeys
  const mapping = {
    'conduitPvc': 'cond-pvc20',
    // ... add more as we expand the catalog
  };

  let hasChanges = false;
  for (const [formKey, itemKey] of Object.entries(mapping)) {
    const qty = parseInt(formData[formKey], 10);
    if (qty && qty > 0) {
      const item = catalog.find(c => c.itemKey === itemKey);
      if (item && item.currentStock !== null) {
        item.currentStock = Math.max(0, item.currentStock - qty);
        await put(COLLECTIONS.MASTER_DATA_CATALOG, item);
        hasChanges = true;
      }
    }
  }
}

