import * as db from './localDb.js';
import { logEvent } from './auditLogService.js';
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
    await createNotification(record.assignedTeam, `Ocular ${record.rnNo} was Approved.`, '/ocular/history');
  } else if (newStatus === 'REJECTED' && record.assignedTeam) {
    await createNotification(record.assignedTeam, `Ocular ${record.rnNo} was Rejected. Please review.`, '/ocular/history');
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

export async function saveOcularInspection(formData) {
  const result = await put(COLLECTIONS.OCULAR_INSPECTIONS, formData);
  if (formData.status === 'PENDING_APPROVAL') {
    // Notify all Managers
    const profiles = await getAll(COLLECTIONS.PROFILES);
    const managers = profiles.filter(p => p.role === 'customer_care_manager' || p.role === 'admin');
    for (const m of managers) {
        await createNotification(m.id, `New Ocular Submitted: ${formData.rnNo}`, '/manager/qa');
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
  const result = await put(COLLECTIONS.INSTALLATION_RECORDS, formData);
  
  if (formData.status === 'COMMISSIONED') {
    // Notify all Managers
    const profiles = await getAll(COLLECTIONS.PROFILES);
    const managers = profiles.filter(p => p.role === 'customer_care_manager' || p.role === 'admin');
    for (const m of managers) {
        await createNotification(m.id, `Installation Completed: ${formData.installationNo}`, '/manager/pipeline');
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
      await createNotification(m.id, `New Support Ticket: ${ticketData.subject}`, '/manager/tickets');
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

export async function fetchAllSalesLeads() {
  return getAll(COLLECTIONS.SALES_LEADS, item => !item.deletedAt);
}

export async function createSalesLead(leadData) {
  leadData.stage = 'INITIAL_CONTACT';
  leadData.stageINITIAL_CONTACTAt = new Date().toISOString();
  return put(COLLECTIONS.SALES_LEADS, leadData);
}

export async function updateSalesLeadStage(id, stage) {
  const lead = await get(COLLECTIONS.SALES_LEADS, id);
  if (!lead) throw new Error('Lead not found');
  
  const oldStage = lead.stage;
  lead.stage = stage;
  lead[`stage${stage}At`] = new Date().toISOString();
  
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
      description: `Stage updated from ${oldStage} to ${stage}`
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
          description: `Auto-updated stage from ${oldStage} to ${newStage} via Operations`
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
    contactNo: lead.contactInfo,
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
  await put(COLLECTIONS.SALES_LEADS, lead);

  await createNotification(teamId, `New Ocular Dispatched: ${rnNo} for ${lead.name}`, '/ocular/assigned');
  
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
  lead.stage = 'INSTALL_SCHEDULED';
  lead['stageINSTALL_SCHEDULEDAt'] = new Date().toISOString();
  await put(COLLECTIONS.SALES_LEADS, lead);

  await createNotification(teamId, `New Installation Dispatched: ${installationNo} for ${lead.name}`, '/ocular/ready');
  
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

