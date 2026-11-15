import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(TEST_DIR, '../../..');

const EDITED_FILES = [
  'components/admin/HomeTab.tsx',
  'components/admin/home/HomePendingCashCard.tsx',
  'components/admin/home/HomeQuickActionsGrid.tsx',
  'components/admin/home/HomeWeeklyScheduleRibbon.tsx',
  'components/admin/home/FleetExpenseQuickModal.tsx',
  'components/modals/WeeklyScheduleModal.tsx',
  'components/modals/schedule/WeeklyScheduleForm.tsx',
  'components/Sidebar.tsx',
  'components/AdminDashboard.tsx',
  'components/admin/AdminSummaryCardModal.tsx',
  'components/admin/AdminQuickModals.tsx',
  'components/admin/AdminCreateQuickOrderModal.tsx',
  'components/admin/AdminPaymentModal.tsx',
  'components/modals/QuickPriceSearchModal.tsx',
  'components/PriceListModal.tsx',
] as const;

const IDEAL_LIMIT_FILES = [
  'components/admin/HomeTab.tsx',
  'components/admin/home/HomePendingCashCard.tsx',
  'components/admin/home/HomeQuickActionsGrid.tsx',
  'components/admin/home/HomeWeeklyScheduleRibbon.tsx',
  'components/admin/home/FleetExpenseQuickModal.tsx',
  'components/modals/WeeklyScheduleModal.tsx',
  'components/modals/schedule/WeeklyScheduleForm.tsx',
  'components/Sidebar.tsx',
] as const;

const BANNED_FILLER_STRINGS = [
  'Pendientes de recolección en depósito',
  'Mercadería en embalaje y control',
  'Comprobantes emitidos / Reparto activo',
  'Todo se encuentra al día',
  'Accesos Directos',
  'Comprobante de venta',
  'Registrar nueva persona',
  'Consulta rápida (Lupa)',
  'Sin actividad agendada',
  'Se descontará del saldo de tu caja',
  'Configuración del Cronograma Semanal',
  'Gestionar pueblos y preventa',
  'Semana activa actual en el sistema',
  'Servidor en Línea',
  'Cargando sección...',
  'Listado detallado con estado de facturación',
  'Seleccioná artículos de la izquierda',
  'Registrando pago para:',
  'Escribí al menos 2 letras',
  'Consulta fonética rápida',
  'Generar Lista de Precios PDF',
] as const;

function readSrcFile(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_DIR, relativePath), 'utf8');
}

describe('Paso 2 Minimalismo Premium — Home, Sidebar y Modales Rápidos de Admin', () => {
  it('elimina palabras de relleno y notas obvias en los 15 archivos del Paso 2', () => {
    for (const relPath of EDITED_FILES) {
      const content = readSrcFile(relPath);
      for (const banned of BANNED_FILLER_STRINGS) {
        expect(content, `${relPath} no debe contener "${banned}"`).not.toContain(banned);
      }
    }
  });

  it('mantiene todos los TSX bajo 450 líneas y los módulos divididos bajo 300 líneas', () => {
    for (const relPath of EDITED_FILES) {
      const lineCount = readSrcFile(relPath).split(/\r?\n/).length;
      expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(450);
    }

    for (const relPath of IDEAL_LIMIT_FILES) {
      const lineCount = readSrcFile(relPath).split(/\r?\n/).length;
      expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(300);
    }
  });

  it('migra modales rápidos y cronograma a NativeModalDialog sin window.alert ni window.confirm', () => {
    const modalFiles = [
      'components/admin/home/FleetExpenseQuickModal.tsx',
      'components/modals/WeeklyScheduleModal.tsx',
      'components/admin/AdminSummaryCardModal.tsx',
      'components/admin/AdminQuickModals.tsx',
      'components/admin/AdminCreateQuickOrderModal.tsx',
      'components/admin/AdminPaymentModal.tsx',
      'components/modals/QuickPriceSearchModal.tsx',
    ];

    for (const relPath of modalFiles) {
      expect(readSrcFile(relPath), `${relPath} debe usar NativeModalDialog`).toContain('<NativeModalDialog');
    }

    for (const relPath of [
      'components/admin/HomeTab.tsx',
      'components/admin/home/FleetExpenseQuickModal.tsx',
      'components/modals/WeeklyScheduleModal.tsx',
    ]) {
      const content = readSrcFile(relPath);
      expect(content, `${relPath} no debe usar window.alert/alert(`).not.toMatch(/\balert\s*\(/);
      expect(content, `${relPath} no debe usar window.confirm`).not.toContain('window.confirm');
    }
  });

  it('usa semántica moderna en Sidebar y AdminDashboard sin aria-controls roto', () => {
    const sidebar = readSrcFile('components/Sidebar.tsx');
    expect(sidebar).toContain('aria-label="Menú principal"');
    expect(sidebar).toContain('aria-current');

    const adminDashboard = readSrcFile('components/AdminDashboard.tsx');
    expect(adminDashboard).toContain('role="tablist"');
    expect(adminDashboard).not.toContain('aria-controls');
  });
});
