import React from 'react';
import { X, Edit2, Trash2, ArrowLeftRight, PackageMinus } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import type { TransferLotData } from './types';
import LotTransferForm from './LotTransferForm';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isSentinelExpiration
} from './lotLabel';

interface LotManagerModalProps {
  open: boolean;
  product: any | null;
  loading: boolean;
  canMutateStock?: boolean;
  editingLot: any | null;
  editLotNumber: string;
  editExpirationDate: string;
  editLocation: string;
  onEditLotNumberChange: (val: string) => void;
  onEditExpirationDateChange: (val: string) => void;
  onEditLocationChange: (val: string) => void;
  onStartEditingLot: (lot: any) => void;
  onCancelEditingLot: () => void;
  onUpdateLotSubmit: (e: React.FormEvent) => void;
  onVacateLot: (lotId: number, lotNumber: string, currentStock: number) => void;
  onDeleteLot: (lotId: number, lotNumber: string) => void;
  showTransferPanel: boolean;
  onToggleTransferPanel: () => void;
  onBackFromTransfer: () => void;
  transferData: TransferLotData;
  onTransferDataChange: (next: TransferLotData) => void;
  onTransferSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

const TH_LOT_STYLE: React.CSSProperties = {
  padding: '10px 12px', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--text-secondary)'
};

export default function LotManagerModal({
  open, product, loading, canMutateStock = true, editingLot, editLotNumber, editExpirationDate, editLocation,
  onEditLotNumberChange, onEditExpirationDateChange, onEditLocationChange, onStartEditingLot, onCancelEditingLot,
  onUpdateLotSubmit, onVacateLot, onDeleteLot, showTransferPanel, onToggleTransferPanel, onBackFromTransfer,
  transferData, onTransferDataChange, onTransferSubmit, onClose
}: LotManagerModalProps) {
  if (!open || !product) return null;
  const lots = product.lots || [];

  return (
    <NativeModalDialog
      isOpen={Boolean(open && product)}
      onClose={onClose}
      ariaLabelledBy="lot-manager-modal-title"
      style={{ borderRadius: '12px', padding: '24px', maxWidth: '650px', width: '94vw' }}
    >
      <div>
        <div className="modal-header" style={{ marginBottom: '20px' }}>
          <h3 id="lot-manager-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            {canMutateStock ? 'Gestionar Lotes' : 'Lotes'}
          </h3>
          <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px', borderRadius: '6px', border: 'none', cursor: 'pointer' }} onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '20px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ marginBottom: '2px' }}><strong>Artículo:</strong> {product.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>SKU: {product.sku}</div>
          </div>
          {canMutateStock && (
            <button
              type="button"
              className="btn"
              style={{ borderRadius: '6px', fontSize: '0.78rem', padding: '6px 12px', backgroundColor: showTransferPanel ? 'var(--bg-muted)' : 'var(--text-primary)', color: showTransferPanel ? 'var(--text-primary)' : 'var(--bg-app)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              onClick={onToggleTransferPanel}
            >
              <ArrowLeftRight size={13} />
              <span>{showTransferPanel ? 'Ver Lista de Lotes' : 'Transferir Stock'}</span>
            </button>
          )}
        </div>

        {canMutateStock && showTransferPanel ? (
          <LotTransferForm
            lots={lots}
            transferData={transferData}
            loading={loading}
            onChange={onTransferDataChange}
            onBack={onBackFromTransfer}
            onSubmit={onTransferSubmit}
          />
        ) : canMutateStock && editingLot ? (
          <form onSubmit={onUpdateLotSubmit} style={{ animation: 'slideDown 0.2s ease-out' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: 600 }}>Editar Lote</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="lot-edit-number">Código de Lote</label>
                <input
                  id="lot-edit-number"
                  type="text"
                  className="input"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={editLotNumber}
                  onChange={(e) => onEditLotNumberChange(e.target.value)}
                  required
                  style={{ borderRadius: '8px', width: '100%' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="lot-edit-location">Ubicación</label>
                <input
                  id="lot-edit-location"
                  type="text"
                  className="input"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={editLocation}
                  onChange={(e) => onEditLocationChange(e.target.value)}
                  placeholder="D1-R01-C04-A o S/U"
                  style={{ borderRadius: '8px', width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px', maxWidth: '280px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="lot-edit-expiration">Vencimiento</label>
                <input
                  id="lot-edit-expiration"
                  type="date"
                  className="input"
                  value={editExpirationDate}
                  onChange={(e) => onEditExpirationDateChange(e.target.value)}
                  required
                  style={{ borderRadius: '8px', width: '100%' }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={onCancelEditingLot} style={{ borderRadius: '8px' }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ borderRadius: '8px' }}>
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 600 }}>Lotes</h4>
            <div className="table-container table-container--sticky" role="region" aria-label="Lotes registrados" tabIndex={0} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '300px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ backgroundColor: 'var(--bg-muted)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th scope="col" style={{ ...TH_LOT_STYLE, textAlign: 'left' }}>Lote</th>
                    <th scope="col" style={{ ...TH_LOT_STYLE, textAlign: 'center' }}>Stock</th>
                    <th scope="col" style={{ ...TH_LOT_STYLE, textAlign: 'left' }}>Vencimiento</th>
                    <th scope="col" style={{ ...TH_LOT_STYLE, textAlign: 'left' }}>Ubicación</th>
                    {canMutateStock && <th scope="col" style={{ ...TH_LOT_STYLE, textAlign: 'right' }}>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {lots.length === 0 ? (
                    <tr>
                      <td colSpan={canMutateStock ? 5 : 4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Sin lotes registrados
                      </td>
                    </tr>
                  ) : (
                    lots.map((lot: any) => {
                      const cleanLot = extractCleanLotNumber(lot.lotNumber);
                      const sentinel = isSentinelExpiration(lot.expirationDate);
                      const isExpired = !sentinel && new Date(lot.expirationDate) <= new Date();
                      return (
                        <tr key={lot.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }} className="hover-bg-muted">
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{cleanLot}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {lot.stock} u.
                          </td>
                          <td style={{ padding: '10px 12px', color: isExpired ? 'var(--color-danger)' : sentinel ? 'var(--text-muted)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {formatCleanExpirationDate(lot.expirationDate)}
                            {isExpired && (
                              <span style={{ marginLeft: '6px', fontSize: '0.68rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '2px 5px', borderRadius: '4px' }}>
                                Vencido
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            {lot.location || 'S/U'}
                          </td>
                          {canMutateStock && (
                            <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ padding: '4px', color: 'var(--text-secondary)' }}
                                  onClick={() => onStartEditingLot(lot)}
                                  title="Editar propiedades del lote"
                                >
                                  <Edit2 size={14} />
                                </button>
                                {lot.stock > 0 ? (
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: '4px', color: 'var(--color-corp-red)' }}
                                    onClick={() => onVacateLot(lot.id, cleanLot, lot.stock)}
                                    title="Vaciar stock del lote a 0 u."
                                  >
                                    <PackageMinus size={14} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: '4px', color: 'var(--color-corp-red)' }}
                                    onClick={() => onDeleteLot(lot.id, cleanLot)}
                                    title="Eliminar lote vacío"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} style={{ borderRadius: '8px' }}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </NativeModalDialog>
  );
}
