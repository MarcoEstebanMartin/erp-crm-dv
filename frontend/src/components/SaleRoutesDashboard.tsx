import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../utils/api';
import { useConfirm } from '../context/ConfirmContext';
import { OptimizeRouteModal } from './modals/OptimizeRouteModal';
import { SaleRouteDetailPanel } from './admin/routes/SaleRouteDetailPanel';
import { SaleRouteFormModal } from './admin/routes/SaleRouteFormModal';

const DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;

export default function SaleRoutesDashboard() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingSequence, setSavingSequence] = useState(false);
  const [hasSequenceChanges, setHasSequenceChanges] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formSellerId, setFormSellerId] = useState('');
  const [formDay, setFormDay] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);

  const confirm = useConfirm();

  const loadInitialData = async (keepSelection = true) => {
    setLoading(true);
    try {
      const [routesRes, sellersRes] = await Promise.all([api.getSaleRoutes(), api.getSellersList()]);
      const list = routesRes?.routes || [];
      setRoutes(list);
      setSellers(sellersRes || []);
      if (list.length === 0) {
        setSelectedRouteId(null);
        setSelectedRoute(null);
      } else if (!keepSelection || !selectedRouteId || !list.some((r: any) => r.id === selectedRouteId)) {
        setSelectedRouteId(list[0].id);
      }
    } catch {
      setErrorMsg('No se pudieron cargar las rutas.');
    } finally {
      setLoading(false);
    }
  };

  const loadRouteDetail = async (routeId: number) => {
    setDetailLoading(true);
    try {
      const res = await api.getSaleRouteById(routeId);
      setSelectedRoute(res?.route || null);
      setHasSequenceChanges(false);
    } catch {
      setErrorMsg('No se pudo cargar el detalle.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData(false);
  }, []);

  useEffect(() => {
    if (selectedRouteId) loadRouteDetail(selectedRouteId);
    else setSelectedRoute(null);
  }, [selectedRouteId]);

  const handleOpenCreate = () => {
    setEditingRouteId(null);
    setFormName('');
    setFormSellerId('');
    setFormDay('');
    setFormActive(true);
    setShowFormModal(true);
  };

  const handleOpenEdit = () => {
    if (!selectedRoute) return;
    setEditingRouteId(selectedRoute.id);
    setFormName(selectedRoute.name || '');
    setFormSellerId(selectedRoute.sellerId ? String(selectedRoute.sellerId) : '');
    setFormDay(selectedRoute.dayOfWeek || '');
    setFormActive(selectedRoute.isActive !== false);
    setShowFormModal(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        name: formName.trim(),
        sellerId: formSellerId ? Number(formSellerId) : null,
        dayOfWeek: formDay || null,
      };
      if (editingRouteId) {
        await api.updateSaleRoute(editingRouteId, { ...payload, isActive: formActive });
        setSuccessMsg('Ruta actualizada.');
        setShowFormModal(false);
        await loadInitialData(true);
        await loadRouteDetail(editingRouteId);
      } else {
        const res = await api.createSaleRoute(payload);
        setSuccessMsg('Ruta creada.');
        setShowFormModal(false);
        await loadInitialData(false);
        if (res?.route?.id) setSelectedRouteId(res.route.id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar ruta.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!selectedRoute) return;
    if (!(await confirm(`¿Eliminar la ruta "${selectedRoute.name}"?`))) return;
    try {
      await api.deleteSaleRoute(selectedRoute.id);
      setSuccessMsg('Ruta eliminada.');
      setSelectedRouteId(null);
      await loadInitialData(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al eliminar ruta.');
    }
  };

  const handleMoveClient = (index: number, direction: -1 | 1) => {
    if (!selectedRoute?.clients) return;
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= selectedRoute.clients.length) return;
    const updated = [...selectedRoute.clients];
    const [moved] = updated.splice(index, 1);
    updated.splice(nextIdx, 0, moved);
    setSelectedRoute({ ...selectedRoute, clients: updated });
    setHasSequenceChanges(true);
  };

  const handleSaveSequence = async () => {
    if (!selectedRoute) return;
    setSavingSequence(true);
    try {
      const ids = (selectedRoute.clients || []).map((c: any) => c.id);
      await api.updateClientSequence(selectedRoute.id, ids);
      setHasSequenceChanges(false);
      setSuccessMsg('Secuencia guardada.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar secuencia.');
    } finally {
      setSavingSequence(false);
    }
  };

  const handleRemoveClient = async (clientId: number, clientName: string) => {
    if (!(await confirm(`¿Quitar a "${clientName}" de esta ruta?`))) return;
    try {
      await api.updatePersona(clientId, { saleRouteId: null, routeSequence: null });
      setSuccessMsg('Cliente quitado de la ruta.');
      if (selectedRouteId) {
        await Promise.all([loadRouteDetail(selectedRouteId), loadInitialData(true)]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al quitar cliente.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Rutas de preventa</h3>
        <button type="button" className="btn btn-primary" onClick={handleOpenCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} />
          <span>Nueva ruta</span>
        </button>
      </div>

      {errorMsg && (
        <div role="alert" style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.84rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{errorMsg}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setErrorMsg(null)}>Cerrar</button>
        </div>
      )}

      {successMsg && (
        <div role="status" style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '0.84rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{successMsg}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setSuccessMsg(null)}>Cerrar</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 285px) 1fr', gap: '20px', alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#ffffff', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando...</div>
          ) : routes.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Sin rutas</div>
          ) : (
            routes.map((r, idx) => {
              const selected = selectedRouteId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedRouteId(r.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    border: 'none',
                    borderBottom: idx < routes.length - 1 ? '1px solid #f1f5f9' : 'none',
                    borderLeft: selected ? '2px solid #111827' : '2px solid transparent',
                    backgroundColor: selected ? '#f8fafc' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: selected ? 700 : 600, fontSize: '0.86rem', color: selected ? '#0f172a' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.name}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '0.76rem', fontWeight: 500, color: '#64748b', flexShrink: 0 }}>
                      {r._count?.clients || 0}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    {r.seller?.username ? r.seller.username.replace('_', ' ').toUpperCase() : 'Sin vendedor'}
                    {r.dayOfWeek ? ` · ${r.dayOfWeek}` : ''}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <SaleRouteDetailPanel
          route={selectedRoute}
          loading={detailLoading}
          hasSequenceChanges={hasSequenceChanges}
          savingSequence={savingSequence}
          onMoveClient={handleMoveClient}
          onSaveSequence={handleSaveSequence}
          onRemoveClient={handleRemoveClient}
          onOpenEdit={handleOpenEdit}
          onDeleteRoute={handleDeleteRoute}
          onOpenOptimize={() => setShowOptimizeModal(true)}
        />
      </div>

      <SaleRouteFormModal
        isOpen={showFormModal}
        isEditing={Boolean(editingRouteId)}
        formName={formName}
        setFormName={setFormName}
        formSellerId={formSellerId}
        setFormSellerId={setFormSellerId}
        formDay={formDay}
        setFormDay={setFormDay}
        formActive={formActive}
        setFormActive={setFormActive}
        sellers={sellers}
        daysOfWeek={DAYS_OF_WEEK}
        saving={saving}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleSubmitForm}
      />

      <OptimizeRouteModal
        open={showOptimizeModal}
        onClose={() => setShowOptimizeModal(false)}
        route={selectedRoute}
        onSuccess={() => {
          if (selectedRouteId) loadRouteDetail(selectedRouteId);
        }}
        setErrorMsg={setErrorMsg}
        setSuccessMsg={setSuccessMsg}
      />
    </div>
  );
}
