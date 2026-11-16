import type { FC, FormEvent } from 'react';
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
  routeName: string;
  setRouteName: (val: string) => void;
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

export const RepartoCreateRouteModal: FC<RepartoCreateRouteModalProps> = ({
  show, editingRouteId, onClose, onSubmit, routeName, setRouteName,
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

  return (
    <NativeModalDialog isOpen={show} onClose={onClose} ariaLabelledBy="reparto-create-modal-title" style={{ maxWidth: '1220px', width: '94vw', padding: '24px' }}>
      <div className="modal-header">
        <h3 id="reparto-create-modal-title" style={{ margin: 0 }}>
          {editingRouteId ? `Editar Viaje #${editingRouteId}` : 'Nuevo Viaje'}
        </h3>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{errorMsg}</div>}

      <form onSubmit={onSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: '24px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reparto-route-name">Nombre del viaje</label>
                <input id="reparto-route-name" type="text" className="input" placeholder="Ruta Sur" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reparto-companion">Acompañante</label>
                <input id="reparto-companion" type="text" className="input" placeholder="Opcional" value={companionName} onChange={(e) => setCompanionName(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reparto-driver">Conductor</label>
                <select
                  id="reparto-driver"
                  className="select"
                  value={driverName}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setDriverName(nextName);
                    const found = driverOptions.find((d) => d.fullName === nextName);
                    setDriverEmployeeId(found?.employeeId ?? null);
                  }}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {driverOptions.map((d) => (
                    <option key={`${d.employeeId ?? 'x'}-${d.fullName}`} value={d.fullName}>
                      {d.fullName}
                    </option>
                  ))}
                  {driverName && !driverOptions.some((d) => d.fullName === driverName) && (
                    <option value={driverName}>{driverName}</option>
                  )}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reparto-vehicle">Vehículo</label>
                <select
                  id="reparto-vehicle"
                  className="select"
                  value={selectedVehicleKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedVehicleKey(val);
                    if (val === 'CUSTOM' || !val) {
                      setVehicleId(null); setVehiclePlate(''); setVehicleDescription('');
                    } else {
                      const found = fleetVehicles.find((v) => v.plate === val);
                      if (found) {
                        setVehicleId(found.id ?? null);
                        setVehiclePlate(found.plate);
                        setVehicleDescription(found.description);
                      }
                    }
                  }}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {fleetVehicles.map((v) => (
                    <option key={v.plate} value={v.plate}>{v.description} ({v.plate})</option>
                  ))}
                  <option value="CUSTOM">Otro (Manual)</option>
                </select>
              </div>
            </div>

            {selectedVehicleKey === 'CUSTOM' && (
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px' }}>
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

            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '6px', flexWrap: 'wrap' }}>
                <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.84rem' }}>
                  Pedidos ({filteredPendingOrders.length})
                </span>
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
                  {selectedCityFilter !== 'ALL' && filteredPendingOrders.length > 0 && (
                    <button type="button" className="btn btn-secondary" style={{ height: '28px', padding: '0 8px', fontSize: '0.74rem' }} onClick={handleSelectCityOrders}>
                      Sel. localidad
                    </button>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: '275px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px' }}>
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

          <div>
            {selectedOrderIds.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="tabular-nums" style={{ fontSize: '0.82rem', color: '#111827', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <CheckCircle size={14} aria-hidden="true" style={{ color: 'var(--color-success)' }} />
                  <span>{metrics.ordersCount} {metrics.ordersCount === 1 ? 'pedido' : 'pedidos'}</span>
                  <span>· {metrics.totalBultos} {metrics.totalBultos === 1 ? 'bulto' : 'bultos'}</span>
                  <span>· {metrics.totalAmountLabel}</span>
                </div>
                <RouteMap
                  locations={currentTspRoute}
                  routePoints={createRouteStreetPoints.length > 0 ? createRouteStreetPoints : mapPoints}
                  onUpdateClientCoords={handleUpdateClientCoords}
                />
              </div>
            ) : (
              <div style={{ height: '340px', border: '1px dashed var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', backgroundColor: 'var(--bg-app)', gap: '8px', color: 'var(--text-secondary)' }}>
                <MapPin size={32} aria-hidden="true" />
                <span style={{ fontSize: '0.85rem' }}>Seleccione pedidos para trazar la ruta</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '18px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={selectedOrderIds.length === 0}>
            {editingRouteId ? 'Guardar cambios' : 'Crear viaje'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
