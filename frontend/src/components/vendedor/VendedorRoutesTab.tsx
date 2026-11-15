import React, { useState } from 'react';
import { UserPlus, CheckCircle2, MapPin, Phone, Navigation, ArrowRight, RefreshCw, Map } from 'lucide-react';
import { getWhatsAppLink } from './vendedorHelpers';
import ClientsGpsMapModal from '../modals/ClientsGpsMapModal';
import type { Persona, Order, SaleRoute } from '../../types';

interface VendedorRoutesTabProps {
  vendedorRoutes: SaleRoute[];
  selectedRouteId: number | null;
  clients: Persona[];
  orders: Order[];
  todayVisits: any[];
  loading: boolean;
  onSelectRoute: (routeId: number) => void;
  onSync: () => void;
  onOpenNewClientModal: () => void;
  onOpenNoSaleModal: (client: Persona) => void;
  onCollectClient: (client: Persona) => void;
  onSellToClient: (client: Persona) => void;
  onOpenResumenClient: (client: Persona) => void;
}

export const VendedorRoutesTab: React.FC<VendedorRoutesTabProps> = ({
  vendedorRoutes, selectedRouteId, clients, orders, todayVisits, loading,
  onSelectRoute, onSync, onOpenNewClientModal, onOpenNoSaleModal, onCollectClient, onSellToClient, onOpenResumenClient,
}) => {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const activeRouteName = vendedorRoutes.find((r) => r.id === selectedRouteId)?.name || 'Ruta';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        {vendedorRoutes.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 300px', flexWrap: 'wrap' }}>
            <label htmlFor="vendedor-active-route" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Ruta</label>
            <select id="vendedor-active-route" className="select" value={selectedRouteId || ''} onChange={(e) => onSelectRoute(Number(e.target.value))} style={{ height: '36px', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', maxWidth: '280px' }}>
              {vendedorRoutes.map((r) => (<option key={r.id} value={r.id}>{r.name} ({r.dayOfWeek || 'Flexible'})</option>))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={onSync} title="Actualizar saldos" style={{ padding: '6px 10px', height: '36px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={15} className={loading ? 'spin-animation' : ''} aria-hidden="true" />
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Sincronizar</span>
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-corp-red)', fontWeight: 600 }}>Sin rutas asignadas</div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary tabular-nums" onClick={() => setIsMapOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            <Map size={15} aria-hidden="true" />
            <span>Mapa GPS ({clients.length})</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={onOpenNewClientModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            <UserPlus size={15} aria-hidden="true" />
            <span>Nuevo cliente</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {clients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 12px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Sin clientes en la ruta
          </div>
        ) : (
          clients.map((c, index) => {
            const hasOrderToday = orders.some((o) => o.clientId === c.id && new Date(o.createdAt).toDateString() === new Date().toDateString() && o.status !== 'CANCELLED');
            const visitToday = todayVisits.find((v) => v.personaId === c.id);
            const visitStatus = hasOrderToday ? 'VENTA' : visitToday ? 'NO_COMPRO' : 'PENDIENTE';
            return (
              <div key={c.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="tabular-nums" style={{ fontSize: '0.72rem', fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>#{index + 1}</span>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</h4>
                  </div>
                  {Number(c.outstandingBalance || 0) > 0 && (
                    <button type="button" className="tabular-nums" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-corp-red)', backgroundColor: 'rgba(var(--color-corp-red-rgb),0.05)', padding: '3px 8px', borderRadius: '12px', border: '1px solid rgba(var(--color-corp-red-rgb),0.15)', cursor: 'pointer' }} onClick={() => onOpenResumenClient(c)}>
                      Debe ${Math.round(Number(c.outstandingBalance)).toLocaleString('es-AR')}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} aria-hidden="true" /> {c.address || '-'} {c.city ? `(${c.city})` : ''}</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {c.route && (<span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>{c.route}</span>)}
                    {c.phone && (<span className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} aria-hidden="true" /> {c.phone}</span>)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    {visitStatus === 'VENTA' ? (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(52, 199, 89, 0.15)', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} aria-hidden="true" /> Compró</span>
                    ) : visitStatus === 'NO_COMPRO' ? (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(142, 142, 147, 0.15)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>No compró ({visitToday?.noBuyReason || '-'})</span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(0, 122, 255, 0.1)', color: '#007AFF', display: 'inline-flex', alignItems: 'center' }}>Pendiente</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {c.phone && (<a href={getWhatsAppLink(c.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 8px', minWidth: 'auto', borderRadius: '6px', fontSize: '0.76rem' }} title="WhatsApp">WA</a>)}
                    {c.latitude && c.longitude && (<a href={`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto', borderRadius: '6px' }} title="Google Maps" aria-label={`Ubicación de ${c.name}`}><Navigation size={14} aria-hidden="true" /></a>)}
                    <button type="button" className="btn btn-secondary" onClick={() => onOpenResumenClient(c)} style={{ padding: '6px 10px', fontSize: '0.72rem', borderRadius: '6px' }}>Cuenta</button>
                    <button type="button" className="btn btn-secondary" onClick={() => onOpenNoSaleModal(c)} style={{ padding: '6px 10px', fontSize: '0.72rem', borderRadius: '6px' }} disabled={visitStatus !== 'PENDIENTE'}>Sin venta</button>
                    {Number(c.outstandingBalance || 0) > 0 && (<button type="button" className="btn btn-secondary" onClick={() => onCollectClient(c)} style={{ padding: '6px 10px', fontSize: '0.72rem', borderRadius: '6px', color: 'var(--color-corp-red)' }}>Cobrar</button>)}
                    <button type="button" className="btn btn-primary" onClick={() => onSellToClient(c)} style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px' }} disabled={visitStatus === 'VENTA'}><span>Vender</span><ArrowRight size={12} aria-hidden="true" /></button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ClientsGpsMapModal isOpen={isMapOpen} clients={clients} activeFilterLabel={activeRouteName} onClose={() => setIsMapOpen(false)} onSelectClient={(client) => { setIsMapOpen(false); onSellToClient(client); }} />
    </div>
  );
};
