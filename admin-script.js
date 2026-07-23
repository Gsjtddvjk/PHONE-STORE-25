var PASS_KEY = 'nassimmobile_admin_pass';
var DEFAULT_PASS = 'admin123';
var CLOUDINARY_CLOUD = 'qqftt7fm';
var CLOUDINARY_PRESET = 'nassimmobile_preset';

var adminProducts = [];
var orders = [];
var selectedProducts = [];
var currentPage = 1;
var ITEMS_PER_PAGE = 50;
var adminPass = null;

function hidePageLoader() {
    var loader = document.getElementById('pageLoader');
    if (loader) loader.classList.add('hidden');
}

function setDbStatus(status) {
    var el = document.getElementById('dbStatus');
    var txt = document.getElementById('dbStatusText');
    if (!el || !txt) return;
    el.className = 'db-status ' + status;
    txt.textContent = { connected: 'En ligne', disconnected: 'Hors ligne', loading: 'Connexion...' }[status] || status;
}

async function fetchAdminPass() {
    var admin = _db.admin;
    if (!admin) {
        adminPass = localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
        return;
    }
    try {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 10000);
        var result = await _db.admin
            .from('settings')
            .select('value')
            .eq('key', 'admin_pass')
            .single();
        clearTimeout(timer);
        if (result.error) throw result.error;
        adminPass = (result.data && result.data.value) || localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
    } catch (err) {
        console.error('Error fetching password:', err);
        adminPass = localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
    }
}

function getPass() { return adminPass || localStorage.getItem(PASS_KEY) || DEFAULT_PASS; }

async function fetchProducts() {
    var cacheKey = 'nassimmobile_cache_admin_products';

    if (!_db.admin) {
        adminProducts = JSON.parse(localStorage.getItem('nassimmobile_products')) || [];
        return;
    }
    try {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 10000);
        var result = await _db.admin
            .from('products')
            .select('*')
            .order('id', { ascending: true });
        clearTimeout(timer);
        if (result.error) throw result.error;
        adminProducts = result.data.map(function(p) {
            return {
                id: p.id, name: p.name, category: p.category_id,
                price: parseFloat(p.price),
                oldPrice: p.old_price ? parseFloat(p.old_price) : null,
                emoji: p.emoji || '📱',
                image: p.image_url,
                image2: p.image_url2 || null,
                image3: p.image_url3 || null,
                badge: p.badge,
                desc: p.description || '',
                stock: p.stock || 'En stock'
            };
        });
        localStorage.setItem(cacheKey, JSON.stringify(adminProducts));
    } catch (err) {
        console.error('Error:', err);
        var cached = localStorage.getItem(cacheKey);
        adminProducts = cached ? JSON.parse(cached) : JSON.parse(localStorage.getItem('nassimmobile_products')) || [];
    }
}

async function fetchOrders() {
    var cacheKey = 'nassimmobile_cache_admin_orders';

    if (!_db.admin) {
        orders = JSON.parse(localStorage.getItem('nassimmobile_orders')) || [];
        return;
    }
    try {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 10000);
        var result = await _db.admin
            .from('orders')
            .select('*')
            .order('id', { ascending: false });
        clearTimeout(timer);
        if (result.error) throw result.error;
        orders = result.data.map(function(o) {
            return {
                id: o.id, orderNumber: o.order_number,
                customer: o.customer_name, phone: o.customer_phone, email: o.customer_email,
                address: o.shipping_address, city: o.shipping_city,
                status: o.status, paymentMethod: o.payment_method, paymentStatus: o.payment_status,
                subtotal: parseFloat(o.subtotal), shipping: parseFloat(o.shipping_cost), total: parseFloat(o.total),
                notes: o.notes,
                date: new Date(o.created_at).toLocaleDateString('fr-FR')
            };
        });
        localStorage.setItem(cacheKey, JSON.stringify(orders));
    } catch (err) {
        console.error('Error:', err);
        var cached = localStorage.getItem(cacheKey);
        orders = cached ? JSON.parse(cached) : JSON.parse(localStorage.getItem('nassimmobile_orders')) || [];
    }
}

var CATEGORY_MAP = {
    telephone: 1, ecran: 2, batterie: 3, camera: 4,
    boitier: 5, accessoire: 6, outils: 7, gaming: 8
};

async function saveProductToDB(product) {
    if (!_db.admin) return true;
    try {
        var categoryId = CATEGORY_MAP[product.category] || 1;
        var dbProduct = {
            name: product.name,
            category_id: categoryId,
            price: product.price,
            old_price: product.oldPrice,
            emoji: product.emoji,
            image_url: product.image,
            image_url2: product.image2 || null,
            image_url3: product.image3 || null,
            badge: product.badge,
            description: product.desc,
            stock: product.stock
        };

        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 10000);

        if (product.dbId) {
            var result = await _db.admin
                .from('products')
                .update(dbProduct)
                .eq('id', product.dbId)
                .select();
            clearTimeout(timer);
            if (result.error) throw result.error;
        } else {
            var result = await _db.admin
                .from('products')
                .insert([dbProduct])
                .select();
            clearTimeout(timer);
            if (result.error) throw result.error;
            if (result.data && result.data[0]) product.dbId = result.data[0].id;
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
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 10000);
        var result = await _db.admin
            .from('products')
            .delete()
            .eq('id', id);
        clearTimeout(timer);
        if (result.error) throw result.error;
        return true;
    } catch (err) {
        console.error('Error deleting product:', err);
        return false;
    }
}

async function updateOrderStatusDB(id, status) {
    if (!_db.admin) return true;
    try {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 10000);
        var result = await _db.admin
            .from('orders')
            .update({ status: status })
            .eq('id', id);
        clearTimeout(timer);
        if (result.error) throw result.error;
        return true;
    } catch (err) {
        console.error('Error:', err);
        return false;
    }
}

function setupAdminRealtime() {
    if (!_db.admin) return;

    _db.admin
        .channel('admin-products')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async function() {
            await fetchProducts();
            renderProductsTable();
            renderDashboard();
        })
        .subscribe();

    _db.admin
        .channel('admin-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async function() {
            await fetchOrders();
            renderOrdersTable();
            renderDashboard();
        })
        .subscribe();
}

function adminLogin() {
    var v = document.getElementById('loginPassword').value;
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
    var current = document.getElementById('currentPassword').value;
    var newPass = document.getElementById('newPassword').value.trim();
    var confirmPass = document.getElementById('confirmPassword').value.trim();

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

    var savedToDb = false;
    if (_db.admin) {
        try {
            var controller = new AbortController();
            var timer = setTimeout(function() { controller.abort(); }, 10000);
            var result = await _db.admin
                .from('settings')
                .upsert({ key: 'admin_pass', value: newPass }, { onConflict: 'key' })
                .select();
            clearTimeout(timer);
            if (result.error) throw result.error;
            savedToDb = true;
        } catch (err) {
            console.error('Error saving password to Supabase:', err);
            showToast('Erreur sauvegarde DB: ' + (err.message || err), 'error');
            return;
        }
    }

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
    await Promise.all([fetchProducts(), fetchOrders(), loadSettingsIntoForm(), loadCustomerOrders()]);
    renderDashboard();
    renderProductsTable();
    renderOrdersTable();
    setupAdminRealtime();
}

function showSection(name) {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    document.getElementById('section-' + name).classList.add('active');
    if (typeof event !== 'undefined' && event && event.target) event.target.closest('.nav-item').classList.add('active');
    if (name === 'dashboard') renderDashboard();
    if (name === 'products') renderProductsTable();
    if (name === 'orders') renderOrdersTable();
    if (name === 'settings') loadSettingsIntoForm();
    if (name === 'customer-orders') loadCustomerOrders();
}

function getCatLabel(c) {
    return { telephone: 'Téléphone', ecran: 'Écran', batterie: 'Batterie', camera: 'Caméra', boitier: 'Boîtier', accessoire: 'Accessoire', outils: 'Outils', gaming: 'Gaming' }[c] || c;
}

function renderDashboard() {
    document.getElementById('totalProducts').textContent = adminProducts.length;
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('totalRevenue').textContent = orders.reduce(function(s, o) { return s + o.total; }, 0).toLocaleString('fr-DZ');

    var tbody = document.getElementById('recentOrdersBody');
    var statusLabels = { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée' };
    tbody.innerHTML = orders.length === 0
        ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Aucune commande</td></tr>'
        : orders.slice(0, 5).map(function(o) {
            return '<tr><td>' + o.id + '</td><td>' + o.customer + '</td><td>' + o.total.toLocaleString('fr-DZ') + ' DA</td><td><span class="order-status status-' + o.status + '">' + (statusLabels[o.status] || o.status) + '</span></td></tr>';
        }).join('');

    var top = document.getElementById('topProductsList');
    var tp = adminProducts.slice().sort(function(a, b) { return b.price - a.price; }).slice(0, 5);
    top.innerHTML = tp.length === 0
        ? '<p style="color:var(--text-muted);text-align:center;font-size:13px">Aucun produit</p>'
        : tp.map(function(p, i) {
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-light)"><span style="width:24px;height:24px;border-radius:6px;background:rgba(0,122,255,0.08);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">' + (i + 1) + '</span><div style="flex:1"><div style="font-size:13px;font-weight:500">' + p.emoji + ' ' + p.name + '</div><div style="font-size:11px;color:var(--text-muted)">' + p.stock + '</div></div><div style="font-size:13px;font-weight:600;color:var(--accent)">' + p.price.toLocaleString('fr-DZ') + ' DA</div></div>';
        }).join('');
}

function renderProductsTable() {
    var tbody = document.getElementById('productsTableBody');
    var totalPages = Math.ceil(adminProducts.length / ITEMS_PER_PAGE);
    var start = (currentPage - 1) * ITEMS_PER_PAGE;
    var paginated = adminProducts.slice(start, start + ITEMS_PER_PAGE);

    if (adminProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px"><i class="fas fa-box-open" style="font-size:28px;margin-bottom:8px;display:block;opacity:0.4"></i>Aucun produit</td></tr>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = paginated.map(function(p) {
        return '<tr>' +
            '<td><input type="checkbox" class="product-checkbox" value="' + p.id + '" onchange="updateSelectedProducts()"></td>' +
            '<td>' + p.id + '</td>' +
            '<td><div class="product-cell"><div class="product-thumb">' + (p.image ? '<img src="' + p.image + '" alt="" loading="lazy">' : p.emoji) + '</div><span>' + p.name + '</span></div></td>' +
            '<td><span class="cat-badge cat-' + p.category + '">' + getCatLabel(p.category) + '</span></td>' +
            '<td><strong>' + p.price.toLocaleString('fr-DZ') + ' DA</strong></td>' +
            '<td><span class="stock-badge">' + p.stock + '</span></td>' +
            '<td><div class="actions-cell"><button class="action-btn" onclick="editProduct(' + p.id + ')"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteProduct(' + p.id + ')"><i class="fas fa-trash"></i></button></div></td>' +
        '</tr>';
    }).join('');

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    var pag = document.getElementById('pagination');
    if (totalPages <= 1) { pag.innerHTML = ''; return; }

    var html = '';
    html += '<button class="page-btn" onclick="goToPage(' + (currentPage - 1) + ')" ' + (currentPage === 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';

    for (var i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += '<button class="page-btn ' + (i === currentPage ? 'active' : '') + '" onclick="goToPage(' + i + ')">' + i + '</button>';
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<span class="page-dots">...</span>';
        }
    }

    html += '<button class="page-btn" onclick="goToPage(' + (currentPage + 1) + ')" ' + (currentPage === totalPages ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
    html += '<span class="page-info">' + adminProducts.length + ' produit(s)</span>';

    pag.innerHTML = html;
}

function goToPage(page) {
    var totalPages = Math.ceil(adminProducts.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderProductsTable();
}

function renderOrdersTable() {
    var tbody = document.getElementById('ordersTableBody');
    var statusLabels = { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée' };
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">Aucune commande</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(function(o) {
        return '<tr>' +
            '<td>' + o.id + '</td><td>' + o.customer + '</td><td>' + o.phone + '</td>' +
            '<td><strong>' + o.total.toLocaleString('fr-DZ') + ' DA</strong></td>' +
            '<td><span class="order-status status-' + o.status + '">' + (statusLabels[o.status] || o.status) + '</span></td>' +
            '<td>' + o.date + '</td>' +
            '<td><div class="actions-cell"><button class="action-btn" onclick="changeOrderStatus(' + o.id + ')"><i class="fas fa-sync"></i></button></div></td>' +
        '</tr>';
    }).join('');
}

function filterAdminProducts() {
    var cat = document.getElementById('filterCategory').value;
    var s = document.getElementById('adminSearch').value.toLowerCase();
    var f = adminProducts;
    if (cat !== 'all') f = f.filter(function(p) { return p.category === cat; });
    if (s) f = f.filter(function(p) { return p.name.toLowerCase().indexOf(s) !== -1 || p.desc.toLowerCase().indexOf(s) !== -1; });

    currentPage = 1;

    var tbody = document.getElementById('productsTableBody');
    var statusLabels = { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée' };
    if (f.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">Aucun résultat</td></tr>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    var totalPages = Math.ceil(f.length / ITEMS_PER_PAGE);
    var start = (currentPage - 1) * ITEMS_PER_PAGE;
    var paginated = f.slice(start, start + ITEMS_PER_PAGE);

    tbody.innerHTML = paginated.map(function(p) {
        return '<tr>' +
            '<td><input type="checkbox" class="product-checkbox" value="' + p.id + '" onchange="updateSelectedProducts()"></td>' +
            '<td>' + p.id + '</td>' +
            '<td><div class="product-cell"><div class="product-thumb">' + (p.image ? '<img src="' + p.image + '" alt="" loading="lazy">' : p.emoji) + '</div><span>' + p.name + '</span></div></td>' +
            '<td><span class="cat-badge cat-' + p.category + '">' + getCatLabel(p.category) + '</span></td>' +
            '<td><strong>' + p.price.toLocaleString('fr-DZ') + ' DA</strong></td>' +
            '<td><span class="stock-badge">' + p.stock + '</span></td>' +
            '<td><div class="actions-cell"><button class="action-btn" onclick="editProduct(' + p.id + ')"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteProduct(' + p.id + ')"><i class="fas fa-trash"></i></button></div></td>' +
        '</tr>';
    }).join('');

    renderPagination(totalPages);
}

function openProductModal(id) {
    var m = document.getElementById('productModal');
    if (id) {
        var p = adminProducts.find(function(x) { return x.id === id; });
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
        if (document.getElementById('prodImageUrl2')) document.getElementById('prodImageUrl2').value = p.image2 || '';
        if (document.getElementById('prodImageUrl3')) document.getElementById('prodImageUrl3').value = p.image3 || '';
        if (p.image) {
            document.getElementById('imagePreview').innerHTML = '<img src="' + p.image + '" alt="">';
        } else {
            document.getElementById('imagePreview').innerHTML = '';
        }
        if (document.getElementById('imagePreview2') && p.image2) {
            document.getElementById('imagePreview2').innerHTML = '<img src="' + p.image2 + '" alt="">';
        }
        if (document.getElementById('imagePreview3') && p.image3) {
            document.getElementById('imagePreview3').innerHTML = '<img src="' + p.image3 + '" alt="">';
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
        if (document.getElementById('prodImageUrl2')) document.getElementById('prodImageUrl2').value = '';
        if (document.getElementById('prodImageUrl3')) document.getElementById('prodImageUrl3').value = '';
        if (document.getElementById('imagePreview2')) document.getElementById('imagePreview2').innerHTML = '';
        if (document.getElementById('imagePreview3')) document.getElementById('imagePreview3').innerHTML = '';
    }
    m.classList.add('open');
}

function closeProductModal() { document.getElementById('productModal').classList.remove('open'); }

function previewImageUrl() {
    var url = document.getElementById('prodImageUrl').value.trim();
    var preview = document.getElementById('imagePreview');
    if (url) {
        preview.innerHTML = '<img src="' + url + '" alt="" onerror="this.parentElement.innerHTML=\'\'">';
    } else {
        preview.innerHTML = '';
    }
}

async function handleImageUpload(e) {
    var file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { showToast('Image max 5MB', 'error'); return; }
    if (!file.type.startsWith('image/')) { showToast('Fichier invalide', 'error'); return; }

    var preview = document.getElementById('imagePreview');
    var loader = document.getElementById('uploadLoader');
    loader.style.display = 'block';
    loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Upload en cours...';

    var reader = new FileReader();
    reader.onload = function(ev) { preview.innerHTML = '<img src="' + ev.target.result + '" alt="">'; };
    reader.readAsDataURL(file);

    try {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);

        var res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', {
            method: 'POST', body: formData
        });

        var data = await res.json();
        loader.style.display = 'none';

        if (data.secure_url) {
            document.getElementById('prodImageUrl').value = data.secure_url;
            preview.innerHTML = '<img src="' + data.secure_url + '" alt="">';
            showToast('Image uploadée!', 'success');
        } else {
            var errMsg = (data.error && data.error.message) || JSON.stringify(data);
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

async function handleImageUpload2(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image max 5MB', 'error'); return; }
    var preview = document.getElementById('imagePreview2');
    var loader = document.getElementById('uploadLoader2');
    loader.style.display = 'block';
    var reader = new FileReader();
    reader.onload = function(ev) { preview.innerHTML = '<img src="' + ev.target.result + '" alt="">'; };
    reader.readAsDataURL(file);
    try {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);
        var res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method: 'POST', body: formData });
        var data = await res.json();
        loader.style.display = 'none';
        if (data.secure_url) {
            document.getElementById('prodImageUrl2').value = data.secure_url;
            preview.innerHTML = '<img src="' + data.secure_url + '" alt="">';
            showToast('Image 2 uploadée!', 'success');
        } else { showToast('Erreur upload', 'error'); preview.innerHTML = ''; }
    } catch (err) { loader.style.display = 'none'; showToast('Erreur réseau', 'error'); }
}

async function handleImageUpload3(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image max 5MB', 'error'); return; }
    var preview = document.getElementById('imagePreview3');
    var loader = document.getElementById('uploadLoader3');
    loader.style.display = 'block';
    var reader = new FileReader();
    reader.onload = function(ev) { preview.innerHTML = '<img src="' + ev.target.result + '" alt="">'; };
    reader.readAsDataURL(file);
    try {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);
        var res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method: 'POST', body: formData });
        var data = await res.json();
        loader.style.display = 'none';
        if (data.secure_url) {
            document.getElementById('prodImageUrl3').value = data.secure_url;
            preview.innerHTML = '<img src="' + data.secure_url + '" alt="">';
            showToast('Image 3 uploadée!', 'success');
        } else { showToast('Erreur upload', 'error'); preview.innerHTML = ''; }
    } catch (err) { loader.style.display = 'none'; showToast('Erreur réseau', 'error'); }
}

function previewImageUrl2() {
    var url = document.getElementById('prodImageUrl2').value.trim();
    var preview = document.getElementById('imagePreview2');
    if (url) preview.innerHTML = '<img src="' + url + '" alt="" onerror="this.parentElement.innerHTML=\'\'">';
    else preview.innerHTML = '';
}

function previewImageUrl3() {
    var url = document.getElementById('prodImageUrl3').value.trim();
    var preview = document.getElementById('imagePreview3');
    if (url) preview.innerHTML = '<img src="' + url + '" alt="" onerror="this.parentElement.innerHTML=\'\'">';
    else preview.innerHTML = '';
}

async function saveProduct() {
    var id = document.getElementById('editProductId').value;
    var name = document.getElementById('prodName').value.trim();
    var category = document.getElementById('prodCategory').value;
    var price = parseInt(document.getElementById('prodPrice').value);
    var oldPrice = parseInt(document.getElementById('prodOldPrice').value) || null;
    var emoji = document.getElementById('prodEmoji').value || '📱';
    var badge = document.getElementById('prodBadge').value || null;
    var desc = document.getElementById('prodDesc').value.trim();
    var image = document.getElementById('prodImageUrl').value.trim() || null;
    var image2 = document.getElementById('prodImageUrl2') ? document.getElementById('prodImageUrl2').value.trim() || null : null;
    var image3 = document.getElementById('prodImageUrl3') ? document.getElementById('prodImageUrl3').value.trim() || null : null;

    if (!name || !price) { showToast('Remplissez les champs obligatoires', 'error'); return; }

    var product = { name: name, category: category, price: price, oldPrice: oldPrice, emoji: emoji, badge: badge, desc: desc, image: image, image2: image2, image3: image3, stock: 'En stock' };

    if (id) {
        var existing = adminProducts.find(function(x) { return x.id === parseInt(id); });
        if (existing) {
            product.dbId = existing.dbId || existing.id;
            Object.assign(existing, product);
        }
    } else {
        var newId = adminProducts.length > 0 ? Math.max.apply(null, adminProducts.map(function(p) { return p.id; })) + 1 : 1;
        product.id = newId;
        adminProducts.push(product);
    }

    var saved = await saveProductToDB(product);
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

    var deleted = await deleteProductFromDB(id);
    if (deleted) {
        adminProducts = adminProducts.filter(function(p) { return p.id !== id; });
        saveProducts(); renderProductsTable(); renderDashboard();
        showToast('Supprimé', 'success');
    } else {
        showToast('Erreur de suppression', 'error');
    }
}

function updateSelectedProducts() {
    selectedProducts = Array.from(document.querySelectorAll('.product-checkbox:checked')).map(function(cb) { return parseInt(cb.value); });
    document.getElementById('deleteSelectedBtn').style.display = selectedProducts.length > 0 ? 'inline-flex' : 'none';
}

function toggleSelectAll() {
    var c = document.getElementById('selectAll').checked;
    document.querySelectorAll('.product-checkbox').forEach(function(cb) { cb.checked = c; });
    updateSelectedProducts();
}

async function deleteSelected() {
    if (!confirm('Supprimer ' + selectedProducts.length + ' produit(s)?')) return;
    for (var i = 0; i < selectedProducts.length; i++) {
        await deleteProductFromDB(selectedProducts[i]);
    }
    adminProducts = adminProducts.filter(function(p) { return selectedProducts.indexOf(p.id) === -1; });
    saveProducts(); renderProductsTable(); renderDashboard();
    selectedProducts = []; document.getElementById('deleteSelectedBtn').style.display = 'none';
    showToast('Supprimés', 'success');
}

async function changeOrderStatus(id) {
    var o = orders.find(function(x) { return x.id === id; });
    if (!o) return;
    var s = ['pending', 'confirmed', 'shipped', 'delivered'];
    var newStatus = s[(s.indexOf(o.status) + 1) % s.length];

    await updateOrderStatusDB(id, newStatus);
    o.status = newStatus;

    renderOrdersTable(); renderDashboard();
    var statusLabels = { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée' };
    showToast('Statut: ' + (statusLabels[o.status] || o.status), 'success');
}

function saveProducts() { localStorage.setItem('nassimmobile_products', JSON.stringify(adminProducts)); }

async function saveSettings() {
    var name = document.getElementById('storeName').value.trim();
    var email = document.getElementById('storeEmail').value.trim();
    var phone = document.getElementById('storePhone').value.trim();

    if (!_db.admin) {
        showToast('Pas de connexion DB', 'error');
        return;
    }

    try {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 10000);

        var updates = [
            _db.admin.from('settings').upsert({ key: 'store_name', value: name }, { onConflict: 'key' }),
            _db.admin.from('settings').upsert({ key: 'store_email', value: email }, { onConflict: 'key' }),
            _db.admin.from('settings').upsert({ key: 'store_phone', value: phone }, { onConflict: 'key' })
        ];

        var results = await Promise.all(updates);
        clearTimeout(timer);

        var hasError = results.some(function(r) { return r.error; });
        if (hasError) throw results.find(function(r) { return r.error; }).error;

        showToast('Paramètres enregistrés!', 'success');
    } catch (err) {
        console.error('Error saving settings:', err);
        showToast('Erreur de sauvegarde', 'error');
    }
}

async function loadSettingsIntoForm() {
    if (!_db.admin) return;
    try {
        var result = await _db.admin.from('settings').select('key, value').in('key', ['store_name', 'store_email', 'store_phone']);
        if (result.error) throw result.error;
        if (result.data) {
            result.data.forEach(function(s) {
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
    var d = { products: adminProducts, orders: orders, settings: { password: getPass() }, date: new Date().toISOString() };
    var b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'nassimmobile-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    showToast('Exporté!', 'success');
}

function importData(e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
        try {
            var d = JSON.parse(ev.target.result);
            if (d.products) { adminProducts = d.products; saveProducts(); }
            if (d.orders) { orders = d.orders; localStorage.setItem('nassimmobile_orders', JSON.stringify(orders)); }
            if (d.settings && d.settings.password) { localStorage.setItem(PASS_KEY, d.settings.password); adminPass = d.settings.password; }
            renderProductsTable(); renderOrdersTable(); renderDashboard();
            showToast('Importé!', 'success');
        } catch (err) { showToast('Erreur', 'error'); }
    };
    r.readAsText(f);
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

function showToast(msg, type) {
    type = type || 'success';
    var c = document.getElementById('toastContainer');
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check-circle' : 'exclamation-circle') + '"></i> ' + msg;
    c.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
}

var customerOrders = [];

async function loadCustomerOrders() {
    if (!_db.admin) return;
    try {
        var result = await _db.admin
            .from('customer_orders')
            .select('*')
            .order('created_at', { ascending: false });
        if (result.error) throw result.error;
        customerOrders = result.data || [];
        renderCustomerOrders();
    } catch (err) {
        console.error('Error loading customer orders:', err);
    }
}

function renderCustomerOrders() {
    var tbody = document.getElementById('customerOrdersBody');
    if (!tbody) return;
    var statusLabels = { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée' };
    if (customerOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px">Aucune commande client</td></tr>';
        return;
    }
    tbody.innerHTML = customerOrders.map(function(o) {
        var st = o.status || 'pending';
        return '<tr>' +
            '<td>' + o.id + '</td>' +
            '<td>' + (o.customer_name || '-') + '</td>' +
            '<td>' + (o.customer_phone || '-') + '</td>' +
            '<td>' + (o.customer_email || '-') + '</td>' +
            '<td>' + (o.customer_city || '-') + '</td>' +
            '<td><strong>' + parseFloat(o.total || 0).toLocaleString('fr-DZ') + ' DA</strong></td>' +
            '<td><span class="order-status status-' + st + '">' + (statusLabels[st] || st) + '</span></td>' +
            '<td>' + (o.created_at ? new Date(o.created_at).toLocaleDateString('fr-DZ') : '-') + '</td>' +
            '<td><button class="action-btn" onclick="changeCustomerOrderStatus(' + o.id + ')"><i class="fas fa-sync"></i></button></td>' +
        '</tr>';
    }).join('');
}

async function changeCustomerOrderStatus(id) {
    var statuses = ['pending', 'confirmed', 'shipped', 'delivered'];
    var o = customerOrders.find(function(x) { return x.id === id; });
    if (!o) return;
    var current = statuses.indexOf(o.status || 'pending');
    var next = statuses[(current + 1) % statuses.length];
    if (!_db.admin) return;
    try {
        var result = await _db.admin.from('customer_orders').update({ status: next }).eq('id', id);
        if (result.error) throw result.error;
        o.status = next;
        renderCustomerOrders();
        showToast('Statut mis à jour', 'success');
    } catch (err) {
        showToast('Erreur', 'error');
    }
}
