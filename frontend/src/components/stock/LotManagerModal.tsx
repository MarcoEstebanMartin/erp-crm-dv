import React from 'react';
import { X, Edit2, Trash2 } from 'lucide-react';
import type { TransferLotData } from './types';
import LotTransferForm from './LotTransferForm';

interface LotManagerModalProps {
  open: boolean;
  product: any | null;
  loading: boolean;
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
  onDeleteLot: (lotId: number, lotNumber: string) => void;
  showTransferPanel: boolean;
  onToggleTransferPanel: () => void;
  onBackFromTransfer: () => void;
  transferData: TransferLotData;
  onTransferDataChange: (next: TransferLotData) => void;
  onTransferSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function LotManagerModal({
  open,
  product,
  loading,
  editingLot,
  editLotNumber,
  editExpirationDate,
  editLocation,
  onEditLotNumberChange,
  onEditExpirationDateChange,
  onEditLocationChange,
  onStartEditingLot,
  onCancelEditingLot,
  onUpdateLotSubmit,
  onDeleteLot,
  showTransferPanel,
  onToggleTransferPanel,
  onBackFromTransfer,
  transferData,
  onTransferDataChange,
  onTransferSubmit,
  onClose
}: LotManagerModalProps) {
  if (!open || !product) return null;

  const lots = product.lots || [];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ borderRadius: '16px', padding: '24px', maxWidth: '650px', width: '90%' }}>
        <div className="modal-header" style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Gestionar Lotes</h3>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-app)',
            padding: '14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ marginBottom: '4px' }}>
              <strong>Artículo:</strong> {product.name}
            </div>
            <div>
              <strong>SKU:</strong> {product.sku}
            </div>
          </div>
          <button
            type="button"
            className="btn"
            style={{
              borderRadius: '6px',
              fontSize: '0.78rem',
              padding: '6px 12px',
              backgroundColor: showTransferPanel ? 'var(--bg-muted)' : 'var(--text-primary)',
              color: showTransferPanel ? 'var(--text-primary)' : 'var(--bg-app)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600
            }}
            onClick={onToggleTransferPanel}
          >
            {showTransferPanel ? 'Ver Lista de Lotes' : '⇅ Transferir Stock'}
          </button>
        </div>

        {showTransferPanel ? (
          <LotTransferForm
            lots={lots}
            transferData={transferData}
            loading={loading}
            onChange={onTransferDataChange}
            onBack={onBackFromTransfer}
            onSubmit={onTransferSubmit}
          />
        ) : editingLot ? (
          <form onSubmit={onUpdateLotSubmit} style={{ animation: 'slideDown 0.2s ease-out' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: 600 }}>Editar Propiedades del Lote</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Código de Lote</label>
                <input
                  type="text"
                  className="input"
                  value={editLotNumber}
                  onChange={(e) => onEditLotNumberChange(e.target.value)}
                  required
                  style={{ borderRadius: '8px', width: '100%' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Ubicación Física</label>
                <input
                  type="text"
                  className="input"
                  value={editLocation}
                  onChange={(e) => onEditLocationChange(e.target.value)}
                  placeholder="Ej: A-3, B-12"
                  style={{ borderRadius: '8px', width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Fecha de Vencimiento</label>
                <input
                  type="date"
                  className="input"
                  value={editExpirationDate}
                  onChange={(e) => onEditExpirationDateChange(e.target.value)}
                  required
                  style={{ borderRadius: '8px', width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', paddingBottom: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Los cambios afectarán únicamente a las propiedades del lote. No se alterará la cantidad de stock.
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={onCancelEditingLot} style={{ borderRadius: '8px' }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ borderRadius: '8px' }}>
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>Lotes Registrados</h4>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '300px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ backgroundColor: 'var(--bg-muted)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Código Lote</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Stock</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Vencimiento</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Ubicación</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Sin lotes registrados
                      </td>
                    </tr>
                  ) : (
                    lots.map((lot: any) => {
                      const isExpired = new Date(lot.expirationDate) <= new Date();
                      return (
                        <tr key={lot.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }} className="hover-bg-muted">
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lot.lotNumber}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{lot.stock} u.</td>
                          <td style={{ padding: '10px 12px', color: isExpired ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                            {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                            {isExpired && (
                              <span style={{ marginLeft: '4px', fontSize: '0.68rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '2px 4px', borderRadius: '4px' }}>
                                Vencido
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{lot.location}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '4px', color: 'var(--text-secondary)' }}
                                onClick={() => onStartEditingLot(lot)}
                                title="Editar datos de lote"
                              >
                                <Edit2 size={14} />
                              </button>
                              {lot.stock === 0 && (
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ padding: '4px', color: 'var(--color-corp-red)' }}
                                  onClick={() => onDeleteLot(lot.id, lot.lotNumber)}
                                  title="Eliminar lote"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
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
    </div>
  );
}
