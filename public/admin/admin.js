// For now, this file will be for the login logic.
// I will add more to it later for other admin pages.
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = e.target.username.value;
            const password = e.target.password.value;
            const errorMessage = document.getElementById('error-message');

            try {
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (data.success) {
                    window.location.href = '/admin/dashboard.html';
                    errorMessage.classList.remove('show');
                } else {
                    errorMessage.textContent = data.message || 'Login gagal.';
                    errorMessage.classList.add('show');
                }
            } catch (error) {
                errorMessage.textContent = 'Terjadi kesalahan. Silakan coba lagi.';
                errorMessage.classList.add('show');
            }
        });
    }
});
