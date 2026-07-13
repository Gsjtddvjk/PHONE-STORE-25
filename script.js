let products = [];
let cart = JSON.parse(localStorage.getItem('ipstore25_cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('ipstore25_wishlist')) || [];
let currentModalProduct = null;

const categoryLabels = {
    telephone: 'Téléphones',
    ecran: 'Écrans',
    batterie: 'Batteries',
    camera: 'Caméras',
    boitier: 'Boîtiers',
    accessoire: 'Accessoires',
    outils: 'Outils'
};

// ============================================
// Load products from Supabase
// ============================================
async function loadProducts() {
    if (!supabase) {
        products = JSON.parse(localStorage.getItem('ipstore25_products')) || [];
        return;
    }
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        products = data.map(p => ({
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
    } catch (err) {
        console.error('Error loading products:', err);
        products = JSON.parse(localStorage.getItem('ipstore25_products')) || [];
    }
}

// ============================================
// Load categories from Supabase
// ============================================
async function loadCategories() {
    if (!supabase) return;
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        // Update categoryLabels from database
        data.forEach(c => {
            categoryLabels[c.slug] = c.name;
        });
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadProducts();
    renderProducts(products);
    updateCartCount();
    updateWishlistCount();

    // Header scroll effect
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.header');
        if (header) {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }
    });

    // Lazy load observer for animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.cat-card, .feature-card, .product-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(el);
    });
});

function renderProducts(list) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (list.length === 0) {
        grid.innerHTML = '<div class="empty-state-full"><i class="fas fa-box-open"></i><h3>Aucun produit pour le moment</h3><p>Ajoutez des produits depuis l\'espace administrateur</p></div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    const initialRender = list.slice(0, 50);
    const remaining = list.slice(50);

    initialRender.forEach(p => {
        fragment.appendChild(createProductCard(p));
    });

    grid.appendChild(fragment);

    if (remaining.length > 0) {
        const loadMore = document.createElement('div');
        loadMore.className = 'load-more-container';
        loadMore.innerHTML = `<button class="btn btn-outline load-more-btn" onclick="loadMoreProducts(this)"><i class="fas fa-plus"></i> Voir plus (${remaining.length} produits)</button>`;
        grid.parentElement.appendChild(loadMore);
        window._remainingProducts = remaining;
    }
}

function loadMoreProducts(btn) {
    const grid = document.getElementById('productsGrid');
    const remaining = window._remainingProducts || [];
    const fragment = document.createDocumentFragment();

    remaining.slice(0, 50).forEach(p => {
        fragment.appendChild(createProductCard(p));
    });

    grid.appendChild(fragment);

    const newRemaining = remaining.slice(50);
    window._remainingProducts = newRemaining;

    if (newRemaining.length > 0) {
        btn.innerHTML = `<i class="fas fa-plus"></i> Voir plus (${newRemaining.length} produits)`;
    } else {
        btn.parentElement.remove();
    }
}

function createProductCard(p) {
    const inW = wishlist.includes(p.id);
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        ${p.badge ? `<span class="product-badge badge-${p.badge}">${p.badge === 'hot' ? '🔥 Best Seller' : p.badge === 'new' ? '✨ Nouveau' : '💰 Promo'}</span>` : ''}
        <div class="product-actions">
            <button class="action-btn ${inW ? 'wishlisted' : ''}" onclick="event.stopPropagation();toggleWishlist(${p.id})"><i class="fas fa-heart"></i></button>
            <button class="action-btn" onclick="event.stopPropagation();window.location.href='product.html?id=${p.id}'"><i class="fas fa-eye"></i></button>
        </div>
        <div class="product-image" onclick="window.location.href='product.html?id=${p.id}'">
            ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : `<span class="product-emoji">${p.emoji}</span>`}
        </div>
        <div class="product-info">
            <div class="product-cat">${categoryLabels[p.category] || p.category}</div>
            <div class="product-name">${p.name}</div>
            <div class="product-bottom">
                <div>
                    <div class="product-price">${p.price.toLocaleString('fr-DZ')} DA</div>
                    ${p.oldPrice ? `<div class="product-price-old">${p.oldPrice.toLocaleString('fr-DZ')} DA</div>` : ''}
                </div>
                <button class="add-cart-btn" onclick="event.stopPropagation();addToCart(${p.id})"><i class="fas fa-cart-plus"></i></button>
            </div>
        </div>`;
    return card;
}

function filterCategory(cat) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    const filtered = cat === 'all' ? products : products.filter(p => p.category === cat);
    renderProducts(filtered);
    document.getElementById('productsSection').scrollIntoView({ behavior: 'smooth' });
    closeMenu();
}

function searchProducts() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!q) { renderProducts(products); return; }
    renderProducts(products.filter(p => p.name.toLowerCase().includes(q) || p.category.includes(q) || p.desc.toLowerCase().includes(q)));
    document.getElementById('productsSection').scrollIntoView({ behavior: 'smooth' });
}

function addToCart(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const item = cart.find(x => x.id === id);
    if (item) item.qty++; else cart.push({ ...p, qty: 1 });
    saveCart(); updateCartCount();
    showToast(`${p.name} ajouté au panier`, 'success');
}

function removeFromCart(id) {
    cart = cart.filter(x => x.id !== id);
    saveCart(); updateCartCount(); renderCart();
}

function changeQty(id, d) {
    const item = cart.find(x => x.id === id);
    if (!item) return;
    item.qty += d;
    if (item.qty <= 0) { removeFromCart(id); return; }
    saveCart(); renderCart();
}

function saveCart() { localStorage.setItem('ipstore25_cart', JSON.stringify(cart)); }

function updateCartCount() {
    const el = document.getElementById('cartCount');
    if (el) el.textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function renderCart() {
    const c = document.getElementById('cartItems');
    const f = document.getElementById('cartFooter');
    if (cart.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-basket"></i><p>Votre panier est vide</p></div>';
        if (f) f.style.display = 'none';
        return;
    }
    c.innerHTML = cart.map(i => `
        <div class="cart-item">
            <div class="cart-item-img">${i.image ? `<img src="${i.image}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : i.emoji}</div>
            <div class="cart-item-info">
                <div class="cart-item-name">${i.name}</div>
                <div class="cart-item-price">${i.price.toLocaleString('fr-DZ')} DA</div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="changeQty(${i.id},-1)"><i class="fas fa-minus"></i></button>
                    <span class="qty-value">${i.qty}</span>
                    <button class="qty-btn" onclick="changeQty(${i.id},1)"><i class="fas fa-plus"></i></button>
                </div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${i.id})"><i class="fas fa-trash"></i></button>
        </div>`).join('');
    document.getElementById('cartTotal').textContent = cart.reduce((s, i) => s + i.price * i.qty, 0).toLocaleString('fr-DZ') + ' DA';
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

function toggleWishlist(id) {
    const idx = wishlist.indexOf(id);
    if (idx > -1) { wishlist.splice(idx, 1); showToast('Retiré des favoris', 'success'); }
    else { wishlist.push(id); showToast('Ajouté aux favoris', 'success'); }
    localStorage.setItem('ipstore25_wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
}

function updateWishlistCount() {
    const el = document.getElementById('wishlistCount');
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
    const c = document.getElementById('wishlistItems');
    const wp = products.filter(p => wishlist.includes(p.id));
    if (wp.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-heart-broken"></i><p>Aucun favori</p></div>';
        return;
    }
    c.innerHTML = wp.map(i => `
        <div class="cart-item">
            <div class="cart-item-img">${i.image ? `<img src="${i.image}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : i.emoji}</div>
            <div class="cart-item-info">
                <div class="cart-item-name">${i.name}</div>
                <div class="cart-item-price">${i.price.toLocaleString('fr-DZ')} DA</div>
            </div>
            <button class="cart-item-remove" onclick="toggleWishlist(${i.id});renderWishlist()"><i class="fas fa-times"></i></button>
        </div>`).join('');
}

function openModal(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentModalProduct = p;
    document.getElementById('modalImage').innerHTML = p.image ? `<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:cover">` : `<span>${p.emoji}</span>`;
    document.getElementById('modalCategory').textContent = categoryLabels[p.category] || p.category;
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

function checkout() {
    if (cart.length === 0) return;
    const t = cart.reduce((s, i) => s + i.price * i.qty, 0);
    showToast(`Commande passée! Total: ${t.toLocaleString('fr-DZ')} DA`, 'success');
    cart = []; saveCart(); updateCartCount(); closeCart();
}

function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function toggleMenu() { document.getElementById('mainNav').classList.toggle('open'); }
function closeMenu() { document.getElementById('mainNav').classList.remove('open'); }

function closeAll() {
    closeCart(); closeWishlist(); closeModal(); closeMenu();
    document.getElementById('overlay').classList.remove('active');
}

function scrollToProducts() { document.getElementById('productsSection').scrollIntoView({ behavior: 'smooth' }); }

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
