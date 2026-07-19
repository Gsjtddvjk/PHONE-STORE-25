let products = [];
let cart = JSON.parse(localStorage.getItem('ipstore25_cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('ipstore25_wishlist')) || [];
let currentModalProduct = null;
let siteSettings = {};
let dbConnected = false;
let _productsLoaded = false;

const categoryLabels = { telephone: 'Téléphones', ecran: 'Écrans', batterie: 'Batteries', camera: 'Caméras', boitier: 'Boîtiers', accessoire: 'Accessoires', outils: 'Outils', gaming: 'Gaming' };
const CAT_ID_TO_LABEL = { 1: 'Téléphones', 2: 'Écrans', 3: 'Batteries', 4: 'Caméras', 5: 'Boîtiers', 6: 'Accessoires', 7: 'Outils', 8: 'Gaming' };

const getClient = () => _db.client;
const getAdmin = () => _db.admin;

// ============================================
// DB Status
// ============================================
function setDbStatus(status) {
    var el = document.getElementById('dbStatus');
    var txt = document.getElementById('dbStatusText');
    if (!el || !txt) return;
    el.className = 'db-status ' + status;
    txt.textContent = { connected: 'En ligne', disconnected: 'Hors ligne', loading: 'Connexion...' }[status] || status;
}

// ============================================
// Page Loader
// ============================================
function hidePageLoader() {
    var loader = document.getElementById('pageLoader');
    if (loader) loader.classList.add('hidden');
}

// ============================================
// Supabase query with short timeout + cache
// ============================================
async function supabaseQuery(table, options) {
    options = options || {};
    var select = options.select || '*';
    var eq = options.eq;
    var order = options.order;
    var limit = options.limit;
    var timeout = options.timeout || 3000;
    var cacheKey = 'ipstore25_cache_' + table;

    if (!getClient()) {
        var cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
        return null;
    }

    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, timeout);

    try {
        var query = getClient().from(table).select(select);
        if (eq) { var entries = Object.entries(eq); for (var i = 0; i < entries.length; i++) { query = query.eq(entries[i][0], entries[i][1]); } }
        if (order) query = query.order(order.column, { ascending: order.ascending !== false });
        if (limit) query = query.limit(limit);

        var result = await query;
        clearTimeout(timer);
        if (result.error) throw result.error;

        localStorage.setItem(cacheKey, JSON.stringify(result.data));
        return result.data;
    } catch (err) {
        clearTimeout(timer);
        var cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
        return null;
    }
}

// ============================================
// Load all data (fast - only await products)
// ============================================
async function loadAllData() {
    setDbStatus('loading');

    await loadProducts();

    if (dbConnected) {
        setDbStatus('connected');
    } else {
        setDbStatus('disconnected');
    }
    hidePageLoader();

    Promise.all([loadCategories(), loadSettings()]);
}

// ============================================
// Load products
// ============================================
async function loadProducts() {
    var data = await supabaseQuery('products', {
        select: '*',
        eq: { is_active: true },
        order: { column: 'sort_order', ascending: true },
        timeout: 3000
    });

    if (data) {
        products = data.map(function(p) {
            return {
                id: p.id,
                name: p.name,
                category: p.category_id,
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
        dbConnected = true;
        localStorage.setItem('ipstore25_products', JSON.stringify(products));
    } else {
        products = JSON.parse(localStorage.getItem('ipstore25_products')) || [];
    }
    _productsLoaded = true;
}

// ============================================
// Load categories
// ============================================
async function loadCategories() {
    var data = await supabaseQuery('categories', {
        select: '*',
        eq: { is_active: true },
        order: { column: 'sort_order', ascending: true },
        timeout: 5000
    });
    if (data) data.forEach(function(c) { categoryLabels[c.slug] = c.name; });
}

// ============================================
// Load settings
// ============================================
async function loadSettings() {
    var data = await supabaseQuery('settings', { select: '*', timeout: 5000 });
    if (data) {
        data.forEach(function(s) { siteSettings[s.key] = s.value; });
        applySettings();
    }
}

function applySettings() {
    if (siteSettings.store_phone) {
        var phone = siteSettings.store_phone;
        var phoneClean = phone.replace(/[^0-9]/g, '');
        document.querySelectorAll('[data-setting-phone]').forEach(function(el) { el.textContent = phone; });
        document.querySelectorAll('[data-setting-whatsapp]').forEach(function(el) { el.href = 'https://wa.me/' + phoneClean; });
        document.querySelectorAll('a[href*="wa.me"]').forEach(function(el) { el.href = 'https://wa.me/' + phoneClean; });
    }
    if (siteSettings.store_email) {
        document.querySelectorAll('[data-setting-email]').forEach(function(el) { el.textContent = siteSettings.store_email; });
    }
    if (siteSettings.store_name) {
        document.querySelectorAll('[data-setting-name]').forEach(function(el) { el.textContent = siteSettings.store_name; });
    }
}

// ============================================
// REAL-TIME
// ============================================
function setupRealtime() {
    var client = getClient();
    if (!client) return;

    client.channel('products-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async function() {
            await loadProducts();
            var grid = document.getElementById('productsGrid');
            if (grid && typeof renderProductsPage === 'function') renderProductsPage(filterAndSort());
            else if (grid) renderProducts(products);
            var phonesGrid = document.getElementById('phonesGrid');
            if (phonesGrid) renderPhones();
            var gamingGrid = document.getElementById('gamingGrid');
            if (gamingGrid) renderGaming();
        }).subscribe();

    client.channel('settings-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async function() {
            await loadSettings();
        }).subscribe();

    client.channel('categories-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async function() {
            await loadCategories();
        }).subscribe();
}

// ============================================
// Render phones (index) - latest 6
// ============================================
function renderPhones() {
    var phones = products.filter(function(p) { return p.category == 1; });
    var grid = document.getElementById('phonesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (phones.length === 0) {
        grid.innerHTML = '<div class="empty-state-full"><i class="fas fa-mobile-alt"></i><h3>Aucun téléphone</h3><p>Ajoutez des téléphones depuis l\'admin</p></div>';
        return;
    }
    var latest = phones.slice(-6).reverse();
    var fragment = document.createDocumentFragment();
    latest.forEach(function(p) {
        fragment.appendChild(createPhoneCard(p));
    });
    grid.appendChild(fragment);
    requestAnimationFrame(function() { observeCards(); });
}

// ============================================
// Render gaming (index) - latest 6
// ============================================
function renderGaming() {
    var gaming = products.filter(function(p) { return p.category == 8; });
    var grid = document.getElementById('gamingGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (gaming.length === 0) {
        grid.innerHTML = '<div class="empty-state-full"><i class="fas fa-gamepad"></i><h3>Aucun appareil gaming</h3><p>Ajoutez des appareils gaming depuis l\'admin</p></div>';
        return;
    }
    var latest = gaming.slice(-6).reverse();
    var fragment = document.createDocumentFragment();
    latest.forEach(function(p) {
        fragment.appendChild(createPhoneCard(p));
    });
    grid.appendChild(fragment);
    requestAnimationFrame(function() { observeCards(); });
}

function createPhoneCard(p) {
    var inW = wishlist.includes(p.id);
    var images = [p.image, p.image2, p.image3].filter(Boolean);
    var card = document.createElement('div');
    card.className = 'phone-card';
    card.innerHTML =
        (p.badge ? '<span class="phone-card-badge badge-' + p.badge + '">' + (p.badge === 'hot' ? '🔥 Best Seller' : p.badge === 'new' ? '✨ Nouveau' : '💰 Promo') + '</span>' : '') +
        '<div class="phone-card-image" onclick="window.location.href=\'product.html?id=' + p.id + '\'">' +
            (images.length > 0
                ? '<img src="' + images[0] + '" alt="' + p.name + '" loading="lazy" decoding="async" data-images=\'' + JSON.stringify(images).replace(/'/g, "&#39;") + '\' onmouseenter="hoverProductImg(event)" onmouseleave="leaveProductImg(event)">'
                : '<span>' + p.emoji + '</span>') +
        '</div>' +
        '<div class="phone-card-body">' +
            '<div class="phone-card-category">' + (CAT_ID_TO_LABEL[p.category] || p.category) + '</div>' +
            '<div class="phone-card-name">' + p.name + '</div>' +
            '<div class="phone-card-desc">' + p.desc + '</div>' +
            '<div class="phone-card-stock"><i class="fas fa-check-circle"></i> ' + p.stock + '</div>' +
            '<div class="phone-card-prices">' +
                '<span class="phone-card-price">' + p.price.toLocaleString('fr-DZ') + ' DA</span>' +
                (p.oldPrice ? '<span class="phone-card-old-price">' + p.oldPrice.toLocaleString('fr-DZ') + ' DA</span>' : '') +
            '</div>' +
            '<div class="phone-card-footer">' +
                '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();addToCart(' + p.id + ')"><i class="fas fa-cart-plus"></i></button>' +
                '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();window.location.href=\'product.html?id=' + p.id + '\'"><i class="fas fa-eye"></i></button>' +
                '<button class="btn btn-outline btn-sm' + (inW ? ' wishlisted' : '') + '" onclick="event.stopPropagation();toggleWishlist(' + p.id + ')"><i class="fas fa-heart"></i></button>' +
            '</div>' +
        '</div>';
    return card;
}

// ============================================
// Render products (index - all)
// ============================================
function renderProducts(list) {
    var grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (list.length === 0) {
        grid.innerHTML = '<div class="empty-state-full"><i class="fas fa-box-open"></i><h3>Aucun produit</h3><p>Ajoutez des produits depuis l\'admin</p></div>';
        return;
    }
    var fragment = document.createDocumentFragment();
    list.forEach(function(p) { fragment.appendChild(createProductCard(p)); });
    grid.appendChild(fragment);
    requestAnimationFrame(function() { observeCards(); });
}

function createProductCard(p) {
    var inW = wishlist.includes(p.id);
    var images = [p.image, p.image2, p.image3].filter(Boolean);
    var card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML =
        (p.badge ? '<span class="product-badge badge-' + p.badge + '">' + (p.badge === 'hot' ? '🔥 Best Seller' : p.badge === 'new' ? '✨ Nouveau' : '💰 Promo') + '</span>' : '') +
        '<div class="product-actions">' +
            '<button class="action-btn ' + (inW ? 'wishlisted' : '') + '" onclick="event.stopPropagation();toggleWishlist(' + p.id + ')"><i class="fas fa-heart"></i></button>' +
            '<button class="action-btn" onclick="event.stopPropagation();window.location.href=\'product.html?id=' + p.id + '\'"><i class="fas fa-eye"></i></button>' +
        '</div>' +
        '<div class="product-image" onclick="window.location.href=\'product.html?id=' + p.id + '\'">' +
            (images.length > 0
                ? '<img src="' + images[0] + '" alt="' + p.name + '" loading="lazy" decoding="async" data-images=\'' + JSON.stringify(images).replace(/'/g, '&#39;') + '\' onmouseenter="hoverProductImg(event)" onmouseleave="leaveProductImg(event)">'
                : '<span class="product-emoji">' + p.emoji + '</span>') +
        '</div>' +
        '<div class="product-info">' +
            '<div class="product-cat">' + (CAT_ID_TO_LABEL[p.category] || p.category) + '</div>' +
            '<div class="product-name">' + p.name + '</div>' +
            '<div class="product-bottom">' +
                '<div>' +
                    '<div class="product-price">' + p.price.toLocaleString('fr-DZ') + ' DA</div>' +
                    (p.oldPrice ? '<div class="product-price-old">' + p.oldPrice.toLocaleString('fr-DZ') + ' DA</div>' : '') +
                '</div>' +
                '<button class="add-cart-btn" onclick="event.stopPropagation();addToCart(' + p.id + ')"><i class="fas fa-cart-plus"></i></button>' +
            '</div>' +
        '</div>';
    return card;
}

function hoverProductImg(e) {
    var img = e.currentTarget;
    try {
        var images = JSON.parse(img.dataset.images);
        if (images.length > 1) { img.dataset.idx = '1'; img.src = images[1]; }
    } catch {}
}

function leaveProductImg(e) {
    var img = e.currentTarget;
    try {
        var images = JSON.parse(img.dataset.images);
        img.src = images[0]; delete img.dataset.idx;
    } catch {}
}

// ============================================
// Intersection Observer for scroll animations
// ============================================
var _cardObserver = null;
function observeCards() {
    if (_cardObserver) _cardObserver.disconnect();
    _cardObserver = new IntersectionObserver(function(entries) {
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) {
                entries[i].target.classList.add('card-visible');
                _cardObserver.unobserve(entries[i].target);
            }
        }
    }, { threshold: 0.02, rootMargin: '80px' });

    document.querySelectorAll('.phone-card:not(.card-visible), .product-card:not(.card-visible), .cat-card:not(.card-visible), .feature-card:not(.card-visible)').forEach(function(el) {
        _cardObserver.observe(el);
    });
}

// ============================================
// Cart
// ============================================
function addToCart(id) {
    var p = products.find(function(x) { return x.id === id; });
    if (!p) return;
    var item = cart.find(function(x) { return x.id === id; });
    if (item) item.qty++; else cart.push(Object.assign({}, p, { qty: 1 }));
    saveCart(); updateCartCount();
    showToast(p.name + ' ajouté au panier', 'success');
}

function removeFromCart(id) {
    cart = cart.filter(function(x) { return x.id !== id; });
    saveCart(); updateCartCount(); renderCart();
}

function changeQty(id, d) {
    var item = cart.find(function(x) { return x.id === id; });
    if (!item) return;
    item.qty += d;
    if (item.qty <= 0) { removeFromCart(id); return; }
    saveCart(); renderCart();
}

function saveCart() { localStorage.setItem('ipstore25_cart', JSON.stringify(cart)); }

function updateCartCount() {
    var el = document.getElementById('cartCount');
    if (el) el.textContent = cart.reduce(function(s, i) { return s + i.qty; }, 0);
}

function renderCart() {
    var c = document.getElementById('cartItems');
    var f = document.getElementById('cartFooter');
    if (cart.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-basket"></i><p>Votre panier est vide</p></div>';
        if (f) f.style.display = 'none';
        return;
    }
    c.innerHTML = cart.map(function(i) {
        return '<div class="cart-item">' +
            '<div class="cart-item-img">' + (i.image ? '<img src="' + i.image + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:8px">' : i.emoji) + '</div>' +
            '<div class="cart-item-info">' +
                '<div class="cart-item-name">' + i.name + '</div>' +
                '<div class="cart-item-price">' + i.price.toLocaleString('fr-DZ') + ' DA</div>' +
                '<div class="cart-item-qty">' +
                    '<button class="qty-btn" onclick="changeQty(' + i.id + ',-1)"><i class="fas fa-minus"></i></button>' +
                    '<span class="qty-value">' + i.qty + '</span>' +
                    '<button class="qty-btn" onclick="changeQty(' + i.id + ',1)"><i class="fas fa-plus"></i></button>' +
                '</div>' +
            '</div>' +
            '<button class="cart-item-remove" onclick="removeFromCart(' + i.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>';
    }).join('');
    document.getElementById('cartTotal').textContent = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0).toLocaleString('fr-DZ') + ' DA';
    if (f) f.style.display = 'block';
}

function openCart() {
    document.getElementById('cartSidebar').classList.add('open');
    document.getElementById('overlay').classList.add('active');
    renderCart(); closeMenu();
}

function closeCart() {
    document.getElementById('cartSidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
}

// ============================================
// Wishlist
// ============================================
function toggleWishlist(id) {
    var idx = wishlist.indexOf(id);
    if (idx > -1) { wishlist.splice(idx, 1); showToast('Retiré des favoris', 'success'); }
    else { wishlist.push(id); showToast('Ajouté aux favoris', 'success'); }
    localStorage.setItem('ipstore25_wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
}

function updateWishlistCount() {
    var el = document.getElementById('wishlistCount');
    if (el) el.textContent = wishlist.length;
}

function openWishlist() {
    document.getElementById('wishlistSidebar').classList.add('open');
    document.getElementById('overlay').classList.add('active');
    renderWishlist(); closeMenu();
}

function closeWishlist() {
    document.getElementById('wishlistSidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
}

function renderWishlist() {
    var c = document.getElementById('wishlistItems');
    var wp = products.filter(function(p) { return wishlist.includes(p.id); });
    if (wp.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-heart-broken"></i><p>Aucun favori</p></div>';
        return;
    }
    c.innerHTML = wp.map(function(i) {
        return '<div class="cart-item">' +
            '<div class="cart-item-img">' + (i.image ? '<img src="' + i.image + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:8px">' : i.emoji) + '</div>' +
            '<div class="cart-item-info">' +
                '<div class="cart-item-name">' + i.name + '</div>' +
                '<div class="cart-item-price">' + i.price.toLocaleString('fr-DZ') + ' DA</div>' +
            '</div>' +
            '<button class="cart-item-remove" onclick="toggleWishlist(' + i.id + ');renderWishlist()"><i class="fas fa-times"></i></button>' +
        '</div>';
    }).join('');
}

// ============================================
// Product modal
// ============================================
function openModal(id) {
    var p = products.find(function(x) { return x.id === id; });
    if (!p) return;
    currentModalProduct = p;
    document.getElementById('modalImage').innerHTML = p.image ? '<img src="' + p.image + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '<span>' + p.emoji + '</span>';
    document.getElementById('modalCategory').textContent = CAT_ID_TO_LABEL[p.category] || p.category;
    document.getElementById('modalTitle').textContent = p.name;
    document.getElementById('modalDesc').textContent = p.desc;
    document.getElementById('modalPrice').textContent = p.price.toLocaleString('fr-DZ') + ' DA';
    document.getElementById('modalStock').innerHTML = '<i class="fas fa-check-circle"></i> ' + p.stock;
    document.getElementById('productModal').classList.add('open');
    document.getElementById('overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('productModal').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
    currentModalProduct = null;
}

function addToCartFromModal() { if (currentModalProduct) { addToCart(currentModalProduct.id); closeModal(); } }
function toggleWishlistFromModal() { if (currentModalProduct) toggleWishlist(currentModalProduct.id); }

// ============================================
// Checkout → Supabase
// ============================================
function checkout() {
    if (cart.length === 0) return;
    openCheckoutModal();
}

function openCheckoutModal() {
    var overlay = document.getElementById('overlay');
    var existing = document.getElementById('checkoutModal');
    if (existing) existing.remove();

    var total = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
    var itemsSummary = cart.map(function(i) { return i.name + ' x' + i.qty; }).join(', ');

    var modal = document.createElement('div');
    modal.id = 'checkoutModal';
    modal.className = 'modal open';
    modal.innerHTML =
        '<div class="modal-content" style="max-width:500px">' +
            '<button class="modal-close" onclick="closeCheckoutModal()"><i class="fas fa-times"></i></button>' +
            '<div style="padding:32px">' +
                '<h2 style="font-size:22px;font-weight:800;margin-bottom:6px">📦 Finaliser la commande</h2>' +
                '<p style="color:var(--text-secondary);font-size:14px;margin-bottom:24px">' + cart.length + ' article(s) — <strong>' + total.toLocaleString('fr-DZ') + ' DA</strong></p>' +
                '<div class="form-group"><label><i class="fas fa-user"></i> Nom complet *</label><input type="text" id="coName" placeholder="Votre nom"></div>' +
                '<div class="form-group"><label><i class="fas fa-phone"></i> Téléphone *</label><input type="tel" id="coPhone" placeholder="07XX XX XX XX"></div>' +
                '<div class="form-group"><label><i class="fas fa-envelope"></i> Email</label><input type="email" id="coEmail" placeholder="email@example.com"></div>' +
                '<div class="form-group"><label><i class="fas fa-map-marker-alt"></i> Adresse de livraison *</label><input type="text" id="coAddress" placeholder="Adresse complète"></div>' +
                '<div class="form-group"><label><i class="fas fa-city"></i> Ville</label><input type="text" id="coCity" placeholder="Alger, Oran..."></div>' +
                '<div class="form-group"><label><i class="fas fa-sticky-note"></i> Notes</label><textarea id="coNotes" rows="2" placeholder="Instructions spéciales..."></textarea></div>' +
                '<button class="btn btn-primary btn-full" onclick="submitOrder()" style="margin-top:8px"><i class="fas fa-check"></i> Confirmer la commande</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
    overlay.classList.add('active');
}

function closeCheckoutModal() {
    var m = document.getElementById('checkoutModal');
    if (m) m.remove();
    document.getElementById('overlay').classList.remove('active');
}

async function submitOrder() {
    var name = document.getElementById('coName').value.trim();
    var phone = document.getElementById('coPhone').value.trim();
    var email = document.getElementById('coEmail').value.trim();
    var address = document.getElementById('coAddress').value.trim();
    var city = document.getElementById('coCity').value.trim();
    var notes = document.getElementById('coNotes').value.trim();

    if (!name || !phone || !address) {
        showToast('Remplissez les champs obligatoires', 'error');
        return;
    }

    var total = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
    var items = cart.map(function(i) {
        return { id: i.id, name: i.name, price: i.price, qty: i.qty, image: i.image || null };
    });

    if (_db.admin) {
        try {
            var result = await _db.admin.from('customer_orders').insert([{
                customer_name: name, customer_phone: phone, customer_email: email,
                shipping_address: address, shipping_city: city, items: items,
                subtotal: total, shipping_cost: 0, total: total,
                payment_method: 'cod', status: 'pending', notes: notes
            }]);
            if (result.error) throw result.error;
        } catch (err) {
            var orders = JSON.parse(localStorage.getItem('ipstore25_orders')) || [];
            orders.push({ name: name, phone: phone, email: email, address: address, city: city, items: items, total: total, notes: notes, date: new Date().toISOString() });
            localStorage.setItem('ipstore25_orders', JSON.stringify(orders));
        }
    } else {
        var orders = JSON.parse(localStorage.getItem('ipstore25_orders')) || [];
        orders.push({ name: name, phone: phone, email: email, address: address, city: city, items: items, total: total, notes: notes, date: new Date().toISOString() });
        localStorage.setItem('ipstore25_orders', JSON.stringify(orders));
    }

    closeCheckoutModal();
    showToast('Commande passée! Total: ' + total.toLocaleString('fr-DZ') + ' DA', 'success');
    cart = []; saveCart(); updateCartCount(); closeCart();

    var phoneClean = (siteSettings.store_phone || '213775765743').replace(/[^0-9]/g, '');
    var waMsg = encodeURIComponent('Nouvelle commande de ' + name + '\nTéléphone: ' + phone + '\nAdresse: ' + address + ', ' + city + '\nTotal: ' + total.toLocaleString('fr-DZ') + ' DA\nArticles: ' + items.map(function(i) { return i.name + ' x' + i.qty; }).join(', '));
    window.open('https://wa.me/' + phoneClean + '?text=' + waMsg, '_blank');
}

// ============================================
// Toast
// ============================================
function showToast(msg, type) {
    type = type || 'success';
    var c = document.getElementById('toastContainer');
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check-circle' : 'exclamation-circle') + '"></i> ' + msg;
    c.appendChild(t);
    setTimeout(function() { t.classList.add('toast-hide'); setTimeout(function() { t.remove(); }, 400); }, 2500);
}

function toggleMenu() { document.getElementById('mainNav').classList.toggle('open'); }
function closeMenu() { document.getElementById('mainNav').classList.remove('open'); }

function closeAll() {
    closeCart(); closeWishlist(); closeModal(); closeMenu();
    closeCheckoutModal();
    document.getElementById('overlay').classList.remove('active');
}

// ============================================
// Scroll header
// ============================================
var _lastScroll = 0;
var _scrollTicking = false;
function onScroll() {
    _lastScroll = window.scrollY;
    if (!_scrollTicking) {
        requestAnimationFrame(function() {
            var header = document.querySelector('.header');
            if (header) {
                if (_lastScroll > 50) header.classList.add('scrolled');
                else header.classList.remove('scrolled');
            }
            _scrollTicking = false;
        });
        _scrollTicking = true;
    }
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    setDbStatus('loading');

    // Load from cache first for instant render
    var cached = localStorage.getItem('ipstore25_products');
    if (cached) {
        try {
            products = JSON.parse(cached);
            renderProducts(products);
            renderPhones();
            renderGaming();
            updateCartCount();
            updateWishlistCount();
        } catch(e) {}
    }

    hidePageLoader();
    observeCards();

    // Now fetch fresh data
    await loadAllData();

    // Re-render with fresh data
    if (_productsLoaded) {
        renderProducts(products);
        renderPhones();
        renderGaming();
        updateCartCount();
        updateWishlistCount();
    }

    setupRealtime();
    observeCards();

    window.addEventListener('scroll', onScroll, { passive: true });
});

document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeAll(); });

// ============================================
// PARTICLE CANVAS - Floating Particles
// ============================================
(function initParticles() {
    var canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var particles = [];
    var particleCount = 40;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function Particle() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.3 + 0.1;
        this.color = ['0,122,255', '88,86,214', '52,199,89', '255,149,0'][Math.floor(Math.random() * 4)];
    }

    Particle.prototype.update = function() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    };

    Particle.prototype.draw = function() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + this.color + ',' + this.opacity + ')';
        ctx.fill();
    };

    for (var i = 0; i < particleCount; i++) particles.push(new Particle());

    function connectParticles() {
        for (var a = 0; a < particles.length; a++) {
            for (var b = a + 1; b < particles.length; b++) {
                var dx = particles[a].x - particles[b].x;
                var dy = particles[a].y - particles[b].y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(0,122,255,' + (0.05 * (1 - dist / 150)) + ')';
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(function(p) { p.update(); p.draw(); });
        connectParticles();
        requestAnimationFrame(animate);
    }
    animate();
})();

// ============================================
// CURSOR GLOW EFFECT
// ============================================
(function initCursorGlow() {
    var glow = document.getElementById('cursorGlow');
    if (!glow) return;
    var mx = 0, my = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', function(e) { mx = e.clientX; my = e.clientY; });
    function updateGlow() {
        cx += (mx - cx) * 0.1;
        cy += (my - cy) * 0.1;
        glow.style.left = cx + 'px';
        glow.style.top = cy + 'px';
        requestAnimationFrame(updateGlow);
    }
    updateGlow();
})();

// ============================================
// SCROLL REveal - IntersectionObserver
// ============================================
(function initScrollReveal() {
    var revealElements = document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale, .stagger-grid');
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    revealElements.forEach(function(el) { observer.observe(el); });

    // Re-observe after render (for dynamically added elements)
    setTimeout(function() {
        document.querySelectorAll('.scroll-reveal:not(.visible), .scroll-reveal-left:not(.visible), .scroll-reveal-right:not(.visible), .scroll-reveal-scale:not(.visible), .stagger-grid:not(.visible)').forEach(function(el) {
            observer.observe(el);
        });
    }, 500);
})();

// ============================================
// PARALLAX ON SCROLL
// ============================================
(function initParallax() {
    var orbs = document.querySelectorAll('.bg-orb');
    if (orbs.length === 0) return;
    var ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            requestAnimationFrame(function() {
                var scrollY = window.scrollY;
                orbs.forEach(function(orb, i) {
                    var speed = (i + 1) * 0.03;
                    orb.style.transform = 'translateY(' + (scrollY * speed) + 'px)';
                });
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
})();

// ============================================
// SECTION TITLE SCROLL ANIMATION
// ============================================
(function initSectionTitles() {
    var titles = document.querySelectorAll('.section-title');
    titles.forEach(function(title) {
        title.classList.add('scroll-reveal');
    });
})();