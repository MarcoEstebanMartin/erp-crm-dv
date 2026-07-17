const fs = require('fs');
const f = 'frontend/src/components/CajasDashboard.tsx';
let c = fs.readFileSync(f, 'utf8');

const inject = `
  const handleArqueoSubmit = async (realBalance: number, receipts: any[], checks: any[]) => {
    try {
      if (actionModal?.mode === 'close' && actionModal.drawerId) {
        await api.closeDrawer(actionModal.drawerId, realBalance, receipts, checks);
        setActionModal(null);
        fetchData();
      }
    } catch (err: any) {
      alert(err.message || 'Error al cerrar caja.');
    }
  };
`;

if (!c.includes("const handleArqueoSubmit")) {
  c = c.replace(
    "const handleActionSubmit = async (e: React.FormEvent) => {",
    inject + "\n  const handleActionSubmit = async (e: React.FormEvent) => {"
  );
}

// Remove ArrowRightCircle if unused
c = c.replace("import { Lock, Unlock, DollarSign, ArrowRightCircle, RefreshCw } from 'lucide-react';", "import { Lock, Unlock, DollarSign, RefreshCw } from 'lucide-react';");

fs.writeFileSync(f, c);
console.log("Injected handleArqueoSubmit");
