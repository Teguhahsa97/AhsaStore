document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;

    // --- Common Elements ---
    const navToggle = document.querySelector('.nav-toggle');
    const navbar = document.querySelector('.navbar');
    const navMenu = document.querySelector('.nav-menu');
    const overlay = document.getElementById('overlay');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = themeToggleBtn.querySelector('i');

    // --- Functions ---

    /**
     * Closes all active modal/overlay elements.
     */
    function closeAllModals() {
        // Close mobile menu
        if (navMenu) navMenu.classList.remove('active');
        if (navToggle) navToggle.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        body.classList.remove('menu-open');

        // Close search bars if they exist on the page
        const desktopSearchBar = document.getElementById('desktop-search-bar');
        const mobileSearchContainer = document.getElementById('mobile-search-container');
        if (desktopSearchBar) desktopSearchBar.classList.remove('active');
        if (mobileSearchContainer) mobileSearchContainer.classList.remove('active');
    }

    function toggleMobileMenu() {
        const isMenuActive = navMenu.classList.contains('active');
        closeAllModals();
        if (!isMenuActive) {
            navMenu.classList.add('active');
            navToggle.classList.add('active');
            if (overlay) overlay.classList.add('active');
            body.classList.add('menu-open');
        }
    }

    function applyTheme(theme) {
        body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            if (themeIcon) themeIcon.className = 'fas fa-sun';
        } else {
            if (themeIcon) themeIcon.className = 'fas fa-moon';
        }
    }

    function toggleTheme() {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    }

    // --- Scroll-triggered animations ---
    function initializeScrollAnimations() {
        const animatedElements = document.querySelectorAll('.scroll-animate');
        if (animatedElements.length > 0) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1
            });
            animatedElements.forEach(el => observer.observe(el));
        }
    }

    // --- Event Listeners ---
    if (navToggle) {
        navToggle.addEventListener('click', toggleMobileMenu);
    }

    if (overlay) {
        overlay.addEventListener('click', closeAllModals);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Navbar scroll effect
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // --- Initial Setup ---
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    initializeScrollAnimations();
});