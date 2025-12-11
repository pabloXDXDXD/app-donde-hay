const SUPABASE_URL = 'https://ozivukumwofkhpruzoig.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aXZ1a3Vtd29ma2hwcnV6b2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTIzMjQsImV4cCI6MjA3NzQyODMyNH0.GgT7ssx4NXXDPb1tXyuRjpM1yi245Gf62gAjx7jTBcg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let USER_ID = null, STORE = null, PRODUCTS = [], networkMonitorInterval = null;
let IS_LOADING_ONLINE = false, LAST_SYNC_FROM_CACHE = false;
const SKELETON_PLACEHOLDER_COUNT = 6;
const LOCAL_ID_PREFIX = 'local-';
let PENDING_OPERATIONS = [];
let PENDING_SYNC_COUNT = 0;
const PENDING_OPS_KEY = 'pending_ops';
let LOCAL_ID_COUNTER = 0;

function generateLocalId(entity) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `${LOCAL_ID_PREFIX}${entity}-${crypto.randomUUID()}`;
    }
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const buffer = new Uint32Array(2);
        crypto.getRandomValues(buffer);
        return `${LOCAL_ID_PREFIX}${entity}-${buffer[0].toString(16)}-${buffer[1].toString(16)}-${++LOCAL_ID_COUNTER}`;
    }
    return `${LOCAL_ID_PREFIX}${entity}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}-${++LOCAL_ID_COUNTER}`;
}

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
    
    // Try to detect online status with fallback
    let isOnline = navigator.onLine;
    console.log('Session verification started. navigator.onLine:', isOnline);
    
    // If navigator.onLine is unreliable (common in WebView), try a quick network check
    if (isOnline) {
        try {
            console.log('Attempting quick network check...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            await fetch(SUPABASE_URL, {
                signal: controller.signal,
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            console.log('Network check successful - device is online');
        } catch (error) {
            console.warn('Network check failed, device may be offline:', error.message);
            isOnline = false;
        }
    }
    
    if (isOnline) {
        // ONLINE: Validate token with server
        console.log('Device is online, validating session with server');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                // Valid session - store token for offline use
                console.log('Valid session found, storing token for offline use');
                localStorage.setItem('session_token', session.access_token);
                localStorage.setItem('user_id', session.user.id);
                console.log('Session token and user_id saved to localStorage');
                initializeView(session);
            } else {
                // No valid session - clear stored token
                console.log('No valid session found, clearing stored tokens');
                localStorage.removeItem('session_token');
                localStorage.removeItem('user_id');
                initializeView(null);
            }
        } catch (error) {
            console.error('Error getting session from server, falling back to offline mode:', error);
            // Fallback to offline mode if server request fails
            isOnline = false;
        }
    }
    
    if (!isOnline) {
        // OFFLINE: Check for cached token
        console.log('Device is offline, checking for cached session');
        const cachedToken = localStorage.getItem('session_token');
        const cachedUserId = localStorage.getItem('user_id');
        console.log('Cached token exists:', !!cachedToken);
        console.log('Cached userId exists:', !!cachedUserId);
        
        if (cachedToken && cachedUserId) {
            // Create a minimal session object for offline use
            console.log('Creating offline session with cached credentials');
            const offlineSession = {
                access_token: cachedToken,
                user: { id: cachedUserId }
            };
            initializeView(offlineSession);
        } else {
            // No cached token - redirect to login
            console.log('No cached credentials found, showing login screen');
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
                STORE = null;
                PRODUCTS = [];
            } else {
                // Clear token on logout
                localStorage.removeItem('session_token');
                localStorage.removeItem('user_id');
                STORE = null;
                PRODUCTS = [];
            }
            initializeView(newSession);
        }
    });
    
    window.addEventListener('online', () => {
        LAST_SYNC_FROM_CACHE = PENDING_OPERATIONS.length > 0;
        syncPendingOperations().then(() => refreshData());
    });
    
    window.addEventListener('offline', () => {
        LAST_SYNC_FROM_CACHE = true;
        renderAllUI();
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
        localStorage.removeItem('store_cache');
        localStorage.removeItem('products_cache');
        localStorage.removeItem(PENDING_OPS_KEY);
        STORE = null;
        PRODUCTS = [];
        PENDING_OPERATIONS = [];
        PENDING_SYNC_COUNT = 0;
    }
}

/**
 * Initialize the main menu view
 */
function initializeMenu() {
    console.log('Initializing menu view');
    
    // Verify critical DOM elements exist
    const bottomSheet = document.getElementById('bottom-sheet-menu');
    const modalOverlay = document.getElementById('modal-overlay');
    console.log('Bottom sheet element exists:', !!bottomSheet);
    console.log('Modal overlay element exists:', !!modalOverlay);
    
    if (!bottomSheet) {
        console.error('Critical: bottom-sheet-menu element not found in DOM!');
    }
    
    loadCache();
    renderAllUI();
    refreshData();
    startNetworkMonitor();
    navigateTo('products-page', document.querySelector('.nav-item[data-page="products-page"]'));
}

/**
 * Load cached store/products for offline usage
 */
function loadCache() {
    const cachedUserId = localStorage.getItem('user_id');
    if (cachedUserId !== USER_ID) {
        localStorage.removeItem('store_cache');
        localStorage.removeItem('products_cache');
        localStorage.removeItem(PENDING_OPS_KEY);
        STORE = null;
        PRODUCTS = [];
        PENDING_OPERATIONS = [];
        PENDING_SYNC_COUNT = 0;
        return;
    }

    const parseCache = (key) => {
        const raw = localStorage.getItem(key);
        if (!raw || raw === 'null' || raw === 'undefined') {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    };

    const cachedStore = parseCache('store_cache');
    const cachedProducts = parseCache('products_cache');
    const cachedPending = parseCache(PENDING_OPS_KEY);

    STORE = cachedStore || null;
    PRODUCTS = Array.isArray(cachedProducts) ? cachedProducts : [];
    PENDING_OPERATIONS = Array.isArray(cachedPending) ? cachedPending : [];
    PENDING_SYNC_COUNT = PENDING_OPERATIONS.length;
    const loadedFromCache = !!cachedStore || (Array.isArray(cachedProducts) && cachedProducts.length > 0);
    LAST_SYNC_FROM_CACHE = loadedFromCache;
}

function persistCache() {
    localStorage.setItem('store_cache', JSON.stringify(STORE));
    localStorage.setItem('products_cache', JSON.stringify(PRODUCTS));
}

function persistPendingOperations() {
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(PENDING_OPERATIONS));
    PENDING_SYNC_COUNT = PENDING_OPERATIONS.length;
}

function isLocalId(value) {
    return typeof value === 'string' && value.startsWith(LOCAL_ID_PREFIX);
}

function queuePendingOperation(operation) {
    const op = {
        id: operation.id || generateLocalId('op'),
        ...operation
    };
    
    if (op.type === 'product_upsert') {
        const existingIndex = PENDING_OPERATIONS.findIndex(item => 
            item.type === 'product_upsert' && item.payload?.productId === op.payload?.productId
        );
        if (existingIndex >= 0) {
            PENDING_OPERATIONS[existingIndex] = op;
        } else {
            PENDING_OPERATIONS.push(op);
        }
    } else {
        PENDING_OPERATIONS.push(op);
    }
    
    persistPendingOperations();
}

function removePendingOperation(opId) {
    PENDING_OPERATIONS = PENDING_OPERATIONS.filter(op => op.id !== opId);
    persistPendingOperations();
}

function updateProductIdMapping(localId, remoteId) {
    PRODUCTS = PRODUCTS.map(product => {
        if (String(product.id) === String(localId)) {
            return { ...product, id: remoteId };
        }
        return product;
    });
    
    PENDING_OPERATIONS = PENDING_OPERATIONS.map(op => {
        if (op.type === 'product_upsert' && String(op.payload?.productId) === String(localId)) {
            return { ...op, payload: { ...op.payload, productId: remoteId } };
        }
        if (op.type === 'product_delete' && String(op.payload?.productId) === String(localId)) {
            return { ...op, payload: { ...op.payload, productId: remoteId } };
        }
        return op;
    });
    
    persistPendingOperations();
    persistCache();
}

function updateStoreIdMapping(oldId, newId) {
    PRODUCTS = PRODUCTS.map(product => {
        if (String(product.store_id) === String(oldId)) {
            return { ...product, store_id: newId };
        }
        return product;
    });
    
    PENDING_OPERATIONS = PENDING_OPERATIONS.map(op => {
        if (op.type === 'product_upsert' && String(op.payload?.data?.store_id) === String(oldId)) {
            return { ...op, payload: { ...op.payload, data: { ...op.payload.data, store_id: newId } } };
        }
        if (op.type === 'store_delete' && String(op.payload?.storeId) === String(oldId)) {
            return { ...op, payload: { ...op.payload, storeId: newId } };
        }
        return op;
    });
    
    persistPendingOperations();
    persistCache();
}

async function syncStoreOperation(payload) {
    const data = { ...payload.data, user_id: USER_ID };
    const sendData = { ...data };
    const hadLocalId = isLocalId(sendData.id);
    
    if (hadLocalId) {
        delete sendData.id;
    }
    
    const storeQuery = supabase.from('store_requests');
    const result = (!hadLocalId && STORE && !isLocalId(STORE.id))
        ? await storeQuery.update(sendData).eq('user_id', USER_ID)
        : await storeQuery.insert([sendData]);
    
    if (result.error) {
        throw result.error;
    }
    
    const savedStore = Array.isArray(result.data) ? result.data[0] : (result.data || data);
    const previousId = STORE?.id || data.id;
    STORE = savedStore || data;
    if (previousId && STORE.id && String(previousId) !== String(STORE.id)) {
        updateStoreIdMapping(previousId, STORE.id);
    }
    persistCache();
}

async function syncProductUpsert(payload) {
    const productData = { ...payload.data };
    const storeId = productData.store_id || STORE?.id;
    
    if (isLocalId(productData.id)) {
        delete productData.id;
    }
    
    if (!storeId || isLocalId(storeId)) {
        throw new Error('La tienda debe sincronizarse antes de agregar productos. Conéctate a internet e inténtalo nuevamente.');
    }
    
    productData.store_id = storeId;
    const hasRemoteId = !isLocalId(payload.productId);
    
    const result = hasRemoteId
        ? await supabase.from('products').update(productData).eq('id', payload.productId)
        : await supabase.from('products').insert([productData]);
    
    if (result.error) {
        throw result.error;
    }
    
    const savedProduct = Array.isArray(result.data) ? result.data[0] : result.data;
    if (savedProduct?.id && !hasRemoteId) {
        updateProductIdMapping(payload.productId, savedProduct.id);
    }
    persistCache();
}

async function syncProductDelete(payload) {
    if (!payload?.productId || isLocalId(payload.productId)) {
        return;
    }
    const { error } = await supabase.from('products').delete().eq('id', payload.productId);
    if (error) {
        throw error;
    }
}

async function syncStoreDelete(payload) {
    if (!payload?.storeId) {
        return;
    }
    const { error: productsError } = await supabase.from('products').delete().eq('store_id', payload.storeId);
    if (productsError) {
        throw productsError;
    }
    const { error } = await supabase.from('store_requests').delete().eq('user_id', USER_ID);
    if (error) {
        throw error;
    }
}

async function syncPendingOperations() {
    if (!USER_ID || !navigator.onLine) {
        return false;
    }
    if (PENDING_OPERATIONS.length === 0) {
        return true;
    }
    
    const operationsSnapshot = [...PENDING_OPERATIONS];
    for (const operation of operationsSnapshot) {
        try {
            if (operation.type === 'store_upsert') {
                await syncStoreOperation(operation.payload);
            } else if (operation.type === 'product_upsert') {
                await syncProductUpsert(operation.payload);
            } else if (operation.type === 'product_delete') {
                await syncProductDelete(operation.payload);
            } else if (operation.type === 'store_delete') {
                await syncStoreDelete(operation.payload);
            }
            removePendingOperation(operation.id);
        } catch (error) {
            console.error('Error synchronizing pending operation', error);
            return false;
        }
    }
    
    if (PENDING_OPERATIONS.length === 0) {
        LAST_SYNC_FROM_CACHE = false;
    }
    return true;
}

/**
 * Refresh data from Supabase and update cache
 */
async function refreshData() {
    if (!USER_ID) {
        return;
    }

    if (!navigator.onLine) {
        LAST_SYNC_FROM_CACHE = true;
        IS_LOADING_ONLINE = false;
        renderAllUI();
        return;
    }

    IS_LOADING_ONLINE = true;
    renderAllUI();

    try {
        if (PENDING_OPERATIONS.length > 0) {
            await syncPendingOperations();
        }
        // Fetch store request
        const { data: storeData, error: storeError } = await supabase
            .from('store_requests')
            .select('*')
            .eq('user_id', USER_ID)
            .maybeSingle();

        if (storeError) {
            throw storeError;
        }

        STORE = storeData || null;
        
        // Fetch products if store is approved
        if (STORE?.status === 'approved') {
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select('*')
                .eq('store_id', STORE.id)
                .order('name', { ascending: true });
            
            if (productsError) {
                throw productsError;
            }

            PRODUCTS = productsData || [];
        } else {
            PRODUCTS = [];
        }

        persistCache();
        LAST_SYNC_FROM_CACHE = PENDING_OPERATIONS.length > 0;
        PENDING_SYNC_COUNT = PENDING_OPERATIONS.length;
    } catch (error) {
        console.error('Error refreshing data:', error);
        LAST_SYNC_FROM_CACHE = true;
        showToast('No se pudo cargar la información en línea.');
    } finally {
        IS_LOADING_ONLINE = false;
        renderAllUI();
    }
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
                <md-icon-button 
                    onclick="openStoreModal()" 
                    style="position:absolute;top:12px;right:12px;"
                    aria-label="Editar tienda"
                    touch-target="wrapper"
                >
                    ${renderIcon('./icons/edit.svg', 24, 'slot="icon"')}
                </md-icon-button>
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

    const renderBanner = () => {
        const hasPending = PENDING_SYNC_COUNT > 0;
        const isSyncing = IS_LOADING_ONLINE;
        let baseMessage = 'Productos sincronizados';
        let detail = 'Todos los datos están al día.';
        let toneClass = 'sync-banner success';
        
        if (isSyncing) {
            baseMessage = 'Sincronizando productos';
            detail = 'Actualizando datos desde la nube...';
            toneClass = 'sync-banner warning';
        } else if (LAST_SYNC_FROM_CACHE) {
            baseMessage = 'Productos en caché (sin conexión)';
            detail = 'Mostrando los últimos datos guardados.';
            toneClass = 'sync-banner warning';
        } else if (hasPending) {
            baseMessage = 'Cambios pendientes de sincronizar';
            detail = `${PENDING_SYNC_COUNT} cambio(s) pendientes por enviar.`;
            toneClass = 'sync-banner warning';
        }
        
        const loader = isSyncing ? `<div class="banner-loader" role="status" aria-label="Sincronizando datos" aria-live="polite"></div>` : '';
        return `
            <div class="card ${toneClass}">
                <div class="banner-header">
                    <div>
                        <div class="md-typescale-title-small">${baseMessage}</div>
                        <p class="md-typescale-body-small" style="margin-top:4px;">${detail}</p>
                    </div>
                    ${loader}
                </div>
            </div>
        `;
    };

    if (!STORE || STORE.status !== 'approved') {
        productsPage.innerHTML = renderEmptyState(
            'lock',
            'Tienda No Aprobada',
            'Necesitas una tienda activa para agregar productos.',
            'Ir a Tienda',
            "navigateTo('store-page',document.querySelector('[data-page=store-page]'))",
            true
        );
    } else {
        const banner = renderBanner();
        if (PRODUCTS.length === 0) {
            const emptyState = IS_LOADING_ONLINE
                ? `
                    <div class="card" aria-live="polite">
                        <div class="md-typescale-body-medium" style="color:var(--md-sys-color-on-surface-variant);display:flex;align-items:center;gap:8px;">
                            <div class="banner-loader" aria-hidden="true"></div>
                            <span>Cargando productos...</span>
                        </div>
                    </div>
                `
                : renderEmptyState(
                    'inventory_2',
                    'Sin Productos',
                    'Usa el botón <b>+</b> para agregar tu primer producto.'
                );
            productsPage.innerHTML = banner + emptyState;
            return;
        }
        productsPage.innerHTML = banner + PRODUCTS.map(product => {
            const productIdLiteral = JSON.stringify(product.id);
            return `
                <div class="card card-product">
                    <div style="flex:1;">
                        <div class="name md-typescale-body-large">${product.name}</div>
                        <div class="category md-typescale-body-small">${product.category || 'General'}</div>
                    </div>
                    <div class="card-actions">
                        <div class="price">${'$' + product.price}</div>
                        <md-icon-button
                            onclick="showProductMenu(${productIdLiteral})"
                            aria-label="Opciones del producto ${product.name}"
                            touch-target="wrapper"
                        >
                            ${renderIcon('./icons/more-vert.svg', 24, 'slot="icon"')}
                        </md-icon-button>
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
                <div style="width:40px;height:40px;background:var(--md-sys-color-error-container);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--md-sys-color-error);">
                    ${renderIcon('./icons/delete-forever.svg', 20)}
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
                <div style="width:40px;height:40px;background:var(--md-sys-color-error-container);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--md-sys-color-error);">
                    ${renderIcon('./icons/logout.svg', 20)}
                </div>
                <div class="md-typescale-body-large" style="color:var(--md-sys-color-error);font-weight:500;">
                    Cerrar Sesión
                </div>
            </div>
        </div>
    `;
}

function renderIcon(path, size = 24, extraAttrs = '') {
    const attrs = extraAttrs ? ` ${extraAttrs}` : '';
    // Use data-icon-path for debugging and potential fallbacks
    return `<span class="icon" style="--icon-url:url('${path}');width:${size}px;height:${size}px;" data-icon-path="${path}" aria-hidden="true"${attrs}></span>`;
}

/**
 * Render empty state component
 */
function renderEmptyState(iconType, title, subtitle, buttonText, buttonAction, isSecondaryButton) {
    const icons = {
        storefront: renderIcon('./icons/storefront.svg', 48),
        inventory_2: renderIcon('./icons/inventory-2.svg', 48),
        lock: renderIcon('./icons/block.svg', 48),
        pending: renderIcon('./icons/package.svg', 48),
        error: renderIcon('./icons/delete-forever.svg', 48)
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
    console.log('openBottomSheet called');
    const overlay = document.getElementById('bottom-sheet-menu');
    if (!overlay) {
        console.error('Bottom sheet overlay element not found in DOM');
        return false;
    }
    console.log('Bottom sheet overlay found, adding content');
    overlay.innerHTML = `<div class="bottom-sheet-content" onclick="event.stopPropagation()">${html}</div>`;
    
    // Add click handler to close when clicking on overlay background only
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            closeBottomSheet();
        }
    };
    
    // Use requestAnimationFrame to ensure the DOM is updated and rendered
    // before adding the active class, which triggers the CSS transition
    requestAnimationFrame(() => {
        overlay.classList.add('active');
        console.log('Bottom sheet should now be visible with class:', overlay.className);
        
        // Additional debug: log the overlay's computed styles
        const computedStyle = window.getComputedStyle(overlay);
        console.log('Bottom sheet display:', computedStyle.display);
        console.log('Bottom sheet opacity:', computedStyle.opacity);
        console.log('Bottom sheet z-index:', computedStyle.zIndex);
    });
    
    return true;
}

/**
 * Close bottom sheet menu
 */
function closeBottomSheet() {
    console.log('closeBottomSheet called');
    const overlay = document.getElementById('bottom-sheet-menu');
    if (!overlay) {
        console.error('Bottom sheet overlay not found when trying to close');
        return;
    }
    overlay.classList.remove('active');
    console.log('Bottom sheet closed, class removed');
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
        id: STORE?.id || generateLocalId('store'),
        business_name: businessName,
        business_type: document.getElementById('st-type').value.trim(),
        phone: phone,
        email: email,
        address: document.getElementById('st-address').value.trim(),
        status: STORE?.status || 'pending'
    };
    
    STORE = { ...storeData };
    persistCache();
    LAST_SYNC_FROM_CACHE = !navigator.onLine || PENDING_OPERATIONS.length > 0;
    renderAllUI();
    
    queuePendingOperation({
        type: 'store_upsert',
        payload: { data: storeData }
    });
    
    closeModal();
    showToast('Tienda guardada localmente');
    
    if (navigator.onLine) {
        await syncPendingOperations();
        await refreshData();
    }
    
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

/**
 * Find product by ID with normalized comparison
 */
function findProductById(productId) {
    if (productId === null || productId === undefined) {
        return null;
    }
    const normalizedId = String(productId);
    return PRODUCTS.find(p => String(p.id) === normalizedId);
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
    const productData = productId !== null && productId !== undefined ? findProductById(productId) : null;
    
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
    
    const hasProductId = productId !== null && productId !== undefined;
    const product = hasProductId ? findProductById(productId) : null;
    if (hasProductId && !product) {
        return showToast('Producto no encontrado');
    }
    
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
    
    const productIdToUse = product?.id || generateLocalId('product');
    const localProduct = { id: productIdToUse, ...productData };
    
    if (product) {
        PRODUCTS = PRODUCTS.map(item => String(item.id) === String(productIdToUse) ? localProduct : item);
    } else {
        PRODUCTS = [...PRODUCTS, localProduct];
    }
    
    persistCache();
    LAST_SYNC_FROM_CACHE = !navigator.onLine || PENDING_OPERATIONS.length > 0;
    renderAllUI();
    
    queuePendingOperation({
        type: 'product_upsert',
        payload: {
            productId: productIdToUse,
            data: localProduct
        }
    });
    
    closeModal();
    showToast('Producto guardado localmente');
    
    if (navigator.onLine) {
        await syncPendingOperations();
        await refreshData();
    }
    
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

/**
 * Show product options menu (bottom sheet)
 */
function showProductMenu(productId) {
    console.log('showProductMenu called with productId:', productId);
    const product = findProductById(productId);
    if (!product) {
        console.error('Product not found:', productId);
        showToast('Producto no encontrado');
        return;
    }
    console.log('Product found:', product.name);
    
    const menuHtml = `
        <div class="bottom-sheet-title md-typescale-title-medium">${product.name}</div>
        <button class="bottom-sheet-item md-typescale-body-large" onclick="closeBottomSheet(); openProductModal(${JSON.stringify(product.id)})" aria-label="Editar ${product.name}">
            ${renderIcon('./icons/edit.svg')}
            Editar
        </button>
        <button class="bottom-sheet-item md-typescale-body-large" style="color:var(--md-sys-color-error);" onclick="closeBottomSheet(); deleteProduct(${JSON.stringify(product.id)})" aria-label="Eliminar ${product.name}">
            ${renderIcon('./icons/delete.svg')}
            <span>Eliminar</span>
        </button>
    `;

    console.log('Attempting to open bottom sheet');
    const opened = openBottomSheet(menuHtml);
    if (!opened) {
        console.warn('Bottom sheet failed to open, showing modal fallback');
        openModal(`
            <div class="modal-title md-typescale-headline-small">${product.name}</div>
            <div class="modal-actions" style="justify-content: space-between; width: 100%;">
                <md-text-button onclick="closeModal()">Cerrar</md-text-button>
                <md-filled-tonal-button style="color:var(--md-sys-color-error);" onclick="closeModal(); deleteProduct(${JSON.stringify(product.id)})">Eliminar</md-filled-tonal-button>
                <md-filled-button onclick="closeModal(); openProductModal(${JSON.stringify(product.id)})">Editar</md-filled-button>
            </div>
        `);
    } else {
        console.log('Bottom sheet opened successfully');
    }
}

/**
 * Delete product
 */
async function deleteProduct(productId) {
    if (!confirm('¿Seguro que quieres eliminar este producto?')) {
        return;
    }
    
    closeBottomSheet();
    
    const product = findProductById(productId);
    if (!product) {
        showToast('Producto no encontrado');
        return;
    }
    
    // Client-side ownership check for better UX (real security is enforced by Supabase RLS policies)
    if (!STORE || STORE.user_id !== USER_ID) {
        showToast('Error: No tienes permiso para eliminar este producto');
        return;
    }
    
    PRODUCTS = PRODUCTS.filter(p => String(p.id) !== String(product.id));
    persistCache();
    
    // Remove pending upserts for the same product
    PENDING_OPERATIONS = PENDING_OPERATIONS.filter(op => !(op.type === 'product_upsert' && String(op.payload?.productId) === String(product.id)));
    persistPendingOperations();
    
    if (!isLocalId(product.id)) {
        queuePendingOperation({
            type: 'product_delete',
            payload: { productId: product.id }
        });
    }
    
    LAST_SYNC_FROM_CACHE = !navigator.onLine || PENDING_OPERATIONS.length > 0;
    renderAllUI();
    showToast('Producto eliminado localmente');
    
    if (navigator.onLine) {
        await syncPendingOperations();
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
    const storeId = STORE.id;
    
    STORE = null;
    PRODUCTS = [];
    localStorage.removeItem('store_cache');
    localStorage.removeItem('products_cache');
    
    const clearedTypes = ['store_upsert', 'store_delete', 'product_upsert', 'product_delete'];
    PENDING_OPERATIONS = PENDING_OPERATIONS.filter(op => !clearedTypes.includes(op.type));
    queuePendingOperation({
        type: 'store_delete',
        payload: { storeId }
    });
    
    LAST_SYNC_FROM_CACHE = true;
    persistCache();
    renderAllUI();
    closeModal();
    showToast('Tienda eliminada localmente');
    
    navigateTo('store-page', document.querySelector('.nav-item[data-page="store-page"]'));
    
    if (navigator.onLine) {
        await syncPendingOperations();
        await refreshData();
    }
    
    if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Eliminar';
    }
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
            method: 'HEAD'
        });
        
        clearTimeout(timeoutId);
        statusChip.className = 'status-chip online';
        statusText.textContent = 'Conectado';
        
        if (PENDING_OPERATIONS.length > 0) {
            await syncPendingOperations();
            await refreshData();
        }
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
