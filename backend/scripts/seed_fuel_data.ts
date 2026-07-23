import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Poblando datos de combustible para la flota...');

  const vehicles = await prisma.vehicle.findMany({
    where: { status: { in: ['ACTIVE', 'MAINTENANCE'] } }
  });

  if (vehicles.length === 0) {
    console.log('No hay vehículos activos para poblar cargas.');
    return;
  }

  // Borrar cargas previas de prueba si existen
  await prisma.fuelLog.deleteMany({});

  const sampleFuelLogs = [
    // Mercedes Benz Accelo 1016 (AB 919 WO)
    { plate: 'AB 919 WO', odoStart: 3200, cargas: [
      { kmOffset: 0, liters: 75.5, cost: 83050, date: new Date('2026-07-01T08:30:00Z'), notes: 'YPF Boxes - Carga inicial mes' },
      { kmOffset: 410, liters: 78.2, cost: 86020, date: new Date('2026-07-08T09:15:00Z'), notes: 'Shell Axion - Reparto Zona Sur' },
      { kmOffset: 840, liters: 81.0, cost: 89100, date: new Date('2026-07-16T10:00:00Z'), notes: 'YPF Acceso Norte' },
      { kmOffset: 1290, liters: 84.5, cost: 92950, date: new Date('2026-07-22T08:45:00Z'), notes: 'Axion Energy - Reparto Colectores' }
    ]},
    // Mercedes Benz Accelo 815 (AE 178 EC)
    { plate: 'AE 178 EC', odoStart: 13500, cargas: [
      { kmOffset: 0, liters: 65.0, cost: 71500, date: new Date('2026-07-02T07:45:00Z'), notes: 'YPF Central' },
      { kmOffset: 380, liters: 62.4, cost: 68640, date: new Date('2026-07-09T08:20:00Z'), notes: 'Shell Centro' },
      { kmOffset: 770, liters: 64.8, cost: 71280, date: new Date('2026-07-17T09:10:00Z'), notes: 'Puma Energy' },
      { kmOffset: 1150, liters: 63.5, cost: 69850, date: new Date('2026-07-23T07:30:00Z'), notes: 'YPF Boxes - Tanque Lleno' }
    ]},
    // KYC Mamut (AI 148 CP)
    { plate: 'AI 148 CP', odoStart: 54000, cargas: [
      { kmOffset: 0, liters: 45.0, cost: 49500, date: new Date('2026-07-03T09:00:00Z'), notes: 'Axion San Martín' },
      { kmOffset: 320, liters: 44.2, cost: 48620, date: new Date('2026-07-11T10:30:00Z'), notes: 'YPF Bicentenario' },
      { kmOffset: 650, liters: 46.1, cost: 50710, date: new Date('2026-07-19T08:15:00Z'), notes: 'Shell Directa' }
    ]},
    // Audi A1 (OTF 197)
    { plate: 'OTF 197', odoStart: 121500, cargas: [
      { kmOffset: 0, liters: 40.0, cost: 48000, date: new Date('2026-07-05T14:00:00Z'), notes: 'V-Power Nitro Shell' },
      { kmOffset: 520, liters: 39.5, cost: 47400, date: new Date('2026-07-15T16:30:00Z'), notes: 'Infinia YPF - Uso Supervisión' }
    ]}
  ];

  for (const sample of sampleFuelLogs) {
    const veh = vehicles.find(v => v.plate.toUpperCase().trim() === sample.plate.toUpperCase().trim());
    if (!veh) continue;

    let currentOdo = sample.odoStart;

    for (const item of sample.cargas) {
      currentOdo += item.kmOffset;
      const pricePerLiter = Number((item.cost / item.liters).toFixed(2));

      await prisma.fuelLog.create({
        data: {
          vehicleId: veh.id,
          date: item.date,
          odometer: currentOdo,
          liters: item.liters,
          totalCost: item.cost,
          pricePerLiter,
          isFullTank: true,
          notes: item.notes
        }
      });
    }

    // Actualizar odómetro final en el vehículo
    await prisma.vehicle.update({
      where: { id: veh.id },
      data: { currentOdometer: currentOdo }
    });
  }

  console.log('✅ Se han poblado los datos reales de cargas de combustible exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
