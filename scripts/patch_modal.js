const fs = require('fs');
const f = 'frontend/src/components/CajasDashboard.tsx';
let c = fs.readFileSync(f, 'utf8');

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

c = c.replace(targetModal, newModal);
fs.writeFileSync(f, c);
console.log("Patched CajasDashboard modal!");
