const fs = require('fs');

const f1 = 'frontend/src/components/AdminDashboard.tsx';
const lines1 = fs.readFileSync(f1, 'utf8').split('\n');
const new1 = lines1.filter(l => 
  !l.includes("import BillingDashboard from './BillingDashboard';") &&
  !l.includes("const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');") &&
  !l.includes("const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');") &&
  !l.includes("const [selectedDrawerFilter, setSelectedDrawerFilter] = useState<string>('ALL');") &&
  !l.includes("const handleOpenReconciliation = (tx: any) => {") &&
  !l.includes("setReconciliationModal({ open: true, transaction: tx });")
);
fs.writeFileSync(f1, new1.join('\n'));

const f2 = 'frontend/src/components/FacturacionDashboard.tsx';
const lines2 = fs.readFileSync(f2, 'utf8').split('\n');
const new2 = lines2.filter(l => 
  !l.includes("const deliveredToday = data.filter((o: any) => o.status === OrderStatus.DELIVERED);")
);
fs.writeFileSync(f2, new2.join('\n'));
