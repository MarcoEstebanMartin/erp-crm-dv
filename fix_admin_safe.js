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
      "        <CajasDashboard />",
      "      )}",
      ""
    );
  }

  let c = lines.join('\n');

  // Imports
  if (!c.includes("import CajasDashboard")) {
    c = c.replace(
      "import RubrosList from './RubrosList';", 
      "import RubrosList from './RubrosList';\nimport CajasDashboard from './CajasDashboard';\nimport ResumenCuentaModal from './modals/ResumenCuentaModal';"
    );
  }

  // State
  if (!c.includes("showResumenModal")) {
    c = c.replace(
      "const [clientModal, setClientModal] = useState({ open: false, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false } });",
      "const [clientModal, setClientModal] = useState({ open: false, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false } });\n  const [showResumenModal, setShowResumenModal] = useState<any>(null);"
    );
  }

  // Button
  if (!c.includes(">Resumen de Cta<")) {
    c = c.replace(
      "<button className=\"btn btn-secondary\" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleViewClientProfile(c)}>\n                              Ver Ficha\n                            </button>",
      "<button className=\"btn btn-secondary\" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleViewClientProfile(c)}>\n                              Ver Ficha\n                            </button>\n                            <button className=\"btn btn-secondary\" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setShowResumenModal(c)}>\n                              Resumen de Cta\n                            </button>"
    );
  }

  // Render Modal
  if (!c.includes("<ResumenCuentaModal client={showResumenModal}")) {
    c = c.replace(
      "{clientModal.open && (",
      "{showResumenModal && (\n        <ResumenCuentaModal client={showResumenModal} onClose={() => setShowResumenModal(null)} />\n      )}\n      {clientModal.open && ("
    );
  }

  fs.writeFileSync(f, c);
}

fixAdmin();
console.log('Fixed AdminDashboard safely');
