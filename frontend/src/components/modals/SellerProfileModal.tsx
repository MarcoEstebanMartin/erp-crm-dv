import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { NativeModalDialog } from './NativeModalDialog';
import { SellerProfilePanels, type SellerProfileData } from './seller/SellerProfilePanels';

interface SellerProfileModalProps {
  sellerId: number | null;
  onClose: () => void;
  onOpenReport?: () => void;
}

export const SellerProfileModal: React.FC<SellerProfileModalProps> = ({
  sellerId,
  onClose,
  onOpenReport,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [data, setData] = useState<SellerProfileData | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'routes' | 'clients'>('stats');
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    if (!sellerId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg('');
    setActiveTab('stats');
    setClientSearch('');

    api
      .getSellerProfileStats(sellerId)
      .then((res: SellerProfileData) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setErrorMsg('No se pudo cargar la ficha.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  if (!sellerId) return null;

  return (
    <NativeModalDialog
      isOpen={Boolean(sellerId)}
      onClose={onClose}
      ariaLabelledBy="seller-profile-title"
      style={{
        maxWidth: '960px',
        width: '95vw',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '22px 24px',
        borderRadius: '12px',
      }}
    >
      <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 id="seller-profile-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              {data?.seller.name || `Vendedor #${sellerId}`}
            </h3>
            {data && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: data.seller.isActive ? '#E6F4EA' : '#FCE8E6',
                  color: data.seller.isActive ? '#137333' : '#C5221F',
                }}
              >
                {data.seller.isActive ? 'Activo' : 'Inactivo'}
              </span>
            )}
            {data?.seller.userAccount && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '2px 7px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                {data.seller.userAccount}
              </span>
            )}
          </div>
          {data && (
            <div className="tabular-nums" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {data.seller.city && <span>{data.seller.city}</span>}
              {data.seller.phone && <span>{data.seller.phone}</span>}
              {data.seller.email && <span>{data.seller.email}</span>}
              {data.seller.cuit && <span>CUIT {data.seller.cuit}</span>}
            </div>
          )}
        </div>
        <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '6px' }} onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : errorMsg ? (
        <div role="alert" style={{ padding: '14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.86rem' }}>
          {errorMsg}
        </div>
      ) : data ? (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
            <div className="card stat-card" style={{ padding: '14px 16px' }}>
              <div className="stat-label">Ventas (mes)</div>
              <div className="stat-value tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                ${Math.round(data.metrics.totalSalesMonth).toLocaleString('es-AR')}
              </div>
            </div>
            <div className="card stat-card" style={{ padding: '14px 16px' }}>
              <div className="stat-label">Pedidos</div>
              <div className="stat-value tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                {data.metrics.totalOrdersMonth}
              </div>
            </div>
            <div className="card stat-card" style={{ padding: '14px 16px' }}>
              <div className="stat-label">Ticket promedio</div>
              <div className="stat-value tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                ${Math.round(data.metrics.averageTicket).toLocaleString('es-AR')}
              </div>
            </div>
            <div className="card stat-card" style={{ padding: '14px 16px' }}>
              <div className="stat-label">Cobertura</div>
              <div className="stat-value tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                {data.metrics.coveragePercentage}%
                <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                  {data.metrics.activeClientsCount}/{data.metrics.assignedClientsCount}
                </span>
              </div>
            </div>
          </div>

          <div className="linear-tablist" role="tablist" aria-label="Detalle de vendedor">
            <button type="button" role="tab" aria-selected={activeTab === 'stats'} className="linear-tab" onClick={() => setActiveTab('stats')}>
              Evolución
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'routes'} className="linear-tab" onClick={() => setActiveTab('routes')}>
              Rutas ({data.routes.length})
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'clients'} className="linear-tab" onClick={() => setActiveTab('clients')}>
              Clientes ({data.clients.length})
            </button>
          </div>

          <SellerProfilePanels
            activeTab={activeTab}
            data={data}
            clientSearch={clientSearch}
            setClientSearch={setClientSearch}
          />
        </div>
      ) : null}

      <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        {onOpenReport && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              onClose();
              onOpenReport();
            }}
          >
            Reportes
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </NativeModalDialog>
  );
};

export default SellerProfileModal;
