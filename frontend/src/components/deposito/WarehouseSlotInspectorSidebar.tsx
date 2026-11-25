import React from 'react';
import { Layers, Lock } from 'lucide-react';
import type { Product, ProductLot } from '../../types';
import { SECTORS_INFO } from './depositomapaData';
import { extractBaseSlotFromLocation, type MergedDepositSlot } from './warehouseLayoutMerger';
import { formatCompactSlotLevels } from './wmsMapHelpers';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isSentinelExpiration,
} from '../stock/lotLabel';

interface WarehouseSlotInspectorSidebarProps {
  selectedSlot: MergedDepositSlot | null;
  products: Product[];
  onOpen3DModal: () => void;
}

const GENERIC_CHAMBERS = new Set(['GENERAL', 'D2_GENERAL', 'D3_GENERAL']);

export const WarehouseSlotInspectorSidebar: React.FC<WarehouseSlotInspectorSidebarProps> = ({
  selectedSlot,
  products,
  onOpen3DModal,
}) => {
  const matchingProducts: { product: Product; lot: ProductLot }[] = [];

  if (selectedSlot) {
    (products || []).forEach((p) => {
      if (p.lots && p.lots.length > 0) {
        p.lots.forEach((l) => {
          if (l.stock > 0 && extractBaseSlotFromLocation(l.location) === selectedSlot.code) {
            matchingProducts.push({ product: p, lot: l });
          }
        });
      } else if (p.stock > 0 && extractBaseSlotFromLocation(p.defaultLocation) === selectedSlot.code) {
        matchingProducts.push({
          product: p,
          lot: {
            id: 0,
            productId: p.id,
            lotNumber: 'S/L',
            expirationDate: '2036-12-31T00:00:00.000Z',
            stock: p.stock,
            location: selectedSlot.code,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }
    });
  }

  const sectorLabel =
    selectedSlot && !GENERIC_CHAMBERS.has(selectedSlot.chamber)
      ? SECTORS_INFO[selectedSlot.chamber]?.label
      : null;

  const isEmpty = matchingProducts.length === 0;
  const actionLabel = isEmpty && !selectedSlot?.isBlocked ? 'Ubicar stock' : 'Abrir estante';

  return (
    <div className={`wms-inspector-panel ${!selectedSlot ? 'wms-inspector-panel--empty' : ''}`}>
      {selectedSlot ? (
        <>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {selectedSlot.code}
              </h4>
              {selectedSlot.isBlocked ? (
                <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Lock size={11} aria-hidden="true" /> Bloqueado
                </span>
              ) : !isEmpty ? (
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Ocupado</span>
              ) : null}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              {selectedSlot.deposito}
              {sectorLabel ? ` · ${sectorLabel}` : ''}
              {' · '}Pisos <strong style={{ color: 'var(--text-primary)' }}>{formatCompactSlotLevels(selectedSlot.nivel)}</strong>
            </div>
            {selectedSlot.customLabel && (
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#334155', backgroundColor: '#f1f5f9', display: 'inline-block', padding: '2px 7px', borderRadius: '4px', marginTop: '6px' }}>
                {selectedSlot.customLabel}
              </div>
            )}
          </div>

          {isEmpty ? (
            <div style={{ padding: '14px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {selectedSlot.isBlocked && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px', color: '#dc2626' }}>
                  <Lock size={18} aria-hidden="true" />
                </div>
              )}
              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                {selectedSlot.isBlocked ? 'Bloqueado' : 'Vacío'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
              {matchingProducts.map(({ product, lot }, idx) => {
                const cleanLot = extractCleanLotNumber(lot.lotNumber);
                const hasRealExp = !isSentinelExpiration(lot.expirationDate);
                return (
                  <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', backgroundColor: '#fafafa', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      [{product.sku}] {product.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.75rem' }}>
                      <span>
                        Lote {cleanLot}
                        {hasRealExp ? ` · Venc. ${formatCleanExpirationDate(lot.expirationDate)}` : ''}
                      </span>
                      <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{lot.stock} u.</strong>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                      {lot.location || selectedSlot.code}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            style={{
              width: '100%',
              minBlockSize: '42px',
              padding: '9px 14px',
              fontSize: '0.86rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              borderRadius: '8px',
            }}
            onClick={onOpen3DModal}
          >
            <Layers size={16} aria-hidden="true" />
            <span>{actionLabel}</span>
          </button>
        </>
      ) : (
        <div style={{ padding: '28px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Elegí un slot del mapa
        </div>
      )}
    </div>
  );
};
