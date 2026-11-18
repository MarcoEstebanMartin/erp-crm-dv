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

const OLA_1_FILES = [
  'FinanzasDashboard.tsx',
  'FinanceMovementModal.tsx',
  'ArqueoCajaModal.tsx',
  'ReceiptView.tsx',
  'RendicionesDashboard.tsx',
  'GastosDashboard.tsx',
  'finanzas/FinanzasBankReconciliationModal.tsx',
  'finanzas/FinanzasModals.tsx',
  'finanzas/finanzasHelpers.ts',
  'rendiciones/ArqueoResultModal.tsx',
  'rendiciones/AuditLeftPanel.tsx',
  'rendiciones/AuditReceiptsPanel.tsx',
  'rendiciones/CajaDepositoTab.tsx',
  'rendiciones/CajaOpenModal.tsx',
  'rendiciones/DeclaredChecksWidget.tsx',
  'rendiciones/DrawersHistoryTable.tsx',
  'rendiciones/InspectDrawerModal.tsx',
  'rendiciones/PendingRendicionesTabs.tsx',
  'rendiciones/RendicionAuditModal.tsx',
  'rendiciones/types.ts',
  'rendiciones/useDepositDrawers.ts',
  'rendiciones/useRendicionesAudit.ts',
  'gastos/GastosCopyMonthModal.tsx',
  'gastos/GastosCreateAndImportModals.tsx',
  'gastos/GastosOverviewAndTable.tsx',
  'gastos/gastos.types.ts',
  'gastos/useGastosController.ts',
] as const;

const OLA_2_FILES = [
  'ComprasDashboard.tsx',
  'PurchaseScannerModal.tsx',
  'LogisticaDashboard.tsx',
  'FleetDashboard.tsx',
  'FuelControlDashboard.tsx',
  'RepartoDashboard.tsx',
  'compras/ComprasCreateReceiveModals.tsx',
  'compras/ComprasFacturasProveedoresTabs.tsx',
  'compras/ComprasOrdenesRecepcionesTabs.tsx',
  'compras/ComprasProviderModals.tsx',
  'compras/ComprasSupplierInvoiceAndPayModals.tsx',
  'compras/scanner/PurchaseScannerFormAndTotals.tsx',
  'compras/scanner/PurchaseScannerItemsSection.tsx',
  'compras/scanner/usePurchaseScanner.ts',
  'fleet/FleetModals.tsx',
  'fleet/FleetVehicleDetailPanel.tsx',
  'fleet/fleet.types.ts',
  'fleet/useFleetController.ts',
  'fuel/FuelCreateModal.tsx',
  'fuel/FuelKpisAndRanking.tsx',
  'fuel/useFuelControl.ts',
  'reparto/GoogleRouteMap.tsx',
  'reparto/LeafletRouteMap.tsx',
  'reparto/RepartoActiveRoutePanel.tsx',
  'reparto/RepartoCreateRouteModal.tsx',
  'reparto/RepartoPrintRouteSheet.tsx',
  'reparto/RepartoSettleRouteModal.tsx',
  'reparto/repartoGeoHelpers.ts',
  'reparto/useRepartoController.ts',
  'reparto/useRepartoGeocoder.ts',
  'reparto/useRepartoTspRoutes.ts',
] as const;

const OLA_3_FILES = [
  'UnifiedReportsDashboard.tsx',
  'ProfitabilityTab.tsx',
  'reports/profitability/ProfitabilityFiltersAndKpis.tsx',
  'reports/profitability/ProfitabilityTablesAndMatrix.tsx',
  'reports/reportDateHelpers.ts',
  'reports/pdf/pdfReportHelpers.ts',
  'reports/pdf/ExecutivePdfSheet.tsx',
  'reports/ExecutivePdfReport.tsx',
  'reports/pdf/SellerMeetingPdfSheet.tsx',
  'reports/SellerMeetingPdfReport.tsx',
  'reports/FinancialSummaryReportTab.tsx',
  'reports/ZoneAnalysisFiltersBar.tsx',
  'reports/ZoneAnalysisReportTab.tsx',
  'reports/ZoneAnalysisCopilotAndTables.tsx',
  'reports/ZoneAnalysisProductRotationCards.tsx',
] as const;

const PASO_5_FILES = [...OLA_1_FILES, ...OLA_2_FILES, ...OLA_3_FILES] as const;
const IDEAL_CEILING_FILES = PASO_5_FILES.filter((f) => f !== 'ComprasDashboard.tsx');

const MIGRATED_NATIVE_DIALOG_MODALS = [
  'FinanceMovementModal.tsx',
  'ArqueoCajaModal.tsx',
  'finanzas/FinanzasBankReconciliationModal.tsx',
  'finanzas/FinanzasModals.tsx',
  'rendiciones/ArqueoResultModal.tsx',
  'rendiciones/CajaOpenModal.tsx',
  'rendiciones/InspectDrawerModal.tsx',
  'rendiciones/RendicionAuditModal.tsx',
  'gastos/GastosCopyMonthModal.tsx',
  'gastos/GastosCreateAndImportModals.tsx',
  'compras/ComprasCreateReceiveModals.tsx',
  'compras/ComprasSupplierInvoiceAndPayModals.tsx',
  'compras/ComprasProviderModals.tsx',
  'PurchaseScannerModal.tsx',
  'fleet/FleetModals.tsx',
  'fuel/FuelCreateModal.tsx',
  'reparto/RepartoCreateRouteModal.tsx',
  'reparto/RepartoSettleRouteModal.tsx',
] as const;

const NO_ARIA_CONTROLS_TABS = [
  'RendicionesDashboard.tsx',
  'rendiciones/PendingRendicionesTabs.tsx',
  'GastosDashboard.tsx',
  'ComprasDashboard.tsx',
  'LogisticaDashboard.tsx',
  'UnifiedReportsDashboard.tsx',
  'ProfitabilityTab.tsx',
] as const;

const UNICODE_EMOJI_OR_GLYPHS_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[✕✖▼]/u;
const EJ_PLACEHOLDER_REGEX = /\bej\s*:/i;
const NATIVE_ALERT_WINDOW_REGEX = /(?:^|[^\w$.])alert\s*\(|window\.(?:alert|confirm|prompt)\s*\(/m;
const BARE_SYNC_CONFIRM_REGEX = /(?:^|[^\w$.])confirm\s*\(/m;
const BARE_PROMPT_REGEX = /(?:^|[^\w$.])prompt\s*\(/m;
const UPPERCASE_STYLE_REGEX = /textTransform:\s*['"]uppercase['"]/;

describe('Pilar Minimalista Premium — Paso 5 (Finanzas, Rendiciones, Gastos, Compras, Logística y Reportes)', () => {
  it.each(PASO_5_FILES)('%s respeta techo duro <= 450 líneas', (relPath) => {
    const lineCount = readComponent(relPath).split(/\r?\n/).length;
    expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(450);
  });

  it.each(IDEAL_CEILING_FILES)('%s respeta zona ideal <= 300 líneas', (relPath) => {
    const lineCount = readComponent(relPath).split(/\r?\n/).length;
    expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(300);
  });

  it.each(PASO_5_FILES)('%s no contiene emojis Unicode, glifos decorativos ni placeholders ej:/Ej:', (relPath) => {
    const content = readComponent(relPath);
    expect(content).not.toMatch(UNICODE_EMOJI_OR_GLYPHS_REGEX);
    expect(content).not.toMatch(EJ_PLACEHOLDER_REGEX);
  });

  it.each(PASO_5_FILES)('%s no invoca alert(), confirm() síncrono ni prompt() nativos', (relPath) => {
    const content = readComponent(relPath);
    expect(content).not.toMatch(NATIVE_ALERT_WINDOW_REGEX);
    expect(content).not.toMatch(BARE_PROMPT_REGEX);
    const withoutAsyncUseConfirm = content.replace(/\bawait\s+confirm\s*\(/g, '');
    expect(withoutAsyncUseConfirm).not.toMatch(BARE_SYNC_CONFIRM_REGEX);
  });

  it.each(PASO_5_FILES)('%s no usa textTransform uppercase ni modal-overlay manual', (relPath) => {
    const content = readComponent(relPath);
    expect(content).not.toMatch(UPPERCASE_STYLE_REGEX);
    expect(content).not.toContain('modal-overlay');
  });

  it.each(MIGRATED_NATIVE_DIALOG_MODALS)('%s utiliza NativeModalDialog', (relPath) => {
    const content = readComponent(relPath);
    expect(content).toContain('<NativeModalDialog');
  });

  it.each(NO_ARIA_CONTROLS_TABS)('%s omite aria-controls en pestañas ARIA', (relPath) => {
    const content = readComponent(relPath);
    expect(content).not.toContain('aria-controls');
  });

  it('Preserva invariantes operativas críticas en Flota, Reparto y Reportes', () => {
    const fleetTypes = readComponent('fleet/fleet.types.ts');
    expect(fleetTypes).toContain('ALLOWED_FLEET_PROVIDER_NAMES');
    expect(fleetTypes).toContain("'YPF Boxes'");

    const fleetCtrl = readComponent('fleet/useFleetController.ts');
    expect(fleetCtrl).toContain("'open_fleet_gasto_modal'");

    const repartoPrint = readComponent('reparto/RepartoPrintRouteSheet.tsx');
    expect(repartoPrint).toContain('VILLEGAS_DEPOT');

    const execSheet = readComponent('reports/pdf/ExecutivePdfSheet.tsx');
    expect(execSheet).toContain('id="executive-report-container"');

    const sellerSheet = readComponent('reports/pdf/SellerMeetingPdfSheet.tsx');
    expect(sellerSheet).toContain('id="seller-meeting-report-container"');

    const reportsDash = readComponent('UnifiedReportsDashboard.tsx');
    expect(reportsDash).toContain("'Resumen'");
    expect(reportsDash).toContain("'Rentabilidad'");
    expect(reportsDash).toContain("'Zonas'");
    expect(reportsDash).not.toContain('Caja Semanal');
    expect(reportsDash).not.toContain('Alertas IA');
    expect(reportsDash).not.toContain('Canales');
  });
});
