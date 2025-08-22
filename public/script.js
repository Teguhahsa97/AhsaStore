document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const popularGrid = document.querySelector('.popular-products-grid');
    const popularLoader = document.getElementById('popular-products-loader');
    const allProductsGrid = document.getElementById('all-products-grid');
    const categoryFiltersContainer = document.getElementById('category-filters');
    const loadMoreBtn = document.getElementById('load-more-btn');

    // --- State Management ---
    let masterProductList = [];
    let filteredProductList = [];
    let displayedCount = 0;
    const PRODUCTS_PER_PAGE = 12; // Number of products to show per "load more" click

    // --- Functions ---

    /**
     * Creates an HTML element for a single product card.
     */
    function createProductCard(product) {
        const card = document.createElement('a');
        card.href = `produk-detail.html?produk=${product.key}`;
        card.className = 'product-card';
        card.dataset.category = product.category;

        // **CRUCIAL FIX**: Added 'assets/images/' to the image path.
        card.innerHTML = `
            <img src="assets/images/${product.image}" alt="${product.name}" class="product-image" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-developer">${product.developer}</p>
            </div>
        `;
        return card;
    }

    /**
     * Renders a slice of products to the main grid.
     */
    function renderMoreProducts() {
        if (!allProductsGrid || !loadMoreBtn) return;

        const productsToRender = filteredProductList.slice(displayedCount, displayedCount + PRODUCTS_PER_PAGE);
        
        productsToRender.forEach(product => {
            const card = createProductCard(product);
            allProductsGrid.appendChild(card);
        });

        displayedCount += productsToRender.length;

        if (displayedCount >= filteredProductList.length) {
            loadMoreBtn.classList.add('hidden');
        } else {
            loadMoreBtn.classList.remove('hidden');
        }
    }

    /**
     * Handles category filter button clicks.
     */
    function applyFilter(category) {
        if (category === 'all') {
            filteredProductList = [...masterProductList];
        } else {
            filteredProductList = masterProductList.filter(p => p.category === category);
        }

        allProductsGrid.innerHTML = '';
        displayedCount = 0;
        renderMoreProducts();
    }

    /**
     * Fetches all data and initializes the homepage components.
     */
    async function initializeHomepage() {
        console.log('Initializing homepage...');
        try {
            const response = await fetch('/api/products/grouped');
            console.log('API Response Status:', response.status);
            if (!response.ok) throw new Error(`Gagal mengambil data produk dari server. Status: ${response.status}`);
            
            masterProductList = await response.json();
            console.log(`Successfully fetched ${masterProductList.length} grouped products.`);

            if (popularLoader) popularLoader.style.display = 'none';

            if (masterProductList.length === 0) {
                popularGrid.innerHTML = '<p class="info-message">Tidak ada produk populer yang tersedia saat ini.</p>';
                allProductsGrid.innerHTML = '<p class="info-message">Tidak ada produk yang tersedia. Silakan cek kembali nanti.</p>';
                loadMoreBtn.classList.add('hidden');
                return;
            }

            filteredProductList = [...masterProductList];

            // 1. Populate Popular Products
            const popularProducts = masterProductList.slice(0, 6);
            popularGrid.innerHTML = '';
            popularProducts.forEach(product => {
                popularGrid.appendChild(createProductCard(product));
            });
            console.log(`Rendered ${popularProducts.length} popular products.`);

            // 2. Populate Category Filters
            const categories = [...new Set(masterProductList.map(p => p.category).filter(Boolean))].sort();
            categoryFiltersContainer.innerHTML = '<button class="filter-btn active" data-category="all">Semua</button>';
            categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'filter-btn';
                btn.dataset.category = cat;
                btn.textContent = cat.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                categoryFiltersContainer.appendChild(btn);
            });
            console.log(`Rendered ${categories.length} category filters.`);

            // 3. Render initial "All Products"
            renderMoreProducts();

        } catch (error) {
            console.error('Error initializing homepage:', error);
            const errorMessage = `<p class="info-message error">${error.message}</p>`;
            if (popularGrid) popularGrid.innerHTML = errorMessage;
            if (allProductsGrid) allProductsGrid.innerHTML = errorMessage;
            if (popularLoader) popularLoader.style.display = 'none';
        }
    }

    // --- Event Listeners ---
    if (categoryFiltersContainer) {
        categoryFiltersContainer.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
                categoryFiltersContainer.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                applyFilter(e.target.dataset.category);
            }
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', renderMoreProducts);
    }

    // --- Initial Load ---
    initializeHomepage();
});