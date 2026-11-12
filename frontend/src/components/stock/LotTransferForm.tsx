import React from 'react';
import type { TransferLotData } from './types';
import { extractCleanLotNumber } from './lotLabel';

interface LotTransferFormProps {
  lots: any[];
  transferData: TransferLotData;
  loading: boolean;
  onChange: (next: TransferLotData) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function LotTransferForm({
  lots,
  transferData,
  loading,
  onChange,
  onBack,
  onSubmit
}: LotTransferFormProps) {
  return (
    <form onSubmit={onSubmit} style={{ animation: 'slideDown 0.2s ease-out' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: 600 }}>
        Transferir / Reasignar Stock entre Lotes
      </h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Lote Origen */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Lote de Origen</label>
          <select
            className="select"
            value={transferData.fromLotId}
            onChange={(e) => onChange({ ...transferData, fromLotId: Number(e.target.value) })}
            required
            style={{ borderRadius: '8px', width: '100%' }}
          >
            <option value="">Seleccione origen...</option>
            {lots
              .filter((l: any) => l.stock > 0)
              .map((l: any) => {
                const cleanLot = extractCleanLotNumber(l.lotNumber);
                const locLabel = l.location && l.location !== 'S/U' ? ` · ${l.location}` : '';
                return (
                  <option key={l.id} value={l.id}>
                    Lote: {cleanLot}{locLabel} ({l.stock} u. disponibles)
                  </option>
                );
              })}
          </select>
        </div>

        {/* Cantidad */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Cantidad a transferir</label>
          <input
            type="number"
            className="input"
            value={transferData.quantity || ''}
            onChange={(e) => onChange({ ...transferData, quantity: Number(e.target.value) })}
            required
            min={1}
            max={
              transferData.fromLotId !== ''
                ? lots.find((l: any) => l.id === transferData.fromLotId)?.stock || 1
                : undefined
            }
            style={{ borderRadius: '8px', width: '100%' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Lote Destino */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Lote de Destino</label>
          <select
            className="select"
            value={transferData.isNewDestLot ? '__new__' : transferData.toLotNumber}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__new__') {
                onChange({ ...transferData, isNewDestLot: true, toLotNumber: '', toExpirationDate: '' });
              } else {
                onChange({ ...transferData, isNewDestLot: false, toLotNumber: val });
              }
            }}
            required
            style={{ borderRadius: '8px', width: '100%' }}
          >
            <option value="">Seleccione destino...</option>
            {lots
              .filter((l: any) => l.id !== transferData.fromLotId)
              .map((l: any) => {
                const cleanLot = extractCleanLotNumber(l.lotNumber);
                const locLabel = l.location && l.location !== 'S/U' ? ` · ${l.location}` : '';
                return (
                  <option key={l.id} value={l.lotNumber}>
                    Lote: {cleanLot}{locLabel} (Stock: {l.stock} u.)
                  </option>
                );
              })}
            <option value="__new__">+ Crear nuevo lote...</option>
          </select>
        </div>

        {/* Fecha de vencimiento (si es nuevo lote) */}
        {transferData.isNewDestLot && (
          <div className="form-group" style={{ marginBottom: 0, animation: 'slideDown 0.15s ease-out' }}>
            <label>Fecha Vencimiento (Nuevo Lote)</label>
            <input
              type="date"
              className="input"
              value={transferData.toExpirationDate}
              onChange={(e) => onChange({ ...transferData, toExpirationDate: e.target.value })}
              required
              style={{ borderRadius: '8px', width: '100%' }}
            />
          </div>
        )}

        {/* Input Código Lote Nuevo */}
        {transferData.isNewDestLot && (
          <div className="form-group" style={{ marginBottom: 0, animation: 'slideDown 0.15s ease-out' }}>
            <label>Código del Nuevo Lote</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: L-2026-02"
              value={transferData.toLotNumber}
              onChange={(e) => onChange({ ...transferData, toLotNumber: e.target.value })}
              required
              style={{ borderRadius: '8px', width: '100%' }}
            />
          </div>
        )}
      </div>

      <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px' }}>
        <button type="button" className="btn btn-secondary" onClick={onBack} style={{ borderRadius: '8px' }}>
          Volver
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ borderRadius: '8px' }}>
          {loading ? 'Transfiriendo...' : 'Confirmar Transferencia'}
        </button>
      </div>
    </form>
  );
}
