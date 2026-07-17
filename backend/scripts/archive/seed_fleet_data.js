const { PrismaClient, VehicleStatus, MaintenanceType, ExpiryType } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga de datos de flota...');

  // 1. Limpiar datos viejos de flota para evitar duplicados en pruebas
  await prisma.vehicleExpiry.deleteMany({});
  await prisma.vehicleMaintenance.deleteMany({});
  await prisma.vehicle.deleteMany({});
  console.log('🧹 Limpieza de tablas de flota completada.');

  // 2. Crear Vehículos (incluyendo el virtual "DEP-GRAL" para vencimientos de depósito/choferes)
  const vData = [
    { plate: 'AB 919 WO', brand: 'MERCEDES BENZ', model: 'ACCELO 1016', year: 2017, currentOdometer: 3656, status: 'ACTIVE' },
    { plate: 'AE 178 EC', brand: 'MERCEDES BENZ', model: 'ACCELO 815', year: 2020, currentOdometer: 15069, status: 'ACTIVE' },
    { plate: 'FUL 385', brand: 'MERCEDES BENZ', model: '710', year: 2006, currentOdometer: 0, status: 'ACTIVE' },
    { plate: 'AI 148 CP', brand: 'KYC', model: 'MAMUT', year: 2026, currentOdometer: 55800, status: 'ACTIVE' },
    { plate: 'AG 422 GS', brand: 'PEUGEOT', model: 'PARTNER BLANCA', year: 2024, currentOdometer: 5399, status: 'ACTIVE' },
    { plate: 'AE 764 FE', brand: 'PEUGEOT', model: 'PARTNER', year: 2021, currentOdometer: 27614, status: 'ACTIVE' },
    { plate: 'AF 747 KX', brand: 'VOLKSWAGEN', model: 'AMAROK 3.0', year: 2023, currentOdometer: 60000, status: 'ACTIVE' },
    { plate: 'AD 032 KX', brand: 'VOLKSWAGEN', model: 'AMAROK 2.0', year: 2018, currentOdometer: 122800, status: 'ACTIVE' },
    { plate: 'OTF 197', brand: 'AUDI', model: 'A1 1.4 T SPORTBACK', year: 2015, currentOdometer: 122500, status: 'ACTIVE' },
    { plate: 'ELEV-VERDE', brand: 'AUTOELEVADOR', model: 'VERDE ELECTRICO', year: 2026, currentOdometer: 0, status: 'ACTIVE' },
    { plate: 'ELEV-ROSA', brand: 'AUTOELEVADOR', model: 'ROSA', year: 2020, currentOdometer: 0, status: 'ACTIVE' },
    { plate: 'DEP-GRAL', brand: 'ADMINISTRACION', model: 'DEPOSITO Y CHOFERES', year: 2026, currentOdometer: 0, status: 'ACTIVE', notes: 'Unidad virtual para vencimientos generales' }
  ];

  const vehicles = {};
  for (const item of vData) {
    const v = await prisma.vehicle.create({ data: item });
    vehicles[item.plate] = v;
  }
  console.log(`🚗 Creados ${Object.keys(vehicles).length} registros de vehículos.`);

  // 3. Crear Vencimientos
  const eData = [
    // Carnets de Choferes (Asociados al Vehículo virtual DEP-GRAL)
    { plate: 'DEP-GRAL', type: 'CARNET', description: 'Carnet Chofer: FABIAN MAYA', expirationDate: '2028-06-09T00:00:00Z' },
    { plate: 'DEP-GRAL', type: 'CARNET', description: 'Carnet Chofer: NORBERTO RAMOS', expirationDate: '2027-11-03T00:00:00Z' },
    { plate: 'DEP-GRAL', type: 'CARNET', description: 'Carnet Chofer: PABLO MARTIN', expirationDate: '2029-01-15T00:00:00Z' },
    { plate: 'DEP-GRAL', type: 'CARNET', description: 'Carnet Chofer: ESTEBAN MARTIN', expirationDate: '2027-07-08T00:00:00Z' },
    { plate: 'DEP-GRAL', type: 'CARNET', description: 'Carnet Chofer: VIVIANA MARTIN', expirationDate: '2028-03-22T00:00:00Z' },
    { plate: 'DEP-GRAL', type: 'CARNET', description: 'Carnet Chofer: AGUSTIN MONTIEL', expirationDate: '2028-01-20T00:00:00Z' },

    // SENASA (Vehicular)
    { plate: 'AB 919 WO', type: 'OTHER', description: 'Habilitación SENASA (Mercedes Accelo 1016)', expirationDate: '2027-06-03T00:00:00Z' },
    { plate: 'AE 178 EC', type: 'OTHER', description: 'Habilitación SENASA (Mercedes Accelo 815)', expirationDate: '2027-06-03T00:00:00Z' },
    { plate: 'FUL 385', type: 'OTHER', description: 'Habilitación SENASA (Mercedes 710)', expirationDate: '2027-06-03T00:00:00Z' },

    // BROMATOLOGÍA (Vehicular)
    { plate: 'AB 919 WO', type: 'OTHER', description: 'Bromatología Vehicular (Mercedes Accelo 1016)', expirationDate: '2027-02-17T00:00:00Z' },
    { plate: 'AE 178 EC', type: 'OTHER', description: 'Bromatología Vehicular (Mercedes Accelo 815)', expirationDate: '2027-02-17T00:00:00Z' },
    { plate: 'FUL 385', type: 'OTHER', description: 'Bromatología Vehicular (Mercedes 710)', expirationDate: '2027-02-17T00:00:00Z' },

    // MATAFUEGOS
    { plate: 'DEP-GRAL', type: 'OTHER', description: 'Vencimiento Matafuegos Depósito', expirationDate: '2026-11-30T00:00:00Z' },
    { plate: 'AE 178 EC', type: 'OTHER', description: 'Matafuegos Vehículo (Mercedes Accelo 815)', expirationDate: '2026-11-29T00:00:00Z' },
    { plate: 'FUL 385', type: 'OTHER', description: 'Matafuegos Vehículo (Mercedes 710)', expirationDate: '2026-11-29T00:00:00Z' },
    { plate: 'AB 919 WO', type: 'OTHER', description: 'Matafuegos Vehículo (Mercedes Accelo 1016)', expirationDate: '2026-11-29T00:00:00Z' },

    // REBA
    { plate: 'DEP-GRAL', type: 'OTHER', description: 'Habilitación REBA (Bebidas y Alimentos)', expirationDate: '2026-07-29T00:00:00Z' },

    // OFERTAS FLOW (Telefonía e Internet de depósito y sucursales)
    { plate: 'DEP-GRAL', type: 'OTHER', description: 'Oferta Flow Depósito', expirationDate: '2026-05-02T00:00:00Z' },
    { plate: 'DEP-GRAL', type: 'OTHER', description: 'Oferta Flow Robledo', expirationDate: '2026-05-02T00:00:00Z' },
    { plate: 'DEP-GRAL', type: 'OTHER', description: 'Oferta Flow Gallo', expirationDate: '2026-05-02T00:00:00Z' },
    { plate: 'DEP-GRAL', type: 'OTHER', description: 'Oferta Flow Esteban', expirationDate: '2026-05-02T00:00:00Z' },

    // CLARO
    { plate: 'DEP-GRAL', type: 'OTHER', description: 'Vencimiento Contrato Claro Telefonía', expirationDate: '2027-02-26T00:00:00Z' }
  ];

  for (const item of eData) {
    const vehicle = vehicles[item.plate];
    if (vehicle) {
      await prisma.vehicleExpiry.create({
        data: {
          vehicleId: vehicle.id,
          type: item.type,
          description: item.description,
          expirationDate: new Date(item.expirationDate)
        }
      });
    }
  }
  console.log(`📅 Cargados ${eData.length} vencimientos.`);

  // 4. Crear Historial de Mantenimientos
  const mData = [
    { plate: 'AF 747 KX', type: 'OTHER', description: 'Diagnóstico general de Amarok (Responsable: Jona / Taller: Jorge Guerrera)', cost: 0, odometer: 60000, date: '2025-06-11T00:00:00Z' },
    { plate: 'OTF 197', type: 'SERVICE', description: 'Service General - Pinky + filtros + aceites (Responsable: Esteban)', cost: 500000, odometer: 110570, date: '2025-07-14T00:00:00Z' },
    { plate: 'OTF 197', type: 'SERVICE', description: 'Revisión técnica de service general (Responsable: Jona / Taller: Jorge Guerrera)', cost: 0, odometer: 110570, date: '2025-08-15T00:00:00Z' },
    { plate: 'FUL 385', type: 'OTHER', description: 'Ajuste general (Responsable: Esteban / Taller: Juan Lopez)', cost: 0, odometer: 0, date: '2026-02-03T00:00:00Z' },
    { plate: 'AD 032 KX', type: 'REPAIR', description: 'Inyectores nuevos y filtros con Pinky (Responsable: Esteban)', cost: 6100000, odometer: 60000, date: '2026-02-04T00:00:00Z' },
    { plate: 'OTF 197', type: 'REPAIR', description: 'Trabajo sacabollos - Pago seguro (Responsable: Esteban)', cost: 950000, odometer: 122500, date: '2026-02-05T00:00:00Z' },
    { plate: 'ELEV-VERDE', type: 'OTHER', description: 'Ingreso Nuevo Elevador Eléctrico ($ en USD final, Responsable: Esteban)', cost: 22100, odometer: 0, date: '2026-02-07T00:00:00Z' },
    { plate: 'OTF 197', type: 'REPAIR', description: 'Cambio de 2 cubiertas nuevas con Gustavo Albiero (Responsable: Esteban)', cost: 0, odometer: 122000, date: '2026-02-10T00:00:00Z' },
    { plate: 'AB 919 WO', type: 'REPAIR', description: 'Reparación de vidrio interno izquierdo y óptica (Responsable: Esteban)', cost: 45764, odometer: 3656, date: '2026-02-18T00:00:00Z' },
    { plate: 'ELEV-ROSA', type: 'SERVICE', description: 'Service general de 6 meses - Agua (Responsable: Fabian)', cost: 0, odometer: 0, date: '2026-02-21T00:00:00Z' },
    { plate: 'FUL 385', type: 'REPAIR', description: 'Cambio elásticos delanteros y traseros con Juan Lopez (Responsable: Esteban)', cost: 2300000, odometer: 0, date: '2026-02-21T00:00:00Z' },
    { plate: 'AI 148 CP', type: 'OTHER', description: 'Se vende y se compra camión chino (Responsable: Fabian)', cost: 0, odometer: 55800, date: '2026-02-27T00:00:00Z' },
    { plate: 'AE 764 FE', type: 'SERVICE', description: 'Service General - Aceite y 4 filtros + mano obra Jorge Guerrera (Responsable: Esteban)', cost: 290000, odometer: 27614, date: '2026-03-04T00:00:00Z' },
    { plate: 'FUL 385', type: 'REPAIR', description: 'Compra de 2 cubiertas delanteras y balanceo (Responsable: Esteban)', cost: 687000, odometer: 0, date: '2026-03-09T00:00:00Z' }
  ];

  for (const item of mData) {
    const vehicle = vehicles[item.plate];
    if (vehicle) {
      await prisma.vehicleMaintenance.create({
        data: {
          vehicleId: vehicle.id,
          type: item.type,
          description: item.description,
          cost: item.cost,
          odometer: item.odometer,
          date: new Date(item.date)
        }
      });
    }
  }
  console.log(`🔧 Cargados ${mData.length} registros del historial de mantenimiento.`);

  console.log('✅ Semilla de datos de flota cargada con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando la semilla:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
