import { getCatalog, addCatalogItem, deleteCatalogItem } from '../../services/masterDataService.js';
import { escapeHTML } from '../../shared/security.js';

export default class MasterDataCatalogView {
    async render() {
        const container = document.createElement('div');
        container.className = 'card';
        
        container.innerHTML = `
            <h2>Inventory Database</h2>
            <div style="margin-top: 1rem; margin-bottom: 2rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px;">
                <h3>Add New Inventory Item</h3>
                <form id="add-catalog-form" style="display: flex; gap: 1rem; align-items: end; flex-wrap: wrap;">
                    <div class="form-group" style="margin: 0;">
                        <label>Category</label>
                        <select name="category" required>
                            <option value="chargers">Chargers</option>
                            <option value="breakers">Breakers</option>
                            <option value="conduits">Conduits</option>
                            <option value="scopes">Scopes</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label>Item Key (unique)</label>
                        <input type="text" name="itemKey" required placeholder="e.g. c-22kw">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label>Item Name</label>
                        <input type="text" name="itemName" required>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label>Stock</label>
                        <input type="number" name="currentStock" min="0" placeholder="Optional">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label>Unit Price</label>
                        <input type="number" name="unitPrice" min="0" placeholder="Optional">
                    </div>
                    <button type="submit" style="padding: 0.5rem 1rem;">Add Item</button>
                </form>
            </div>
            <div id="catalog-table-container">
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
                <div class="skeleton skeleton-table-row"></div>
            </div>
        `;

        const form = container.querySelector('#add-catalog-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const stockVal = formData.get('currentStock');
            const priceVal = formData.get('unitPrice');
            
            try {
                await addCatalogItem({
                    category: formData.get('category'),
                    itemKey: formData.get('itemKey'),
                    itemName: formData.get('itemName'),
                    currentStock: stockVal ? parseInt(stockVal, 10) : 0,
                    unitPrice: priceVal ? parseFloat(priceVal) : 0,
                    details: {}
                });
                form.reset();
                this.loadCatalog(container.querySelector('#catalog-table-container'));
            } catch (err) {
                alert('Error creating inventory item: ' + err.message);
            }
        });

        this.loadCatalog(container.querySelector('#catalog-table-container'));

        return container;
    }

    async loadCatalog(container) {
        try {
            const catalog = await getCatalog();
            if (catalog.length === 0) {
                container.innerHTML = '<p>No inventory items found.</p>';
                return;
            }
            container.innerHTML = `
                <table style="width: 100%; text-align: left;">
                    <thead><tr><th>Category</th><th>Item Key</th><th>Item Name</th><th>Stock</th><th>Unit Price (₱)</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${catalog.map(c => `
                            <tr>
                                <td>${escapeHTML(c.category)}</td>
                                <td>${escapeHTML(c.itemKey)}</td>
                                <td>${escapeHTML(c.itemName)}</td>
                                <td>${c.currentStock !== null && c.currentStock !== undefined ? escapeHTML(c.currentStock) : '-'}</td>
                                <td>${c.unitPrice !== null && c.unitPrice !== undefined ? escapeHTML(c.unitPrice.toLocaleString()) : '-'}</td>
                                <td>
                                    <button class="edit-btn" data-key="${escapeHTML(c.itemKey)}" title="Edit" style="background-color: #f59e0b; color: white; font-size: 0.85rem; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;">Edit</button>
                                    <button class="delete-btn" data-key="${escapeHTML(c.itemKey)}" title="Delete" style="background-color: #ef4444; color: white; font-size: 0.85rem; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer;">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const itemKey = e.currentTarget.dataset.key;
                    const item = catalog.find(c => c.itemKey === itemKey);
                    if (!item) return;

                    const modal = document.createElement('div');
                    modal.style.position = 'fixed';
                    modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100%'; modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
                    modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
                    modal.style.zIndex = '1000';

                    modal.innerHTML = `
                        <div style="background: white; padding: 2rem; border-radius: 8px; width: 400px;">
                            <h3>Edit Inventory Item</h3>
                            <div class="form-group">
                                <label>Item Key (Read Only)</label>
                                <input type="text" value="${escapeHTML(item.itemKey)}" readonly style="background: #f1f5f9;">
                            </div>
                            <div class="form-group">
                                <label>Item Name</label>
                                <input type="text" id="edit-name" value="${escapeHTML(item.itemName)}">
                            </div>
                            <div class="form-group">
                                <label>Category</label>
                                <input type="text" id="edit-category" value="${escapeHTML(item.category)}">
                            </div>
                            <div style="display:flex; gap: 1rem;">
                                <div class="form-group" style="flex:1;">
                                    <label>Stock</label>
                                    <input type="number" id="edit-stock" value="${item.currentStock !== null ? item.currentStock : ''}">
                                </div>
                                <div class="form-group" style="flex:1;">
                                    <label>Unit Price (₱)</label>
                                    <input type="number" step="0.01" id="edit-price" value="${item.unitPrice !== null ? item.unitPrice : ''}">
                                </div>
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap: 1rem; margin-top: 1.5rem;">
                                <button id="edit-cancel" style="background: #e2e8f0; color: #333;">Cancel</button>
                                <button id="edit-save" style="background: #10b981; color: white;">Save Changes</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    modal.querySelector('#edit-cancel').addEventListener('click', () => {
                        document.body.removeChild(modal);
                    });

                    modal.querySelector('#edit-save').addEventListener('click', async () => {
                        const stockVal = modal.querySelector('#edit-stock').value;
                        const priceVal = modal.querySelector('#edit-price').value;
                        
                        const updatedItem = {
                            ...item,
                            itemName: modal.querySelector('#edit-name').value,
                            category: modal.querySelector('#edit-category').value,
                            currentStock: stockVal !== '' ? parseInt(stockVal, 10) : null,
                            unitPrice: priceVal !== '' ? parseFloat(priceVal) : null
                        };

                        try {
                            const { updateCatalogItem } = await import('../../services/masterDataService.js');
                            await updateCatalogItem(itemKey, updatedItem);
                            document.body.removeChild(modal);
                            this.loadCatalog(container);
                        } catch (err) {
                            alert('Error updating item: ' + err.message);
                        }
                    });
                });
            });

            container.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Delete this item?')) {
                        try {
                            await deleteCatalogItem(e.currentTarget.dataset.key);
                            this.loadCatalog(container);
                        } catch (err) {
                            alert('Error deleting item: ' + err.message);
                        }
                    }
                });
            });
        } catch (e) {
            container.innerHTML = `<p style="color:red;">Failed to load catalog: ${e.message}</p>`;
        }
    }
}
