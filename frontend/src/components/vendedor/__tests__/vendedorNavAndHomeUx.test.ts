import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(TEST_DIR, '../../..');

const readSrc = (relPath: string): string =>
  fs.readFileSync(path.join(SRC_DIR, relPath), 'utf8');

describe('Vendedor — Inicio centrado en zona de pulgar y barra inferior fija fluida', () => {
  it('elimina el bucle de re-renders en useVendedorOfflineSync usando onSyncedRef y evita leer products_full por defecto', () => {
    const syncSrc = readSrc('components/vendedor/useVendedorOfflineSync.ts');
    expect(syncSrc).toContain('onSyncedRef');
    expect(syncSrc).toContain('onSyncedRef.current?.()');
    expect(syncSrc).toContain('refreshQueueState = useCallback(async (includeCatalogSyncAt = false)');
    expect(syncSrc).toContain('[refreshQueueState, showToast]');
    expect(syncSrc).not.toContain('[onSynced, refreshQueueState, showToast]');
  });

  it('estabiliza handleOfflineSynced y precarga Ruta (clients) desde Inicio en useVendedorController', () => {
    const ctrlSrc = readSrc('components/vendedor/useVendedorController.ts');
    expect(ctrlSrc).toContain('handleOfflineSynced = useCallback');
    expect(ctrlSrc).toContain('onSynced: handleOfflineSynced');
    expect(ctrlSrc).toContain('prefetchedClientsRef');
    expect(ctrlSrc).toContain("activeTab: 'clients'");
    expect(ctrlSrc.split(/\r?\n/).length).toBeLessThanOrEqual(450);
  });

  it('mantiene vivas las pestañas en VendedorDashboard sin React.lazy en Cobrar y resetea el scroll instantáneamente', () => {
    const dashSrc = readSrc('components/VendedorDashboard.tsx');
    expect(dashSrc).toContain("import { FieldCollectionPage } from './field-receipts/FieldCollectionPage'");
    expect(dashSrc).not.toMatch(/React\.lazy\([^)]*FieldCollectionPage/);
    expect(dashSrc).toContain('mountedTabs');
    expect(dashSrc).toContain('hidden={activeTab !==');
    expect(dashSrc).toContain("behavior: 'instant'");
  });

  it('usa clases ergonómicas vendedor-home-shell y vendedor-home-action-btn en VendedorHomeTab', () => {
    const homeSrc = readSrc('components/vendedor/VendedorHomeTab.tsx');
    expect(homeSrc).toContain('className="vendedor-home-shell"');
    expect(homeSrc.match(/className="vendedor-home-action-btn"/g)?.length).toBe(4);
  });

  it('aplica estado optimista pendingTab en VendedorBottomNav y startTransition en Sidebar <= 300 líneas', () => {
    const navSrc = readSrc('components/sidebar/VendedorBottomNav.tsx');
    expect(navSrc).toContain('pendingTab');
    expect(navSrc).toContain('displayedTab');

    const sidebarSrc = readSrc('components/Sidebar.tsx');
    expect(sidebarSrc).toContain('startTransition');
    expect(sidebarSrc.split(/\r?\n/).length).toBeLessThanOrEqual(300);
  });

  it('configura centrado vertical 100dvh, barra fija con safe-area y targets >= 48px en index.css sin touchmove bloqueante en main.tsx', () => {
    const cssSrc = readSrc('index.css');
    expect(cssSrc).toContain('.vendedor-home-shell');
    expect(cssSrc).toContain('100dvh');
    expect(cssSrc).toContain('justify-content: center;');
    expect(cssSrc).toContain('height: calc(64px + env(safe-area-inset-bottom, 0px));');
    expect(cssSrc).toContain('transform: translate3d(0, 0, 0);');
    expect(cssSrc).toContain('min-height: 48px;');
    expect(cssSrc).toContain('box-shadow: none;');

    const mainSrc = readSrc('main.tsx');
    expect(mainSrc).not.toContain("addEventListener('touchmove'");
  });

  it('centra la pantalla de Preventa con vendedor-order-shell y expone el renglón Nota siempre visible', () => {
    const orderTabSrc = readSrc('components/vendedor/VendedorOrderTakeTab.tsx');
    const cartPanelSrc = readSrc('components/vendedor/VendedorOrderCartPanel.tsx');
    const cssSrc = readSrc('index.css');

    expect(orderTabSrc).toContain('vendedor-order-shell');
    expect(orderTabSrc).toContain('id="vendedor-order-notes"');
    expect(orderTabSrc).toContain('placeholder="Nota"');
    expect(orderTabSrc).toContain('vendedor-note-input');
    expect(orderTabSrc.split(/\r?\n/).length).toBeLessThanOrEqual(450);

    expect(cartPanelSrc).not.toContain('id="vendedor-order-notes"');

    expect(cssSrc).toContain('.vendedor-order-shell');
    expect(cssSrc).toContain('.vendedor-note-input');
    expect(cssSrc).toContain('field-sizing: content;');
  });

  it('mantiene fijo el tamaño de las listas de búsqueda en Preventa sin saltos verticales ni horizontales', () => {
    const orderTabSrc = readSrc('components/vendedor/VendedorOrderTakeTab.tsx');
    const cssSrc = readSrc('index.css');

    expect(orderTabSrc).toContain('vendedor-order-results vendedor-order-results--clients');
    expect(orderTabSrc).toContain('vendedor-order-results vendedor-order-results--products');
    expect(orderTabSrc).not.toContain("maxHeight: '420px'");
    expect(orderTabSrc).not.toContain("maxHeight: '240px'");

    expect(cssSrc).toMatch(/\.vendedor-order-shell\s*\{[^}]*justify-content:\s*flex-start;/s);
    expect(cssSrc).toContain('14svh');
    expect(cssSrc).toContain('15svh');
    expect(cssSrc).toContain('.vendedor-order-results {');
    expect(cssSrc).toContain('scrollbar-gutter: stable;');
    expect(cssSrc).toContain('overscroll-behavior: contain;');
    expect(cssSrc).toContain('.vendedor-order-results--products');
    expect(cssSrc).toContain('block-size: 320px;');
  });

  it('elimina la barra flotante duplicada del carrito y muestra "Pedido confirmado" con tilde verde sin GPS OK', () => {
    const cartPanelSrc = readSrc('components/vendedor/VendedorOrderCartPanel.tsx');
    const ctrlSrc = readSrc('components/vendedor/useVendedorController.ts');
    const dashSrc = readSrc('components/VendedorDashboard.tsx');

    expect(cartPanelSrc).toContain('Confirmar pedido');
    expect(cartPanelSrc).not.toContain("position: 'fixed'");
    expect(cartPanelSrc).not.toContain('Elegir cliente');
    expect(cartPanelSrc).not.toContain('cartSectionRef');

    expect(ctrlSrc).toContain("setSuccessMsg('Pedido confirmado')");
    expect(ctrlSrc).not.toContain('GPS OK');

    expect(dashSrc).toContain('<CheckCircle2 size={17} />');
  });
});
