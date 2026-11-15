import type { FC, FormEvent } from 'react';
import { MapPin, CheckCircle, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { RouteMap } from './LeafletRouteMap';

interface RepartoCreateRouteModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  driverName: string;
  setDriverName: (val: string) => void;
  companionName: string;
  setCompanionName: (val: string) => void;
  vehiclePlate: string;
  setVehiclePlate: (val: string) => void;
  vehicleDescription: string;
  setVehicleDescription: (val: string) => void;
  selectedVehicleKey: string;
  setSelectedVehicleKey: (val: string) => void;
  loadedDrivers: string[];
  loadedVehicles: { plate: string; description: string }[];
  selectedCityFilter: string;
  setSelectedCityFilter: (val: string) => void;
  selectedZoneFilter: string;
  setSelectedZoneFilter: (val: string) => void;
  uniqueCities: string[];
  uniqueZones: string[];
  filteredPendingOrders: any[];
  selectedOrderIds: number[];
  handleToggleOrder: (orderId: number) => void;
  currentTspRoute: any[];
  createRouteStreetPoints: [number, number][];
  mapPoints: [number, number][];
  handleUpdateClientCoords: (clientId: number, lat: number, lng: number) => void;
  errorMsg?: string | null;
}

export const RepartoCreateRouteModal: FC<RepartoCreateRouteModalProps> = ({
  show, onClose, onSubmit, driverName, setDriverName, companionName, setCompanionName,
  vehiclePlate, setVehiclePlate, vehicleDescription, setVehicleDescription,
  selectedVehicleKey, setSelectedVehicleKey, loadedDrivers, loadedVehicles,
  selectedCityFilter, setSelectedCityFilter, selectedZoneFilter, setSelectedZoneFilter,
  uniqueCities, uniqueZones, filteredPendingOrders, selectedOrderIds, handleToggleOrder,
  currentTspRoute, createRouteStreetPoints, mapPoints, handleUpdateClientCoords, errorMsg,
}) => (
  <NativeModalDialog isOpen={show} onClose={onClose} ariaLabelledBy="reparto-create-modal-title" style={{ maxWidth: '1200px', width: '94vw', padding: '24px' }}>
    <div className="modal-header">
      <h3 id="reparto-create-modal-title" style={{ margin: 0 }}>Nueva Hoja de Ruta</h3>
      <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
    </div>

    {errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{errorMsg}</div>}

    <form onSubmit={onSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label htmlFor="reparto-driver">Chofer</label>
            <select id="reparto-driver" className="select" value={driverName} onChange={(e) => setDriverName(e.target.value)} required>
              <option value="">Seleccionar chofer...</option>
              {loadedDrivers.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="reparto-companion">Acompañante (opcional)</label>
            <input id="reparto-companion" type="text" className="input" placeholder="Nombre" value={companionName} onChange={(e) => setCompanionName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="reparto-vehicle">Vehículo</label>
            <select
              id="reparto-vehicle"
              className="select"
              value={selectedVehicleKey}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedVehicleKey(val);
                if (val === 'CUSTOM' || !val) {
                  setVehiclePlate(''); setVehicleDescription('');
                } else {
                  const found = loadedVehicles.find((v) => v.plate === val);
                  if (found) { setVehiclePlate(found.plate); setVehicleDescription(found.description); }
                }
              }}
              required
            >
              <option value="">Seleccionar vehículo...</option>
              {loadedVehicles.map((v) => <option key={v.plate} value={v.plate}>{v.description} ({v.plate})</option>)}
              <option value="CUSTOM">Otro (Manual)</option>
            </select>
          </div>
          {selectedVehicleKey === 'CUSTOM' && (
            <>
              <div className="form-group">
                <label htmlFor="reparto-plate">Patente</label>
                <input id="reparto-plate" type="text" className="input tabular-nums" placeholder="AA000AA" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} autoCorrect="off" autoCapitalize="characters" spellCheck={false} required />
              </div>
              <div className="form-group">
                <label htmlFor="reparto-veh-desc">Descripción</label>
                <input id="reparto-veh-desc" type="text" className="input" placeholder="Marca y modelo" value={vehicleDescription} onChange={(e) => setVehicleDescription(e.target.value)} required />
              </div>
            </>
          )}

          <div style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
              <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.84rem' }}>Pedidos ({filteredPendingOrders.length})</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select aria-label="Filtrar por localidad" className="input" style={{ width: '140px', padding: '2px 6px', fontSize: '0.78rem', height: '28px' }} value={selectedCityFilter} onChange={(e) => setSelectedCityFilter(e.target.value)}>
                  <option value="ALL">Todas</option>
                  {uniqueCities.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
                {selectedCityFilter !== 'ALL' && uniqueZones.length > 0 && (
                  <select aria-label="Filtrar por zona" className="input" style={{ width: '115px', padding: '2px 6px', fontSize: '0.78rem', height: '28px' }} value={selectedZoneFilter} onChange={(e) => setSelectedZoneFilter(e.target.value)}>
                    <option value="ALL">Todas</option>
                    {uniqueZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px' }}>
              {filteredPendingOrders.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '12px', textAlign: 'center' }}>Sin pedidos disponibles.</div>
              ) : (
                filteredPendingOrders.map((o) => (
                  <label key={o.id} htmlFor={`route-order-${o.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderBottom: '1px solid #f0f0f0', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
                    <input id={`route-order-${o.id}`} type="checkbox" checked={selectedOrderIds.includes(o.id)} onChange={() => handleToggleOrder(o.id)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{o.persona?.name}</span>
                        {o.persona?.city && <span style={{ fontSize: '0.68rem', color: '#681da8', backgroundColor: '#f3e8fd', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>{o.persona.city}</span>}
                      </div>
                      <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{o.invoiceNumber || 'Remito'}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          {selectedOrderIds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span className="tabular-nums" style={{ fontSize: '0.82rem', color: 'var(--color-success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} aria-hidden="true" />
                {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'parada' : 'paradas'}
              </span>
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

      <div className="modal-footer" style={{ marginTop: '20px' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }} disabled={selectedOrderIds.length === 0}>
          Generar Hoja de Ruta
        </button>
      </div>
    </form>
  </NativeModalDialog>
);
