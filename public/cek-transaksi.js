document.addEventListener('DOMContentLoaded', () => {
    // --- Page-Specific Elements ---
    const transactionForm = document.getElementById('transaction-form');
    const transactionIdInput = document.getElementById('transaction-id-input');
    const resultContainer = document.getElementById('transaction-result');

    const mockTransactions = {
        'AHS-123XYZ': {
            id: 'AHS-123XYZ',
            product: '100 Diamonds Mobile Legends',
            date: '15 Oktober 2024, 10:30 WIB',
            status: 'success',
            statusText: 'Berhasil'
        },
        'AHS-456ABC': {
            id: 'AHS-456ABC',
            product: '250 UC PUBG Mobile',
            date: '15 Oktober 2024, 11:00 WIB',
            status: 'pending',
            statusText: 'Diproses'
        },
        'AHS-789DEF': {
            id: 'AHS-789DEF',
            product: 'Voucher Google Play Rp 50.000',
            date: '14 Oktober 2024, 15:00 WIB',
            status: 'failed',
            statusText: 'Gagal'
        }
    };

    // --- Transaction Check Logic ---

    function displayResult(transaction) {
        resultContainer.innerHTML = ''; // Clear previous results

        let resultHTML;

        if (transaction) {
            resultHTML = `
                <div class="result-card ${transaction.status}">
                    <div class="result-header">
                        <h2 class="result-title">Detail Transaksi</h2>
                        <span class="result-status ${transaction.status}">${transaction.statusText}</span>
                    </div>
                    <div class="result-details">
                        <p><strong>ID Transaksi:</strong> ${transaction.id}</p>
                        <p><strong>Produk:</strong> ${transaction.product}</p>
                        <p><strong>Tanggal:</strong> ${transaction.date}</p>
                    </div>
                </div>
            `;
        } else {
            resultHTML = `
                <div class="result-card not-found">
                    <div class="result-header">
                        <h2 class="result-title">Transaksi Tidak Ditemukan</h2>
                        <span class="result-status not-found">Error</span>
                    </div>
                    <div class="result-details">
                        <p>Pastikan ID Transaksi yang Anda masukkan sudah benar dan coba lagi.</p>
                    </div>
                </div>
            `;
        }

        resultContainer.innerHTML = resultHTML;
    }

    // --- Event Listeners ---
    if (transactionForm) {
        transactionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const transactionId = transactionIdInput.value.trim().toUpperCase();
            if (!transactionId) return;

            const transaction = mockTransactions[transactionId];
            displayResult(transaction);
        });
    }
});