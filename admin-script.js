const PASS_KEY = 'ipstore25_admin_pass';
const DEFAULT_PASS = 'admin123';
const CLOUDINARY_CLOUD = 'qqftt7fm';
const CLOUDINARY_PRESET = 'ipstore25_preset';

let adminProducts = [];
let orders = [];
let selectedProducts = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 50;
let adminPass = null;

// ============================================
// Page Loader
// ============================================
function hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) loader.classList.add('hidden');
}

function setDbStatus(status) {
    const el = document.getElementById('dbStatus');
    const txt = document.getElementById('dbStatusText');
    if (!el || !txt) return;
    el.className = 'db-status ' + status;
    txt.textContent = { connected: 'En ligne', disconnected: 'Hors ligne', loading: 'Connexion...' }[status] || status;
}

// ============================================
// Get admin password (Supabase first, localStorage fallback)
// ============================================
async function fetchAdminPass() {
    const admin = _db.admin;
    if (!admin) {
        adminPass = localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
        return;
    }
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const { data, error } = await _db.admin
            .from('settings')
            .select('value')
            .eq('key', 'admin_pass')
            .single();
        clearTimeout(timer);
        if (error) throw error;
        adminPass = data?.value || localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
    } catch (err) {
        console.error('Error fetching password:', err);
        adminPass = localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
    }
}

function getPass() { return adminPass || localStorage.getItem(PASS_KEY) || DEFAULT_PASS; }

// ============================================
// Supabase Helpers with timeout + cache
// ============================================
async function fetchProducts() {
    const cacheKey = 'ipstore25_cache_admin_products';

    if (!_db.admin) {
        adminProducts = JSON.parse(localStorage.getItem('ipstore25_products')) || [];
        return;
    }
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const { data, error } = await _db.admin
            .from('products')
            .select('*')
            .order('id', { ascending: true });
        clearTimeout(timer);
        if (error) throw error;
        adminProducts = data.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category_id,
            price: parseFloat(p.price),
            oldPrice: p.old_price ? parseFloat(p.old_price) : null,
            emoji: p.emoji || '📱',
            image: p.image_url,
            badge: p.badge,
            desc: p.description || '',
            stock: p.stock || 'En stock'
        }));
        localStorage.setItem(cacheKey, JSON.stringify(adminProducts));
    } catch (err) {
        console.error('Error:', err);
        const cached = localStorage.getItem(cacheKey);
        adminProducts = cached ? JSON.parse(cached) : JSON.parse(localStorage.getItem('ipstore25_products')) || [];
    }
}

async function fetchOrders() {
    const cacheKey = 'ipstore25_cache_admin_orders';

    if (!_db.admin) {
        orders = JSON.parse(localStorage.getItem('ipstore25_orders')) || [];
        return;
    }
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const { data, error } = await _db.admin
            .from('orders')
            .select('*')
            .order('id', { ascending: false });
        clearTimeout(timer);
        if (error) throw error;
        orders = data.map(o => ({
            id: o.id,
            orderNumber: o.order_number,
            customer: o.customer_name,
            phone: o.customer_phone,
            email: o.customer_email,
            address: o.shipping_address,
            city: o.shipping_city,
            status: o.status,
            paymentMethod: o.payment_method,
            paymentStatus: o.payment_status,
            subtotal: parseFloat(o.subtotal),
            shipping: parseFloat(o.shipping_cost),
            total: parseFloat(o.total),
            notes: o.notes,
            date: new Date(o.created_at).toLocaleDateString('fr-FR')
        }));
        localStorage.setItem(cacheKey, JSON.stringify(orders));
    } catch (err) {
        console.error('Error:', err);
        const cached = localStorage.getItem(cacheKey);
        orders = cached ? JSON.parse(cached) : JSON.parse(localStorage.getItem('ipstore25_orders')) || [];
    }
}

async function saveProductToDB(product) {
    if (!_db.admin) return true;
    try {
        const dbProduct = {
            name: product.name,
            category_id: product.category,
            price: product.price,
            old_price: product.oldPrice,
            emoji: product.emoji,
            image_url: product.image,
            badge: product.badge,
            description: product.desc,
            stock: product.stock
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);

        if (product.dbId) {
            const { error } = await _db.admin
                .from('products')
                .update(dbProduct)
                .eq('id', product.dbId);
            clearTimeout(timer);
            if (error) throw error;
        } else {
            const { error } = await _db.admin
                .from('products')
                .insert([dbProduct]);
            clearTimeout(timer);
            if (error) throw error;
        }
        return true;
    } catch (err) {
        console.error('Error saving product:', err);
        return false;
    }
}

async function deleteProductFromDB(id) {
    if (!_db.admin) return true;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const { error } = await _db.admin
            .from('products')
            .delete()
            .eq('id', id);
        clearTimeout(timer);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Error deleting product:', err);
        return false;
    }
}

async function updateOrderStatusDB(id, status) {
    if (!_db.admin) return true;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const { error } = await _db.admin
            .from('orders')
            .update({ status: status })
            .eq('id', id);
        clearTimeout(timer);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Error:', err);
        return false;
    }
}

// ============================================
// REAL-TIME: Admin subscriptions
// ============================================
function setupAdminRealtime() {
    if (!_db.admin) return;

    _db.admin
        .channel('admin-products')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
            await fetchProducts();
            renderProductsTable();
            renderDashboard();
        })
        .subscribe();

    _db.admin
        .channel('admin-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
            await fetchOrders();
            renderOrdersTable();
            renderDashboard();
        })
        .subscribe();
}

// ============================================
// Login
// ============================================
function adminLogin() {
    const v = document.getElementById('loginPassword').value;
    if (v === getPass()) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('adminLayout').style.display = 'flex';
        initAdmin();
    } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('loginPassword').value = '';
    }
}

async function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value.trim();
    const confirmPass = document.getElementById('confirmPassword').value.trim();

    if (current !== getPass()) {
        showToast('Mot de passe actuel incorrect!', 'error');
        return;
    }
    if (!newPass || newPass.length < 4) {
        showToast('Min 4 caractères', 'error');
        return;
    }
    if (newPass !== confirmPass) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
    }

    // Save to Supabase first
    let savedToDb = false;
    if (_db.admin) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const { data, error } = await _db.admin
                .from('settings')
                .upsert({ key: 'admin_pass', value: newPass }, { onConflict: 'key' })
                .select();
            clearTimeout(timer);
            if (error) throw error;
            savedToDb = true;
        } catch (err) {
            console.error('Error saving password to Supabase:', err);
            showToast('Erreur sauvegarde DB: ' + (err.message || err), 'error');
            return;
        }
    }

    // Only update locally if DB write succeeded
    if (savedToDb) {
        localStorage.setItem(PASS_KEY, newPass);
        adminPass = newPass;
    }

    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showToast('Mot de passe changé avec succès!', 'success');
}

async function initAdmin() {
    await fetchAdminPass();
    await Promise.all([fetchProducts(), fetchOrders(), loadSettingsIntoForm()]);
    renderDashboard();
    renderProductsTable();
    renderOrdersTable();
    setupAdminRealtime();
}

function showSection(name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('section-' + name).classList.add('active');
    if (event && event.target) event.target.closest('.nav-item').classList.add('active');
    if (name === 'dashboard') renderDashboard();
    if (name === 'products') renderProductsTable();
    if (name === 'orders') renderOrdersTable();
    if (name === 'settings') loadSettingsIntoForm();
}

function getCatLabel(c) {
    return { telephone:'Téléphone', ecran:'Écran', batterie:'Batterie', camera:'Caméra', boitier:'Boîtier', accessoire:'Accessoire', outils:'Outils' }[c] || c;
}

function renderDashboard() {
    document.getElementById('totalProducts').textContent = adminProducts.length;
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('totalRevenue').textContent = orders.reduce((s, o) => s + o.total, 0).toLocaleString('fr-DZ');

    const tbody = document.getElementById('recentOrdersBody');
    tbody.innerHTML = orders.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Aucune commande</td></tr>' :
        orders.slice(0, 5).map(o => `<tr><td>${o.id}</td><td>${o.customer}</td><td>${o.total.toLocaleString('fr-DZ')} DA</td><td><span class="order-status status-${o.status}">${{pending:'En attente',confirmed:'Confirmée',shipped:'Expédiée',delivered:'Livrée'}[o.status]}</span></td></tr>`).join('');

    const top = document.getElementById('topProductsList');
    const tp = [...adminProducts].sort((a, b) => b.price - a.price).slice(0, 5);
    top.innerHTML = tp.length === 0 ? '<p style="color:var(--text-muted);text-align:center;font-size:13px">Aucun produit</p>' :
        tp.map((p, i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-light)"><span style="width:24px;height:24px;border-radius:6px;background:rgba(0,122,255,0.08);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${i + 1}</span><div style="flex:1"><div style="font-size:13px;font-weight:500">${p.emoji} ${p.name}</div><div style="font-size:11px;color:var(--text-muted)">${p.stock}</div></div><div style="font-size:13px;font-weight:600;color:var(--accent)">${p.price.toLocaleString('fr-DZ')} DA</div></div>`).join('');
}

function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    const totalPages = Math.ceil(adminProducts.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = adminProducts.slice(start, start + ITEMS_PER_PAGE);

    if (adminProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px"><i class="fas fa-box-open" style="font-size:28px;margin-bottom:8px;display:block;opacity:0.4"></i>Aucun produit</td></tr>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = paginated.map(p => `<tr>
        <td><input type="checkbox" class="product-checkbox" value="${p.id}" onchange="updateSelectedProducts()"></td>
        <td>${p.id}</td>
        <td><div class="product-cell"><div class="product-thumb">${p.image ? `<img src="${p.image}" alt="" loading="lazy">` : p.emoji}</div><span>${p.name}</span></div></td>
        <td><span class="cat-badge cat-${p.category}">${getCatLabel(p.category)}</span></td>
        <td><strong>${p.price.toLocaleString('fr-DZ')} DA</strong></td>
        <td><span class="stock-badge">${p.stock}</span></td>
        <td><div class="actions-cell"><button class="action-btn" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button></div></td>
    </tr>`).join('');

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pag = document.getElementById('pagination');
    if (totalPages <= 1) { pag.innerHTML = ''; return; }

    let html = '';
    html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span class="page-dots">...</span>`;
        }
    }

    html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    html += `<span class="page-info">${adminProducts.length} produit(s)</span>`;

    pag.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(adminProducts.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderProductsTable();
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">Aucune commande</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => `<tr>
        <td>${o.id}</td><td>${o.customer}</td><td>${o.phone}</td>
        <td><strong>${o.total.toLocaleString('fr-DZ')} DA</strong></td>
        <td><span class="order-status status-${o.status}">${{pending:'En attente',confirmed:'Confirmée',shipped:'Expédiée',delivered:'Livrée'}[o.status]}</span></td>
        <td>${o.date}</td>
        <td><div class="actions-cell"><button class="action-btn" onclick="changeOrderStatus(${o.id})"><i class="fas fa-sync"></i></button></div></td>
    </tr>`).join('');
}

function filterAdminProducts() {
    const cat = document.getElementById('filterCategory').value;
    const s = document.getElementById('adminSearch').value.toLowerCase();
    let f = adminProducts;
    if (cat !== 'all') f = f.filter(p => p.category === cat);
    if (s) f = f.filter(p => p.name.toLowerCase().includes(s) || p.desc.toLowerCase().includes(s));

    currentPage = 1;

    const tbody = document.getElementById('productsTableBody');
    if (f.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">Aucun résultat</td></tr>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(f.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = f.slice(start, start + ITEMS_PER_PAGE);

    tbody.innerHTML = paginated.map(p => `<tr>
        <td><input type="checkbox" class="product-checkbox" value="${p.id}" onchange="updateSelectedProducts()"></td>
        <td>${p.id}</td>
        <td><div class="product-cell"><div class="product-thumb">${p.image ? `<img src="${p.image}" alt="" loading="lazy">` : p.emoji}</div><span>${p.name}</span></div></td>
        <td><span class="cat-badge cat-${p.category}">${getCatLabel(p.category)}</span></td>
        <td><strong>${p.price.toLocaleString('fr-DZ')} DA</strong></td>
        <td><span class="stock-badge">${p.stock}</span></td>
        <td><div class="actions-cell"><button class="action-btn" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button></div></td>
    </tr>`).join('');

    renderPagination(totalPages);
}

function openProductModal(id = null) {
    const m = document.getElementById('productModal');
    if (id) {
        const p = adminProducts.find(x => x.id === id);
        document.getElementById('productModalTitle').textContent = 'Modifier';
        document.getElementById('editProductId').value = id;
        document.getElementById('prodName').value = p.name;
        document.getElementById('prodCategory').value = p.category;
        document.getElementById('prodPrice').value = p.price;
        document.getElementById('prodOldPrice').value = p.oldPrice || '';
        document.getElementById('prodEmoji').value = p.emoji;
        document.getElementById('prodBadge').value = p.badge || '';
        document.getElementById('prodDesc').value = p.desc;
        document.getElementById('prodImageUrl').value = p.image || '';
        if (p.image) {
            document.getElementById('imagePreview').innerHTML = `<img src="${p.image}" alt="">`;
        } else {
            document.getElementById('imagePreview').innerHTML = '';
        }
    } else {
        document.getElementById('productModalTitle').textContent = 'Ajouter un Produit';
        document.getElementById('editProductId').value = '';
        document.getElementById('prodName').value = '';
        document.getElementById('prodCategory').value = 'telephone';
        document.getElementById('prodPrice').value = '';
        document.getElementById('prodOldPrice').value = '';
        document.getElementById('prodEmoji').value = '📱';
        document.getElementById('prodBadge').value = '';
        document.getElementById('prodDesc').value = '';
        document.getElementById('prodImageUrl').value = '';
        document.getElementById('imagePreview').innerHTML = '';
    }
    m.classList.add('open');
}

function closeProductModal() { document.getElementById('productModal').classList.remove('open'); }

function previewImageUrl() {
    const url = document.getElementById('prodImageUrl').value.trim();
    const preview = document.getElementById('imagePreview');
    if (url) {
        preview.innerHTML = `<img src="${url}" alt="" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-image\\' style=\\'font-size:32px;color:var(--text-muted)\\'></i>'">`;
    } else {
        preview.innerHTML = '';
    }
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image max 5MB', 'error');
        return;
    }

    if (!file.type.startsWith('image/')) {
        showToast('Fichier invalide', 'error');
        return;
    }

    const preview = document.getElementById('imagePreview');
    const loader = document.getElementById('uploadLoader');
    loader.style.display = 'block';
    loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Upload en cours...';

    const reader = new FileReader();
    reader.onload = function(ev) {
        preview.innerHTML = `<img src="${ev.target.result}" alt="">`;
    };
    reader.readAsDataURL(file);

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        loader.style.display = 'none';

        if (data.secure_url) {
            document.getElementById('prodImageUrl').value = data.secure_url;
            preview.innerHTML = `<img src="${data.secure_url}" alt="">`;
            showToast('Image uploadée!', 'success');
        } else {
            const errMsg = data.error?.message || JSON.stringify(data);
            console.error('[Upload]', errMsg);
            showToast('Erreur: ' + errMsg, 'error');
            preview.innerHTML = '';
        }
    } catch (err) {
        loader.style.display = 'none';
        console.error('[Upload] Network error:', err);
        showToast('Erreur réseau: ' + err.message, 'error');
    }
}

async function saveProduct() {
    const id = document.getElementById('editProductId').value;
    const name = document.getElementById('prodName').value.trim();
    const category = document.getElementById('prodCategory').value;
    const price = parseInt(document.getElementById('prodPrice').value);
    const oldPrice = parseInt(document.getElementById('prodOldPrice').value) || null;
    const emoji = document.getElementById('prodEmoji').value || '📱';
    const badge = document.getElementById('prodBadge').value || null;
    const desc = document.getElementById('prodDesc').value.trim();
    const image = document.getElementById('prodImageUrl').value.trim() || null;

    if (!name || !price) { showToast('Remplissez les champs obligatoires', 'error'); return; }

    const product = { name, category, price, oldPrice, emoji, badge, desc, image, stock: "En stock" };

    if (id) {
        const existing = adminProducts.find(x => x.id === parseInt(id));
        if (existing) {
            product.dbId = existing.dbId || existing.id;
            Object.assign(existing, product);
        }
    } else {
        const newId = adminProducts.length > 0 ? Math.max(...adminProducts.map(p => p.id)) + 1 : 1;
        product.id = newId;
        adminProducts.push(product);
    }

    const saved = await saveProductToDB(product);
    if (saved) {
        showToast(id ? 'Produit modifié!' : 'Produit ajouté!', 'success');
    } else {
        showToast('Erreur de sauvegarde', 'error');
    }

    saveProducts(); renderProductsTable(); renderDashboard(); closeProductModal();
}

function editProduct(id) { openProductModal(id); }

async function deleteProduct(id) {
    if (!confirm('Supprimer?')) return;

    const deleted = await deleteProductFromDB(id);
    if (deleted) {
        adminProducts = adminProducts.filter(p => p.id !== id);
        saveProducts(); renderProductsTable(); renderDashboard();
        showToast('Supprimé', 'success');
    } else {
        showToast('Erreur de suppression', 'error');
    }
}

function updateSelectedProducts() {
    selectedProducts = Array.from(document.querySelectorAll('.product-checkbox:checked')).map(cb => parseInt(cb.value));
    document.getElementById('deleteSelectedBtn').style.display = selectedProducts.length > 0 ? 'inline-flex' : 'none';
}

function toggleSelectAll() {
    const c = document.getElementById('selectAll').checked;
    document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = c);
    updateSelectedProducts();
}

async function deleteSelected() {
    if (!confirm(`Supprimer ${selectedProducts.length} produit(s)?`)) return;
    for (const id of selectedProducts) {
        await deleteProductFromDB(id);
    }
    adminProducts = adminProducts.filter(p => !selectedProducts.includes(p.id));
    saveProducts(); renderProductsTable(); renderDashboard();
    selectedProducts = []; document.getElementById('deleteSelectedBtn').style.display = 'none';
    showToast('Supprimés', 'success');
}

async function changeOrderStatus(id) {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    const s = ['pending', 'confirmed', 'shipped', 'delivered'];
    const newStatus = s[(s.indexOf(o.status) + 1) % s.length];

    await updateOrderStatusDB(id, newStatus);
    o.status = newStatus;

    renderOrdersTable(); renderDashboard();
    showToast('Statut: ' + {pending:'En attente',confirmed:'Confirmée',shipped:'Expédiée',delivered:'Livrée'}[o.status], 'success');
}

function saveProducts() { localStorage.setItem('ipstore25_products', JSON.stringify(adminProducts)); }

async function saveSettings() {
    const name = document.getElementById('storeName').value.trim();
    const email = document.getElementById('storeEmail').value.trim();
    const phone = document.getElementById('storePhone').value.trim();

    if (!_db.admin) {
        showToast('Pas de connexion DB', 'error');
        return;
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);

        const updates = [
            _db.admin.from('settings').upsert({ key: 'store_name', value: name }, { onConflict: 'key' }),
            _db.admin.from('settings').upsert({ key: 'store_email', value: email }, { onConflict: 'key' }),
            _db.admin.from('settings').upsert({ key: 'store_phone', value: phone }, { onConflict: 'key' })
        ];

        const results = await Promise.all(updates);
        clearTimeout(timer);

        const hasError = results.some(r => r.error);
        if (hasError) throw results.find(r => r.error).error;

        showToast('Paramètres enregistrés!', 'success');
    } catch (err) {
        console.error('Error saving settings:', err);
        showToast('Erreur de sauvegarde', 'error');
    }
}

async function loadSettingsIntoForm() {
    if (!_db.admin) return;
    try {
        const { data, error } = await _db.admin.from('settings').select('key, value').in('key', ['store_name', 'store_email', 'store_phone']);
        if (error) throw error;
        if (data) {
            data.forEach(s => {
                if (s.key === 'store_name' && s.value) document.getElementById('storeName').value = s.value;
                if (s.key === 'store_email' && s.value) document.getElementById('storeEmail').value = s.value;
                if (s.key === 'store_phone' && s.value) document.getElementById('storePhone').value = s.value;
            });
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
}

function exportData() {
    const d = { products: adminProducts, orders, settings: { password: getPass() }, date: new Date().toISOString() };
    const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = `ipstore25-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    showToast('Exporté!', 'success');
}

function importData(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = function(ev) {
        try {
            const d = JSON.parse(ev.target.result);
            if (d.products) { adminProducts = d.products; saveProducts(); }
            if (d.orders) { orders = d.orders; localStorage.setItem('ipstore25_orders', JSON.stringify(orders)); }
            if (d.settings && d.settings.password) { localStorage.setItem(PASS_KEY, d.settings.password); adminPass = d.settings.password; }
            renderProductsTable(); renderOrdersTable(); renderDashboard();
            showToast('Importé!', 'success');
        } catch (err) { showToast('Erreur', 'error'); }
    };
    r.readAsText(f);
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
