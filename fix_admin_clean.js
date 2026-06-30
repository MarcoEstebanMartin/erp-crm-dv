const fs = require('fs');
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
  
  // also clean unused variables
  let content = lines.join('\n');
  content = content.replace(/import BillingDashboard from '\.\/BillingDashboard';\n/g, '');
  content = content.replace(/const \[selectedBranchFilter, setSelectedBranchFilter\] = useState<string>\('ALL'\);\n/g, '');
  content = content.replace(/const \[selectedBankFilter, setSelectedBankFilter\] = useState<string>\('ALL'\);\n/g, '');
  content = content.replace(/const \[selectedDrawerFilter, setSelectedDrawerFilter\] = useState<string>\('ALL'\);\n/g, '');
  
  // remove the entire block for handleOpenReconciliation up to its closing brace
  content = content.replace(/const handleOpenReconciliation = async \(\) => \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\n  \};\n/g, '');
  
  fs.writeFileSync(f1, content);
  console.log('Fixed Admin');
}
