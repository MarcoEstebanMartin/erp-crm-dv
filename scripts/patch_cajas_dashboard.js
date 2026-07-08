const fs = require('fs');
const f = 'frontend/src/components/CajasDashboard.tsx';
let c = fs.readFileSync(f, 'utf8');

if (!c.includes("import ArqueoCajaModal from './ArqueoCajaModal';")) {
  c = c.replace(
    "import { Lock, Unlock, DollarSign, ArrowRightCircle, RefreshCw } from 'lucide-react';",
    "import { Lock, Unlock, DollarSign, ArrowRightCircle, RefreshCw } from 'lucide-react';\nimport ArqueoCajaModal from './ArqueoCajaModal';"
  );
}

// Reemplazar submit logic para usar onSuccess del modal
const targetSubmit = `  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const amount = Number(amountInput);
      if (isNaN(amount) || amount < 0) {
        throw new Error('Ingrese un monto válido mayor o igual a 0.');
      }

      if (actionModal.mode === 'open') {
        await api.openDrawer(actionModal.branch, amount);
      } else if (actionModal.mode === 'close' && actionModal.drawerId) {
        await api.closeDrawer(actionModal.drawerId, amount);
      }

      setActionModal(null);
      setAmountInput('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al procesar la caja.');
    }
  };`;

const newSubmit = `  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = Number(amountInput);
      if (isNaN(amount) || amount < 0) throw new Error('Ingrese un monto válido mayor o igual a 0.');
      if (actionModal?.mode === 'open') {
        await api.openDrawer(actionModal.branch, amount);
      }
      setActionModal(null);
      setAmountInput('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al procesar la caja.');
    }
  };

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
  };`;

if (c.includes(targetSubmit)) {
  c = c.replace(targetSubmit, newSubmit);
}

const targetModalClose = `            {actionModal.mode === 'close' && (
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <ArrowRightCircle size={20} color="#3b82f6" style={{ marginTop: '2px', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#1e3a8a' }}>
                  El saldo real que declares aquí se transferirá automáticamente a la <strong>Caja Grande</strong>.
                </p>
              </div>
            )}`;

if (c.includes(targetModalClose)) {
  c = c.replace(targetModalClose, "");
}

const targetModal = `{/* Modal Arqueo / Apertura */}
      {actionModal?.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{actionModal.mode === 'open' ? 'Apertura de Caja' : 'Arqueo de Caja (Cierre)'}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setActionModal(null)}>✕</button>
            </div>
            
            <form onSubmit={handleActionSubmit}>
              <div className="form-group">
                <label>{actionModal.mode === 'open' ? 'Efectivo Inicial en Caja ($)' : 'Efectivo Físico Contado ($)'}</label>
                <input 
                  type="number" 
                  className="input" 
                  autoFocus
                  required
                  step="0.01"
                  min="0"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActionModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: actionModal.mode === 'open' ? '#10b981' : '#ef4444', borderColor: actionModal.mode === 'open' ? '#10b981' : '#ef4444' }}>
                  {actionModal.mode === 'open' ? 'Abrir Caja' : 'Cerrar y Transferir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}`;

const newModal = `{/* Modal Arqueo / Apertura */}
      {actionModal?.open && actionModal.mode === 'open' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Apertura de Caja</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setActionModal(null)}>✕</button>
            </div>
            <form onSubmit={handleActionSubmit}>
              <div className="form-group">
                <label>Efectivo Inicial en Caja ($)</label>
                <input 
                  type="number" 
                  className="input" 
                  autoFocus
                  required
                  step="0.01"
                  min="0"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActionModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>Abrir Caja</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actionModal?.open && actionModal.mode === 'close' && (
        <ArqueoCajaModal 
          drawer={drawers.find(d => d.id === actionModal.drawerId)}
          onClose={() => setActionModal(null)}
          onSuccess={handleArqueoSubmit}
        />
      )}`;

if (c.includes(targetModal)) {
  c = c.replace(targetModal, newModal);
}

fs.writeFileSync(f, c);
console.log("Patched CajasDashboard for ArqueoCajaModal");
