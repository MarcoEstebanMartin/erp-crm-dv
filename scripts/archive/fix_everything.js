const fs = require('fs');

function fixAdmin() {
  const f = 'frontend/src/components/AdminDashboard.tsx';
  let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  
  // 1. Replace Finanzas Block
  const start = lines.findIndex(l => l.includes('7. CAJAS Y TESORERÍA'));
  const end = lines.findIndex(l => l.includes('8. COMPRAS (COMPRAS DASHBOARD)'));
  if (start !== -1 && end !== -1) {
    lines.splice(start + 2, end - start - 3, 
      "      {activeTab === 'finanzas' && (",
      "        <CierreCajaDashboard />",
      "      )}",
      ""
    );
  }

  // 2. Import CierreCajaDashboard & remove BillingDashboard
  let c = lines.join('\n');
  c = c.replace(/import BillingDashboard from '\.\/BillingDashboard';\n/g, '');
  c = c.replace(/import ClientesDashboard from '\.\/ClientesDashboard';/, "import ClientesDashboard from './ClientesDashboard';\nimport CierreCajaDashboard from './CierreCajaDashboard';");

  // 3. Remove unused states
  c = c.replace(/const \[selectedBranchFilter, setSelectedBranchFilter\] = useState<string>\('ALL'\);\n/g, '');
  c = c.replace(/const \[selectedBankFilter, setSelectedBankFilter\] = useState<string>\('ALL'\);\n/g, '');
  c = c.replace(/const \[selectedDrawerFilter, setSelectedDrawerFilter\] = useState<string>\('ALL'\);\n/g, '');

  // 4. Remove them from useEffect dependency array
  c = c.replace(/, selectedBranchFilter, selectedBankFilter, selectedDrawerFilter/g, '');

  // 5. Remove them from fetchFinancialReport
  c = c.replace(/if \(selectedBranchFilter !== 'ALL'\) filters\.branch = selectedBranchFilter;\n/g, '');
  c = c.replace(/if \(selectedBankFilter !== 'ALL'\) filters\.bankAccountId = Number\(selectedBankFilter\);\n/g, '');
  c = c.replace(/if \(selectedDrawerFilter !== 'ALL'\) filters\.cashDrawerId = Number\(selectedDrawerFilter\);\n/g, '');

  // 6. Remove handleOpenReconciliation entirely
  c = c.replace(/const handleOpenReconciliation = async \(\) => \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\n  \};\n/g, '');

  fs.writeFileSync(f, c);
}

function fixFacturacion() {
  const f = 'frontend/src/components/FacturacionDashboard.tsx';
  let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  
  const start = lines.findIndex(l => l.includes("4. CAJA OPERATIVA"));
  const end = lines.findIndex(l => l.includes("normalizedTab === 'cuentas'"));
  if (start !== -1 && end !== -1) {
    lines.splice(start + 2, end - start - 3, 
      "      {normalizedTab === 'finanzas' && (",
      "        <CierreCajaDashboard />",
      "      )}",
      ""
    );
  }

  let c = lines.join('\n');
  if (!c.includes("import CierreCajaDashboard")) {
    c = c.replace(/import ClientesDashboard from '\.\/ClientesDashboard';/, "import ClientesDashboard from './ClientesDashboard';\nimport CierreCajaDashboard from './CierreCajaDashboard';");
  }

  c = c.replace(/const \[sessionInvoices, setSessionInvoices\] = useState<any\[\]>\(\[\]\);\n/g, '');
  c = c.replace(/const getSessionIncomeTotal = \(\) => \{[\s\S]*?\}\};\n/g, '');
  c = c.replace(/const data = await api\.getOrders\(\);\n/g, '');
  c = c.replace(/const deliveredToday = data\.filter\(\(o: any\) => o\.status === OrderStatus\.DELIVERED\);\n/g, '');
  c = c.replace(/setSessionInvoices\(deliveredToday\);\n/g, '');

  fs.writeFileSync(f, c);
}

fixAdmin();
fixFacturacion();
console.log('All fixed!');
