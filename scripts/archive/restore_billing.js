const fs = require('fs');

const f = 'frontend/src/components/AdminDashboard.tsx';
let c = fs.readFileSync(f, 'utf8');

if (!c.includes("import BillingDashboard from './BillingDashboard';")) {
  c = c.replace(
    "import CajasDashboard from './CajasDashboard';",
    "import CajasDashboard from './CajasDashboard';\nimport BillingDashboard from './BillingDashboard';"
  );
}

if (!c.includes("<BillingDashboard activeTab={activeTab} setActiveTab={setActiveTab} />")) {
  c = c.replace(
    "      {/* ====================================================================\n          8. COMPRAS (COMPRAS DASHBOARD)",
    "      {/* ====================================================================\n          FACTURACION & IMPUESTOS (BILLING)\n          ==================================================================== */}\n      {activeTab === 'billing' && (\n        <BillingDashboard activeTab={activeTab} setActiveTab={setActiveTab} />\n      )}\n\n      {/* ====================================================================\n          8. COMPRAS (COMPRAS DASHBOARD)"
  );
}

fs.writeFileSync(f, c);
console.log('Restored BillingDashboard');
