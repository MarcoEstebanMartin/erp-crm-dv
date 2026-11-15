import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(TEST_DIR, '../../..');

const EDITED_FILES = [
  'components/admin/ClientsTab.tsx',
  'components/admin/ClientsPersonasTable.tsx',
  'components/admin/DebtorsByCityReportView.tsx',
  'components/modals/ClientModal.tsx',
  'components/modals/client/ClientIdentityRolesCard.tsx',
  'components/modals/client/ClientLocationCommercialCard.tsx',
  'components/modals/client/useClientModalController.ts',
  'components/modals/ClientProfileModal.tsx',
  'components/modals/ClientsGpsMapModal.tsx',
  'components/modals/ResumenCuentaModal.tsx',
  'components/modals/ResumenCuentaDetailModals.tsx',
  'components/modals/SellerProfileModal.tsx',
  'components/modals/seller/SellerProfilePanels.tsx',
  'components/SaleRoutesDashboard.tsx',
  'components/admin/routes/SaleRouteFormModal.tsx',
  'components/admin/routes/SaleRouteDetailPanel.tsx',
  'components/modals/OptimizeRouteModal.tsx',
  'components/VendedorDashboard.tsx',
  'components/vendedor/VendedorModals.tsx',
  'components/vendedor/useVendedorController.ts',
  'components/vendedor/VendedorOrderTakeTab.tsx',
  'components/vendedor/VendedorRoutesTab.tsx',
  'components/vendedor/VendedorCatalogHistoryTabs.tsx',
  'components/vendedor/VendedorOfflineBanner.tsx',
  'components/MobileCobros.tsx',
  'components/vendedor/cobros/MobileCobrosClientList.tsx',
  'components/vendedor/cobros/MobileCobrosFormView.tsx',
  'components/vendedor/cobros/MobileCobrosReceiptView.tsx',
] as const;

const SPLIT_IDEAL_FILES = [
  'components/modals/SellerProfileModal.tsx',
  'components/modals/seller/SellerProfilePanels.tsx',
  'components/SaleRoutesDashboard.tsx',
  'components/admin/routes/SaleRouteDetailPanel.tsx',
  'components/admin/routes/SaleRouteFormModal.tsx',
  'components/MobileCobros.tsx',
  'components/vendedor/cobros/MobileCobrosClientList.tsx',
  'components/vendedor/cobros/MobileCobrosFormView.tsx',
  'components/vendedor/cobros/MobileCobrosReceiptView.tsx',
] as const;

const MODAL_FILES = [
  'components/modals/ClientModal.tsx',
  'components/modals/ClientProfileModal.tsx',
  'components/modals/ClientsGpsMapModal.tsx',
  'components/modals/ResumenCuentaModal.tsx',
  'components/modals/ResumenCuentaDetailModals.tsx',
  'components/modals/SellerProfileModal.tsx',
  'components/modals/OptimizeRouteModal.tsx',
  'components/admin/routes/SaleRouteFormModal.tsx',
  'components/vendedor/VendedorModals.tsx',
] as const;

const BANNED_FILLER_STRINGS = [
  'Planilla de deudores agrupados',
  'autocompleta datos',
  'Habilitá el rol Cliente',
  'Algoritmo Haversine',
  '~15% a 25%',
  'CLIENTE SELECCIONADO',
  'Solicitar al cliente que realice la transferencia',
  'Marcar si el cheque ingresó',
  'Selecciona un cliente para registrar un cobro',
  'Modo Sin Señal — Catálogo Local Activo',
  'Confirmar Pedido (Check-in GPS Automático)',
  'General Villegas y zonas',
] as const;

const BANNED_EMOJIS = [
  '📋', '🔑', '👥', '📍', '💼', '⚡', '👤', '✏️', '📊', '💰', '📞', '✉️',
  '🚛', '💬', '⏳', '⚠️', '🔍', '📝', '💡', '📱', 'ℹ️', '🔒', '⚪',
] as const;

const UNICODE_EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function readSrcFile(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_DIR, relativePath), 'utf8');
}

describe('Paso 3 Minimalismo Premium — Clientes, Rutas de Preventa y Preventa Móvil', () => {
  it('mantiene todos los archivos bajo 450 líneas y los 9 módulos divididos bajo 300 líneas', () => {
    for (const relPath of EDITED_FILES) {
      const lineCount = readSrcFile(relPath).split(/\r?\n/).length;
      expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(450);
    }

    for (const relPath of SPLIT_IDEAL_FILES) {
      const lineCount = readSrcFile(relPath).split(/\r?\n/).length;
      expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(300);
    }
  });

  it('elimina palabras de relleno y emojis decorativos en todos los archivos del Paso 3', () => {
    for (const relPath of EDITED_FILES) {
      const content = readSrcFile(relPath);
      for (const banned of BANNED_FILLER_STRINGS) {
        expect(content, `${relPath} no debe contener "${banned}"`).not.toContain(banned);
      }
      for (const emoji of BANNED_EMOJIS) {
        expect(content, `${relPath} no debe contener el emoji "${emoji}"`).not.toContain(emoji);
      }
      expect(content, `${relPath} no debe contener emojis Unicode`).not.toMatch(UNICODE_EMOJI_RE);
    }
  });

  it('prohíbe window.alert, window.confirm y confirm() nativo', () => {
    for (const relPath of EDITED_FILES) {
      const content = readSrcFile(relPath);
      expect(content, `${relPath} no debe usar alert(`).not.toMatch(/\balert\s*\(/);
      expect(content, `${relPath} no debe usar window.confirm`).not.toContain('window.confirm');

      const withoutHookConfirm = content
        .replace(/window\.confirm/g, '')
        .replace(/\bawait\s+confirm\s*\(/g, '');
      expect(withoutHookConfirm, `${relPath} no debe usar confirm() nativo`).not.toMatch(/\bconfirm\s*\(/);
    }
  });

  it('migra los 9 modales del Paso 3 a NativeModalDialog sin modal-overlay y respeta a11y + datos bancarios', () => {
    for (const relPath of MODAL_FILES) {
      const content = readSrcFile(relPath);
      expect(content, `${relPath} debe usar <NativeModalDialog`).toContain('<NativeModalDialog');
      expect(content, `${relPath} no debe usar modal-overlay`).not.toContain('modal-overlay');
    }

    for (const tabFile of [
      'components/admin/ClientsTab.tsx',
      'components/modals/ClientsGpsMapModal.tsx',
      'components/modals/SellerProfileModal.tsx',
    ]) {
      expect(readSrcFile(tabFile), `${tabFile} no debe usar aria-controls`).not.toContain('aria-controls');
    }

    const vendedorDashboard = readSrcFile('components/VendedorDashboard.tsx');
    expect(vendedorDashboard).toContain('<nav');
    expect(vendedorDashboard).toContain('aria-label="Preventa"');

    const cobrosForm = readSrcFile('components/vendedor/cobros/MobileCobrosFormView.tsx');
    expect(cobrosForm).toContain('donvenancio2024');
    expect(cobrosForm).toContain('0000003100085432453321');
  });
});
