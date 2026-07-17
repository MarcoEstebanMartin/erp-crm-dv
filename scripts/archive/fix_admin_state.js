const fs = require('fs');
const file = 'frontend/src/components/AdminDashboard.tsx';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('const [showResumenModal, setShowResumenModal] = useState<any>(null);')) {
  c = c.replace(
    "const [clientModal, setClientModal] = useState({ open: false, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false } });",
    "const [clientModal, setClientModal] = useState({ open: false, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false } });\n  const [showResumenModal, setShowResumenModal] = useState<any>(null);"
  );
  fs.writeFileSync(file, c);
  console.log('Added showResumenModal state');
}
