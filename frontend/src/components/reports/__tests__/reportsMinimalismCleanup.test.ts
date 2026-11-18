import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { computeArDatePreset, formatArDisplayDate } from '../reportDateHelpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.resolve(__dirname, '../..');

const readComp = (relPath: string): string =>
  fs.readFileSync(path.join(componentsDir, relPath), 'utf8');

describe('Reportes — limpieza minimalista de 3 pestañas y helpers de fecha AR', () => {
  it('elimina los archivos obsoletos de Canales y Caja Semanal del disco', () => {
    const removedFiles = [
      'SalesChannelReportsTab.tsx',
      'reports/channels/SalesChannelKpisAndShare.tsx',
      'reports/channels/SalesChannelMostradorTables.tsx',
      'reports/WeeklyCashConsolidatedTab.tsx',
      'reports/WeeklyCashLogicHook.ts',
      'reports/WeeklyCashSummaryFooter.tsx',
    ];

    for (const rel of removedFiles) {
      expect(fs.existsSync(path.join(componentsDir, rel))).toBe(false);
    }
  });

  it('UnifiedReportsDashboard expone solo 3 pestañas en 1 fila sin CRM, Canales ni Caja Semanal', () => {
    const src = readComp('UnifiedReportsDashboard.tsx');

    expect(src).not.toContain('CrmDashboard');
    expect(src).not.toContain('WeeklyCashConsolidatedTab');
    expect(src).not.toContain('SalesChannelReportsTab');
    expect(src).not.toContain('<h2>Reportes</h2>');
    expect(src).not.toContain('Caja Semanal');
    expect(src).not.toContain('Alertas IA');
    expect(src).not.toContain('Canales');
    expect(src).toContain("flexWrap: 'nowrap'");
    expect(src).toContain("'Resumen'");
    expect(src).toContain("'Rentabilidad'");
    expect(src).toContain("'Zonas'");
  });

  it('elimina sub-vista Matriz de Rentabilidad y Recomendaciones vacías en Zonas', () => {
    const profTab = readComp('ProfitabilityTab.tsx');
    const profTables = readComp('reports/profitability/ProfitabilityTablesAndMatrix.tsx');
    const zoneTables = readComp('reports/ZoneAnalysisCopilotAndTables.tsx');

    expect(profTab).not.toContain("'matrix'");
    expect(profTables).not.toContain("'matrix'");
    expect(profTables).not.toContain('Estrellas (Alto margen + volumen)');
    expect(zoneTables).not.toContain('Guión vendedores');
    expect(zoneTables).not.toContain('salesRecommendations');
  });

  it('integra la tarjeta Mostrador, Reporte PDF y Empleado PDF dentro de Resumen Financiero', () => {
    const summaryTab = readComp('reports/FinancialSummaryReportTab.tsx');
    const execPdfReport = readComp('reports/ExecutivePdfReport.tsx');

    expect(summaryTab).toContain('Mostrador');
    expect(summaryTab).toContain('modalityBreakdown?.local');
    expect(summaryTab).toContain('Reporte PDF');
    expect(summaryTab).toContain('Empleado PDF');
    expect(execPdfReport).toContain('exec-pdf-scope');
    expect(execPdfReport).toContain('General (Empresa)');
  });

  it('limita Top Clientes y Top Productos a Top 5 únicamente en hojas PDF y Zonas', () => {
    const execSheet = readComp('reports/pdf/ExecutivePdfSheet.tsx');
    const empSheet = readComp('reports/pdf/EmployeePdfSheet.tsx');
    const sellerSheet = readComp('reports/pdf/SellerMeetingPdfSheet.tsx');
    const zoneRotation = readComp('reports/ZoneAnalysisProductRotationCards.tsx');

    expect(execSheet).toContain('3. Top 5 Clientes');
    expect(execSheet).toContain('4. Top 5 Productos');
    expect(execSheet).not.toContain('Top 10 Clientes');

    expect(empSheet).toContain('id="executive-report-container"');
    expect(empSheet).toContain('3. Top 5 Clientes');
    expect(empSheet).toContain('4. Top 5 Productos');

    expect(sellerSheet).toContain('Top 5 productos');
    expect(zoneRotation).toContain('Top 5 productos');
  });

  it('formatea y calcula presets de fechas en zona horaria Argentina (-03:00) sin desfase UTC', () => {
    expect(formatArDisplayDate('2026-11-01')).toBe('01/11/2026');

    const lateNightAr = new Date('2026-11-18T02:30:00.000Z');
    expect(computeArDatePreset('this_month', lateNightAr)).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
  });
});
