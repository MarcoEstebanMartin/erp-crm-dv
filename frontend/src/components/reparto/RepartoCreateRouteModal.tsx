import React from 'react';
import { MapPin, CheckCircle, X } from 'lucide-react';
import { RouteMap } from './LeafletRouteMap';

interface RepartoCreateRouteModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
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
}

export const RepartoCreateRouteModal: React.FC<RepartoCreateRouteModalProps> = ({
  show,
  onClose,
  onSubmit,
  driverName,
  setDriverName,
  companionName,
  setCompanionName,
  vehiclePlate,
  setVehiclePlate,
  vehicleDescription,
  setVehicleDescription,
  selectedVehicleKey,
  setSelectedVehicleKey,
  loadedDrivers,
  loadedVehicles,
  selectedCityFilter,
  setSelectedCityFilter,
  selectedZoneFilter,
  setSelectedZoneFilter,
  uniqueCities,
  uniqueZones,
  filteredPendingOrders,
  selectedOrderIds,
  handleToggleOrder,
  currentTspRoute,
  createRouteStreetPoints,
  mapPoints,
  handleUpdateClientCoords
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '1200px', width: '94vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3>Crear Hoja de Ruta & Optimizar Recorrido</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>Nombre del Chofer</label>
                <select className="input" value={driverName} onChange={(e) => setDriverName(e.target.value)} required>
                  <option value="">-- Seleccionar Chofer --</option>
                  {loadedDrivers.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Acompañante</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(Opcional)</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Juan Pérez"
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Vehículo de Reparto</label>
                <select
                  className="input"
                  value={selectedVehicleKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedVehicleKey(val);
                    if (val === 'CUSTOM') {
                      setVehiclePlate('');
                      setVehicleDescription('');
                    } else if (val) {
                      const found = loadedVehicles.find(v => v.plate === val);
                      if (found) {
                        setVehiclePlate(found.plate);
                        setVehicleDescription(found.description);
                      }
                    } else {
                      setVehiclePlate('');
                      setVehicleDescription('');
                    }
                  }}
                  required
                >
                  <option value="">-- Seleccionar Vehículo --</option>
                  {loadedVehicles.map((v) => (
                    <option key={v.plate} value={v.plate}>{v.description} ({v.plate})</option>
                  ))}
                  <option value="CUSTOM">Otro (Ingreso manual...)</option>
                </select>
              </div>
              {selectedVehicleKey === 'CUSTOM' && (
                <>
                  <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                    <label>Patente del Vehículo</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="ej: AF-123-ZZ"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                    <label>Descripción Vehículo</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="ej: Sprinter Roja"
                      value={vehicleDescription}
                      onChange={(e) => setVehicleDescription(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Pedidos Disponibles ({filteredPendingOrders.length})
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      className="input"
                      style={{ width: '150px', padding: '2px 6px', fontSize: '0.78rem', height: '28px' }}
                      value={selectedCityFilter}
                      onChange={(e) => setSelectedCityFilter(e.target.value)}
                    >
                      <option value="ALL">Todas las localidades</option>
                      {uniqueCities.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                    {selectedCityFilter !== 'ALL' && uniqueZones.length > 0 && (
                      <select
                        className="input"
                        style={{ width: '120px', padding: '2px 6px', fontSize: '0.78rem', height: '28px' }}
                        value={selectedZoneFilter}
                        onChange={(e) => setSelectedZoneFilter(e.target.value)}
                      >
                        <option value="ALL">Todas las zonas</option>
                        {uniqueZones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px' }}>
                  {filteredPendingOrders.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '10px', textAlign: 'center' }}>
                      No hay pedidos disponibles para la localidad seleccionada.
                    </div>
                  ) : (
                    filteredPendingOrders.map(o => (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderBottom: '1px solid #f0f0f0', fontSize: '0.8rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(o.id)}
                          onChange={() => handleToggleOrder(o.id)}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{o.persona?.name}</span>
                            {o.persona?.city && (
                              <span style={{ fontSize: '0.68rem', color: '#681da8', backgroundColor: '#f3e8fd', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                {o.persona?.city}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Comprobante: {o.invoiceNumber || 'Remito de Carga'}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div>
              {selectedOrderIds.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={14} />
                      Ruta calculada con {selectedOrderIds.length} paradas
                    </span>
                  </div>
                  <RouteMap
                    locations={currentTspRoute}
                    routePoints={createRouteStreetPoints.length > 0 ? createRouteStreetPoints : mapPoints}
                    onUpdateClientCoords={handleUpdateClientCoords}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '8px', backgroundColor: 'var(--bg-light, #fafafa)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div><strong>💡 Sugerencia TSP:</strong> La ruta se calcula minimizando distancias espaciales saliendo del Depósito Central.</div>
                    <div><strong>📍 Tip:</strong> Si un punto en el mapa está mal ubicado, podés arrastrar su marcador para corregir la geolocalización del cliente de forma permanente.</div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '340px', border: '1px dashed var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', backgroundColor: 'var(--bg-app)' }}>
                  <MapPin size={36} style={{ color: 'var(--text-secondary)', marginBottom: '10px' }} />
                  <h5>Vista previa del Mapa</h5>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                    Seleccione pedidos de la lista de la izquierda para trazar el mapa de recorrido óptimo en General Villegas.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
              disabled={selectedOrderIds.length === 0}
            >
              Generar Hoja de Ruta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
