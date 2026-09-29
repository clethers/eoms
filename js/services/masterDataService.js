import { COLLECTIONS, getAll, put, remove } from './localDb.js';
import { recordAudit, diffFields } from './auditLogService.js';

const ITEM_AUDIT_FIELDS = ['itemName', 'category', 'currentStock', 'unitPrice'];

export async function getCatalog() {
    return getAll(COLLECTIONS.MASTER_DATA_CATALOG);
}

export async function getItemsByCategory(category) {
    const catalog = await getCatalog();
    return catalog.filter(item => item.category === category);
}

export async function addCatalogItem(itemData) {
    return put(COLLECTIONS.MASTER_DATA_CATALOG, itemData);
}

export async function updateCatalogItem(itemKey, updates) {
    const catalog = await getCatalog();
    const item = catalog.find(c => c.itemKey === itemKey);
    if (!item) throw new Error('Catalog item not found');
    const before = { ...item };
    Object.assign(item, updates);
    const saved = await put(COLLECTIONS.MASTER_DATA_CATALOG, item);
    await recordAudit({
        category: 'MASTER_DATA',
        eventType: 'UPDATE_ITEM',
        resourceType: 'ITEM',
        resourceId: itemKey,
        resourceLabel: `Item · ${before.itemName || itemKey}`,
        description: `Catalog item updated: ${before.itemName || itemKey}`,
        changesDelta: diffFields(before, item, ITEM_AUDIT_FIELDS)
    });
    return saved;
}

export async function deleteCatalogItem(itemKey) {
    return remove(COLLECTIONS.MASTER_DATA_CATALOG, itemKey);
}
