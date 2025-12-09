const SUPABASE_URL = 'https://ozivukumwofkhpruzoig.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aXZ1a3Vtd29ma2hwcnV6b2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTIzMjQsImV4cCI6MjA3NzQyODMyNH0.GgT7ssx4NXXDPb1tXyuRjpM1yi245Gf62gAjx7jTBcg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let USER_ID = null, STORE = null, PRODUCTS = [], networkMonitorInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    const app = document.getElementById('app-container');
    const splashText = document.getElementById('splash-text');
    const splashScreen = document.getElementById('splash-screen');
    let currentSession = null;

    const initializeView = (session) => {
        const hasSession = !!session;
        splashText.textContent = hasSession ? 'Sesión encontrada. Cargando menú...' : 'No hay sesión.';
        
        app.innerHTML = ''; // Limpiar contenedor
        const template = document.getElementById(hasSession ? 'template-menu' : 'template-login');
        const view = template.content.cloneNode(true);
        app.appendChild(view);
        
        setTimeout(() => {
            splashScreen.style.opacity = '0';
            splashScreen.style.pointerEvents = 'none';
            const viewElement = app.querySelector('.view');
            if (viewElement) viewElement.classList.add('active');

            if (hasSession) {
                USER_ID = session.user.id;
                initializeMenu();
            }
        }, 300);
        
        currentSession = session;
    };

    // Offline-first session verification
    splashText.textContent = 'Verificando sesión...';
    const isOnline = navigator.onLine;
    
    if (isOnline) {
        // ONLINE: Validate token with server
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            // Valid session - store token for offline use
            localStorage.setItem('session_token', session.access_token);
            localStorage.setItem('user_id', session.user.id);
            initializeView(session);
        } else {
            // No valid session - clear stored token
            localStorage.removeItem('session_token');
            localStorage.removeItem('user_id');
            initializeView(null);
        }
    } else {
        // OFFLINE: Check for cached token
        const cachedToken = localStorage.getItem('session_token');
        const cachedUserId = localStorage.getItem('user_id');
        
        if (cachedToken && cachedUserId) {
            // Create a minimal session object for offline use
            const offlineSession = {
                access_token: cachedToken,
                user: { id: cachedUserId }
            };
            initializeView(offlineSession);
        } else {
            // No cached token - redirect to login
            initializeView(null);
        }
    }
    
    // Listen for auth changes (login/logout)
    supabase.auth.onAuthStateChange((_event, newSession) => {
        // Only reinitialize if session state actually changed
        if ((!currentSession && newSession) || (currentSession && !newSession)) {
            // Store token on successful login
            if (newSession) {
                localStorage.setItem('session_token', newSession.access_token);
                localStorage.setItem('user_id', newSession.user.id);
            } else {
                // Clear token on logout
                localStorage.removeItem('session_token');
                localStorage.removeItem('user_id');
            }
            initializeView(newSession);
        }
    });
});

/**
 * Toggle between login and register sub-views
 */
function showSubView(subViewId) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (subViewId === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
}

/**
 * Handle login form submission
 */
async function handleLogin() {
    const email = document.getElementById('l-email').value.trim();
    const password = document.getElementById('l-pass').value;
    
    if (!email || !password) {
        return showToast('Completa los campos');
    }
    
    const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) {
        showToast(`Error: ${error.message}`);
    }
}

/**
 * Handle registration form submission
 */
async function handleRegister() {
    const email = document.getElementById('r-email').value.trim();
    const password = document.getElementById('r-pass').value;
    const confirmPassword = document.getElementById('r-pass-confirm').value;
    
    if (!email || !password) {
        return showToast('Completa campos');
    }
    
    if (password.length < 6) {
        return showToast('Contraseña muy corta');
    }
    
    if (password !== confirmPassword) {
        return showToast('Las contraseñas no coinciden');
    }
    
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password
    });
    
    if (error) {
        showToast(`Error: ${error.message}`);
    } else {
        showToast('¡Cuenta creada! Revisa tu correo para confirmar.');
        showSubView('login');
    }
}

/**
 * Handle user logout
 */
async function handleLogout() {
    try {
        await supabase.auth.signOut();
    } finally {
        localStorage.removeItem('session_token');
        localStorage.removeItem('user_id');
    }
}

/**
 * Initialize the main menu view
 */
function initializeMenu() {
    loadCache();
    renderAllUI();
    refreshData();
    startNetworkMonitor();
    navigateTo('products-page', document.querySelector('.nav-item[data-page="products-page"]'));
}

/**
 * Load cached data from localStorage
 */
function loadCache() {
    const storeCache = localStorage.getItem('store_cache');
    if (storeCache && storeCache !== 'null' && storeCache !== 'undefined') {
        try {
            STORE = JSON.parse(storeCache);
        } catch (e) {
            console.error('Error parsing store cache:', e);
            localStorage.removeItem('store_cache');
        }
    }
    
    const productsCache = localStorage.getItem('products_cache');
    if (productsCache && productsCache !== 'null' && productsCache !== 'undefined') {
        try {
            PRODUCTS = JSON.parse(productsCache);
        } catch (e) {
            console.error('Error parsing products cache:', e);
            localStorage.removeItem('products_cache');
        }
    }
}

/**
 * Refresh data from Supabase and update cache
 */
async function refreshData() {
    if (!USER_ID) {
        return;
    }
    
    // Fetch store request
    const { data: storeData } = await supabase
        .from('store_requests')
        .select('*')
        .eq('user_id', USER_ID)
        .maybeSingle();
    
    STORE = storeData;
    localStorage.setItem('store_cache', JSON.stringify(storeData));
    
    // Fetch products if store is approved
    if (STORE?.status === 'approved') {
        const { data: productsData } = await supabase
            .from('products')
            .select('*')
            .eq('store_id', STORE.id)
            .order('name', { ascending: true });
        
        PRODUCTS = productsData || [];
    } else {
        PRODUCTS = [];
    }
    
    localStorage.setItem('products_cache', JSON.stringify(PRODUCTS));
    renderAllUI();
}

/**
 * Render all UI sections
 */
function renderAllUI() {
    renderStore();
    renderProducts();
    renderSettings();
}

/**
 * Render the store page
 */
function renderStore() {
    const storePage = document.getElementById('store-page');
    if (!storePage) {
        return;
    }
    
    if (!STORE) {
        // No store request yet
        storePage.innerHTML = renderEmptyState(
            'storefront',
            'Sin Tienda',
            'Crea tu perfil para vender.',
            'Crear Tienda',
            'openStoreModal()'
        );
    } else if (STORE.status === 'approved') {
        // Store is approved - show details
        storePage.innerHTML = `
            <div class="card" style="position:relative;">
                <button 
                    class="icon-btn" 
                    onclick="openStoreModal()" 
                    style="position:absolute;top:12px;right:12px;"
                    aria-label="Editar tienda"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden="true">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
                <h2 class="md-typescale-title-medium" style="color:var(--md-sys-color-primary);padding-right:40px;">
                    ${STORE.business_name}
                </h2>
                <p class="md-typescale-body-medium" style="color:var(--md-sys-color-on-surface-variant);margin-top:4px;">
                    ${STORE.business_type || 'Negocio'}
                </p>
                <div class="md-typescale-body-medium" style="margin-top:16px;color:var(--md-sys-color-on-surface-variant);display:flex;flex-direction:column;gap:8px;">
                    <div>📞 ${STORE.phone}</div>
                    <div>✉️ ${STORE.email}</div>
                    <div>📍 ${STORE.address || 'Sin dirección'}</div>
                </div>
            </div>
        `;
    } else {
        // Store is pending or rejected
        const isRejected = STORE.status === 'rejected';
        storePage.innerHTML = renderEmptyState(
            isRejected ? 'error' : 'pending',
            isRejected ? 'Rechazada' : 'En Revisión',
            STORE.rejection_reason || 'Tu solicitud se está procesando.',
            'Actualizar',
            'refreshData()',
            true
        );
    }
}

/**
 * Render the products page
 */
function renderProducts() {
    const productsPage = document.getElementById('products-page');
    if (!productsPage) {
        return;
    }
    
    if (!STORE || STORE.status !== 'approved') {
        productsPage.innerHTML = renderEmptyState(
            'lock',
            'Tienda No Aprobada',
            'Necesitas una tienda activa para agregar productos.',
            'Ir a Tienda',
            "navigateTo('store-page',document.querySelector('[data-page=store-page]'))",
            true
        );
    } else if (PRODUCTS.length === 0) {
        productsPage.innerHTML = renderEmptyState(
            'inventory_2',
            'Sin Productos',
            'Usa el botón <b>+</b> para agregar tu primer producto.'
        );
    } else {
        productsPage.innerHTML = PRODUCTS.map(product => {
            const productId = JSON.stringify(product.id);
            return `
                <div class="card card-product">
                    <div style="flex:1;">
                        <div class="name md-typescale-body-large">${product.name}</div>
                        <div class="category md-typescale-body-small">${product.category || 'General'}</div>
                    </div>
                    <div class="card-actions">
                        <div class="price">${'$' + product.price}</div>
                        <button 
                            class="icon-btn" 
                            onclick="showProductMenu(${productId})"
                            aria-label="Opciones del producto ${product.name}"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden="true">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

/**
 * Render the settings page
 */
function renderSettings() {
    const settingsPage = document.getElementById('settings-page');
    if (!settingsPage) {
        return;
    }
    
    // Only show delete store button if user has a store
    const deleteStoreSection = STORE ? `
        <div class="card" onclick="confirmDeleteStore()" style="cursor:pointer;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:16px;">
                <div style="width:40px;height:40px;background:var(--md-sys-color-error-container);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                    <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:var(--md-sys-color-error);" aria-hidden="true">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </div>
                <div class="md-typescale-body-large" style="color:var(--md-sys-color-error);font-weight:500;">
                    Eliminar Tienda
                </div>
            </div>
        </div>
    ` : '';
    
    settingsPage.innerHTML = `
        ${deleteStoreSection}
        <div class="card" onclick="handleLogout()" style="cursor:pointer;">
            <div style="display:flex;align-items:center;gap:16px;">
                <div style="width:40px;height:40px;background:var(--md-sys-color-error-container);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                    <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:var(--md-sys-color-error);" aria-hidden="true">
                        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                    </svg>
                </div>
                <div class="md-typescale-body-large" style="color:var(--md-sys-color-error);font-weight:500;">
                    Cerrar Sesión
                </div>
            </div>
        </div>
    `;
}

/**
 * Render empty state component
 */
function renderEmptyState(iconType, title, subtitle, buttonText, buttonAction, isSecondaryButton) {
    const icons = {
        storefront: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg>',
        inventory_2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>',
        lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C9.24 2 7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v3H9V7c0-1.66 1.34-3 3-3z"/></svg>',
        pending: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>',
        error: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
    };
    
    const buttonTag = isSecondaryButton ? 'md-filled-tonal-button' : 'md-filled-button';
    const buttonHtml = buttonText 
        ? `<${buttonTag} onclick="${buttonAction}" style="margin-top:16px;">${buttonText}</${buttonTag}>` 
        : '';
    
    return `
        <div class="empty-state">
            ${icons[iconType]}
            <h3 class="md-typescale-title-medium">${title}</h3>
            <p class="md-typescale-body-medium">${subtitle}</p>
            ${buttonHtml}
        </div>
    `;
}

/**
 * Navigate to a different page within the app
 */
function navigateTo(pageId, navButton) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });
    
    // Show selected page
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.classList.add('active');
        selectedPage.style.display = 'block';
    }
    
    // Update navigation buttons
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    if (navButton) {
        navButton.classList.add('active');
    }
    
    // Update page title
    const titles = {
        'products-page': 'Productos',
        'store-page': 'Mi Tienda',
        'settings-page': 'Ajustes'
    };
    
    const titleElement = document.getElementById('page-title');
    if (titleElement) {
        titleElement.textContent = titles[pageId];
    }
    
    updateFabVisibility();
}

/**
 * Update FAB visibility based on current page
 */
function updateFabVisibility() {
    const fab = document.getElementById('fab');
    if (!fab) {
        return;
    }
    
    const isProductsPage = document.getElementById('products-page')?.classList.contains('active');
    fab.style.display = (isProductsPage && STORE?.status === 'approved') ? 'inline-flex' : 'none';
}

/**
 * Open modal dialog
 */
function openModal(html) {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `<div class="modal" onclick="event.stopPropagation()">${html}</div>`;
    overlay.classList.add('active');
}

/**
 * Close modal dialog
 */
function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
}

/**
 * Open bottom sheet menu
 */
function openBottomSheet(html) {
    const overlay = document.getElementById('bottom-sheet-menu');
    overlay.innerHTML = `<div class="bottom-sheet-content" onclick="event.stopPropagation()">${html}</div>`;
    overlay.classList.add('active');
}

/**
 * Close bottom sheet menu
 */
function closeBottomSheet() {
    const overlay = document.getElementById('bottom-sheet-menu');
    overlay.classList.remove('active');
}

/**
 * Open store modal for creating/editing store
 */
function openStoreModal(storeData = null) {
    // If no storeData provided but STORE exists, use STORE for editing
    if (!storeData && STORE) {
        storeData = STORE;
    }
    
    const title = storeData ? 'Editar' : 'Crear';
    
    openModal(`
        <div class="modal-title md-typescale-headline-small">${title} Tienda</div>
        <md-outlined-text-field
            id="st-name"
            label="Nombre del Negocio"
            value="${storeData?.business_name || ''}"
            aria-label="Nombre del Negocio"
            style="width:100%;margin-bottom:12px;">
        </md-outlined-text-field>
        <md-outlined-text-field
            id="st-type"
            label="Tipo de Negocio"
            value="${storeData?.business_type || ''}"
            aria-label="Tipo de Negocio"
            style="width:100%;margin-bottom:12px;">
        </md-outlined-text-field>
        <md-outlined-text-field
            id="st-phone"
            label="Teléfono"
            type="tel"
            value="${storeData?.phone || ''}"
            aria-label="Teléfono"
            style="width:100%;margin-bottom:12px;">
        </md-outlined-text-field>
        <md-outlined-text-field
            id="st-email"
            label="Email"
            type="email"
            value="${storeData?.email || ''}"
            aria-label="Email"
            style="width:100%;margin-bottom:12px;">
        </md-outlined-text-field>
        <md-outlined-text-field
            id="st-address"
            label="Dirección"
            value="${storeData?.address || ''}"
            aria-label="Dirección"
            style="width:100%;margin-bottom:12px;">
        </md-outlined-text-field>
        <div class="modal-actions">
            <md-text-button onclick="closeModal()">Cancelar</md-text-button>
            <md-filled-button id="store-save-btn" onclick="submitStore()">Guardar</md-filled-button>
        </div>
    `);
}

/**
 * Submit store form
 */
async function submitStore() {
    const businessName = document.getElementById('st-name').value.trim();
    const phone = document.getElementById('st-phone').value.trim();
    const email = document.getElementById('st-email').value.trim();
    const saveBtn = document.getElementById('store-save-btn');
    
    if (!businessName || !phone || !email) {
        return showToast('Nombre, teléfono y email requeridos');
    }
    
    // Disable button and show loading state
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
    }
    
    const storeData = {
        user_id: USER_ID,
        business_name: businessName,
        business_type: document.getElementById('st-type').value.trim(),
        phone: phone,
        email: email,
        address: document.getElementById('st-address').value.trim(),
        status: STORE?.status || 'pending'
    };
    
    const result = STORE
        ? await supabase.from('store_requests').update(storeData).eq('user_id', USER_ID)
        : await supabase.from('store_requests').insert([storeData]);
    
    if (result.error) {
        showToast(`Error: ${result.error.message}`);
        // Re-enable button on error
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar';
        }
    } else {
        closeModal();
        showToast(STORE ? 'Tienda actualizada' : 'Solicitud enviada');
        await refreshData();
    }
}

/**
 * Open product modal for creating/editing product
 */
function openProductModal(productId = null) {
    // Close bottom sheet if coming from edit action
    if (productId) {
        closeBottomSheet();
    }
    
    // Find product data if editing
    const normalizedId = productId != null ? String(productId) : null;
    const productData = normalizedId ? PRODUCTS.find(p => String(p.id) === normalizedId) : null;
    
    const title = productData ? 'Editar' : 'Nuevo';
    const productIdLiteral = JSON.stringify(productId);
    
    openModal(`
        <div class="modal-title md-typescale-headline-small">${title} Producto</div>
        <md-outlined-text-field
            id="p-name"
            label="Nombre del Producto"
            placeholder="Nombre"
            value="${productData?.name || ''}"
            aria-label="Nombre del Producto"
            style="width:100%;margin-bottom:12px;">
        </md-outlined-text-field>
        <md-outlined-text-field
            id="p-price"
            label="Precio"
            type="number"
            placeholder="Precio"
            value="${productData?.price || ''}"
            aria-label="Precio"
            style="width:100%;margin-bottom:12px;">
        </md-outlined-text-field>
        <md-outlined-text-field
            id="p-cat"
            label="Categoría"
            placeholder="Categoría"
            value="${productData?.category || ''}"
            aria-label="Categoría"
            style="width:100%;margin-bottom:12px;">
        </md-outlined-text-field>
        <div class="modal-actions">
            <md-text-button onclick="closeModal()">Cancelar</md-text-button>
            <md-filled-button id="product-save-btn" onclick="submitProduct(${productIdLiteral})">Guardar</md-filled-button>
        </div>
    `);
}

/**
 * Submit product form
 */
async function submitProduct(productId = null) {
    const name = document.getElementById('p-name').value.trim();
    const price = document.getElementById('p-price').value;
    const saveBtn = document.getElementById('product-save-btn');
    
    if (!name || !price) {
        return showToast('Nombre y precio requeridos');
    }
    
    // Disable button and show loading state
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
    }
    
    const productData = {
        store_id: STORE.id,
        name: name,
        price: parseFloat(price),
        category: document.getElementById('p-cat').value.trim()
    };
    
    const { error } = productId
        ? await supabase.from('products').update(productData).eq('id', productId)
        : await supabase.from('products').insert([productData]);
    
    if (error) {
        showToast(`Error: ${error.message}`);
        // Re-enable button on error
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar';
        }
    } else {
        closeModal();
        showToast('Producto guardado');
        await refreshData();
    }
}

/**
 * Show product options menu (bottom sheet)
 */
function showProductMenu(productId) {
    const normalizedId = productId != null ? String(productId) : '';
    const product = PRODUCTS.find(p => String(p.id) === normalizedId);
    if (!product) {
        showToast('Producto no encontrado');
        return;
    }
    
    openBottomSheet(`
        <div class="bottom-sheet-title md-typescale-title-medium">${product.name}</div>
        <button class="bottom-sheet-item md-typescale-body-large" onclick="openProductModal(${JSON.stringify(product.id)})">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Editar
        </button>
        <button class="bottom-sheet-item md-typescale-body-large" onclick="deleteProduct(${JSON.stringify(product.id)})">
            <svg viewBox="0 0 24 24" style="fill:var(--md-sys-color-error)" aria-hidden="true">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            <span style="color:var(--md-sys-color-error)">Eliminar</span>
        </button>
    `);
}

/**
 * Delete product
 */
async function deleteProduct(productId) {
    if (!confirm('¿Seguro que quieres eliminar este producto?')) {
        return;
    }
    
    closeBottomSheet();
    
    const product = PRODUCTS.find(p => String(p.id) === String(productId));
    if (!product) {
        showToast('Producto no encontrado');
        return;
    }
    
    // Client-side ownership check for better UX (real security is enforced by Supabase RLS policies)
    if (!STORE || STORE.user_id !== USER_ID) {
        showToast('Error: No tienes permiso para eliminar este producto');
        return;
    }
    
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    
    if (error) {
        showToast(`Error: ${error.message}`);
    } else {
        showToast('Producto eliminado');
        await refreshData();
    }
}

/**
 * Confirm delete store with modal
 */
function confirmDeleteStore() {
    openModal(`
        <div class="modal-title md-typescale-headline-small">¿Eliminar Tienda?</div>
        <p class="md-typescale-body-medium" style="color:var(--md-sys-color-on-surface-variant);line-height:20px;margin-bottom:24px;">
            Esta acción eliminará permanentemente tu tienda y todos los productos asociados. Esta operación no se puede deshacer.
        </p>
        <div class="modal-actions">
            <md-text-button onclick="closeModal()">Cancelar</md-text-button>
            <md-filled-button id="delete-store-btn" onclick="deleteStore()" style="background:var(--md-sys-color-error);color:var(--md-sys-color-on-error);">Eliminar</md-filled-button>
        </div>
    `);
}

/**
 * Delete store and all associated products
 */
async function deleteStore() {
    if (!STORE) {
        return;
    }
    
    // Client-side ownership check for better UX (real security is enforced by Supabase RLS policies)
    if (STORE.user_id !== USER_ID) {
        showToast('Error: No tienes permiso para eliminar esta tienda');
        closeModal();
        return;
    }
    
    const deleteBtn = document.getElementById('delete-store-btn');
    
    // Disable button and show loading state
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Eliminando...';
    }
    
    // First delete all products associated with this store
    const { error: productsError } = await supabase
        .from('products')
        .delete()
        .eq('store_id', STORE.id);
    
    if (productsError) {
        showToast(`Error al eliminar productos: ${productsError.message}`);
        // Re-enable button on error
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = 'Eliminar';
        }
        return;
    }
    
    // Then delete the store request
    const { error: storeError } = await supabase
        .from('store_requests')
        .delete()
        .eq('user_id', USER_ID);
    
    if (storeError) {
        showToast(`Error al eliminar tienda: ${storeError.message}`);
        // Re-enable button on error
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = 'Eliminar';
        }
        return;
    }
    
    // Clear local cache
    STORE = null;
    PRODUCTS = [];
    localStorage.removeItem('store_cache');
    localStorage.removeItem('products_cache');
    
    closeModal();
    showToast('Tienda eliminada correctamente');
    
    // Refresh UI
    renderAllUI();
    
    // Navigate to store page to show the "create store" option
    navigateTo('store-page', document.querySelector('.nav-item[data-page="store-page"]'));
}

/**
 * Start network connection monitor
 */
function startNetworkMonitor() {
    if (networkMonitorInterval) {
        clearInterval(networkMonitorInterval);
    }
    
    checkConnection();
    networkMonitorInterval = setInterval(checkConnection, 15000);
}

/**
 * Check network connection status
 */
async function checkConnection() {
    const statusChip = document.getElementById('status-chip');
    const statusText = document.getElementById('status-text');
    
    if (!statusChip || !statusText) {
        return;
    }
    
    statusChip.className = 'status-chip checking';
    statusText.textContent = 'Verificando';
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        await fetch(SUPABASE_URL, {
            signal: controller.signal,
            method: 'HEAD',
            mode: 'no-cors'
        });
        
        clearTimeout(timeoutId);
        statusChip.className = 'status-chip online';
        statusText.textContent = 'Conectado';
    } catch (error) {
        statusChip.className = 'status-chip offline';
        statusText.textContent = 'Desconectado';
    }
}

/**
 * Show toast message
 */
function showToast(message) {
    // Check if Android interface is available (WebView)
    if (typeof Android !== 'undefined' && Android.showToast) {
        Android.showToast(message);
    } else {
        // Fallback to alert for web browsers
        alert(message);
    }
}

// Export functions to window object for onclick handlers in HTML
window.showSubView = showSubView;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.navigateTo = navigateTo;
window.openProductModal = openProductModal;
window.submitProduct = submitProduct;
window.showProductMenu = showProductMenu;
window.deleteProduct = deleteProduct;
window.openStoreModal = openStoreModal;
window.submitStore = submitStore;
window.confirmDeleteStore = confirmDeleteStore;
window.deleteStore = deleteStore;
window.closeModal = closeModal;
window.closeBottomSheet = closeBottomSheet;
window.refreshData = refreshData;
