import { useEffect, useState, type FC, type FormEvent } from 'react';
import { MapPin, CheckCircle, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { RouteMap } from './LeafletRouteMap';
import {
  computeTripDisplayMetrics,
  type DriverOption,
  type FleetVehicleOption,
} from './repartoRouteHelpers';
import { formatBigIntARS, toOrderIntegerPesosBigInt } from '../../utils/fulfillmentCardMeta.helper';

interface RepartoCreateRouteModalProps {
  show: boolean;
  editingRouteId: number | null;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  driverName: string;
  setDriverName: (val: string) => void;
  driverEmployeeId: number | null;
  setDriverEmployeeId: (val: number | null) => void;
  companionName: string;
  setCompanionName: (val: string) => void;
  vehiclePlate: string;
  setVehiclePlate: (val: string) => void;
  vehicleDescription: string;
  setVehicleDescription: (val: string) => void;
  setVehicleId: (val: number | null) => void;
  selectedVehicleKey: string;
  setSelectedVehicleKey: (val: string) => void;
  driverOptions: DriverOption[];
  fleetVehicles: FleetVehicleOption[];
  selectedCityFilter: string;
  setSelectedCityFilter: (val: string) => void;
  selectedZoneFilter: string;
  setSelectedZoneFilter: (val: string) => void;
  uniqueCities: string[];
  uniqueZones: string[];
  modalOrderPool: any[];
  filteredPendingOrders: any[];
  selectedOrderIds: number[];
  handleToggleOrder: (orderId: number) => void;
  handleSelectCityOrders: () => void;
  currentTspRoute: any[];
  createRouteStreetPoints: [number, number][];
  mapPoints: [number, number][];
  handleUpdateClientCoords: (clientId: number, lat: number, lng: number) => void;
  errorMsg?: string | null;
}

const COMPANION_OPTIONS = ['Thiago'] as const;

export const RepartoCreateRouteModal: FC<RepartoCreateRouteModalProps> = ({
  show, editingRouteId, onClose, onSubmit,
  driverName, setDriverName, setDriverEmployeeId, companionName, setCompanionName,
  vehiclePlate, setVehiclePlate, vehicleDescription, setVehicleDescription, setVehicleId,
  selectedVehicleKey, setSelectedVehicleKey, driverOptions, fleetVehicles,
  selectedCityFilter, setSelectedCityFilter, selectedZoneFilter, setSelectedZoneFilter,
  uniqueCities, uniqueZones, modalOrderPool, filteredPendingOrders, selectedOrderIds,
  handleToggleOrder, handleSelectCityOrders, currentTspRoute, createRouteStreetPoints,
  mapPoints, handleUpdateClientCoords, errorMsg,
}) => {
  const selectedOrders = modalOrderPool.filter((o) => selectedOrderIds.includes(o.id));
  const metrics = computeTripDisplayMetrics(selectedOrders);
  const [isCustomDriver, setIsCustomDriver] = useState(false);
  const [isCustomCompanion, setIsCustomCompanion] = useState(false);
  const visibleSelectedCount = filteredPendingOrders.filter((o) => selectedOrderIds.includes(o.id)).length;
  const allVisibleSelected = filteredPendingOrders.length > 0 && visibleSelectedCount === filteredPendingOrders.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  useEffect(() => {
    if (!show) return;
    setIsCustomDriver(Boolean(driverName && !driverOptions.some((d) => d.fullName === driverName)));
    setIsCustomCompanion(Boolean(companionName && !COMPANION_OPTIONS.includes(companionName as (typeof COMPANION_OPTIONS)[number])));
  }, [show, editingRouteId]);

  return (
    <NativeModalDialog
      isOpen={show}
      onClose={onClose}
      ariaLabelledBy="reparto-create-modal-title"
      style={{
        width: 'min(1320px, 95dvw)',
        maxWidth: '1320px',
        height: 'min(760px, 90dvh)',
        maxHeight: '90dvh',
        padding: '24px 28px',
      }}
    >
      <div className="modal-header" style={{ flexShrink: 0 }}>
        <h3 id="reparto-create-modal-title" style={{ margin: 0 }}>
          {editingRouteId ? `Editar Viaje #${editingRouteId}` : 'Nuevo Viaje'}
        </h3>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px', flexShrink: 0 }}>{errorMsg}</div>}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '450px minmax(0, 1fr)', gap: '24px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0, height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flexShrink: 0 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reparto-driver">Conductor</label>
                <select id="reparto-driver" name="driverName" className="select" value={isCustomDriver ? 'CUSTOM' : driverName} required onChange={(e) => {
                  const nextName = e.target.value;
                  if (nextName === 'CUSTOM') { setIsCustomDriver(true); setDriverName(''); setDriverEmployeeId(null); return; }
                  setIsCustomDriver(false); setDriverName(nextName);
                  if (!isCustomCompanion && companionName && companionName === nextName) setCompanionName('');
                  setDriverEmployeeId(driverOptions.find((d) => d.fullName === nextName)?.employeeId ?? null);
                }}>
                  <option value="">Seleccionar...</option>
                  {driverOptions.map((d) => <option key={`${d.employeeId ?? 'x'}-${d.fullName}`} value={d.fullName}>{d.fullName}</option>)}
                  <option value="CUSTOM">Otro</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reparto-companion">Acompañante</label>
                <select id="reparto-companion" name="companionName" className="select" value={isCustomCompanion ? 'CUSTOM' : companionName} onChange={(e) => {
                  const nextName = e.target.value;
                  if (nextName === 'CUSTOM') { setIsCustomCompanion(true); setCompanionName(''); return; }
                  setIsCustomCompanion(false); setCompanionName(nextName);
                }}>
                  <option value="">Opcional</option>
                  {COMPANION_OPTIONS.map((name) => <option key={`comp-${name}`} value={name}>{name}</option>)}
                  <option value="CUSTOM">Otro</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0, flexShrink: 0 }}>
              <label htmlFor="reparto-vehicle">Vehículo</label>
              <select id="reparto-vehicle" name="vehiclePlate" className="select" value={selectedVehicleKey} required onChange={(e) => {
                const val = e.target.value;
                setSelectedVehicleKey(val);
                if (val === 'CUSTOM' || !val) { setVehicleId(null); setVehiclePlate(''); setVehicleDescription(''); return; }
                const found = fleetVehicles.find((v) => v.plate === val);
                if (found) { setVehicleId(found.id ?? null); setVehiclePlate(found.plate); setVehicleDescription(found.description); }
              }}>
                <option value="">Seleccionar...</option>
                {fleetVehicles.map((v) => <option key={v.plate} value={v.plate}>{v.description} ({v.plate})</option>)}
                <option value="CUSTOM">Otro (Manual)</option>
              </select>
            </div>

            {(isCustomDriver || isCustomCompanion) && (
              <div style={{ display: 'grid', gridTemplateColumns: isCustomDriver && isCustomCompanion ? '1fr 1fr' : '1fr', gap: '10px', flexShrink: 0 }}>
                {isCustomDriver && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="reparto-driver-custom">Nombre del conductor</label>
                    <input id="reparto-driver-custom" name="driverNameCustom" type="text" className="input" placeholder="Nombre y apellido" value={driverName} onChange={(e) => { setDriverName(e.target.value); setDriverEmployeeId(null); }} required />
                  </div>
                )}
                {isCustomCompanion && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="reparto-companion-custom">Nombre del acompañante</label>
                    <input id="reparto-companion-custom" name="companionNameCustom" type="text" className="input" placeholder="Nombre y apellido" value={companionName} onChange={(e) => setCompanionName(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {selectedVehicleKey === 'CUSTOM' && (
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px', flexShrink: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="reparto-plate">Patente</label>
                  <input id="reparto-plate" type="text" className="input tabular-nums" placeholder="AA000AA" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} autoCorrect="off" autoCapitalize="characters" spellCheck={false} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="reparto-veh-desc">Descripción</label>
                  <input id="reparto-veh-desc" type="text" className="input" placeholder="Marca y modelo" value={vehicleDescription} onChange={(e) => setVehicleDescription(e.target.value)} required />
                </div>
              </div>
            )}

            <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '6px', flexWrap: 'wrap', minHeight: '28px', flexShrink: 0 }}>
                {filteredPendingOrders.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input ref={(el) => { if (el) el.indeterminate = someVisibleSelected; }} id="reparto-select-all-orders" type="checkbox" checked={allVisibleSelected} onChange={handleSelectCityOrders} />
                    <label htmlFor="reparto-select-all-orders" className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', margin: 0 }}>
                      Todos ({filteredPendingOrders.length})
                    </label>
                  </div>
                ) : (
                  <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.84rem' }}>Pedidos (0)</span>
                )}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select aria-label="Filtrar por localidad" className="input" style={{ width: '132px', padding: '2px 6px', fontSize: '0.78rem', height: '28px' }} value={selectedCityFilter} onChange={(e) => setSelectedCityFilter(e.target.value)}>
                    <option value="ALL">Todas</option>
                    {uniqueCities.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                  {selectedCityFilter !== 'ALL' && uniqueZones.length > 0 && (
                    <select aria-label="Filtrar por zona" className="input" style={{ width: '105px', padding: '2px 6px', fontSize: '0.78rem', height: '28px' }} value={selectedZoneFilter} onChange={(e) => setSelectedZoneFilter(e.target.value)}>
                      <option value="ALL">Todas</option>
                      {uniqueZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable', overscrollBehavior: 'contain', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px' }}>
                {filteredPendingOrders.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '12px', textAlign: 'center' }}>Sin pedidos para despacho.</div>
                ) : (
                  filteredPendingOrders.map((o) => (
                    <label key={o.id} htmlFor={`route-order-${o.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderBottom: '1px solid #f0f0f0', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
                      <input id={`route-order-${o.id}`} type="checkbox" checked={selectedOrderIds.includes(o.id)} onChange={() => handleToggleOrder(o.id)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.persona?.name}</span>
                          {o.persona?.city && <span style={{ fontSize: '0.68rem', color: '#4B5563', backgroundColor: '#F3F4F6', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }}>{o.persona.city}</span>}
                        </div>
                        <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>#{o.id} · {o.invoiceNumber || 'Pendiente'}</span>
                          <strong style={{ color: '#111827' }}>{formatBigIntARS(toOrderIntegerPesosBigInt(o.totalAmount))}</strong>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0, height: '100%', overflow: 'hidden' }}>
            <div className="tabular-nums" style={{ minHeight: '22px', flexShrink: 0, fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', color: selectedOrderIds.length > 0 ? '#111827' : 'var(--text-secondary)' }}>
              {selectedOrderIds.length > 0 ? (
                <>
                  <CheckCircle size={14} aria-hidden="true" style={{ color: 'var(--color-success)' }} />
                  <span>{metrics.ordersCount} {metrics.ordersCount === 1 ? 'pedido' : 'pedidos'}</span>
                  <span>· {metrics.totalBultos} {metrics.totalBultos === 1 ? 'bulto' : 'bultos'}</span>
                  <span>· {metrics.totalAmountLabel}</span>
                </>
              ) : (
                <span>0 pedidos seleccionados</span>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {selectedOrderIds.length > 0 ? (
                <RouteMap
                  locations={currentTspRoute}
                  routePoints={createRouteStreetPoints.length > 0 ? createRouteStreetPoints : mapPoints}
                  onUpdateClientCoords={handleUpdateClientCoords}
                  fillHeight
                />
              ) : (
                <div style={{ flex: 1, minHeight: 0, border: '1px dashed var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', backgroundColor: 'var(--bg-app)', gap: '8px', color: 'var(--text-secondary)' }}>
                  <MapPin size={32} aria-hidden="true" />
                  <span style={{ fontSize: '0.85rem' }}>Seleccione pedidos para trazar la ruta</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={selectedOrderIds.length === 0}>
            {editingRouteId ? 'Guardar cambios' : 'Crear viaje'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
