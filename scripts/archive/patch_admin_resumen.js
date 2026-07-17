const fs = require('fs');

const file = 'frontend/src/components/AdminDashboard.tsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Import
if (!c.includes("import ResumenCuentaModal")) {
  c = c.replace(
    "import ClientModal from './modals/ClientModal';", 
    "import ClientModal from './modals/ClientModal';\nimport ResumenCuentaModal from './modals/ResumenCuentaModal';"
  );
}

// 2. Add State
if (!c.includes("const [showResumenModal, setShowResumenModal] = useState<any>(null);")) {
  c = c.replace(
    "const [clientModal, setClientModal] = useState<{open: boolean, mode: 'create' | 'edit', data: any}>({ open: false, mode: 'create', data: null });",
    "const [clientModal, setClientModal] = useState<{open: boolean, mode: 'create' | 'edit', data: any}>({ open: false, mode: 'create', data: null });\n  const [showResumenModal, setShowResumenModal] = useState<any>(null);"
  );
}

// 3. Add Button
if (!c.includes("Resumen de Cta")) {
  c = c.replace(
    "<button className=\"btn btn-secondary\" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleViewClientProfile(c)}>\n                              Ver Ficha\n                            </button>",
    "<button className=\"btn btn-secondary\" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleViewClientProfile(c)}>\n                              Ver Ficha\n                            </button>\n                            <button className=\"btn btn-secondary\" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setShowResumenModal(c)}>\n                              Resumen de Cta\n                            </button>"
  );
}

// 4. Render Modal
if (!c.includes("<ResumenCuentaModal client={showResumenModal}")) {
  c = c.replace(
    "{clientModal.open && (",
    "{showResumenModal && (\n        <ResumenCuentaModal client={showResumenModal} onClose={() => setShowResumenModal(null)} />\n      )}\n      {clientModal.open && ("
  );
}

fs.writeFileSync(file, c);
console.log('AdminDashboard updated');
