import { saveOcularInspection, saveInstallationRecord } from '../services/dataService.js';
import { get } from '../services/localDb.js';
import { COLLECTIONS } from '../services/localDb.js';

export async function saveOcularDraft(formData, id = null) {
    const record = { status: 'DRAFT', ...formData };
    if (id) {
        record.id = id;
    }
    return saveOcularInspection(record);
}

export async function getOcularDraft(id) {
    return get(COLLECTIONS.OCULAR_INSPECTIONS, id);
}

export async function saveInstallationDraft(formData, id = null) {
    const record = { status: 'DRAFT', ...formData };
    if (id) {
        record.id = id;
    }
    return saveInstallationRecord(record);
}

export async function getInstallationDraft(id) {
    return get(COLLECTIONS.INSTALLATION_RECORDS, id);
}
