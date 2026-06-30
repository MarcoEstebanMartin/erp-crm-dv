const fs = require('fs');

const f1 = 'frontend/src/components/AdminDashboard.tsx';
let c1 = fs.readFileSync(f1, 'utf8');

const s1 = "import BillingDashboard from './BillingDashboard';\n";
const s2 = "const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');\n";
const s3 = "const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');\n";
const s4 = "const [selectedDrawerFilter, setSelectedDrawerFilter] = useState<string>('ALL');\n";

c1 = c1.replace(s1, '');
c1 = c1.replace(s2, '');
c1 = c1.replace(s3, '');
c1 = c1.replace(s4, '');
c1 = c1.replace(/const handleOpenReconciliation = \([\s\S]*?\};\n\n/g, '');

fs.writeFileSync(f1, c1);
