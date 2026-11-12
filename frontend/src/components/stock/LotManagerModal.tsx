import React from 'react';
import { X, Edit2, Trash2, ArrowLeftRight } from 'lucide-react';
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
      <div className="modal-content" style={{ borderRadius: '12px', padding: '24px', maxWidth: '650px', width: '90%' }}>
        <div className="modal-header" style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Gestionar Lotes</h3>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-app)',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '0.84rem',
            marginBottom: '20px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div>
            <div style={{ marginBottom: '2px' }}>
              <strong>Artículo:</strong> {product.name}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
              SKU: {product.sku}
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
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onClick={onToggleTransferPanel}
          >
            <ArrowLeftRight size={13} />
            <span>{showTransferPanel ? 'Ver Lista de Lotes' : 'Transferir Stock'}</span>
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
                  placeholder="Ej: D1-R01-C04-A o S/U"
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
                  Los cambios afectarán únicamente a las propiedades del lote sin alterar su cantidad física.
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
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 600 }}>Lotes Registrados</h4>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '300px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ backgroundColor: 'var(--bg-muted)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>LOTE</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>STOCK</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>VENCIMIENTO</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>UBICACIÓN</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>ACCIONES</th>
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
                              {lot.stock === 0 && (
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
