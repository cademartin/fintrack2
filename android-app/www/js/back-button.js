/**
 * back-button.js — Android Hardware Back Button Handler
 * Uses Capacitor's App plugin to intercept the Android back button.
 * Closes open modals instead of exiting the app.
 */
document.addEventListener('DOMContentLoaded', () => {
    const hasCapacitor = typeof window.Capacitor !== 'undefined';
    if (!hasCapacitor) return;

    const { App } = window.Capacitor.Plugins;
    if (!App) return;

    App.addListener('backButton', () => {
        // Check for any open modal (element with 'fixed' and without 'hidden' class)
        const openModals = Array.from(document.querySelectorAll('[id$="Modal"], [id$="modal"]'))
            .filter(el => !el.classList.contains('hidden') &&
                          el.style.display !== 'none' &&
                          el.classList.contains('fixed'));

        if (openModals.length > 0) {
            // Close the most recently opened modal
            const lastModal = openModals[openModals.length - 1];
            lastModal.classList.add('hidden');
        } else {
            // No modal open — exit the app
            App.exitApp();
        }
    });
});
