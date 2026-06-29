import React from 'react';
import { api } from '../../utils/api';

interface JointCloseModalProps {
  activeDrawers: any[];
  transactions: any[];
  closeRealBalanceA: string;
  closeRealBalanceX: string;
  setCloseRealBalanceA: (val: string) => void;
  setCloseRealBalanceX: (val: string) => void;
  setShowJointCloseModal: (val: boolean) => void;
  setSuccessMsg: (msg: string) => void;
  setErrorMsg: (msg: string) => void;
  fetchData: () => void;
}

export const JointCloseModal: React.FC<JointCloseModalProps> = ({
  activeDrawers,
  transactions,
  closeRealBalanceA,
  closeRealBalanceX,
  setCloseRealBalanceA,
  setCloseRealBalanceX,
  setShowJointCloseModal,
  setSuccessMsg,
  setErrorMsg,
  fetchData,
}) => {
  const activeA = activeDrawers.find(d => d.branch === 'A');
  const activeX = activeDrawers.find(d => d.branch === 'X');

  let cashIncomeA = 0;
  let cashOutcomeA = 0;
  if (activeA) {
    const txsA = transactions.filter((t: any) => t.cashDrawerId === activeA.id);
    txsA.forEach((t: any) => {
      if (t.type === 'INCOME') cashIncomeA += Number(t.amount);
      else cashOutcomeA += Number(t.amount);
    });
  }
  const theoreticalA = activeA ? Number(activeA.openingBalance) + cashIncomeA - cashOutcomeA : 0;

  let cashIncomeX = 0;
  let cashOutcomeX = 0;
  if (activeX) {
    const txsX = transactions.filter((t: any) => t.cashDrawerId === activeX.id);
    txsX.forEach((t: any) => {
      if (t.type === 'INCOME') cashIncomeX += Number(t.amount);
      else cashOutcomeX += Number(t.amount);
    });
  }
  const theoreticalX = activeX ? Number(activeX.openingBalance) + cashIncomeX - cashOutcomeX : 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const bankTransfersToday = transactions.filter((t: any) => 
    t.paymentMethod === 'BANK_TRANSFER' && 
    t.type === 'INCOME' &&
    t.createdAt && t.createdAt.split('T')[0] === todayStr
  ).reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const checksToday = transactions.filter((t: any) => 
    t.paymentMethod === 'CHECK' && 
    t.type === 'INCOME' &&
    t.createdAt && t.createdAt.split('T')[0] === todayStr
  ).reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  return (
    <div className="modal-overlay animate-fade-in">
      <div className="modal-content" style={{ maxWidth: '500px', padding: '24px' }}>
        <div className="modal-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Cierre de Caja Conjunto (A + X)</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowJointCloseModal(false)}>✕</button>
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            const res = await api.closeJointDrawers({
              realBalanceA: activeA ? Number(closeRealBalanceA || theoreticalA) : 0,
              realBalanceX: activeX ? Number(closeRealBalanceX || theoreticalX) : 0,
            });

            let msg = '✨ Cierre de caja conjunto realizado.';
            if (activeA && res.drawers) {
              const closedA = res.drawers.find((d: any) => d.branch === 'A');
              if (closedA) {
                const diffA = Number(closeRealBalanceA || theoreticalA) - Number(closedA.closingBalance);
                const descA = diffA === 0 ? 'Arqueo perfecto.' : (diffA > 0 ? 'Sobrante de $' + diffA.toLocaleString() : 'Faltante de $' + Math.abs(diffA).toLocaleString());
                msg += '\n- Sucursal A: ' + descA;
              }
            }
            if (activeX && res.drawers) {
              const closedX = res.drawers.find((d: any) => d.branch === 'X');
              if (closedX) {
                const diffX = Number(closeRealBalanceX || theoreticalX) - Number(closedX.closingBalance);
                const descX = diffX === 0 ? 'Arqueo perfecto.' : (diffX > 0 ? 'Sobrante de $' + diffX.toLocaleString() : 'Faltante de $' + Math.abs(diffX).toLocaleString());
                msg += '\n- Sucursal X: ' + descX;
              }
            }

            setSuccessMsg(msg);
            setShowJointCloseModal(false);
            setCloseRealBalanceA('');
            setCloseRealBalanceX('');
            fetchData();
          } catch (err: any) {
            setErrorMsg(err.message || 'Error al realizar el cierre de caja conjunto.');
          }
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.825rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>Cobros Consolidados de Hoy</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Transferencias Bancarias:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-info)' }}>${bankTransfersToday.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cheques Recibidos:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>${checksToday.toLocaleString()}</span>
              </div>
            </div>

            {activeA ? (
              <div style={{ border: '1px solid var(--border-color)', padding: '14px', borderRadius: '8px', backgroundColor: '#fcfcfc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#137333' }}>Sucursal A (Oficial)</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Saldo Teórico: <strong>${theoreticalA.toLocaleString()}</strong></span>
                </div>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Efectivo Real Contado ($)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder={`Teórico: ${theoreticalA}`}
                    value={closeRealBalanceA}
                    onChange={(e) => setCloseRealBalanceA(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Caja de Sucursal A está cerrada. No requiere arqueo.
              </div>
            )}

            {activeX ? (
              <div style={{ border: '1px solid var(--border-color)', padding: '14px', borderRadius: '8px', backgroundColor: '#fcfcfc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#3c4043' }}>Sucursal X (Interno)</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Saldo Teórico: <strong>${theoreticalX.toLocaleString()}</strong></span>
                </div>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Efectivo Real Contado ($)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder={`Teórico: ${theoreticalX}`}
                    value={closeRealBalanceX}
                    onChange={(e) => setCloseRealBalanceX(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Caja de Sucursal X está cerrada. No requiere arqueo.
              </div>
            )}

          </div>

          <div className="modal-footer" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowJointCloseModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#E30613', borderColor: '#E30613', color: '#ffffff' }}>
              Confirmar Cierre de Caja
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
