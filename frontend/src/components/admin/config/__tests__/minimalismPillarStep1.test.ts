import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(TEST_DIR, '../../../..');

const EDITED_FILES = [
  'components/admin/ConfigTab.tsx',
  'components/admin/config/ConfigGeneralTab.tsx',
  'components/modals/ChangeOwnPasswordModal.tsx',
  'components/admin/config/UsersRolesTab.tsx',
  'components/admin/config/UserFormModal.tsx',
  'components/admin/config/PricingRulesTab.tsx',
  'components/admin/config/WeeklyPromoModal.tsx',
  'components/admin/config/PerceptionsTab.tsx',
  'components/admin/config/AuditLogsTab.tsx',
  'components/admin/config/AuditLogsFilterBar.tsx',
  'components/admin/config/AuditLogDetailPanel.tsx',
  'pages/AfipExportDashboard.tsx',
  'components/billing/AfipCorrelationMonitorCard.tsx',
  'components/Login.tsx',
] as const;

const BANNED_FILLER_STRINGS = [
  'Seguridad de la Cuenta',
  'Contraseña de acceso',
  'Actualizá tu clave personal',
  'Identidad Fiscal y Comercial',
  'Reglas Operativas',
  'Encabezado oficial sincronizado',
  'Nómina de Empleados & Roles',
  'Gestión unificada de accesos',
  'Los permisos y módulos visibles se rigen',
  'Promociones comerciales',
  'Registro de Auditoría del Sistema',
  'Hacé clic en una fila',
  'Ingresá tus credenciales',
  'Conexión con el servidor establecida',
  'Libro IVA Digital AFIP & Correlación Fiscal',
  'Correlación balanceada',
] as const;

function readSrcFile(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_DIR, relativePath), 'utf8');
}

describe('Paso 1 Minimalismo Premium — Configuración y Login', () => {
  it('elimina palabras de relleno y notas obvias en los archivos editados', () => {
    for (const relPath of EDITED_FILES) {
      const content = readSrcFile(relPath);
      for (const banned of BANNED_FILLER_STRINGS) {
        expect(content, `${relPath} no debe contener "${banned}"`).not.toContain(banned);
      }
    }
  });

  it('mantiene todos los TSX editados bajo el techo de 450 líneas', () => {
    for (const relPath of EDITED_FILES) {
      const lineCount = readSrcFile(relPath).split(/\r?\n/).length;
      expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(450);
    }
  });

  it('deja Cambiar Clave directo en ConfigGeneralTab', () => {
    const content = readSrcFile('components/admin/config/ConfigGeneralTab.tsx');
    expect(content).toContain('Cambiar Clave');
  });

  it('migra modales de clave y usuario a NativeModalDialog con aria-pressed', () => {
    for (const relPath of [
      'components/modals/ChangeOwnPasswordModal.tsx',
      'components/admin/config/UserFormModal.tsx',
    ]) {
      const content = readSrcFile(relPath);
      expect(content).toContain('<NativeModalDialog');
      expect(content).toContain('aria-pressed');
    }
  });

  it('usa role="tablist" sin aria-controls en ConfigTab', () => {
    const content = readSrcFile('components/admin/ConfigTab.tsx');
    expect(content).toContain('role="tablist"');
    expect(content).not.toContain('aria-controls');
  });

  it('cumple requisitos modernos de Login (autocomplete, name, aria-pressed)', () => {
    const content = readSrcFile('components/Login.tsx');
    expect(content).toContain('autoComplete="current-password"');
    expect(content).toContain('name="username"');
    expect(content).toContain('name="password"');
    expect(content).toContain('aria-pressed');
  });
});
