import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_COMPONENTS_DIR = path.resolve(__dirname, '../..');

const readComponent = (relPath: string): string => {
  return fs.readFileSync(path.join(FRONTEND_COMPONENTS_DIR, relPath), 'utf8');
};

const PASO_4_FILES = [
  'modals/OrderDraftApprovalModal.tsx',
  'modals/OrderFulfillmentModal.tsx',
  'modals/OrderFulfillmentBillingPanel.tsx',
  'BillingDashboard.tsx',
  'billing/CreditNotesTab.tsx',
  'billing/TaxWithholdingsTab.tsx',
  'billing/sales/SalesInvoicesTable.tsx',
  'billing/CreateWithholdingModal.tsx',
  'billing/sales/DirectInvoicePaymentPanel.tsx',
  'billing/sales/DirectInvoiceSummaryFooter.tsx',
  'billing/sales/useDirectInvoice.ts',
  'modals/ProductModal.tsx',
  'modals/product/ProductIdentificationSection.tsx',
  'modals/product/ProductPricingLogisticsSection.tsx',
  'modals/ProductPhotoLightboxModal.tsx',
  'modals/ImportZipModal.tsx',
  'common/ExcelImportModal.tsx',
  'RubrosList.tsx',
  'modals/SupplierCostCalculatorModal.tsx',
  'admin/ProductsTab.tsx',
  'ProductsList.tsx',
  'stock/LotManagerModal.tsx',
  'stock/StockAdjustModal.tsx',
  'stock/ProductKardexDrawer.tsx',
  'stock/LotTransferForm.tsx',
  'stock/useLotManager.ts',
  'DepositoDashboard.tsx',
  'deposito/useDepositoController.ts',
  'deposito/depositoHelpers.tsx',
  'deposito/BultosCloseModal.tsx',
  'deposito/DepositoStockAdjustModal.tsx',
  'deposito/DepositoLotsExpirationTab.tsx',
  'deposito/DepositoReplenishmentTab.tsx',
  'deposito/DepositoStockListTab.tsx',
  'deposito/PickingOrdersQueueTab.tsx',
  'deposito/PickingActiveOrderView.tsx',
  'deposito/PickingConsolidatedView.tsx',
  'deposito/DepositoPrintLayouts.tsx',
  'deposito/Slot3DInspectorModal.tsx',
  'deposito/Slot3DRackIsometricView.tsx',
  'deposito/Slot3DLoadStockForm.tsx',
  'deposito/WarehouseMap.tsx',
  'deposito/WarehouseSlotConfigSidebar.tsx',
  'deposito/WarehouseSlotInspectorSidebar.tsx',
] as const;

const PRODUCT_MODAL_MODULES = [
  'modals/ProductModal.tsx',
  'modals/product/ProductIdentificationSection.tsx',
  'modals/product/ProductPricingLogisticsSection.tsx',
] as const;

const MIGRATED_NATIVE_DIALOG_MODALS = [
  'modals/OrderDraftApprovalModal.tsx',
  'modals/OrderFulfillmentModal.tsx',
  'billing/CreateWithholdingModal.tsx',
  'modals/ProductModal.tsx',
  'modals/ProductPhotoLightboxModal.tsx',
  'modals/ImportZipModal.tsx',
  'common/ExcelImportModal.tsx',
  'modals/SupplierCostCalculatorModal.tsx',
  'stock/LotManagerModal.tsx',
  'stock/StockAdjustModal.tsx',
  'stock/ProductKardexDrawer.tsx',
  'deposito/BultosCloseModal.tsx',
  'deposito/DepositoStockAdjustModal.tsx',
  'deposito/Slot3DInspectorModal.tsx',
] as const;

const NO_ARIA_CONTROLS_TABS = [
  'BillingDashboard.tsx',
  'admin/ProductsTab.tsx',
  'DepositoDashboard.tsx',
] as const;

const UNICODE_EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const EJ_PLACEHOLDER_REGEX = /\bej\s*:/i;
const NATIVE_ALERT_WINDOW_CONFIRM_REGEX = /(?:^|[^\w$.])alert\s*\(|window\.(?:alert|confirm)\s*\(/m;
const BARE_SYNC_CONFIRM_REGEX = /(?:^|[^\w$.])confirm\s*\(/m;

describe('Pilar Minimalista Premium — Paso 4 (Pedidos, Facturación, Stock, Depósito WMS)', () => {
  it.each(PASO_4_FILES)('%s respeta techo duro <= 450 líneas', (relPath) => {
    const lineCount = readComponent(relPath).split(/\r?\n/).length;
    expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(450);
  });

  it.each(PRODUCT_MODAL_MODULES)('%s respeta zona ideal <= 300 líneas', (relPath) => {
    const lineCount = readComponent(relPath).split(/\r?\n/).length;
    expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(300);
  });

  it.each(PASO_4_FILES)('%s no contiene emojis Unicode ni placeholders ej:/Ej:', (relPath) => {
    const content = readComponent(relPath);
    expect(content).not.toMatch(UNICODE_EMOJI_REGEX);
    expect(content).not.toMatch(EJ_PLACEHOLDER_REGEX);
  });

  it.each(PASO_4_FILES)('%s no invoca alert() ni confirm() nativos', (relPath) => {
    const content = readComponent(relPath);
    expect(content).not.toMatch(NATIVE_ALERT_WINDOW_CONFIRM_REGEX);
    const withoutAsyncUseConfirm = content.replace(/\bawait\s+confirm\s*\(/g, '');
    expect(withoutAsyncUseConfirm).not.toMatch(BARE_SYNC_CONFIRM_REGEX);
  });

  it.each(MIGRATED_NATIVE_DIALOG_MODALS)('%s utiliza NativeModalDialog', (relPath) => {
    const content = readComponent(relPath);
    expect(content).toContain('<NativeModalDialog');
  });

  it.each(NO_ARIA_CONTROLS_TABS)('%s omite aria-controls en pestañas ARIA', (relPath) => {
    const content = readComponent(relPath);
    expect(content).not.toContain('aria-controls');
  });

  it('ProductIdentificationSection preserva la categoría legacy exacta Estucheria y Regalerìa', () => {
    const content = readComponent('modals/product/ProductIdentificationSection.tsx');
    expect(content).toContain("'Estucheria y Regalerìa'");
  });

  it('Elimina textTransform uppercase de rellenos y encabezados modificados', () => {
    for (const relPath of [
      'modals/OrderDraftApprovalModal.tsx',
      'modals/OrderFulfillmentBillingPanel.tsx',
      'modals/SupplierCostCalculatorModal.tsx',
      'deposito/PickingActiveOrderView.tsx',
      'deposito/Slot3DRackIsometricView.tsx',
      'deposito/WarehouseSlotInspectorSidebar.tsx',
    ]) {
      const content = readComponent(relPath);
      expect(content, `${relPath} aún contiene uppercase`).not.toMatch(/textTransform:\s*['"]uppercase['"]/);
    }
  });

  it('Slot3DInspectorModal separa el guard de nulidad del componente con hooks', () => {
    const content = readComponent('deposito/Slot3DInspectorModal.tsx');
    expect(content).toContain('Slot3DInspectorInner');
  });
});
