const fs = require('fs');
const file = 'frontend/src/components/FacturacionDashboard.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

// Import
const importIndex = lines.findIndex(l => l.includes("import ClientesDashboard"));
if (importIndex !== -1 && !lines.find(l => l.includes("import CierreCajaDashboard"))) {
  lines.splice(importIndex + 1, 0, "import CierreCajaDashboard from './CierreCajaDashboard';");
}

const start = lines.findIndex(l => l.includes("4. CAJA OPERATIVA"));
const end = lines.findIndex(l => l.includes("normalizedTab === 'cuentas'"));
if (start !== -1 && end !== -1) {
  lines.splice(start + 2, end - start - 3, 
    "      {normalizedTab === 'finanzas' && (",
    "        <CierreCajaDashboard />",
    "      )}",
    ""
  );
  fs.writeFileSync(file, lines.join('\n'));
  console.log('Replaced Facturacion');
} else {
  console.log('Not found Facturacion', start, end);
}
