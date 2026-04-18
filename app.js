// State
let inventory = [];
const PASSCODE = 'vinted123'; // Simple password
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw3xMTlc-UGJ2iY2pMRMcBngb_vzGrn2MlA7i0rxvOiHoWkrjmdwNOL57OQvHb7wstVFg/exec'; // Set to empty to use Local Browser Storage as the database

// Chart instances
let salesChart = null;
let categoryChart = null;

// DOM Elements
const elements = {
    loginScreen: document.getElementById('login-screen'),
    mainScreen: document.getElementById('main-screen'),
    loginForm: document.getElementById('login-form'),
    passwordInput: document.getElementById('password'),
    loginError: document.getElementById('login-error'),
    logoutBtn: document.getElementById('logout-btn'),

    sidebar: document.querySelector('.sidebar'),
    mobileMenuToggle: document.querySelector('.mobile-menu-toggle'),
    navLinks: document.querySelectorAll('.nav-links li'),
    views: document.querySelectorAll('.view'),

    inventoryTbody: document.getElementById('inventory-tbody'),
    searchInput: document.getElementById('search-input'),
    loadingIndicator: document.getElementById('loading-indicator'),

    addItemBtn: document.getElementById('add-item-btn'),
    itemModal: document.getElementById('item-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    itemForm: document.getElementById('item-form'),
    modalTitle: document.getElementById('modal-title'),

    // Form inputs
    editOriginalId: document.getElementById('edit-original-id'),
    editRowIndex: document.getElementById('edit-row-index'),
    itemImage: document.getElementById('item-image'),
    imageBase64: document.getElementById('image-base64'),
    imageUrl: document.getElementById('image-url'),
    imagePreviewContainer: document.getElementById('image-preview-container'),
    itemId: document.getElementById('item-id'),
    itemName: document.getElementById('item-name'),
    itemPrice: document.getElementById('item-price'),
    itemCost: document.getElementById('item-cost'),
    itemStatus: document.getElementById('item-status'),
    itemCondition: document.getElementById('item-condition'),
    itemTags: document.getElementById('item-tags'),

    // Stats
    statTotalSales: document.getElementById('stat-total-sales'),
    statProfitMargin: document.getElementById('stat-profit-margin'),
    statAvgPrice: document.getElementById('stat-avg-price'),
    statTotalStock: document.getElementById('stat-total-stock'),

    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),

    // Confirm Modal
    confirmModal: document.getElementById('confirm-modal'),
    cancelConfirmBtn: document.getElementById('cancel-confirm-btn'),
    confirmDeleteBtn: document.getElementById('confirm-delete-btn'),

    // Sort Headers
    sortHeaders: document.querySelectorAll('th.sortable')
};

// Initialize
function init() {
    checkAuth();
    setupEventListeners();

    // If authenticated, load data
    if (!elements.loginScreen.classList.contains('active')) {
        loadData();
    }
}

// Authentication
function checkAuth() {
    if (localStorage.getItem('vinted_auth') === 'true') {
        showMainScreen();
    }
}

elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (elements.passwordInput.value === PASSCODE) {
        localStorage.setItem('vinted_auth', 'true');
        elements.loginError.classList.add('hidden');
        showMainScreen();
        loadData();
    } else {
        elements.loginError.classList.remove('hidden');
    }
});

elements.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('vinted_auth');
    elements.mainScreen.classList.add('hidden');
    elements.loginScreen.classList.remove('hidden');
    elements.loginScreen.classList.add('active');
    elements.passwordInput.value = '';
});

function showMainScreen() {
    elements.loginScreen.classList.remove('active');
    elements.loginScreen.classList.add('hidden');
    elements.mainScreen.classList.remove('hidden');
}

// Navigation
elements.navLinks.forEach(link => {
    link.addEventListener('click', () => {
        elements.navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const targetId = `view-${link.dataset.target}`;
        elements.views.forEach(view => {
            if (view.id === targetId) {
                view.classList.remove('hidden');
                view.classList.add('active');
            } else {
                view.classList.remove('active');
                view.classList.add('hidden');
            }
        });

        if (window.innerWidth <= 768) {
            elements.sidebar.classList.remove('open');
        }

        if (targetId === 'view-statistics') {
            updateStatistics();
        }
    });
});

elements.mobileMenuToggle.addEventListener('click', () => {
    elements.sidebar.classList.toggle('open');
});

// API Integration
async function loadData() {
    elements.loadingIndicator.classList.remove('hidden');

    if (!SCRIPT_URL) {
        // Fallback to LocalStorage Data if no URL
        const saved = localStorage.getItem('vinted_inventory');
        if (saved) {
            inventory = JSON.parse(saved);
        } else {
            inventory = [
                { id: 'V-001', name: 'Vintage Nike Hoodie', price: 45.00, cost: 15.00, status: 'Available', condition: 'Very Good', tags: 'Hoodie, Nike, Vintage', image: '' },
                { id: 'V-002', name: 'Levis 501 Jeans', price: 30.00, cost: 10.00, status: 'Sold', condition: 'Good', tags: 'Jeans, Levis', image: '' }
            ];
            localStorage.setItem('vinted_inventory', JSON.stringify(inventory));
        }
        renderTable(inventory);
        elements.loadingIndicator.classList.add('hidden');
        updateStatistics();
        return;
    }

    try {
        // Add a timestamp to prevent the browser from caching old data
        const response = await fetch(`${SCRIPT_URL}?passcode=${PASSCODE}&t=${new Date().getTime()}`);
        if (!response.ok) throw new Error("Network response was not ok");

        const result = await response.json();

        if (result.success) {
            inventory = result.data;
            renderTable(inventory);
            updateStatistics();
        } else {
            elements.inventoryTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: #ef4444;">Error loading data: ${result.error}</td></tr>`;
            showToast('Error loading data: ' + result.error, 'error');
        }
    } catch (e) {
        console.error(e);
        elements.inventoryTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: #ef4444;">Connection error to Google Sheets. Make sure you aren't blocking scripts.</td></tr>`;
        showToast('Connection error', 'error');
    } finally {
        elements.loadingIndicator.classList.add('hidden');
    }
}

async function syncWithGoogleSheets(data, action) {
    // Always save to local storage as fallback/local DB
    localStorage.setItem('vinted_inventory', JSON.stringify(inventory));

    if (!SCRIPT_URL) return; // Skip if no URL provided

    // Disable interactions while syncing
    elements.loadingIndicator.classList.remove('hidden');

    try {
        const payload = {
            action: action,
            passcode: PASSCODE,
            ...data
        };

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!result.success) {
            showToast('Failed to sync with Google Sheets', 'error');
            console.error(result.error);
        } else {
            // Reload data to get the Drive image URLs
            if (action === 'ADD' || action === 'UPDATE') {
                if (result.imageUrl) {
                    const itemToUpdate = inventory.find(i => i.id === data.item.id);
                    if (itemToUpdate) itemToUpdate.image = result.imageUrl;
                    renderTable(inventory);
                }
            }
        }
    } catch (e) {
        showToast('Network error while syncing', 'error');
    } finally {
        elements.loadingIndicator.classList.add('hidden');
    }
}

// Render Table
function renderTable(data) {
    elements.inventoryTbody.innerHTML = '';
    if (data.length === 0) {
        elements.inventoryTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No items found.</td></tr>';
        return;
    }

    data.forEach((item, index) => {
        const tr = document.createElement('tr');

        const imgSrc = item.image || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect><circle cx='8.5' cy='8.5' r='1.5'></circle><polyline points='21 15 16 10 5 21'></polyline></svg>";

        tr.innerHTML = `
            <td><img src="${imgSrc}" class="item-img" alt="Item"></td>
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>
                £<input type="number" step="0.01" class="inline-edit-price glass-input" data-id="${item.id}" value="${parseFloat(item.price).toFixed(2)}">
            </td>
            <td>£${parseFloat(item.cost).toFixed(2)}</td>
            <td>
                <select class="inline-edit-status glass-input status-${item.status.toLowerCase()}" data-id="${item.id}">
                    <option value="Available" ${item.status === 'Available' ? 'selected' : ''}>Available</option>
                    <option value="Reserved" ${item.status === 'Reserved' ? 'selected' : ''}>Reserved</option>
                    <option value="Sold" ${item.status === 'Sold' ? 'selected' : ''}>Sold</option>
                </select>
            </td>
            <td>${item.condition}</td>
            <td>
                <div class="action-btns">
                    <button class="btn icon-btn edit-btn" data-id="${item.id}" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn icon-btn delete-btn" data-id="${item.id}" title="Delete"><i class="ph ph-trash"></i></button>
                </div>
            </td>
        `;
        elements.inventoryTbody.appendChild(tr);
    });

    // Attach event listeners to buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openModal(e.currentTarget.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => confirmDelete(e.currentTarget.dataset.id));
    });

    // Attach event listeners to inline edits
    document.querySelectorAll('.inline-edit-price').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const newPrice = parseFloat(e.target.value);
            const item = inventory.find(i => i.id === id);
            if (item && !isNaN(newPrice)) {
                item.price = newPrice;
                updateStatistics();
                syncWithGoogleSheets({ item: item, originalId: item.id }, 'UPDATE');
                showToast('Price updated');
            }
        });
    });

    document.querySelectorAll('.inline-edit-status').forEach(select => {
        select.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const newStatus = e.target.value;
            const item = inventory.find(i => i.id === id);
            if (item) {
                item.status = newStatus;
                e.target.className = `inline-edit-status glass-input status-${newStatus.toLowerCase()}`;
                updateStatistics();
                syncWithGoogleSheets({ item: item, originalId: item.id }, 'UPDATE');
                showToast('Status updated');
            }
        });
    });
}

// Search
elements.searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = inventory.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term) ||
        item.tags.toLowerCase().includes(term)
    );
    renderTable(filtered);
});

// Sort
let currentSort = { key: 'id', asc: true };
elements.sortHeaders.forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (currentSort.key === key) {
            currentSort.asc = !currentSort.asc;
        } else {
            currentSort.key = key;
            currentSort.asc = true;
        }

        const sorted = [...inventory].sort((a, b) => {
            let valA = a[key];
            let valB = b[key];

            if (key === 'price' || key === 'cost') {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return currentSort.asc ? -1 : 1;
            if (valA > valB) return currentSort.asc ? 1 : -1;
            return 0;
        });

        renderTable(sorted);
    });
});

// Modals & Forms
function openModal(id = null) {
    elements.itemForm.reset();
    elements.imageBase64.value = '';
    elements.imageUrl.value = '';
    elements.imagePreviewContainer.style.backgroundImage = 'none';
    elements.imagePreviewContainer.innerHTML = '<i class="ph ph-image"></i><span>Upload Image</span>';

    if (id) {
        const item = inventory.find(i => i.id === id);
        if (item) {
            elements.modalTitle.textContent = 'Edit Item';
            elements.editOriginalId.value = item.id;
            elements.itemId.value = item.id;
            elements.itemName.value = item.name;
            elements.itemPrice.value = item.price;
            elements.itemCost.value = item.cost;
            elements.itemStatus.value = item.status;
            elements.itemCondition.value = item.condition;
            elements.itemTags.value = item.tags;

            if (item.image) {
                elements.imageUrl.value = item.image;
                elements.imagePreviewContainer.style.backgroundImage = `url(${item.image})`;
                elements.imagePreviewContainer.innerHTML = '';
            }
        }
    } else {
        elements.modalTitle.textContent = 'Add Item';
        elements.editOriginalId.value = '';
        // Generate pseudo ID
        elements.itemId.value = 'V-' + Math.floor(1000 + Math.random() * 9000);
    }

    elements.itemModal.classList.remove('hidden');
}

function closeModal() {
    elements.itemModal.classList.add('hidden');
}

elements.addItemBtn.addEventListener('click', () => openModal());
elements.closeModalBtn.addEventListener('click', closeModal);
elements.cancelModalBtn.addEventListener('click', closeModal);

// Image Upload Preview
elements.itemImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            elements.imageBase64.value = base64;
            elements.imagePreviewContainer.style.backgroundImage = `url(${base64})`;
            elements.imagePreviewContainer.innerHTML = '';
        };
        reader.readAsDataURL(file);
    }
});

// Form Submit (Save)
elements.itemForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newItem = {
        id: elements.itemId.value,
        name: elements.itemName.value,
        price: parseFloat(elements.itemPrice.value),
        cost: parseFloat(elements.itemCost.value),
        status: elements.itemStatus.value,
        condition: elements.itemCondition.value,
        tags: elements.itemTags.value,
        image: elements.imageBase64.value || elements.imageUrl.value || ''
    };

    const originalId = elements.editOriginalId.value;

    // Validate pseudo duplicate IDs
    if (!originalId && inventory.some(i => i.id === newItem.id)) {
        showToast('Item ID already exists', 'error');
        return;
    }

    if (originalId) {
        const idx = inventory.findIndex(i => i.id === originalId);
        if (idx !== -1) inventory[idx] = newItem;
        showToast('Item updated successfully');
    } else {
        inventory.unshift(newItem);
        showToast('Item added successfully');
    }

    closeModal();
    renderTable(inventory);
    updateStatistics();

    // In the future, this is where we send data to Apps Script
    syncWithGoogleSheets({ item: newItem, originalId: originalId }, originalId ? 'UPDATE' : 'ADD');
});

// Delete
let itemToDelete = null;
function confirmDelete(id) {
    itemToDelete = id;
    elements.confirmModal.classList.remove('hidden');
}

elements.cancelConfirmBtn.addEventListener('click', () => {
    itemToDelete = null;
    elements.confirmModal.classList.add('hidden');
});

elements.confirmDeleteBtn.addEventListener('click', () => {
    if (itemToDelete) {
        inventory = inventory.filter(i => i.id !== itemToDelete);
        renderTable(inventory);
        updateStatistics();
        showToast('Item deleted');
        elements.confirmModal.classList.add('hidden');

        syncWithGoogleSheets({ id: itemToDelete }, 'DELETE');
    }
});

// Statistics
function updateStatistics() {
    const soldItems = inventory.filter(i => i.status === 'Sold');
    const availableItems = inventory.filter(i => i.status === 'Available');

    const totalSales = soldItems.reduce((sum, item) => sum + parseFloat(item.price), 0);
    const totalCostSold = soldItems.reduce((sum, item) => sum + parseFloat(item.cost), 0);
    const profit = totalSales - totalCostSold;
    const margin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0;

    const avgPrice = soldItems.length > 0 ? (totalSales / soldItems.length) : 0;

    elements.statTotalSales.textContent = `£${totalSales.toFixed(2)}`;
    elements.statProfitMargin.textContent = `${margin}%`;
    elements.statAvgPrice.textContent = `£${avgPrice.toFixed(2)}`;
    elements.statTotalStock.textContent = availableItems.length;

    updateCharts();
}

function updateCharts() {
    // Status breakdown
    const statusCounts = { Available: 0, Reserved: 0, Sold: 0 };
    inventory.forEach(i => statusCounts[i.status]++);

    if (salesChart) salesChart.destroy();

    const ctxSales = document.getElementById('salesChart').getContext('2d');
    salesChart = new Chart(ctxSales, {
        type: 'doughnut',
        data: {
            labels: ['Available', 'Reserved', 'Sold'],
            datasets: [{
                data: [statusCounts.Available, statusCounts.Reserved, statusCounts.Sold],
                backgroundColor: ['#10b981', '#fbbf24', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: '#cbd5e1' } }
            },
            cutout: '70%'
        }
    });

    // Category logic based on tags
    const cats = {};
    inventory.forEach(i => {
        const firstTag = i.tags.split(',')[0].trim() || 'Other';
        cats[firstTag] = (cats[firstTag] || 0) + 1;
    });

    if (categoryChart) categoryChart.destroy();

    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(ctxCat, {
        type: 'bar',
        data: {
            labels: Object.keys(cats),
            datasets: [{
                label: 'Items',
                data: Object.values(cats),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#cbd5e1' } },
                x: { grid: { display: false }, ticks: { color: '#cbd5e1' } }
            }
        }
    });
}

// Toast
function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.querySelector('i').className = type === 'success' ? 'ph ph-check-circle' : 'ph ph-warning-circle';
    elements.toast.querySelector('i').style.color = type === 'success' ? 'var(--success-color)' : 'var(--danger-color)';

    elements.toast.classList.remove('hidden');
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
