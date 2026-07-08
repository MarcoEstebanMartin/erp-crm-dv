const fs = require('fs');

const f1 = 'frontend/src/components/AdminDashboard.tsx';
let c1 = fs.readFileSync(f1, 'utf8');

// remove handleOpenReconciliation entirely including its body if it exists
c1 = c1.replace(/const handleOpenReconciliation = async \(\) => \{[\s\S]*?\}\s*};\n/g, '');
// replace it if it's not async
c1 = c1.replace(/const handleOpenReconciliation = \(\) => \{[\s\S]*?\}\s*};\n/g, '');

const lines1 = c1.split('\n');
const n1 = lines1.filter(l => 
  !l.includes("if (selectedBranchFilter !== 'ALL') filters.branch = selectedBranchFilter;") &&
  !l.includes("if (selectedBankFilter !== 'ALL') filters.bankAccountId = Number(selectedBankFilter);") &&
  !l.includes("if (selectedDrawerFilter !== 'ALL') filters.cashDrawerId = Number(selectedDrawerFilter);") &&
  !l.includes("const handleOpenReconciliation = ") &&
  !l.includes("setReconciliationModal({ open: true, transaction: tx });")
);
fs.writeFileSync(f1, n1.join('\n'));


const f2 = 'frontend/src/components/FacturacionDashboard.tsx';
const lines2 = fs.readFileSync(f2, 'utf8').split('\n');
const n2 = lines2.filter(l => 
  !l.includes("const deliveredToday = data.filter((o: any) => o.status === OrderStatus.DELIVERED);")
);
fs.writeFileSync(f2, n2.join('\n'));
