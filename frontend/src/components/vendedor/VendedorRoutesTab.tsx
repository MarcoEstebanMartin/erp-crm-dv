import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Map as MapIcon, RefreshCw, Search, Trash2, UserPlus, X } from 'lucide-react';
import { buildSearchIndex, filterIndexedItems } from './vendedorHelpers';
import { useConfirm } from '../../context/ConfirmContext';
import type { Persona, Order, SaleRoute } from '../../types';

const ClientsGpsMapModal = React.lazy(() => import('../modals/ClientsGpsMapModal'));

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
  onReorderClients?: (orderedClientIds: number[]) => Promise<void> | void;
  onRemoveClient?: (clientId: number) => Promise<void> | void;
}

export const VendedorRoutesTab: React.FC<VendedorRoutesTabProps> = ({
  vendedorRoutes, selectedRouteId, clients, orders, todayVisits, loading,
  onSelectRoute, onSync, onOpenNewClientModal, onOpenNoSaleModal, onCollectClient, onSellToClient, onOpenResumenClient,
  onReorderClients, onRemoveClient,
}) => {
  const confirm = useConfirm();
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [routeSearch, setRouteSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draftClients, setDraftClients] = useState<Persona[]>(clients);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);

  useEffect(() => {
    setDraftClients(clients);
    setHasOrderChanges(false);
  }, [clients]);

  const activeRouteName = vendedorRoutes.find((r) => r.id === selectedRouteId)?.name || 'Ruta';
  const deferredRouteSearch = useDeferredValue(routeSearch);

  const { orderedTodayIds, visitByClientId } = useMemo(() => {
    const todayStr = new Date().toDateString();
    const orderIds = new Set<number>();
    for (const o of orders) {
      if (o.status !== 'CANCELLED' && o.clientId != null && new Date(o.createdAt).toDateString() === todayStr) {
        orderIds.add(o.clientId);
      }
    }
    const visitMap = new Map<number, any>();
    for (const v of todayVisits) {
      if (v.status === 'ORDERED') orderIds.add(v.personaId);
      visitMap.set(v.personaId, v);
    }
    for (const c of clients) {
      const embedded = (c as any).routeVisits?.[0];
      if (embedded) {
        if (embedded.status === 'ORDERED') orderIds.add(c.id);
        if (!visitMap.has(c.id)) visitMap.set(c.id, embedded);
      }
    }
    return { orderedTodayIds: orderIds, visitByClientId: visitMap };
  }, [orders, todayVisits, clients]);

  const getVisitStatus = (clientId: number) => {
    const visitToday = visitByClientId.get(clientId);
    const status = orderedTodayIds.has(clientId) ? 'VENTA' : visitToday ? 'NO_COMPRO' : 'PENDIENTE';
    return { status, visitToday };
  };

  const sourceList = editMode ? draftClients : clients;

  const indexedSource = useMemo(
    () => buildSearchIndex(sourceList, (c) => [c.name, c.address, c.city]),
    [sourceList],
  );

  const { visitedCount, pendingCount } = useMemo(() => {
    let visited = 0;
    for (const c of sourceList) {
      if (orderedTodayIds.has(c.id) || visitByClientId.has(c.id)) visited++;
    }
    return { visitedCount: visited, pendingCount: sourceList.length - visited };
  }, [sourceList, orderedTodayIds, visitByClientId]);

  const visibleClients = useMemo(() => {
    const searched = deferredRouteSearch.trim()
      ? filterIndexedItems(indexedSource, deferredRouteSearch)
      : sourceList;
    if (editMode || !onlyPending) return searched;
    return searched.filter((c) => !orderedTodayIds.has(c.id) && !visitByClientId.has(c.id));
  }, [indexedSource, sourceList, deferredRouteSearch, editMode, onlyPending, orderedTodayIds, visitByClientId]);

  const moveClient = (index: number, direction: -1 | 1) => {
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= draftClients.length) return;
    const copy = [...draftClients];
    const [moved] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, moved);
    setDraftClients(copy);
    setHasOrderChanges(true);
  };

  const handleSaveOrder = async () => {
    if (!onReorderClients) return;
    await onReorderClients(draftClients.map((c) => c.id));
    setHasOrderChanges(false);
    setEditMode(false);
  };

  const handleConfirmRemove = async (client: Persona) => {
    if (!onRemoveClient) return;
    const ok = await confirm({
      title: `Quitar a ${client.name}`,
      message: 'Se quitará de esta ruta. El cliente no se borra del sistema: queda sin ruta para Administración.',
      confirmText: 'Quitar',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (ok) await onRemoveClient(client.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        {vendedorRoutes.length > 0 ? (
          <select
            id="vendedor-active-route"
            aria-label="Ruta activa"
            className="select"
            value={selectedRouteId || ''}
            onChange={(e) => onSelectRoute(Number(e.target.value))}
            style={{ height: '38px', padding: '6px 10px', borderRadius: '8px', fontSize: '16px', flex: '1 1 180px', maxWidth: '280px' }}
          >
            {vendedorRoutes.map((r) => (<option key={r.id} value={r.id}>{r.name} ({r.dayOfWeek || 'Flexible'})</option>))}
          </select>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--color-corp-red)', fontWeight: 600 }}>Sin rutas</span>
        )}

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onSync} aria-label="Sincronizar" style={{ padding: '7px 10px' }}>
            <RefreshCw size={15} className={loading ? 'spin-animation' : ''} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setIsMapOpen(true)} aria-label="Mapa GPS" style={{ padding: '7px 10px' }}>
            <MapIcon size={15} aria-hidden="true" />
          </button>
          {selectedRouteId && (
            <button
              type="button"
              className={editMode ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => {
                if (editMode) {
                  setDraftClients(clients);
                  setHasOrderChanges(false);
                }
                setEditMode(!editMode);
                setRouteSearch('');
              }}
              style={{ padding: '7px 11px', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {editMode ? 'Listo' : 'Acomodar'}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onOpenNewClientModal} style={{ padding: '7px 10px', fontSize: '0.8rem', fontWeight: 600 }}>
            <UserPlus size={15} aria-hidden="true" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      {editMode && hasOrderChanges && (
        <button type="button" className="btn btn-primary" onClick={handleSaveOrder} disabled={loading} style={{ width: '100%', padding: '10px', fontWeight: 700 }}>
          {loading ? 'Guardando...' : 'Guardar orden'}
        </button>
      )}

      {sourceList.length > 0 && (
        <div className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
            <span className="tabular-nums">{visitedCount} / {sourceList.length} visitados</span>
            {!editMode && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={() => setOnlyPending(false)} style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid', borderColor: !onlyPending ? '#111827' : 'var(--border-color)', backgroundColor: !onlyPending ? '#111827' : '#fff', color: !onlyPending ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
                  Todos ({sourceList.length})
                </button>
                <button type="button" onClick={() => setOnlyPending(true)} style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid', borderColor: onlyPending ? '#111827' : 'var(--border-color)', backgroundColor: onlyPending ? '#111827' : '#fff', color: onlyPending ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
                  Pendientes ({pendingCount})
                </button>
              </div>
            )}
          </div>
          <progress value={visitedCount} max={sourceList.length} aria-label="Avance de ruta" style={{ width: '100%', height: '5px', accentColor: '#111827' }} />
          {!editMode && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} aria-hidden="true" />
              <label htmlFor="vendedor-route-search" className="sr-only">Buscar en ruta</label>
              <input
                id="vendedor-route-search"
                type="search"
                className="input"
                placeholder="Buscar en ruta..."
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 34px', fontSize: '16px', borderRadius: '8px' }}
              />
              {routeSearch && (
                <button type="button" aria-label="Limpiar búsqueda" onClick={() => setRouteSearch('')} style={{ position: 'absolute', right: '6px', background: 'transparent', border: 'none', boxShadow: 'none', padding: '4px', color: 'var(--text-muted)' }}>
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visibleClients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 12px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {sourceList.length === 0 ? 'Sin clientes en la ruta' : 'Sin resultados'}
          </div>
        ) : (
          visibleClients.map((c, index) => {
            const { status: visitStatus, visitToday } = getVisitStatus(c.id);
            const debt = Number(c.outstandingBalance || 0);
            const deferredStyle = index >= 8 ? { contentVisibility: 'auto' as const, containIntrinsicSize: 'auto none auto 96px' } : undefined;
            return (
              <div key={c.id} className="card" style={{ padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: '8px', ...deferredStyle }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="tabular-nums" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>#{index + 1}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    </div>
                    {(c.address || c.city) && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[c.address, c.city].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  {debt > 0 && (
                    <button type="button" className="tabular-nums" onClick={() => onOpenResumenClient(c)} style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-corp-red)', backgroundColor: 'rgba(var(--color-corp-red-rgb),0.06)', padding: '3px 8px', borderRadius: '10px', border: 'none', boxShadow: 'none', flexShrink: 0 }}>
                      ${Math.round(debt).toLocaleString('es-AR')}
                    </button>
                  )}
                </div>

                {editMode ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" className="btn btn-secondary" disabled={index === 0 || loading} onClick={() => moveClient(index, -1)} aria-label={`Subir ${c.name}`} style={{ padding: '6px 10px' }}>
                        <ArrowUp size={15} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={index === draftClients.length - 1 || loading} onClick={() => moveClient(index, 1)} aria-label={`Bajar ${c.name}`} style={{ padding: '6px 10px' }}>
                        <ArrowDown size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => handleConfirmRemove(c)} style={{ padding: '6px 10px', color: 'var(--color-danger)', fontSize: '0.78rem', fontWeight: 600 }}>
                      <Trash2 size={14} aria-hidden="true" />
                      <span>Quitar</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <span>
                      {visitStatus === 'VENTA' ? (
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={13} aria-hidden="true" /> Compró</span>
                      ) : visitStatus === 'NO_COMPRO' ? (
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No compró ({visitToday?.noBuyReason || '-'})</span>
                      ) : (
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#2563EB' }}>Pendiente</span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {visitStatus === 'PENDIENTE' && (
                        <button type="button" className="btn btn-secondary" onClick={() => onOpenNoSaleModal(c)} style={{ padding: '6px 10px', fontSize: '0.76rem' }}>Sin venta</button>
                      )}
                      {debt > 0 && (
                        <button type="button" className="btn btn-secondary" onClick={() => onCollectClient(c)} style={{ padding: '6px 10px', fontSize: '0.76rem', color: 'var(--color-corp-red)' }}>Cobrar</button>
                      )}
                      <button type="button" className="btn btn-primary" onClick={() => onSellToClient(c)} style={{ padding: '6px 12px', fontSize: '0.76rem', fontWeight: 700 }}>
                        <span>{visitStatus === 'VENTA' ? 'Otro' : 'Vender'}</span>
                        <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isMapOpen && (
        <React.Suspense fallback={null}>
          <ClientsGpsMapModal isOpen={isMapOpen} clients={clients} activeFilterLabel={activeRouteName} onClose={() => setIsMapOpen(false)} onSelectClient={(client) => { setIsMapOpen(false); onSellToClient(client); }} />
        </React.Suspense>
      )}
    </div>
  );
};
