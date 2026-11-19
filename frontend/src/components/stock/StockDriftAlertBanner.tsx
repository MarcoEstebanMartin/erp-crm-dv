import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';

interface StockDriftAlertBannerProps {
  isAdmin: boolean;
  refreshToken: number;
  onReconciled: () => Promise<void> | void;
}

export const StockDriftAlertBanner: React.FC<StockDriftAlertBannerProps> = ({
  isAdmin,
  refreshToken,
  onReconciled,
}) => {
  const confirm = useConfirm();
  const [audit, setAudit] = useState<{ count: number; products: any[] } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const runAudit = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.auditStockDrift();
      setAudit({ count: Number(res?.count || 0), products: res?.products || [] });
    } catch {
      // Silencioso para no bloquear pantalla operativa
    }
  }, [isAdmin]);

  useEffect(() => {
    void runAudit();
  }, [runAudit, refreshToken]);

  if (!isAdmin || !audit || audit.count === 0) return null;

  const handleReconcile = async () => {
    const ok = await confirm({
      title: 'Conciliar Stock',
      message: `Se detectaron ${audit.count} artículo(s) con diferencia entre lotes físicos y disponible comercial. ¿Confirmás ejecutar la conciliación automática?`,
      type: 'warning',
      confirmText: 'Conciliar ahora',
      cancelText: 'Cancelar',
    });
    if (!ok) return;

    setReconciling(true);
    try {
      await api.reconcileStockDrift();
      await onReconciled();
      await runAudit();
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div
      role="status"
      style={{
        backgroundColor: '#fffbeb',
        border: '1px solid #f59e0b',
        color: '#92400e',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '16px',
        fontSize: '0.84rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Descalce de inventario en {audit.count} artículo(s) entre lotes físicos y stock disponible.</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setExpanded((prev) => !prev)}
          >
            <span>Ver detalle</span>
            {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={reconciling}
            onClick={handleReconcile}
            style={{ padding: '4px 12px', fontSize: '0.78rem' }}
          >
            {reconciling ? 'Conciliando...' : 'Conciliar'}
          </button>
        </div>
      </div>

      {expanded && audit.products.length > 0 && (
        <div className="table-container" style={{ marginTop: '10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #fde68a' }}>
          <table style={{ width: '100%', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Producto</th>
                <th scope="col" style={{ textAlign: 'right' }}>Stock Actual</th>
                <th scope="col" style={{ textAlign: 'right' }}>Teórico</th>
                <th scope="col" style={{ textAlign: 'right' }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {audit.products.map((item: any) => (
                <tr key={item.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.sku}</td>
                  <td>{item.name}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right' }}>{item.stockActual}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right' }}>{item.stockTeorico}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {item.discrepancia > 0 ? `+${item.discrepancia}` : item.discrepancia}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
