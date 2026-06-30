const fs = require('fs');

const f = 'frontend/src/components/AdminDashboard.tsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(/import BillingDashboard from '\.\/BillingDashboard';\r?\n/, '');
c = c.replace(/const \[selectedBranchFilter, setSelectedBranchFilter\] = useState<string>\('ALL'\);\r?\n/, 'const [selectedBranchFilter] = useState<string>(\'ALL\');\n');
c = c.replace(/const \[selectedBankFilter, setSelectedBankFilter\] = useState<string>\('ALL'\);\r?\n/, 'const [selectedBankFilter] = useState<string>(\'ALL\');\n');
c = c.replace(/const \[selectedDrawerFilter, setSelectedDrawerFilter\] = useState<string>\('ALL'\);\r?\n/, 'const [selectedDrawerFilter] = useState<string>(\'ALL\');\n');

const match = c.match(/const handleOpenReconciliation = async \(\) => \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\n  \};\n/);
if (match) {
  c = c.replace(match[0], '');
}

fs.writeFileSync(f, c);
console.log('Fixed unused variables in AdminDashboard');
