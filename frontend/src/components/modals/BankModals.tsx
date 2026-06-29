import React from 'react';
import { api } from '../../utils/api';

interface BankModalsProps {
  showCreateBankModal: boolean;
  setShowCreateBankModal: (val: boolean) => void;
  createBankName: string;
  setCreateBankName: (val: string) => void;
  createBankAccountNumber: string;
  setCreateBankAccountNumber: (val: string) => void;
  createBankBalance: string;
  setCreateBankBalance: (val: string) => void;
  showTransferModal: boolean;
  setShowTransferModal: (val: boolean) => void;
  transferAmount: string;
  setTransferAmount: (val: string) => void;
  transferBankAccountId: string;
  setTransferBankAccountId: (val: string) => void;
  transferDescription: string;
  setTransferDescription: (val: string) => void;
  bankAccounts: any[];
  setSuccessMsg: (msg: string) => void;
  setErrorMsg: (msg: string) => void;
  fetchData: () => void;
}

export const BankModals: React.FC<BankModalsProps> = ({
  showCreateBankModal,
  setShowCreateBankModal,
  createBankName,
  setCreateBankName,
  createBankAccountNumber,
  setCreateBankAccountNumber,
  createBankBalance,
  setCreateBankBalance,
  showTransferModal,
  setShowTransferModal,
  transferAmount,
  setTransferAmount,
  transferBankAccountId,
  setTransferBankAccountId,
  transferDescription,
  setTransferDescription,
  bankAccounts,
  setSuccessMsg,
  setErrorMsg,
  fetchData
}) => {
  return (
    <>
      {/* Agregar Cuenta Bancaria Modal */}
      {showCreateBankModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Nueva Cuenta Bancaria</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowCreateBankModal(false)}>✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.createBankAccount({
                  name: createBankName,
                  accountNumber: createBankAccountNumber,
                  balance: Number(createBankBalance)
                });
                setSuccessMsg('Cuenta bancaria agregada correctamente.');
                setShowCreateBankModal(false);
                setCreateBankName('');
                setCreateBankAccountNumber('');
                setCreateBankBalance('0');
                fetchData();
              } catch (err: any) {
                setErrorMsg(err.message || 'Error al crear cuenta.');
              }
            }}>
              <div className="form-group">
                <label>Nombre del Banco / Entidad</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Banco Galicia Corriente"
                  required
                  value={createBankName}
                  onChange={(e) => setCreateBankName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Número de Cuenta / CVU</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: CTA-12345/6"
                  value={createBankAccountNumber}
                  onChange={(e) => setCreateBankAccountNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Saldo Inicial ($)</label>
                <input
                  type="number"
                  className="input"
                  value={createBankBalance}
                  onChange={(e) => setCreateBankBalance(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateBankModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Cuenta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Retiro a Banco Modal */}
      {showTransferModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Depositar Efectivo en Banco</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowTransferModal(false)}>✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.transferFunds(Number(transferAmount), Number(transferBankAccountId), transferDescription);
                setSuccessMsg('Depósito registrado exitosamente.');
                setShowTransferModal(false);
                setTransferAmount('');
                setTransferDescription('');
                fetchData();
              } catch (err: any) {
                setErrorMsg(err.message || 'Error al transferir fondos.');
              }
            }}>
              <div className="form-group">
                <label>Cuenta de Destino</label>
                <select
                  className="select"
                  value={transferBankAccountId}
                  onChange={(e) => setTransferBankAccountId(e.target.value)}
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} (${Number(b.balance).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Monto a Depositar ($)</label>
                <input
                  type="number"
                  className="input"
                  required
                  placeholder="ej: 50000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Descripción / Observación</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Depósito por cajero autoservicio"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Depósito</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
