import { COLLECTIONS, getAll, put, remove } from './localDb.js';

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
    Object.assign(item, updates);
    return put(COLLECTIONS.MASTER_DATA_CATALOG, item);
}

export async function deleteCatalogItem(itemKey) {
    return remove(COLLECTIONS.MASTER_DATA_CATALOG, itemKey);
}
