const fs = require('fs');

// ADMIN DASHBOARD
const f1 = 'frontend/src/components/AdminDashboard.tsx';
const lines = fs.readFileSync(f1, 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('7. CAJAS Y TESORERÍA'));
const end = lines.findIndex(l => l.includes('8. COMPRAS (COMPRAS DASHBOARD)'));

if (start !== -1 && end !== -1) {
  lines.splice(start + 2, end - start - 3, 
    "      {activeTab === 'finanzas' && (",
    "        <CierreCajaDashboard />",
    "      )}",
    ""
  );
  
  // also delete variables
  const finalLines = lines.filter(l => 
    !l.includes("import BillingDashboard from './BillingDashboard';") &&
    !l.includes("const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');") &&
    !l.includes("const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');") &&
    !l.includes("const [selectedDrawerFilter, setSelectedDrawerFilter] = useState<string>('ALL');") &&
    !l.includes("const handleOpenReconciliation = ") &&
    !l.includes("setReconciliationModal({ open: true, transaction: tx });")
  );
  
  // Actually handleOpenReconciliation is multiple lines, so filtering by line won't delete the body
  let c1 = finalLines.join('\n');
  c1 = c1.replace(/const handleOpenReconciliation = async \(\) => \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\n  \};\n/g, '');
  
  fs.writeFileSync(f1, c1);
  console.log('Replaced Admin');
}

// FACTURACION DASHBOARD
const f2 = 'frontend/src/components/FacturacionDashboard.tsx';
const lines2 = fs.readFileSync(f2, 'utf8').split('\n');

const start2 = lines2.findIndex(l => l.includes("4. CAJA OPERATIVA"));
const end2 = lines2.findIndex(l => l.includes("normalizedTab === 'cuentas'"));

if (start2 !== -1 && end2 !== -1) {
  lines2.splice(start2 + 2, end2 - start2 - 3, 
    "      {normalizedTab === 'finanzas' && (",
    "        <CierreCajaDashboard />",
    "      )}",
    ""
  );
  
  let finalLines2 = lines2.filter(l => 
    !l.includes("const deliveredToday = data.filter((o: any) => o.status === OrderStatus.DELIVERED);") &&
    !l.includes("setSessionInvoices(deliveredToday);") &&
    !l.includes("const [sessionInvoices, setSessionInvoices] = useState<any[]>([]);") &&
    !l.includes("const getSessionIncomeTotal = () => {") &&
    !l.includes("return sessionInvoices.reduce")
  );
  
  let c2 = finalLines2.join('\n');
  c2 = c2.replace(/const getSessionIncomeTotal = \(\) => \{[\s\S]*?\}\};\n/g, '');
  c2 = c2.replace(/const data = await api\.getOrders\(\);\n/g, '');
  fs.writeFileSync(f2, c2);
  console.log('Replaced Fact');
}
