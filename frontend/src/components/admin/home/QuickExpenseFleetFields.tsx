export type ExpenseMode = 'GENERAL' | 'RODADO';
export type FleetSubType = 'FUEL' | 'SERVICE' | 'REPAIR' | 'CLEANING' | 'INSURANCE' | 'TAX_PATENT' | 'OTHER';

export const FLEET_SUBTYPE_HINTS: Record<FleetSubType, { backendType: string; categoryKeyword: string }> = {
  FUEL: { backendType: 'FUEL', categoryKeyword: 'combustible' },
  SERVICE: { backendType: 'SERVICE', categoryKeyword: 'mantenimiento' },
  REPAIR: { backendType: 'REPAIR', categoryKeyword: 'mantenimiento' },
  CLEANING: { backendType: 'CLEANING', categoryKeyword: 'mantenimiento' },
  INSURANCE: { backendType: 'OTHER', categoryKeyword: 'seguro' },
  TAX_PATENT: { backendType: 'OTHER', categoryKeyword: 'impuesto' },
  OTHER: { backendType: 'OTHER', categoryKeyword: 'mantenimiento' },
};

export function matchCategoryId(categories: Array<{ id: number; name: string }>, keyword: string): string {
  const norm = keyword.toLowerCase();
  const found = categories.find((c) => c.name.toLowerCase().includes(norm));
  return found ? String(found.id) : '';
}

interface QuickExpenseFleetFieldsProps {
  vehicles: any[];
  suppliers: any[];
  vehicleId: string;
  fleetType: FleetSubType;
  odometer: string;
  supplierId: string;
  onVehicleChange: (vehicleId: string) => void;
  onFleetTypeChange: (fleetType: FleetSubType) => void;
  onOdometerChange: (odometer: string) => void;
  onSupplierChange: (supplierId: string) => void;
}

export function QuickExpenseFleetFields({
  vehicles,
  suppliers,
  vehicleId,
  fleetType,
  odometer,
  supplierId,
  onVehicleChange,
  onFleetTypeChange,
  onOdometerChange,
  onSupplierChange,
}: QuickExpenseFleetFieldsProps) {
  return (
    <>
      <div className="form-group">
        <label htmlFor="quick-expense-vehicle">Vehículo</label>
        <select id="quick-expense-vehicle" name="vehicleId" required className="select" value={vehicleId} onChange={(e) => onVehicleChange(e.target.value)}>
          <option value="">Seleccionar...</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model} ({v.currentOdometer} km)</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-group">
          <label htmlFor="quick-expense-fleet-type">Tipo</label>
          <select id="quick-expense-fleet-type" name="fleetType" className="select" value={fleetType} onChange={(e) => onFleetTypeChange(e.target.value as FleetSubType)}>
            <option value="FUEL">Combustible</option>
            <option value="SERVICE">Service</option>
            <option value="REPAIR">Taller</option>
            <option value="CLEANING">Lavadero</option>
            <option value="INSURANCE">Seguro</option>
            <option value="TAX_PATENT">Patente / VTV</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="quick-expense-odometer">Odómetro (km)</label>
          <input id="quick-expense-odometer" name="odometer" type="number" required className="input tabular-nums" value={odometer} onChange={(e) => onOdometerChange(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="quick-expense-supplier">Proveedor</label>
        <select id="quick-expense-supplier" name="supplierId" className="select" value={supplierId} onChange={(e) => onSupplierChange(e.target.value)}>
          <option value="">Sin proveedor</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
    </>
  );
}
