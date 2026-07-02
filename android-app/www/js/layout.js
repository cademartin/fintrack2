document.addEventListener('DOMContentLoaded', () => {
    showSpinnerLoader();
    // Restore session on page load
    const user = Session.get();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    DB.init(user);
    initLayout();
});

async function initLayout() {
    const wrapper = document.getElementById('layout-wrapper');
    if (!wrapper) {
        hideSpinnerLoader();
        return;
    }

    // Get current username & settings
    let username = '';
    let settings = {
        currency: 'USD',
        theme: 'light',
        primaryColor: '#16a34a',
        secondaryColor: '#ffffff',
        backgroundColor: '#ffffff',
        fontFamily: 'Outfit'
    };

    try {
        username = LocalAPI.get_current_username();
        settings = LocalAPI.get_settings();
    } catch (e) {
        console.error('Failed to load settings or username', e);
    }

    // Determine current page filename (e.g. dashboard.html)
    const path = window.location.pathname;
    const filename = path.replace(/\\/g, '/').split('/').pop() || 'dashboard.html';

    // Build the sidebar navigation links HTML
    const pages = [
        { name: 'Dashboard', file: 'dashboard.html' },
        { name: 'Tea Entries', file: 'tea_entries.html' },
        { name: 'Finances', file: 'finances.html' },
        { name: 'Accounts', file: 'accounts.html' },
        { name: 'Loans & Debts', file: 'loans_debts.html' },
        { name: 'Settings', file: 'settings.html' }
    ];

    const navLinksHtml = pages.map(p => {
        const isActive = filename === p.file;
        const activeClass = 'bg-green-50 text-green-600 dark-sidebar-active';
        const inactiveClass = 'text-gray-700 hover:bg-green-50 hover:text-green-600';
        return `
            <a href="${p.file}"
                class="flex items-center px-4 py-2 rounded-lg group font-medium ${isActive ? activeClass : inactiveClass}">
                <span>${p.name}</span>
            </a>
        `;
    }).join('');

    // Create the layout structure
    const container = document.createElement('div');
    container.className = 'flex h-screen overflow-hidden';
    container.innerHTML = `
        <!-- Mobile Menu Button -->
        <button id="mobileMenuBtn"
            class="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md md:hidden hover:bg-gray-100 transition-colors">
            <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
        </button>

        <!-- Overlay for mobile -->
        <div id="sidebarOverlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden"></div>

        <!-- Sidebar -->
        <aside id="sidebar"
            class="fixed top-0 left-0 md:static w-64 bg-white border-r border-gray-200 flex flex-col h-full z-50 transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out">
            <!-- Close button for mobile -->
            <button id="closeSidebarBtn" class="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 md:hidden">
                <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>

            <div class="p-6">
                <h1 class="text-2xl font-bold text-green-600">Tea Tracker</h1>
                ${username ? `<p class="text-xs text-gray-400 mt-1 truncate" title="${username}">👤 ${username}</p>` : ''}
            </div>
            
            <nav class="flex-1 px-4 space-y-2 overflow-y-auto">
                ${navLinksHtml}
            </nav>

            <!-- Logout -->
            <div class="px-4 py-4 border-t border-gray-100">
                <a id="logoutLink" href="#"
                    class="flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-150 group">
                    <svg class="w-4 h-4 mr-2 text-gray-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Logout</span>
                </a>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 overflow-y-auto bg-gray-50 p-8 transition-all duration-300">
            <!-- Desktop Sidebar Toggle -->
            <button id="desktopSidebarBtn"
                class="hidden md:inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-white shadow-sm mb-6 transition-colors duration-200">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
            </button>
            <div id="page-content"></div>
        </main>
    `;

    // Move all original child elements into the #page-content div to preserve bound event listeners
    const pageContent = container.querySelector('#page-content');
    while (wrapper.firstChild) {
        pageContent.appendChild(wrapper.firstChild);
    }

    document.body.appendChild(container);
    wrapper.remove(); // Remove original layout-wrapper container

    // Setup toggle listeners
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const desktopSidebarBtn = document.getElementById('desktopSidebarBtn');
    const logoutLink = document.getElementById('logoutLink');

    // Mobile Open
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    });

    // Mobile Close
    function closeMobileSidebar() {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    closeSidebarBtn.addEventListener('click', closeMobileSidebar);
    overlay.addEventListener('click', closeMobileSidebar);

    // Desktop Toggle
    desktopSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('md:hidden');
        const isHidden = sidebar.classList.contains('md:hidden');
        localStorage.setItem('sidebarHidden', isHidden);
    });

    // Restore Desktop Sidebar State
    const savedState = localStorage.getItem('sidebarHidden');
    if (savedState === 'true' && window.innerWidth >= 768) {
        sidebar.classList.add('md:hidden');
    }

    // Logout
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            LocalAPI.logout();
            window.location.href = 'index.html';
        }
    });

    // ── Apply Settings ────────────────────────────────────────────────────────
    if (settings.fontSize) {
        document.documentElement.style.fontSize = settings.fontSize + 'px';
    }

    if (settings.fontFamily) {
        document.body.style.fontFamily = settings.fontFamily;
    }

    // Helper to convert hex to RGB
    function hexToRgb(hex) {
        if (!hex) return null;
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    const primaryColor = settings.primaryColor || '#16a34a';
    const rgb = hexToRgb(primaryColor) || { r: 22, g: 163, b: 74 };
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    document.documentElement.style.setProperty('--secondary-color', settings.secondaryColor || '#ffffff');

    // Create or update primary color overrides stylesheet
    let stylePrimary = document.getElementById('primary-color-override');
    if (!stylePrimary) {
        stylePrimary = document.createElement('style');
        stylePrimary.id = 'primary-color-override';
        document.head.appendChild(stylePrimary);
    }
    stylePrimary.innerHTML = `
        :root {
            --primary-color-hover: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85);
            --primary-color-light: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1);
            --primary-color-border: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3);
        }
        /* Text color overrides */
        .text-green-600, .text-green-500, .text-green-700, .text-green-800 { color: var(--primary-color) !important; }
        .hover\\:text-green-600:hover, .hover\\:text-green-700:hover { color: var(--primary-color) !important; }
        
        /* Background color overrides */
        .bg-green-600, .bg-green-500 { background-color: var(--primary-color) !important; }
        .bg-green-700, .bg-green-800 { background-color: var(--primary-color-hover) !important; }
        .hover\\:bg-green-700:hover, .hover\\:bg-green-600:hover { background-color: var(--primary-color-hover) !important; }
        .bg-green-50, .bg-green-100 { background-color: var(--primary-color-light) !important; }
        .hover\\:bg-green-50:hover { background-color: var(--primary-color-light) !important; }
        
        /* Border overrides */
        .border-green-600, .border-green-500, .border-green-400 { border-color: var(--primary-color) !important; }
        .border-green-200, .border-green-300, .border-green-100 { border-color: var(--primary-color-border) !important; }
        
        /* Focus & ring overrides */
        .focus\\:ring-green-500:focus, .focus\\:ring-green-400:focus, .focus\\:ring-green-600:focus {
            --tw-ring-color: var(--primary-color) !important;
            border-color: var(--primary-color) !important;
        }
        .focus\\:border-green-500:focus, .focus\\:border-green-400:focus { border-color: var(--primary-color) !important; }

        /* Custom accent color for sliders and widgets */
        .accent-green-600 { accent-color: var(--primary-color) !important; }
    `;

    // Determine effective theme (system = check OS preference)
    let effectiveTheme = settings.theme || 'light';
    if (effectiveTheme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    localStorage.setItem('theme', effectiveTheme);
    applyTheme(effectiveTheme, settings);

    // Force Lucide icon refresh if present
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    // Setup page transitions when clicking sidebar links
    const sidebarNav = container.querySelector('nav');
    if (sidebarNav) {
        sidebarNav.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                const href = link.getAttribute('href');
                if (href && href !== '#' && !href.startsWith('javascript:')) {
                    showSpinnerLoader();
                }
            }
        });
    }

    // Hide loader
    hideSpinnerLoader();

    // Dispatch settingsLoaded event
    window.appSettings = settings;
    window.dispatchEvent(new CustomEvent('settingsLoaded', { detail: settings }));
}

// ── Theme Application ─────────────────────────────────────────────────────────
function applyTheme(theme, settings) {
    const isDark = theme === 'dark';

    if (isDark) {
        // ── Dark palette ──────────────────────────────────────────────────────
        const darkBg     = '#0f172a'; // slate-900
        const darkSurf   = '#1e293b'; // slate-800
        const darkBorder = '#334155'; // slate-700
        const darkText   = '#f1f5f9'; // slate-100
        const darkMuted  = '#94a3b8'; // slate-400
        const primary    = settings.primaryColor || '#16a34a';

        // body / main
        document.body.style.backgroundColor = darkBg;
        document.body.style.color = darkText;

        // Remove light overrides
        const lightStyle = document.getElementById('light-mode-override');
        if (lightStyle) lightStyle.remove();

        // inject a <style> tag for dark overrides (works with Tailwind's arbitrary classes)
        let style = document.getElementById('dark-mode-override');
        if (!style) {
            style = document.createElement('style');
            style.id = 'dark-mode-override';
            document.head.appendChild(style);
        }
        style.innerHTML = `
            /* ── Surface cards & panels ── */
            .bg-white, [class*="bg-white"] { background-color: ${darkSurf} !important; color: ${darkText} !important; }
            .bg-gray-50, [class*="bg-gray-50"] { background-color: ${darkBg} !important; color: ${darkText} !important; }
            .bg-gray-100 { background-color: #1e293b !important; }

            /* ── Borders ── */
            .border-gray-100, .border-gray-200, .border-gray-300 { border-color: ${darkBorder} !important; }
            .divide-gray-200 > * { border-color: ${darkBorder} !important; }

            /* ── Text ── */
            .text-gray-900 { color: ${darkText} !important; }
            .text-gray-700 { color: #cbd5e1 !important; }
            .text-gray-600 { color: #94a3b8 !important; }
            .text-gray-500 { color: ${darkMuted} !important; }
            .text-gray-400 { color: #64748b !important; }

            /* ── Sidebar ── */
            #sidebar { background-color: ${darkSurf} !important; border-color: ${darkBorder} !important; }
            #sidebar a { color: #cbd5e1 !important; }
            #sidebar a:hover, #sidebar a.dark-sidebar-active { background-color: rgba(var(--primary-color-rgb), 0.15) !important; color: ${primary} !important; }

            /* ── Main area ── */
            main { background-color: ${darkBg} !important; }

            /* ── Table rows ── */
            tbody tr { background-color: ${darkSurf} !important; }
            tbody tr:hover { background-color: #273549 !important; }
            thead { background-color: #162033 !important; }
            th { color: ${darkMuted} !important; }
            th.sortable:hover { background-color: rgba(var(--primary-color-rgb), 0.15) !important; }

            /* ── Inputs & selects ── */
            input, select, textarea {
                background-color: #273549 !important;
                color: ${darkText} !important;
                border-color: ${darkBorder} !important;
            }
            input::placeholder, textarea::placeholder { color: #64748b !important; }

            /* ── Modals ── */
            .shadow-lg { background-color: ${darkSurf} !important; }
            .rounded-md.bg-white { background-color: ${darkSurf} !important; }

            /* ── Buttons ── */
            .bg-gray-300 { background-color: #334155 !important; color: ${darkText} !important; }
            .bg-gray-50.rounded-lg { background-color: #1e293b !important; }
            .hover\\:bg-gray-50:hover { background-color: #273549 !important; }
            .hover\\:bg-gray-100:hover { background-color: #273549 !important; }

            /* ── Stat cards ── */
            .bg-green-100 { background-color: #052e16 !important; }
            .bg-red-100   { background-color: #1f0a0a !important; }
            .bg-blue-100  { background-color: #0c1a2e !important; }

            /* ── Spinner loader ── */
            #page-loader-spinner { background-color: rgba(15,23,42,0.75) !important; }
        `;
    } else {
        // Light mode — use explicit background colour and secondary color (for sidebar and card surfaces)
        const bg = settings.backgroundColor || '#ffffff';
        const secondaryColor = settings.secondaryColor || '#ffffff';

        let lightStyle = document.getElementById('light-mode-override');
        if (!lightStyle) {
            lightStyle = document.createElement('style');
            lightStyle.id = 'light-mode-override';
            document.head.appendChild(lightStyle);
        }
        lightStyle.innerHTML = `
            body, main, .bg-gray-50, [class*="bg-gray-50"] { background-color: ${bg} !important; }
            #sidebar { background-color: ${secondaryColor} !important; }
            .bg-white, [class*="bg-white"] { background-color: ${secondaryColor} !important; }
            .border-gray-200, .border-gray-100 { border-color: rgba(0, 0, 0, 0.08) !important; }
        `;

        // Remove any dark overrides
        const darkStyle = document.getElementById('dark-mode-override');
        if (darkStyle) darkStyle.remove();
    }
}

// ── Spinner Loader ────────────────────────────────────────────────────────────
function showSpinnerLoader() {
    if (document.getElementById('page-loader-spinner')) return;

    const loader = document.createElement('div');
    loader.id = 'page-loader-spinner';
    loader.style.position = 'fixed';
    loader.style.inset = '0';
    loader.style.zIndex = '99999';
    loader.style.display = 'flex';
    loader.style.alignItems = 'center';
    loader.style.justifyContent = 'center';
    loader.style.backgroundColor = 'rgba(255, 255, 255, 0.65)';
    loader.style.backdropFilter = 'blur(8px)';
    loader.style.webkitBackdropFilter = 'blur(8px)';
    loader.style.transition = 'opacity 0.25s ease-out';
    loader.style.opacity = '1';

    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            loader.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
        }
    } catch (e) {}

    const spinner = document.createElement('div');
    spinner.style.width = '3rem';
    spinner.style.height = '3rem';
    spinner.style.borderRadius = '9999px';
    spinner.style.borderWidth = '4px';
    spinner.style.borderStyle = 'solid';
    const primaryColor = document.documentElement.style.getPropertyValue('--primary-color') || '#16a34a';
    spinner.style.borderColor = primaryColor;
    spinner.style.borderTopColor = 'transparent';
    spinner.className = 'animate-spin-custom';

    const style = document.createElement('style');
    style.id = 'spinner-custom-style';
    style.innerHTML = `
        @keyframes spin-custom {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .animate-spin-custom {
            animation: spin-custom 0.8s linear infinite;
        }
    `;
    if (!document.getElementById('spinner-custom-style')) {
        document.head.appendChild(style);
    }

    loader.appendChild(spinner);
    document.body.appendChild(loader);
}

function hideSpinnerLoader() {
    const loader = document.getElementById('page-loader-spinner');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            const currentLoader = document.getElementById('page-loader-spinner');
            if (currentLoader) currentLoader.remove();
        }, 250);
    }
}
