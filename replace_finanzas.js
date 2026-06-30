const fs = require('fs');

function cleanAdmin() {
  const f = 'frontend/src/components/AdminDashboard.tsx';
  let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  
  // 1. Replace Finanzas Block
  const start = lines.findIndex(l => l.includes('7. CAJAS Y TESORERÍA'));
  const end = lines.findIndex(l => l.includes('8. COMPRAS (COMPRAS DASHBOARD)'));
  if (start !== -1 && end !== -1) {
    lines.splice(start + 2, end - start - 3, 
      "      {activeTab === 'finanzas' && (",
      "        <CajasDashboard />",
      "      )}",
      ""
    );
  }

  let c = lines.join('\n');

  // 2. Import CajasDashboard
  if (!c.includes("import CajasDashboard")) {
    c = c.replace(/import RubrosList from '\.\/RubrosList';/, "import RubrosList from './RubrosList';\nimport CajasDashboard from './CajasDashboard';");
  }

  // 3. Remove finanzas states
  c = c.replace(/const \[financialReport, setFinancialReport\] = useState<any \| null>\(null\);\n/g, '');
  c = c.replace(/const \[activeDrawers, setActiveDrawers\] = useState<any\[\]>\(\[\]\);\n/g, '');
  c = c.replace(/const \[activeDrawer, setActiveDrawer\] = useState<any \| null>\(null\);\n/g, '');
  c = c.replace(/const \[bankAccounts, setBankAccounts\] = useState<any\[\]>\(\[\]\);\n/g, '');
  c = c.replace(/const \[transactions, setTransactions\] = useState<any\[\]>\(\[\]\);\n/g, '');
  
  c = c.replace(/const \[showReconciliationModal, setShowReconciliationModal\] = useState<boolean>\(false\);\n/g, '');
  c = c.replace(/const \[reconType, setReconType\] = useState<string>\('VENDEDOR'\);\n/g, '');
  c = c.replace(/const \[reconSellerId, setReconSellerId\] = useState<string>\(''\);\n/g, '');
  c = c.replace(/const \[reconBranch, setReconBranch\] = useState<string>\('X'\);\n/g, '');
  c = c.replace(/const \[reconCashDeclared, setReconCashDeclared\] = useState<string>\(''\);\n/g, '');
  c = c.replace(/const \[reconChecksDeclared, setReconChecksDeclared\] = useState<string>\(''\);\n/g, '');
  c = c.replace(/const \[reconTransfersDeclared, setReconTransfersDeclared\] = useState<string>\(''\);\n/g, '');
  c = c.replace(/const \[reconReceipts, setReconReceipts\] = useState<ReconciliationReceipt\[\]>\(\[\]\);\n/g, '');
  c = c.replace(/const \[reconSearchClient, setReconSearchClient\] = useState<string>\(''\);\n/g, '');
  c = c.replace(/const \[reconClientSuggestions, setReconClientSuggestions\] = useState<any\[\]>\(\[\]\);\n/g, '');
  c = c.replace(/const \[reconSelectedClient, setReconSelectedClient\] = useState<any \| null>\(null\);\n/g, '');
  c = c.replace(/const \[reconReceiptNumber, setReconReceiptNumber\] = useState<string>\(''\);\n/g, '');
  c = c.replace(/const \[reconReceiptMethod, setReconReceiptMethod\] = useState<string>\('CASH'\);\n/g, '');
  c = c.replace(/const \[reconReceiptAmount, setReconReceiptAmount\] = useState<string>\(''\);\n/g, '');
  
  // also filter variables
  c = c.replace(/const \[selectedBranchFilter, setSelectedBranchFilter\] = useState<string>\('ALL'\);\n/g, '');
  c = c.replace(/const \[selectedBankFilter, setSelectedBankFilter\] = useState<string>\('ALL'\);\n/g, '');
  c = c.replace(/const \[selectedDrawerFilter, setSelectedDrawerFilter\] = useState<string>\('ALL'\);\n/g, '');

  // 4. Remove fetchFinancialReport inside AdminDashboard
  c = c.replace(/const fetchFinancialReport = async \(\) => \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\n  \};\n/g, '');

  // 5. Remove handleOpenReconciliation entirely
  c = c.replace(/const handleOpenReconciliation = async \(\) => \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\n  \};\n/g, '');

  // 6. Remove handleAddReconReceipt
  c = c.replace(/const handleAddReconReceipt = \(e\?: React\.FormEvent\) => \{[\s\S]*?return;\n    \}\n    setReconReceipts\([\s\S]*?\);\n[\s\S]*?\n  \};\n/g, '');

  // 7. Remove handleRemoveReconReceipt
  c = c.replace(/const handleRemoveReconReceipt = \(id: string\) => \{[\s\S]*?\n  \};\n/g, '');

  // 8. Remove handleSubmitReconciliation
  c = c.replace(/const handleSubmitReconciliation = async \(e: React\.FormEvent\) => \{[\s\S]*?\}\n  \};\n/g, '');

  // 9. Remove Reconciliation modal render block (we can just regex remove the whole thing from {showReconciliationModal && ( to its closing })
  c = c.replace(/\{showReconciliationModal && \([\s\S]*?\}\n          \<\/div\>\n        \<\/div\>\n      \)\}\n/g, '');

  fs.writeFileSync(f, c);
}

cleanAdmin();
console.log('Fixed AdminDashboard');
