/**
 * Registra el Service Worker de Preventa Offline en builds de producción
 * y desregistra cualquier Service Worker residual en modo desarrollo (Vite HMR)
 * para evitar colisiones de módulos en caliente.
 */
export function registerPwaServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  if (!import.meta.env.PROD) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // En HTTP sobre IP privada sin contexto seguro el navegador puede omitir SW;
      // IndexedDB y la cola Offline siguen funcionando al 100%.
    });
  });
}
