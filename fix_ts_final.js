const fs = require('fs');

// ADMIN DASHBOARD
const f1 = 'frontend/src/components/AdminDashboard.tsx';
let c1 = fs.readFileSync(f1, 'utf8');

c1 = c1.replace(/import BillingDashboard from '\.\/BillingDashboard';\n/g, '');
c1 = c1.replace(/import ClientesDashboard from '\.\/ClientesDashboard';\n/g, "import ClientesDashboard from './ClientesDashboard';\nimport CierreCajaDashboard from './CierreCajaDashboard';\n");

c1 = c1.replace(/const \[selectedBranchFilter, setSelectedBranchFilter\] = useState<string>\('ALL'\);\n/g, '');
c1 = c1.replace(/const \[selectedBankFilter, setSelectedBankFilter\] = useState<string>\('ALL'\);\n/g, '');
c1 = c1.replace(/const \[selectedDrawerFilter, setSelectedDrawerFilter\] = useState<string>\('ALL'\);\n/g, '');

c1 = c1.replace(/, selectedBranchFilter, selectedBankFilter, selectedDrawerFilter/g, '');

c1 = c1.replace(/if \(selectedBranchFilter !== 'ALL'\) filters\.branch = selectedBranchFilter;\n/g, '');
c1 = c1.replace(/if \(selectedBankFilter !== 'ALL'\) filters\.bankAccountId = Number\(selectedBankFilter\);\n/g, '');
c1 = c1.replace(/if \(selectedDrawerFilter !== 'ALL'\) filters\.cashDrawerId = Number\(selectedDrawerFilter\);\n/g, '');

c1 = c1.replace(/const handleOpenReconciliation = async \(\) => \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\n  \};\n/g, '');

fs.writeFileSync(f1, c1);
console.log('Fixed AdminDashboard.tsx variables');

// FACTURACION DASHBOARD
const f2 = 'frontend/src/components/FacturacionDashboard.tsx';
let c2 = fs.readFileSync(f2, 'utf8');

if (!c2.includes("import CierreCajaDashboard from './CierreCajaDashboard';")) {
  c2 = c2.replace(/import ClientesDashboard from '\.\/ClientesDashboard';\n/g, "import ClientesDashboard from './ClientesDashboard';\nimport CierreCajaDashboard from './CierreCajaDashboard';\n");
}

c2 = c2.replace(/const getSessionIncomeTotal = \(\) => \{[\s\S]*?\}\};\n/g, '');

fs.writeFileSync(f2, c2);
console.log('Fixed FacturacionDashboard.tsx variables');
