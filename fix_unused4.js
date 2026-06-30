const fs = require('fs');

// AdminDashboard.tsx
const f1 = 'frontend/src/components/AdminDashboard.tsx';
let c1 = fs.readFileSync(f1, 'utf8');

// Fix useEffect dependencies
c1 = c1.replace(', selectedBranchFilter, selectedBankFilter, selectedDrawerFilter', '');

// Fix fetchFinancialReport usage of these variables
c1 = c1.replace(/if \(selectedBranchFilter !== 'ALL'\) filters\.branch = selectedBranchFilter;\n/g, '');
c1 = c1.replace(/if \(selectedBankFilter !== 'ALL'\) filters\.bankAccountId = Number\(selectedBankFilter\);\n/g, '');
c1 = c1.replace(/if \(selectedDrawerFilter !== 'ALL'\) filters\.cashDrawerId = Number\(selectedDrawerFilter\);\n/g, '');

// Remove handleOpenReconciliation entirely since it's unused
c1 = c1.replace(/const handleOpenReconciliation = async \(\) => \{[\s\S]*?\}\s*};\n/g, '');

fs.writeFileSync(f1, c1);

// FacturacionDashboard.tsx
const f2 = 'frontend/src/components/FacturacionDashboard.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(/const data = await api\.getOrders\(\);\n/g, '');
fs.writeFileSync(f2, c2);
