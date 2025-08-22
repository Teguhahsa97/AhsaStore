const express = require('express');
const path = require('path');
const axios = require('axios'); // Import axios
const crypto = require('crypto'); // Import crypto at the top for clarity and reuse
const fs = require('fs/promises'); // Import fs.promises for file-based caching

const app = express();
const PORT = process.env.PORT || 3001; // Changed port to 3001

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON bodies
app.use(express.json());

// --- Persistent Product Cache Configuration ---
const CACHE_FILE_PATH = path.join(__dirname, 'product-cache.json');
const CACHE_DURATION_MS = 6 * 3600 * 1000; // 6 hours
const METADATA_FILE_PATH = path.join(__dirname, 'product-metadata.json');
let isFetchingProducts = false; // Lock to prevent thundering herd problem


// In-memory API settings (for demonstration)
let apiSettings = {
    digiflazzUsername: '',
    digiflazzDevelopmentKey: '',
    digiflazzProductionKey: '',
    midtransClientKey: '',
    midtransServerKey: ''
};

// =================================================================
// DIGIFLAZZ API CLIENT - LOGIC REFACTOR (ROMBAK TOTAL)
// =================================================================

/**
 * A centralized function to handle all requests to the Digiflazz API.
 * This improves code quality, reusability, and error handling.
 * @param {string} endpoint - The API endpoint path (e.g., '/v1/cek-saldo').
 * @param {object} body - The request body object.
 * @param {boolean} isProduction - Flag to use production or development key.
 * @returns {Promise<object>} - The 'data' object from the Digiflazz response.
 * @param {object} [overrideSettings] - Optional settings to override the global apiSettings for this request.
 * @returns {Promise<object>} - The 'data' object from the Digiflazz response.
 * @throws {Error} - Throws an error if the request fails or API returns an error.
 */
async function digiflazzRequest(endpoint, body, isProduction = false, overrideSettings = {}) {
    const settingsToUse = { ...apiSettings, ...overrideSettings };

    const username = settingsToUse.digiflazzUsername?.trim();
    const apiKey = (isProduction ? settingsToUse.digiflazzProductionKey : settingsToUse.digiflazzDevelopmentKey)?.trim();

    if (!username || !apiKey) {
        throw new Error('Username atau API Key Digiflazz belum diatur di server atau di overrideSettings.');
    }

    // ref_id untuk signature (jangan kirim ke API)
    const refId = body.__sig_ref ?? body.buyer_sku_code ?? 'depo'; // fallback aman
    const sign = crypto.createHash('md5').update(username + apiKey + refId).digest('hex');

    // rakit body final yang DIKIRIM (tanpa field internal)
    const { __sig_ref, testing, ...rest } = body; // 'testing' is also an internal field
    const requestBody = { ...rest, username, sign };

    try {
        const { data, status } = await axios.post(
            `https://api.digiflazz.com${endpoint}`,
            requestBody,
            {
                timeout: 15_000,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'AhsaStore-backend/1.0' // sekadar rapih
                },
                validateStatus: () => true // biar kita bisa baca body saat 4xx/5xx
            }
        );

        if (status < 200 || status >= 300) {
            // tampilkan pesan asli dari server agar gampang debug
            throw new Error(`HTTP ${status} dari Digiflazz: ${JSON.stringify(data)}`);
        }

        // Beberapa endpoint membungkus di "data", sebagian langsung objek.
        const payload = data?.data ?? data;

        // Specific handling for Digiflazz RC: 83 (Rate Limit)
        if (payload?.rc === '83') {
            throw new Error(`Digiflazz API Error: Anda telah mencapai limitasi pengecekan pricelist, silahkan coba beberapa saat lagi (RC: 83)`);
        }

        // Jika ada rc dan bukan '00', anggap error bisnis
        if (payload?.rc && payload.rc !== '00') {
            throw new Error(`Digiflazz API Error: ${payload?.message ?? 'Unknown'} (RC: ${payload.rc})`);
        }

        return payload;
    } catch (err) {
        // Pasang konteks tambahan
        const msg = err?.message || String(err);
        throw new Error(`Koneksi ke Digiflazz gagal: ${msg}`);
    }
}

// --- Route Handlers ---

// Handle favicon requests to prevent 404s in logs
app.get('/favicon.ico', (req, res) => res.status(204).send());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin login route
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;

    // IMPORTANT: Hardcoded credentials for prototype purposes only.
    // In a real application, use a secure way to store and check credentials, e.g., hashing and a database.
    if (username === 'admin' && password === 'password') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }
});

// Route to serve admin pages dynamically
app.get('/admin/pages/:pageName.html', (req, res) => {
    const pageName = req.params.pageName;
    const pagePath = path.join(__dirname, 'public', 'admin', 'pages', `${pageName}.html`);
    res.sendFile(pagePath, (err) => {
        if (err) {
            console.error(`Error serving page ${pageName}:`, err);
            res.status(404).send('Page not found');
        }
    });
});

// --- Product Management with Persistent Caching ---

/**
 * Fetches products from Digiflazz and saves them to the cache file.
 * Implements a lock to prevent simultaneous fetches.
 */
async function fetchAndCacheProducts() {
    if (isFetchingProducts) {
        console.log('Product fetch already in progress. Skipping.');
        return;
    }

    console.log('Starting product fetch from Digiflazz...');
    isFetchingProducts = true;
    try {
        const digiflazzProducts = await digiflazzRequest('/v1/price-list', { cmd: 'all', __sig_ref: 'depo' }, false);
        const mappedProducts = digiflazzProducts.map(p => ({
            id: p.buyer_sku_code,
            name: p.product_name,
            developer: p.brand,
            image: `/assets/images/placeholder.webp`,
            category: p.category,
            price: p.price,
            status: p.status,
            type: p.type
        }));

        const cacheData = {
            timestamp: Date.now(),
            data: mappedProducts
        };

        await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2));
        console.log(`Successfully fetched and cached ${mappedProducts.length} products to file.`);
        return cacheData;
    } catch (error) {
        console.error('[Product Sync Error]', error.message);
        // Re-throw the error so the caller (e.g., manual sync) can handle it
        throw error;
    } finally {
        isFetchingProducts = false; // Release the lock
    }
}

/**
 * Reads the product cache from the file.
 * @returns {Promise<object|null>} The cached data or null if not found/error.
 */
async function readProductCache() {
    try {
        const fileContent = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        // If file doesn't exist (ENOENT) or is invalid, it's not a critical error.
        if (error.code !== 'ENOENT') {
            console.error('Error reading product cache file:', error);
        }
        return null;
    }
}

// API route to get all products using "Stale-While-Revalidate"
app.get('/api/products', async (req, res) => {
    const cache = await readProductCache();

    if (cache) {
        // 1. Immediately serve data from cache (stale or not)
        res.json(cache.data);

        // 2. Check if cache is expired and trigger a background refresh
        if (Date.now() - cache.timestamp > CACHE_DURATION_MS) {
            console.log('Cache is stale. Triggering background refresh.');
            fetchAndCacheProducts().catch(err => console.error('Background cache refresh failed:', err.message));
        }
    } else {
        // Cache file doesn't exist, perform a blocking fetch
        console.log('No cache found. Performing initial blocking fetch.');
        try {
            const newCache = await fetchAndCacheProducts();
            res.json(newCache.data);
        } catch (error) {
            res.status(500).json({ success: false, message: `Gagal memuat produk untuk pertama kali: ${error.message}` });
        }
    }
});

// API route to get a grouped list of products for the homepage
app.get('/api/products/grouped', async (req, res) => {
    try {
        const cache = await readProductCache();
        const metadataFile = await fs.readFile(METADATA_FILE_PATH, 'utf-8');
        const metadata = JSON.parse(metadataFile);
        console.log('--- API /api/products/grouped Request ---');
        console.log('Cache loaded:', cache ? `Contains ${cache.data.length} products.` : 'No cache found.');
        console.log('Metadata loaded:', Object.keys(metadata).length, 'entries.');
        
        // Set headers to prevent browser caching for this API endpoint
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
        res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
        res.setHeader('Expires', '0'); // Proxies.

        if (!cache || cache.data.length === 0) {
            console.log('Returning empty array: Cache is empty or not found.');
            return res.json([]); // Return empty array if no products are cached
        }
        
        const groupedProducts = {};
        const seenDevelopers = new Set(); // To track developers that have at least one active product

        let activeProductsCount = 0;
        let mappedProductsCount = 0;

        cache.data.forEach(product => {
            // Only consider active products for display on the homepage
            if (product.status === 'active') {
                activeProductsCount++;
                const developer = product.developer;
                // Check if we have metadata for this developer
                if (metadata[developer]) {
                    // Add to groupedProducts if not already added
                    if (!groupedProducts[developer]) {
                        mappedProductsCount++;
                        console.log(`Mapping active product for developer: "${developer}" to key: "${metadata[developer].key}"`);
                        groupedProducts[developer] = {
                            name: metadata[developer].name || developer, // Use name from metadata if available, else developer
                            developer: developer,
                            key: metadata[developer].key,
                            image: metadata[developer].image,
                            category: metadata[developer].category,
                        };
                    }
                    seenDevelopers.add(developer); // Mark this developer as having an active product
                };
            }
        });
        
        console.log(`Total active products in cache: ${activeProductsCount}`);
        console.log(`Total unique developers mapped to homepage: ${mappedProductsCount}`);

        // Filter out developers that don't have any active products
        const finalGroupedProducts = Object.values(groupedProducts).filter(p => seenDevelopers.has(p.developer));

        res.json(finalGroupedProducts);
    } catch (error) {
        console.error('Error getting grouped products:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat produk untuk homepage.' });
    }
});

// API route to get unique product categories from cached data
app.get('/api/products/categories', async (req, res) => {
    const cache = await readProductCache();
    if (!cache || cache.data.length === 0) {
        return res.json({ success: true, categories: [] });
    }
    const categories = [...new Set(cache.data.map(p => p.category))];
    res.json({ success: true, categories: categories.sort() });
});

// API route to get a single product's details and its nominals
app.get('/api/products/:productKey', async (req, res) => {
    const { productKey } = req.params;
    const cache = await readProductCache();

    // --- Rombak: Use metadata for image path consistency ---
    const metadataFile = await fs.readFile(METADATA_FILE_PATH, 'utf-8');
    const metadata = JSON.parse(metadataFile);

    console.log(`--- API /api/products/${productKey} Request ---`);
    if (!cache || !cache.data || cache.data.length === 0) {
        console.log('Returning 404: Product data not available or cache is empty.');
        return res.status(404).json({ success: false, message: 'Product data not available or cache is empty. Please sync first.' });
    }

    // Find the first active product that matches the key to get general info
    const firstProduct = cache.data.find(p => {
        const metadataEntry = Object.values(metadata).find(m => m.key === productKey);
        return metadataEntry && p.developer === metadataEntry.name && p.status === 'active';
    });

    if (!firstProduct) {
        console.log(`Returning 404: Product with key '${productKey}' not found or not active.`);
        return res.status(404).json({ success: false, message: `Product with key '${productKey}' not found or not active.` });
    }

    // Find all active nominals for that product brand/developer
    const nominals = cache.data
        .filter(p => p.developer === firstProduct.developer && p.status === 'active')
        .sort((a, b) => a.price - b.price); // Sort by price

    res.json({
        success: true,
        name: metadata[firstProduct.developer]?.name || firstProduct.developer,
        developer: firstProduct.developer,
        // Use image from metadata for consistency
        image: metadata[firstProduct.developer]?.image || `${productKey.toLowerCase()}.webp`,
        nominals: nominals
    });
});

// API route to delete a product from the cache file
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const cache = await readProductCache();
    if (!cache) {
        return res.status(404).json({ success: false, message: 'Cache produk tidak ditemukan untuk dihapus.' });
    }

    const initialLength = cache.data.length;
    cache.data = cache.data.filter(p => p.id !== id);

    if (cache.data.length < initialLength) {
        try {
            await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
            res.json({ success: true, message: `Produk dengan ID ${id} berhasil dihapus dari cache.` });
        } catch (error) {
            console.error('Error writing cache after delete:', error);
            res.status(500).json({ success: false, message: 'Gagal memperbarui cache setelah menghapus produk.' });
        }
    } else {
        res.status(404).json({ success: false, message: 'Produk tidak ditemukan di dalam cache.' });
    }
});
// API route to get API settings
app.get('/api/settings/api', (req, res) => {
    res.json(apiSettings);
});

// API route to update API settings
app.post('/api/settings/api', (req, res) => {
    const { digiflazzUsername, digiflazzDevelopmentKey, digiflazzProductionKey, midtransClientKey, midtransServerKey } = req.body;
    
    // Trim whitespace from inputs to prevent common copy-paste errors
    apiSettings.digiflazzUsername = digiflazzUsername ? digiflazzUsername.trim() : '';
    apiSettings.digiflazzDevelopmentKey = digiflazzDevelopmentKey ? digiflazzDevelopmentKey.trim() : '';
    apiSettings.digiflazzProductionKey = digiflazzProductionKey ? digiflazzProductionKey.trim() : '';
    
    // Save Midtrans settings
    apiSettings.midtransClientKey = midtransClientKey ? midtransClientKey.trim() : '';
    apiSettings.midtransServerKey = midtransServerKey ? midtransServerKey.trim() : '';
    res.json({ success: true, message: 'Pengaturan API berhasil disimpan.' });
});

// API route to test Digiflazz connection
// This endpoint can accept credentials directly for testing, or use saved ones if not provided.
app.post('/api/digiflazz/test-connection', async (req, res) => {
    const { username: testUsername, devKey: testDevKey } = req.body;

    try {
        // Temporarily override apiSettings for testing if credentials are provided in the request body
        const currentUsername = testUsername || apiSettings.digiflazzUsername;
        const currentDevKey = testDevKey || apiSettings.digiflazzDevelopmentKey;

        if (!currentUsername || !currentDevKey) {
            throw new Error('Username atau Development Key Digiflazz belum diatur.');
        }

        // Create a temporary apiSettings object for the digiflazzRequest function
        const tempApiSettings = {
            digiflazzUsername: currentUsername,
            digiflazzDevelopmentKey: currentDevKey,
            digiflazzProductionKey: apiSettings.digiflazzProductionKey // Keep production key as is
        };

        // Format resmi cek saldo Digiflazz:
        // endpoint: /v1/cek-saldo
        // body dikirim: { cmd: 'deposit', username, sign }
        // sign = md5(username + apiKey + 'depo')
        const data = await digiflazzRequest(
            '/v1/cek-saldo',
            { cmd: 'deposit', __sig_ref: 'depo' }, // __sig_ref hanya untuk signature
            false, // gunakan development key
            tempApiSettings
        );

        res.status(200).json({
            success: true,
            message: 'Koneksi Digiflazz berhasil!',
            balance: data.deposit
        });
    } catch (error) {
        console.error('[Tes Koneksi Error]', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API route to MANUALLY synchronize products from Digiflazz
app.post('/api/products/sync', async (req, res) => {
    try {
        // This is now a blocking call that waits for the fetch to complete
        const newCache = await fetchAndCacheProducts();
        res.status(200).json({ success: true, message: `Berhasil menyinkronkan ${newCache.data.length} produk dari Digiflazz.`, productsCount: newCache.data.length });
    } catch (error) {
        // The error is already logged inside fetchAndCacheProducts
        res.status(500).json({ success: false, message: `Gagal menyinkronkan produk: ${error.message}` });
    }
});

// API route to get Digiflazz products by category/brand
app.post('/api/digiflazz/products', async (req, res) => {
    const { brand, type } = req.body; // 'brand' is Digiflazz's category, 'type' is prepaid/postpaid

    try { // This endpoint is not currently used by the admin panel, but fixed for consistency
        const requestBody = { cmd: type || 'all', __sig_ref: 'depo' }; // Changed cmd to 'all'
        const data = await digiflazzRequest('/v1/price-list', requestBody, false); // Changed endpoint

        let filteredProducts = data;
        if (brand) {
            filteredProducts = data.filter(product => product.brand === brand);
        }
        
        res.status(200).json({
            success: true,
            products: filteredProducts
        });
    } catch (error) {
        console.error('[Get Products Error]', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API route to handle Digiflazz transactions
app.post('/api/digiflazz/transaction', async (req, res) => {
    const { buyer_sku_code, customer_no, ref_id, testing, production } = req.body;

    if (!buyer_sku_code || !customer_no || !ref_id) {
        return res.status(400).json({ success: false, message: 'buyer_sku_code, customer_no, dan ref_id diperlukan.' });
    }

    try {
        const requestBody = {
            buyer_sku_code,
            customer_no,
            ref_id,
            // Optional: Add other fields like 'msg' for custom messages if needed
            __sig_ref: testing || ref_id // Use ref_id for signature if testing is not provided
        };

        const isProduction = production === true; // Determine if production key should be used

        const data = await digiflazzRequest('/v1/transaction', requestBody, isProduction);

        res.status(200).json({
            success: true,
            message: 'Transaksi berhasil diproses.',
            transaction: data
        });
    } catch (error) {
        console.error('[Transaction Error]', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API route for Digiflazz Webhook/Callback
app.post('/api/digiflazz/webhook', (req, res) => {
    const callbackData = req.body;
    console.log('Digiflazz Callback Received:', JSON.stringify(callbackData, null, 2));

    // IMPORTANT: Implement robust logic here to:
    // 1. Verify the callback signature (Digiflazz provides a mechanism for this).
    // 2. Find the corresponding order in your database using callbackData.ref_id.
    // 3. Update the order status based on callbackData.status (e.g., 'Sukses', 'Gagal', 'Pending').
    // 4. Handle successful transactions (e.g., credit user, send confirmation).
    // 5. Handle failed transactions (e.g., refund user, log error).

    // For now, just acknowledge receipt.
    res.status(200).json({ success: true, message: 'Callback received' });
});


// Start server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
