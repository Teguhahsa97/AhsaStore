document.addEventListener('DOMContentLoaded', () => {
    // Mock discount codes
    const discountCodes = {
        'HEMAT10': { type: 'percent', value: 10 }, // 10% discount
        'DISKON5K': { type: 'fixed', value: 5000 } // Rp 5000 discount
    };

    // State untuk menyimpan detail pesanan saat ini
    let currentOrder = {
        userId: '',
        selectedNominal: null,
        appliedCode: null,
        discountAmount: 0,
        price: 0,
        total: 0,
    };

    // Elemen DOM
    const productImg = document.getElementById('product-img');
    const productName = document.getElementById('product-name');
    const productDeveloper = document.getElementById('product-developer');
    const step1Title = document.getElementById('step-1-title');
    const step1Instruction = document.getElementById('step-1-instruction');
    const userIdInput = document.getElementById('user-id');
    const nominalGrid = document.getElementById('nominal-grid');
    const discountCodeInput = document.getElementById('discount-code');
    const applyDiscountBtn = document.getElementById('apply-discount-btn');
    const discountStatus = document.getElementById('discount-status');
    const buyNowBtn = document.getElementById('buy-now-btn');

    // Elemen Ringkasan
    const summaryUserIdLabel = document.getElementById('summary-user-id-label');
    const summaryUserId = document.getElementById('summary-user-id');
    const summaryDiscountRow = document.getElementById('summary-discount-row');
    const summaryDiscount = document.getElementById('summary-discount');
    const summaryPrice = document.getElementById('summary-price');
    const summaryTotal = document.getElementById('summary-total');

    function formatRupiah(number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(number);
    }

    function updateSummary() {
        summaryUserId.textContent = currentOrder.userId || '-';
        summaryPrice.textContent = formatRupiah(currentOrder.price);

        // Calculate discount
        currentOrder.discountAmount = 0;
        if (currentOrder.appliedCode && currentOrder.selectedNominal) {
            const code = discountCodes[currentOrder.appliedCode];
            if (code.type === 'percent') {
                currentOrder.discountAmount = Math.floor(currentOrder.price * (code.value / 100));
            } else if (code.type === 'fixed') {
                currentOrder.discountAmount = code.value;
            }
            currentOrder.discountAmount = Math.min(currentOrder.price, currentOrder.discountAmount);
            
            summaryDiscountRow.style.display = 'flex';
            summaryDiscount.textContent = `- ${formatRupiah(currentOrder.discountAmount)}`;
        } else {
            summaryDiscountRow.style.display = 'none';
        }

        currentOrder.total = currentOrder.price - currentOrder.discountAmount;
        summaryTotal.textContent = formatRupiah(currentOrder.total);
    }

    async function loadProductData(productKey) {
        try {
            const response = await fetch(`/api/products/${productKey}`);
            if (!response.ok) {
                throw new Error('Produk tidak ditemukan di server.');
            }
            const product = await response.json();

            // 1. Isi info produk (Banner, Judul Halaman)
            productImg.src = `assets/images/${product.image}`; // Tambahkan path ke folder gambar
            productImg.alt = product.name;
            productName.textContent = product.name;
            productDeveloper.textContent = product.developer;
            document.title = `${product.name} - AhsaStore`;

            // 2. Isi Step 1 (Data Akun) secara dinamis - Anda bisa membuat ini lebih canggih
            const fieldLabel = product.category === 'Games' ? 'User ID' : 'Nomor Tujuan';
            step1Title.textContent = `Masukkan ${fieldLabel}`;
            userIdInput.placeholder = `Masukkan ${fieldLabel}`;
            step1Instruction.textContent = `Pastikan ${fieldLabel} yang Anda masukkan sudah benar.`;

            // 3. Isi label di Ringkasan Pesanan
            summaryUserIdLabel.textContent = `${fieldLabel}:`;

            // 4. Isi Pilihan Nominal
            nominalGrid.innerHTML = ''; // Hapus skeleton loader
            product.nominals.forEach(nominal => {
                const card = document.createElement('div');
                card.className = 'nominal-card';
                card.innerHTML = `
                    <div class="nominal-name">${nominal.name}</div>
                    <div class="nominal-price">${formatRupiah(nominal.price)}</div>
                `;
                card.addEventListener('click', () => {
                    const currentActive = nominalGrid.querySelector('.active');
                    if (currentActive) currentActive.classList.remove('active');
                    card.classList.add('active');
                    currentOrder.selectedNominal = nominal;
                    currentOrder.price = nominal.price;
                    updateSummary();
                });
                nominalGrid.appendChild(card);
            });
        } catch (error) {
            console.error('Gagal memuat data produk:', error);
            document.querySelector('.product-detail-container').innerHTML = `
                <div class="section-container" style="padding: 4rem 1rem; text-align: center;">
                    <h1>Oops! Produk Tidak Ditemukan</h1>
                    <p>Produk yang Anda cari tidak ada dalam database kami.</p>
                    <a href="/" style="display: inline-block; margin-top: 1.5rem; padding: 0.8rem 1.5rem; background: #667eea; color: white; text-decoration: none; border-radius: 8px;">Kembali ke Beranda</a>
                </div>
            `;
            const footer = document.querySelector('.footer');
            if (footer) footer.style.display = 'none';
        }
    }

    // --- Event Listeners ---
    userIdInput.addEventListener('input', (e) => {
        currentOrder.userId = e.target.value;
        updateSummary();
    });

    applyDiscountBtn.addEventListener('click', () => {
        const code = discountCodeInput.value.toUpperCase();
        if (!code) {
            discountStatus.textContent = 'Silakan masukkan kode.';
            discountStatus.className = 'input-instruction error';
            return;
        }

        if (discountCodes[code]) {
            currentOrder.appliedCode = code;
            discountStatus.textContent = `Kode "${code}" berhasil diterapkan.`;
            discountStatus.className = 'input-instruction success';
        } else {
            currentOrder.appliedCode = null;
            discountStatus.textContent = 'Kode diskon tidak valid.';
            discountStatus.className = 'input-instruction error';
        }
        updateSummary();
    });

    buyNowBtn.addEventListener('click', () => {
        if (!currentOrder.userId) {
            alert(`Harap masukkan data Anda di Step 1.`);
            userIdInput.focus();
            return;
        }
        if (!currentOrder.selectedNominal) {
            alert('Harap pilih nominal top up.');
            document.getElementById('step-2').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        const whatsapp = document.getElementById('whatsapp-number').value;
        let confirmationMessage = `
            Konfirmasi Pesanan:
            -------------------
            Produk: ${productName.textContent}
            ${summaryUserIdLabel.textContent} ${currentOrder.userId}
            Item: ${currentOrder.selectedNominal.name}
            Harga: ${formatRupiah(currentOrder.price)}`;

        if (currentOrder.discountAmount > 0) {
            confirmationMessage += `
    Diskon: - ${formatRupiah(currentOrder.discountAmount)}`;
        }

        confirmationMessage += `
            Total: ${formatRupiah(currentOrder.total)}
            No. WhatsApp: ${whatsapp || 'Tidak diisi'}
            -------------------
            Lanjutkan pembayaran?
        `;
        if (confirm(confirmationMessage)) {
            alert('Terima kasih! Anda akan diarahkan ke halaman pembayaran. (Simulasi)');
            // Di sini Anda akan mengarahkan ke gateway pembayaran atau menampilkan modal
        }
    });

    // --- Inisialisasi ---
    const urlParams = new URLSearchParams(window.location.search);
    const productKey = urlParams.get('produk');

    if (!productKey) {
        console.error('No product key found in URL.');
        return;
    }
    loadProductData(productKey);
    updateSummary();
});