/**
 * Guardián de Arquitectura Anti-Espagueti (ERP-CRM DV).
 * - Impide que cualquier archivo NUEVO supere el techo rojo de 450 líneas (patrón ratchet).
 * - Lista los archivos legados que aún superan 450 líneas para ir bajándolos en Paso 3.3.
 */
const fs = require('fs');
const path = require('path');

const MAX_LINES = 450;
const ROOTS = ['backend/src', 'frontend/src'];

// Baseline de archivos legados conocidos > 450 líneas (solo puede achicarse, nunca crecer)
const LEGACY_ALLOWLIST = new Set([
  'frontend/src/components/deposito/depositomapaData.ts',
  'frontend/src/components/HrDashboard.tsx',
  'frontend/src/components/offers/StandaloneOffersManager.tsx',
  'frontend/src/components/CrmDashboard.tsx',
  'frontend/src/components/admin/CampaignEditor.tsx',
  'frontend/src/components/modals/WeeklyOfferWizardModal.tsx',
  'frontend/src/components/admin/OffersSideBySideComparator.tsx',
  'frontend/src/components/landing/InstitutionalLanding.tsx',
  'frontend/src/components/admin/OffersCatalogGenerator.tsx',
  'frontend/src/components/store/WebChatWidget.tsx',
  'frontend/src/components/crm/CrmWholesaleBoard.tsx',
  'backend/src/services/logistics/route-settlement.service.ts',
  'backend/src/services/fieldReceipts.service.ts',
  'frontend/src/components/billing/sales/OfficialInvoiceView.tsx',
  'frontend/src/components/field-receipts/UnifiedReceiptsList.tsx',
  'backend/src/services/directInvoice.service.ts',
  'frontend/src/components/admin/useAdminController.ts',
  'backend/src/services/collections/field-receipt-mirror.helper.ts',
  'backend/src/services/saleRoute.service.ts',
  'frontend/src/components/billing/credit-notes/CreateCreditNoteModal.tsx',
  'frontend/src/components/modals/ReconciliationModal.tsx',
]);

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, results);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      results.push(full);
    }
  }
  return results;
}

const repoRoot = path.resolve(__dirname, '..');
const newViolations = [];
const legacyOverLimit = [];

for (const relRoot of ROOTS) {
  const files = walk(path.join(repoRoot, relRoot));
  for (const fullPath of files) {
    const relPath = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).length;
    if (lines > MAX_LINES) {
      if (LEGACY_ALLOWLIST.has(relPath)) {
        legacyOverLimit.push({ relPath, lines });
      } else {
        newViolations.push({ relPath, lines });
      }
    }
  }
}

console.log(`📐 Guardián de Arquitectura (techo rojo: ${MAX_LINES} líneas)`);
console.log(`   Legados pendientes de refactor: ${legacyOverLimit.length}`);

if (newViolations.length > 0) {
  console.error('\n❌ Se detectaron archivos NUEVOS que superan las 450 líneas:');
  for (const v of newViolations.sort((a, b) => b.lines - a.lines)) {
    console.error(`   - ${v.relPath} (${v.lines} líneas)`);
  }
  console.error('\n👉 Dividí cada responsabilidad en un submódulo/hook/modal cohesivo antes de hacer commit.');
  process.exit(1);
}

console.log('✅ 0 violaciones nuevas del techo de 450 líneas.');
