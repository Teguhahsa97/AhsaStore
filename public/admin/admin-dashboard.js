document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors --- //
    const elements = {
        sidebar: document.getElementById('sidebar'),
        sidebarToggle: document.getElementById('sidebar-toggle'),
        mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
        adminContainer: document.querySelector('.admin-container'),
        sidebarNav: document.querySelector('.sidebar-nav'),
        dynamicContent: document.getElementById('dynamic-content'),
        pageTitle: document.getElementById('page-title'),
        breadcrumbCurrent: document.getElementById('breadcrumb-current'),
        themeToggle: document.getElementById('theme-toggle'),
        contentLoader: document.getElementById('content-loader'),
        addProductBtn: document.getElementById('add-product-btn'),
        productModal: document.getElementById('product-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        modalCancelBtn: document.querySelector('.modal-cancel-btn'), // Using querySelector for class
        productForm: document.getElementById('product-form'),
        body: document.body,
        overlay: document.getElementById('overlay'),
    };

    // --- Functions --- //

    /** Handles sidebar collapse for desktop view */
    const handleSidebarToggle = () => {
        elements.sidebar.classList.toggle('collapsed');
        elements.adminContainer.classList.toggle('sidebar-collapsed');
        const isCollapsed = elements.sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    };

    /** Handles sidebar for mobile view */
    const handleMobileMenuToggle = () => {
        elements.sidebar.classList.toggle('open');
        elements.overlay.classList.toggle('active');
    };

    /** Applies the selected theme */
    const applyTheme = (theme) => {
        elements.body.setAttribute('data-theme', theme);
        const icon = elements.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('theme', theme);
    };

    /** Toggles between light and dark theme */
    const toggleTheme = () => {
        const currentTheme = elements.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    };

    /** Logs the user out */
    const logout = () => {
        // In a real app, you'd clear tokens/session here
        window.location.href = '/admin/index.html';
    };

    /** Opens the product modal */
    const openModal = () => {
        if (elements.productModal) elements.productModal.classList.add('active');
    };

    /** Closes any active modal */
    const closeModal = () => {
        if (elements.productModal) elements.productModal.classList.remove('active');
    };

    /** Loads page content dynamically */
    const loadPage = async (page, linkElement) => {
        if (!page || !elements.dynamicContent) return;
        
        // If linkElement is not provided, find it by page data attribute
        const activeLink = linkElement || elements.sidebarNav.querySelector(`a[data-page="${page}"]`);

        // Show loader and hide content
        elements.dynamicContent.classList.add('loading');
        if (elements.contentLoader) elements.contentLoader.style.display = 'flex';
        elements.dynamicContent.innerHTML = ''; 

        // Update Title and Breadcrumb
        const pageName = linkElement.textContent.trim();
        elements.pageTitle.textContent = pageName;
        elements.breadcrumbCurrent.textContent = pageName;

        // Show/hide page-specific buttons
        if (elements.addProductBtn) {
            elements.addProductBtn.style.display = page === 'products' ? 'inline-flex' : 'none';
        }

        try {
            const response = await fetch(`/admin/pages/${page}.html`);
            if (!response.ok) throw new Error(`Halaman tidak ditemukan (Error: ${response.status})`);

            const html = await response.text();
            elements.dynamicContent.innerHTML = html;
            
            // Run page-specific initializers
            if (page === 'api-settings') {
                initApiSettingsPage();
            } else if (page === 'products') {
                initProductsPage();
            }
            // Add other page initializers here, e.g., if (page === 'products') initProductsPage();
        } catch (error) {
            elements.dynamicContent.innerHTML = `<div class="message error">Error: ${error.message}. Halaman tidak dapat dimuat.</div>`;
        }

        // Hide loader and show content with a small delay for animation
        if (elements.contentLoader) elements.contentLoader.style.display = 'none';
        setTimeout(() => {
            elements.dynamicContent.classList.remove('loading');
        }, 50);
    };

    /** Handles all navigation clicks in the sidebar to update hash */
    const handleNavigation = (e) => {
        const link = e.target.closest('a');
        if (!link || !elements.sidebarNav.contains(link)) return;

        // Handle dropdown toggles (e.g., "Pengaturan")
        if (link.classList.contains('dropdown-toggle')) {
            e.preventDefault();
            const parentLi = link.parentElement;
            parentLi.classList.toggle('open');

            // Optional: Close other open submenus if only one should be open at a time
            elements.sidebarNav.querySelectorAll('.has-submenu.open').forEach(item => {
                if (item !== parentLi) {
                    item.classList.remove('open');
                }
            });
            return; // Stop further processing for dropdown toggles
        }

        // Handle actual page links (e.g., Dashboard, Produk, API Settings)
        const navLink = e.target.closest('a[data-page]');
        if (navLink) {
            // Let the default action of the link (changing hash) proceed, which triggers the router.
            // Close mobile menu if it's open.
            if (elements.sidebar.classList.contains('open')) {
                handleMobileMenuToggle();
            }
        }
    };
    /** Updates the active state in the sidebar based on the current page */
    const updateActiveNav = (page) => {
        const link = elements.sidebarNav.querySelector(`a[data-page="${page}"]`);
        if (!link) return;

        const parentLi = link.parentElement;
        // Update active classes
        elements.sidebarNav.querySelectorAll('li.active').forEach(li => li.classList.remove('active'));
        parentLi.classList.add('active');

        const parentSubmenu = parentLi.closest('.has-submenu');
        if (parentSubmenu) {
            parentSubmenu.classList.add('active');
        }

        // Update Title and Breadcrumb
        const pageName = link.textContent.trim();
        elements.pageTitle.textContent = pageName;
        elements.breadcrumbCurrent.textContent = pageName;
    };

    /** Router to handle page loading based on URL hash */
    const router = () => {
        // Get page from hash, default to 'dashboard'
        const page = window.location.hash.substring(1) || 'dashboard';
        const linkElement = elements.sidebarNav.querySelector(`a[data-page="${page}"]`);
        
        if (linkElement) {
            loadPage(page, linkElement);
            updateActiveNav(page);
        } 
    };

    /**
     * A robust, centralized handler for API responses.
     * It checks content-type before parsing and provides better error messages.
     * @param {Response} response - The raw response object from fetch.
     * @returns {Promise<object>} - The parsed JSON data.
     * @throws {Error} - Throws a descriptive error if the response is not ok or not JSON.
     */
    async function handleApiResponse(response) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json(); // Always parse JSON if content-type is JSON
            if (!response.ok || (data && data.success === false)) { // Check response.ok AND data.success
                throw new Error(data.message || `Server error: HTTP status ${response.status}`);
            }
            return data;
        } else {
            // The API returned non-JSON (e.g., an HTML error page).
            throw new Error(`Server returned an unexpected response (not JSON). Status: ${response.status}`);
        }
    }

    // --- Event Listeners --- //
    if (elements.sidebarToggle) elements.sidebarToggle.addEventListener('click', handleSidebarToggle);
    if (elements.mobileMenuToggle) elements.mobileMenuToggle.addEventListener('click', handleMobileMenuToggle);
    if (elements.overlay) elements.overlay.addEventListener('click', handleMobileMenuToggle);
    if (elements.themeToggle) elements.themeToggle.addEventListener('click', toggleTheme);
    if (elements.sidebarNav) elements.sidebarNav.addEventListener('click', handleNavigation);
    if (elements.addProductBtn) elements.addProductBtn.addEventListener('click', openModal);
    if (elements.closeModalBtn) elements.closeModalBtn.addEventListener('click', closeModal);
    if (elements.modalCancelBtn) elements.modalCancelBtn.addEventListener('click', closeModal);
    // Close modal on overlay click
    window.addEventListener('hashchange', router);
    if (elements.productModal) elements.productModal.addEventListener('click', (e) => { if (e.target === elements.productModal) closeModal(); });

    // Delegated listener for all logout buttons
    document.addEventListener('click', (e) => {
        if (e.target.closest('.logout-btn')) {
            logout();
        }
    });

    // --- Initialization --- //

    /** Restore sidebar state from localStorage */
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (window.innerWidth > 768 && savedSidebarState === 'true') {
        elements.sidebar.classList.add('collapsed');
        elements.adminContainer.classList.add('sidebar-collapsed');
    }

    /** Restore theme from localStorage */
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    /** Load initial page based on hash */
    router();

    // --- Page-Specific Initializers --- //

    /**
     * Initializes all functionality for the API Settings page.
     * This function is called from `loadPage` when the 'api-settings' page is loaded.
     */
    function initApiSettingsPage() {
        const digiForm = document.getElementById('digiflazz-settings-form');
        const midtransForm = document.getElementById('midtrans-settings-form');
        const testBtn = document.getElementById('test-digiflazz-btn');
        const messageEl = document.getElementById('api-status-message');

        const showMessage = (type, text) => {
            messageEl.className = `message ${type}`;
            messageEl.textContent = text;
            messageEl.style.display = 'block';
        };

        // Load current settings and populate forms
        const loadSettings = async () => {
            try {
                const response = await fetch('/api/settings/api');
                if (!response.ok) throw new Error('Gagal memuat pengaturan.');
                const settings = await response.json();

                // Populate Digiflazz form
                document.getElementById('digiflazz-username').value = settings.digiflazzUsername || '';
                document.getElementById('digiflazz-dev-key').value = settings.digiflazzDevelopmentKey || '';
                document.getElementById('digiflazz-prod-key').value = settings.digiflazzProductionKey || '';

                // Populate Midtrans form
                document.getElementById('midtrans-client-key').value = settings.midtransClientKey || '';
                document.getElementById('midtrans-server-key').value = settings.midtransServerKey || '';

            } catch (error) {
                showMessage('error', error.message);
            }
        };

        // Generic function to save settings from a form
        const saveSettings = async (formElement) => {
            const formData = new FormData(formElement);
            const payload = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/settings/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await handleApiResponse(response);
                showMessage('success', result.message);
            } catch (error) {
                showMessage('error', error.message);
            }
        };

        // Test Digiflazz Connection
        const testConnection = async () => {
            const username = document.getElementById('digiflazz-username').value;
            const devKey = document.getElementById('digiflazz-dev-key').value;
            testBtn.disabled = true;
            testBtn.querySelector('span').textContent = 'Menguji...';

            try {
                const response = await fetch('/api/digiflazz/test-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, devKey }) });
                const result = await handleApiResponse(response);
                const balance = new Intl.NumberFormat('id-ID').format(result.balance);
                showMessage('success', `${result.message} Saldo Anda: Rp ${balance}`);
            } catch (error) {
                showMessage('error', `Error: ${error.message}`);
            } finally {
                testBtn.disabled = false;
                testBtn.querySelector('span').textContent = 'Tes Koneksi';
            }
        };

        // Attach event listeners
        digiForm.addEventListener('submit', (e) => { e.preventDefault(); saveSettings(digiForm); });
        midtransForm.addEventListener('submit', (e) => { e.preventDefault(); saveSettings(midtransForm); });
        testBtn.addEventListener('click', testConnection);

        // Initial load
        loadSettings();
    }

    /**
     * Initializes all functionality for the Products page.
     * This function is called from `loadPage` when the 'products' page is loaded.
     */
    function initProductsPage() {
        const productsTableBody = document.getElementById('products-table-body');
        const syncProductsBtn = document.getElementById('sync-products-btn');
        const productsStatusMessage = document.getElementById('products-status-message');
        const productCategoryFilter = document.getElementById('product-category-filter');

        const showMessage = (type, text) => {
            productsStatusMessage.className = `message ${type}`;
            productsStatusMessage.textContent = text;
            productsStatusMessage.style.display = 'block';
        };

        let syncCooldownTimer = null; // To store the timer for cooldown
        const SYNC_COOLDOWN_SECONDS = 60; // Cooldown for 60 seconds

        const fetchCategories = async () => {
            try {
                const response = await fetch('/api/products/categories');
                const data = await handleApiResponse(response);
                if (data.success) {
                    // Clear existing options except "Semua Kategori"
                    productCategoryFilter.innerHTML = '<option value="all">Semua Kategori</option>';
                    data.categories.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category;
                        option.textContent = category;
                        productCategoryFilter.appendChild(option);
                    });
                } else {
                    showMessage('error', `Gagal memuat kategori: ${data.message}`);
                }
            } catch (error) {
                showMessage('error', `Gagal memuat kategori: ${error.message}`);
            }
        };

        const fetchProducts = async (selectedCategory = 'all') => {
            productsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Memuat produk...</td></tr>';
            productsStatusMessage.style.display = 'none'; // Hide previous messages
            try {
                const response = await fetch('/api/products');                
                const allProducts = await handleApiResponse(response); // Now fetches from cache/Digiflazz
                
                let productsToDisplay = allProducts;
                if (selectedCategory !== 'all') {
                    productsToDisplay = allProducts.filter(product => product.category === selectedCategory);
                }
                
                productsTableBody.innerHTML = ''; // Clear loading message

                if (productsToDisplay.length === 0) {
                    productsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Tidak ada produk yang ditemukan untuk kategori ini.</td></tr>';
                    return;
                }

                productsToDisplay.forEach(product => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${product.id}</td>
                        <td>${product.name}</td>
                        <td>${product.developer}</td>
                        <td>${product.category}</td>
                        <td><span class="status-badge ${product.status}">${product.status}</span></td>
                        <td class="action-buttons">
                            <button class="btn btn-secondary btn-edit" data-id="${product.id}"><i class="fas fa-edit"></i> Edit</button>
                            <button class="btn btn-danger btn-delete" data-id="${product.id}"><i class="fas fa-trash"></i> Hapus</button>
                        </td>
                    `;
                    productsTableBody.appendChild(row);
                });
            } catch (error) {
                productsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
                showMessage('error', `Gagal memuat produk: ${error.message}`);
            }
        };

        const syncProducts = async () => {
            if (syncCooldownTimer) {
                showMessage('info', `Harap tunggu ${SYNC_COOLDOWN_SECONDS} detik sebelum sinkronisasi berikutnya.`);
                return;
            }

            syncProductsBtn.disabled = true;
            syncProductsBtn.querySelector('span').textContent = 'Menyinkronkan...';
            syncProductsBtn.querySelector('i').className = 'fas fa-spinner fa-spin';
            productsStatusMessage.style.display = 'none'; // Hide previous messages

            // Start cooldown timer
            syncProductsBtn.querySelector('span').textContent = `Sinkronkan (${SYNC_COOLDOWN_SECONDS}s)`;
            let remainingTime = SYNC_COOLDOWN_SECONDS;
            syncCooldownTimer = setInterval(() => {
                remainingTime--;
                syncProductsBtn.querySelector('span').textContent = `Sinkronkan (${remainingTime}s)`;
                if (remainingTime <= 0) {
                    clearInterval(syncCooldownTimer);
                    syncCooldownTimer = null;
                    syncProductsBtn.querySelector('span').textContent = 'Sinkronkan Produk';
                    syncProductsBtn.querySelector('i').className = 'fas fa-sync-alt';
                    syncProductsBtn.disabled = false;
                }
            }, 1000);

            try {
                const response = await fetch('/api/products/sync', { method: 'POST' });
                const result = await handleApiResponse(response);
                showMessage('success', `${result.message} Tampilan akan diperbarui.`);
                // After sync, re-fetch products and categories
                fetchProducts(productCategoryFilter.value); // Keep current filter
                fetchCategories();
            } catch (error) {
                // The cooldown timer will continue regardless of the error, which is the desired behavior for rate limiting.
                showMessage('error', `Sinkronisasi gagal: ${error.message}. Cooldown tetap berjalan.`);
            }
        };

        const deleteProduct = async (productId) => {
            try {
                const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
                const result = await handleApiResponse(response);
                showMessage('success', result.message);
                fetchProducts(productCategoryFilter.value); // Refresh the table, keeping filter
            } catch (error) {
                showMessage('error', `Error: ${error.message}`);
            }
        };

        const handleTableClick = (e) => {
            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) {
                const productId = deleteBtn.dataset.id;
                if (confirm(`Apakah Anda yakin ingin menghapus produk dengan ID: ${productId}?`)) {
                    deleteProduct(productId);
                }
            }

            // Placeholder for edit functionality
            const editBtn = e.target.closest('.btn-edit');
            if (editBtn) {
                alert(`Fungsi edit untuk produk ID: ${editBtn.dataset.id} belum diimplementasikan.`);
            }
        };

        // Attach event listeners
        if (syncProductsBtn) syncProductsBtn.addEventListener('click', syncProducts);
        if (productsTableBody) productsTableBody.addEventListener('click', handleTableClick);
        if (productCategoryFilter) {
            productCategoryFilter.addEventListener('change', (e) => {
                fetchProducts(e.target.value);
            });
        }

        // Initial load of products
        fetchCategories();
        fetchProducts();
    }
});
