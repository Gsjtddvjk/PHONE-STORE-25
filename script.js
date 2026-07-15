let products = [];
let cart = JSON.parse(localStorage.getItem('ipstore25_cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('ipstore25_wishlist')) || [];
let currentModalProduct = null;
let siteSettings = {};

const categoryLabels = {
    telephone: 'Téléphones',
    ecran: 'Écrans',
    batterie: 'Batteries',
    camera: 'Caméras',
    boitier: 'Boîtiers',
    accessoire: 'Accessoires',
    outils: 'Outils'
};

const CAT_ID_TO_LABEL = { 1: 'Téléphones', 2: 'Écrans', 3: 'Batteries', 4: 'Caméras', 5: 'Boîtiers', 6: 'Accessoires', 7: 'Outils' };

const getClient = () => _db.client;
const getAdmin = () => _db.admin;

// ============================================
// DB Status Badge
// ============================================
function setDbStatus(status) {
    const el = document.getElementById('dbStatus');
    const txt = document.getElementById('dbStatusText');
    if (!el || !txt) return;
    el.className = 'db-status ' + status;
    txt.textContent = { connected: 'En ligne', disconnected: 'Hors ligne', loading: 'Connexion...' }[status] || status;
}

// ============================================
// Page Loader
// ============================================
function hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) loader.classList.add('hidden');
}

// ============================================
// Supabase query with timeout + cache fallback
// ============================================
async function supabaseQuery(table, options = {}) {
    const { select = '*', eq, order, limit, timeout = 10000 } = options;
    const cacheKey = 'ipstore25_cache_' + table;

    if (!getClient()) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
        return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, timeout);

    try {
        var query = getClient().from(table).select(select);
        if (eq) Object.entries(eq).forEach(function(entry) { query = query.eq(entry[0], entry[1]); });
        if (order) query = query.order(order.column, { ascending: order.ascending !== false });
        if (limit) query = query.limit(limit);

        var result = await query;
        clearTimeout(timer);
        if (result.error) throw result.error;

        localStorage.setItem(cacheKey, JSON.stringify(result.data));
        return result.data;
    } catch (err) {
        clearTimeout(timer);
        console.error('Query error (' + table + '):', err.message || err);
        var cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
        return null;
    }
}

var dbConnected = false;

// ============================================
// Load products from Supabase
// ============================================
async function loadProducts() {
    var data = await supabaseQuery('products', {
        select: '*',
        eq: { is_active: true },
        order: { column: 'sort_order', ascending: true },
        timeout: 10000
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
        setDbStatus('connected');
    } else {
        products = JSON.parse(localStorage.getItem('ipstore25_products')) || [];
        dbConnected = false;
        setDbStatus('disconnected');
    }
}

// ============================================
// Load categories from Supabase
// ============================================
async function loadCategories() {
    var data = await supabaseQuery('categories', {
        select: '*',
        eq: { is_active: true },
        order: { column: 'sort_order', ascending: true },
        timeout: 10000
    });
    if (data) data.forEach(function(c) { categoryLabels[c.slug] = c.name; });
}

// ============================================
// Load settings from Supabase
// ============================================
async function loadSettings() {
    var data = await supabaseQuery('settings', {
        select: '*',
        timeout: 10000
    });
    if (data) {
        data.forEach(function(s) { siteSettings[s.key] = s.value; });
        applySettings();
    }
}

function applySettings() {
    if (siteSettings.store_phone) {
        var phone = siteSettings.store_phone;
        var phoneClean = phone.replace(/[^0-9]/g, '');

        document.querySelectorAll('[data-setting-phone]').forEach(function(el) {
            el.textContent = phone;
        });

        document.querySelectorAll('[data-setting-whatsapp]').forEach(function(el) {
            el.href = 'https://wa.me/' + phoneClean;
        });

        document.querySelectorAll('a[href*="wa.me"]').forEach(function(el) {
            el.href = 'https://wa.me/' + phoneClean;
        });
    }

    if (siteSettings.store_email) {
        document.querySelectorAll('[data-setting-email]').forEach(function(el) {
            el.textContent = siteSettings.store_email;
        });
    }

    if (siteSettings.store_name) {
        document.querySelectorAll('[data-setting-name]').forEach(function(el) {
            el.textContent = siteSettings.store_name;
        });
    }
}

// ============================================
// REAL-TIME: Subscribe to changes
// ============================================
function setupRealtime() {
    var client = getClient();
    if (!client) return;

    client
        .channel('products-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async function() {
            await loadProducts();
            var grid = document.getElementById('productsGrid');
            if (grid) {
                if (typeof renderProductsPage === 'function') {
                    renderProductsPage(filterAndSort());
                } else {
                    renderProducts(products);
                }
            }
            var phonesGrid = document.getElementById('phonesGrid');
            if (phonesGrid) renderPhones();
        })
        .subscribe();

    client
        .channel('settings-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async function() {
            await loadSettings();
        })
        .subscribe();

    client
        .channel('categories-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async function() {
            await loadCategories();
        })
        .subscribe();

    client
        .channel('customer-orders-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, async function() {
            console.log('[Realtime] New order received');
        })
        .subscribe();
}

// ============================================
// Render phones (index page) - latest 6 only
// ============================================
function renderPhones() {
    var phones = products.filter(function(p) { return p.category == 1; });
    var grid = document.getElementById('phonesGrid');
    if (!grid) return;

    grid.innerHTML = '';
    if (phones.length === 0) {
        grid.innerHTML = '<div class="empty-state-full"><i class="fas fa-mobile-alt"></i><h3>Aucun téléphone pour le moment</h3><p>Ajoutez des téléphones depuis l\'espace administrateur</p></div>';
        return;
    }

    var latest = phones.slice(-6).reverse();

    latest.forEach(function(p) {
        var inW = wishlist.includes(p.id);
        var images = [p.image, p.image2, p.image3].filter(Boolean);
        var card = document.createElement('div');
        card.className = 'phone-card';
        card.innerHTML =
            (p.badge ? '<span class="phone-card-badge badge-' + p.badge + '">' + (p.badge === 'hot' ? '🔥 Best Seller' : p.badge === 'new' ? '✨ Nouveau' : '💰 Promo') + '</span>' : '') +
            '<div class="phone-card-image" onclick="window.location.href=\'product.html?id=' + p.id + '\'">' +
                (images.length > 0
                    ? '<img src="' + images[0] + '" alt="' + p.name + '" loading="lazy" data-images=\'' + JSON.stringify(images).replace(/'/g, "&#39;") + '\' onmouseenter="hoverProductImg(event)" onmouseleave="leaveProductImg(event)">'
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
                    '<button class="btn btn-primary" onclick="event.stopPropagation();addToCart(' + p.id + ')"><i class="fas fa-cart-plus"></i> Ajouter</button>' +
                    '<button class="btn btn-outline" onclick="event.stopPropagation();window.location.href=\'product.html?id=' + p.id + '\'"><i class="fas fa-eye"></i> Voir</button>' +
                    '<button class="btn btn-outline ' + (inW ? 'wishlisted' : '') + '" onclick="event.stopPropagation();toggleWishlist(' + p.id + ')"><i class="fas fa-heart"></i></button>' +
                '</div>' +
            '</div>';
        grid.appendChild(card);
    });
}

// ============================================
// Render products (index page - all products)
// ============================================
function renderProducts(list) {
    var grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (list.length === 0) {
        grid.innerHTML = '<div class="empty-state-full"><i class="fas fa-box-open"></i><h3>Aucun produit pour le moment</h3><p>Ajoutez des produits depuis l\'espace administrateur</p></div>';
        return;
    }

    var fragment = document.createDocumentFragment();

    list.forEach(function(p) {
        fragment.appendChild(createProductCard(p));
    });

    grid.appendChild(fragment);
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
                ? '<img src="' + images[0] + '" alt="' + p.name + '" loading="lazy" data-images=\'' + JSON.stringify(images).replace(/'/g, '&#39;') + '\' onmouseenter="hoverProductImg(event)" onmouseleave="leaveProductImg(event)">'
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
// Cart functions
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
            '<div class="cart-item-img">' + (i.image ? '<img src="' + i.image + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">' : i.emoji) + '</div>' +
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
// Wishlist functions
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
            '<div class="cart-item-img">' + (i.image ? '<img src="' + i.image + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">' : i.emoji) + '</div>' +
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
// Checkout with customer info → Supabase
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
                '<div class="form-group"><label>Nom complet *</label><input type="text" id="coName" placeholder="Votre nom"></div>' +
                '<div class="form-group"><label>Téléphone *</label><input type="tel" id="coPhone" placeholder="07XX XX XX XX"></div>' +
                '<div class="form-group"><label>Email</label><input type="email" id="coEmail" placeholder="email@example.com"></div>' +
                '<div class="form-group"><label>Adresse de livraison *</label><input type="text" id="coAddress" placeholder="Adresse complète"></div>' +
                '<div class="form-group"><label>Ville</label><input type="text" id="coCity" placeholder="Alger, Oran..."></div>' +
                '<div class="form-group"><label>Notes</label><textarea id="coNotes" rows="2" placeholder="Instructions spéciales..."></textarea></div>' +
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
            var controller = new AbortController();
            var timer = setTimeout(function() { controller.abort(); }, 10000);
            var result = await _db.admin
                .from('customer_orders')
                .insert([{
                    customer_name: name,
                    customer_phone: phone,
                    customer_email: email,
                    shipping_address: address,
                    shipping_city: city,
                    items: items,
                    subtotal: total,
                    shipping_cost: 0,
                    total: total,
                    payment_method: 'cod',
                    status: 'pending',
                    notes: notes
                }]);
            clearTimeout(timer);
            if (result.error) throw result.error;
        } catch (err) {
            console.error('Order save error:', err);
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
    setTimeout(function() { t.remove(); }, 3000);
}

function toggleMenu() { document.getElementById('mainNav').classList.toggle('open'); }
function closeMenu() { document.getElementById('mainNav').classList.remove('open'); }

function closeAll() {
    closeCart(); closeWishlist(); closeModal(); closeMenu();
    closeCheckoutModal();
    document.getElementById('overlay').classList.remove('active');
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    setDbStatus('loading');

    await Promise.all([loadCategories(), loadProducts(), loadSettings()]);

    renderProducts(products);
    renderPhones();
    updateCartCount();
    updateWishlistCount();

    setupRealtime();

    if (dbConnected) {
        hidePageLoader();
    } else {
        var ls = document.querySelector('.loader-status');
        if (ls) ls.textContent = 'Hors ligne - affichage des données en cache';
        setTimeout(hidePageLoader, 1500);
    }

    window.addEventListener('scroll', function() {
        var header = document.querySelector('.header');
        if (header) {
            if (window.scrollY > 50) header.classList.add('scrolled');
            else header.classList.remove('scrolled');
        }
    });

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.cat-card, .feature-card, .product-card, .phone-card').forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(el);
    });
});

document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeAll(); });