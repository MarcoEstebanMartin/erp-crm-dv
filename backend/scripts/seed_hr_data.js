const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedHR() {
  console.log('🌱 Poblando datos realistas de Recursos Humanos para Distribuidora DV...');

  try {
    // 1. Empleados
    const emp1 = await prisma.employee.upsert({
      where: { dni: '34125890' },
      update: {},
      create: {
        firstName: 'Carlos Alberto',
        lastName: 'Rodríguez',
        dni: '34125890',
        cuil: '20-34125890-8',
        email: 'crodriguez@distribuidoradv.com.ar',
        phone: '2337-458921',
        address: 'Calle Alberti 452, General Villegas',
        position: 'Chofer / Repartidor',
        department: 'LOGISTICA',
        hireDate: new Date('2021-03-15'),
        baseSalary: 780000.00,
        paymentMethod: 'BANK_TRANSFER',
        cbuAlias: 'carlos.rodriguez.dv.mp',
        bankName: 'Mercado Pago / Banco Nación',
        birthDate: new Date('1988-11-20'),
        emergencyContact: 'María (Esposa) - 2337-412233',
        notes: 'Chofer titular del Camión Mercedes Benz Accelo (Patente AF 123 CD). Carnet LINTI vigente.'
      }
    });

    const emp2 = await prisma.employee.upsert({
      where: { dni: '36987412' },
      update: {},
      create: {
        firstName: 'Fernando Gabriel',
        lastName: 'Gómez',
        dni: '36987412',
        cuil: '20-36987412-3',
        email: 'fgomez@distribuidoradv.com.ar',
        phone: '2337-498112',
        address: 'Av. Chassaing Norte 890, General Villegas',
        position: 'Vendedor Preventista',
        department: 'VENTAS',
        hireDate: new Date('2022-06-01'),
        baseSalary: 620000.00,
        paymentMethod: 'BANK_TRANSFER',
        cbuAlias: 'fer.gomez.preventa.galicia',
        bankName: 'Banco Galicia',
        birthDate: new Date('1992-04-12'),
        emergencyContact: 'Roberto (Padre) - 2337-400988',
        notes: 'Preventista de la ruta Villegas Centro - Bunge. Percibe 1.5% de comisión sobre cobranza efectiva.'
      }
    });

    const emp3 = await prisma.employee.upsert({
      where: { dni: '38520147' },
      update: {},
      create: {
        firstName: 'Matías Ezequiel',
        lastName: 'Peralta',
        dni: '38520147',
        cuil: '20-38520147-5',
        phone: '2337-423311',
        address: 'Calle Castelli 120, General Villegas',
        position: 'Operario Depósito / Armado',
        department: 'DEPOSITO',
        hireDate: new Date('2023-01-10'),
        baseSalary: 590000.00,
        paymentMethod: 'BANK_TRANSFER',
        cbuAlias: 'matias.peralta.mp',
        bankName: 'Mercado Pago',
        birthDate: new Date('1994-08-30'),
        emergencyContact: 'Ana (Madre) - 2337-488990',
        notes: 'Encargado del armado de pallets de fiambres y refrigerados en cámara de frío.'
      }
    });

    const emp4 = await prisma.employee.upsert({
      where: { dni: '35412789' },
      update: {},
      create: {
        firstName: 'Mariana Inés',
        lastName: 'Fernández',
        dni: '35412789',
        cuil: '27-35412789-4',
        email: 'mfernandez@distribuidoradv.com.ar',
        phone: '2337-466544',
        address: 'Calle San Martín 340, General Villegas',
        position: 'Administrativo Facturación',
        department: 'ADMINISTRACION',
        hireDate: new Date('2020-09-01'),
        baseSalary: 680000.00,
        paymentMethod: 'BANK_TRANSFER',
        cbuAlias: 'mariana.fernandez.bbva',
        bankName: 'BBVA Argentina',
        birthDate: new Date('1990-02-14'),
        notes: 'Encargada de facturación electrónica AFIP, notas de crédito y cierres de caja diaria.'
      }
    });

    const emp5 = await prisma.employee.upsert({
      where: { dni: '39852147' },
      update: {},
      create: {
        firstName: 'Lucas Daniel',
        lastName: 'Martínez',
        dni: '39852147',
        cuil: '20-39852147-9',
        phone: '2337-477123',
        address: 'Calle Moreno 678, General Villegas',
        position: 'Chofer / Repartidor',
        department: 'LOGISTICA',
        hireDate: new Date('2023-08-15'),
        baseSalary: 740000.00,
        paymentMethod: 'BANK_TRANSFER',
        cbuAlias: 'lucas.martinez.santander',
        bankName: 'Banco Santander',
        birthDate: new Date('1996-05-18'),
        notes: 'Repartidor de apoyo para rutas locales y entregas rápidas con utilitario Fiorino.'
      }
    });

    console.log('✅ 5 Empleados registrados correctamente.');

    // 2. Vales y Adelantos de Sueldo
    const existingVales = await prisma.salaryAdvance.count();
    if (existingVales === 0) {
      await prisma.salaryAdvance.create({
        data: {
          employeeId: emp1.id,
          amount: 45000.00,
          reason: 'Adelanto para compra de repuesto personal',
          paymentMethod: 'CASH',
          status: 'PENDING',
          date: new Date('2026-07-10')
        }
      });

      await prisma.salaryAdvance.create({
        data: {
          employeeId: emp2.id,
          amount: 30000.00,
          reason: 'Adelanto de gastos de preventa',
          paymentMethod: 'CASH',
          status: 'PENDING',
          date: new Date('2026-07-14')
        }
      });

      console.log('✅ Vales de prueba registrados.');
    }

    // 3. Liquidaciones de sueldo de junio (histórico)
    const existingPayrolls = await prisma.payroll.count();
    if (existingPayrolls === 0) {
      await prisma.payroll.create({
        data: {
          employeeId: emp1.id,
          periodMonth: 6,
          periodYear: 2026,
          baseSalary: 780000.00,
          overtimeAmount: 45000.00,
          grossSalary: 825000.00,
          advancesDeduction: 50000.00,
          netSalary: 775000.00,
          status: 'PAID',
          paymentDate: new Date('2026-07-02'),
          paymentMethod: 'BANK_TRANSFER',
          notes: 'Liquidación de haberes Junio 2026 abonada por Banco Nacion.'
        }
      });

      await prisma.payroll.create({
        data: {
          employeeId: emp4.id,
          periodMonth: 6,
          periodYear: 2026,
          baseSalary: 680000.00,
          bonuses: 30000.00,
          grossSalary: 710000.00,
          netSalary: 710000.00,
          status: 'PAID',
          paymentDate: new Date('2026-07-02'),
          paymentMethod: 'BANK_TRANSFER',
          notes: 'Liquidación Junio 2026.'
        }
      });

      console.log('✅ Liquidaciones del mes anterior cargadas.');
    }

    // 4. Vacaciones y Licencias
    const existingVacations = await prisma.employeeVacation.count();
    if (existingVacations === 0) {
      await prisma.employeeVacation.create({
        data: {
          employeeId: emp5.id,
          year: 2026,
          type: 'VACATION',
          startDate: new Date('2026-08-03'),
          endDate: new Date('2026-08-16'),
          daysCount: 14,
          status: 'APPROVED',
          comments: 'Primer tramo de vacaciones anuales correspondientes a 2025/2026'
        }
      });

      await prisma.employeeVacation.create({
        data: {
          employeeId: emp3.id,
          year: 2026,
          type: 'SICK_LEAVE',
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-07'),
          daysCount: 3,
          status: 'TAKEN',
          comments: 'Licencia médica por reposo con certificado adjunto'
        }
      });

      console.log('✅ Registros de vacaciones y licencias cargados.');
    }

    // 5. Documentos y Vencimientos
    const existingDocs = await prisma.employeeDocument.count();
    if (existingDocs === 0) {
      await prisma.employeeDocument.create({
        data: {
          employeeId: emp1.id,
          type: 'LINTI',
          description: 'Licencia Nacional Habilitante LINTI - Transporte de Cargas Generales',
          expirationDate: new Date('2026-11-30')
        }
      });

      await prisma.employeeDocument.create({
        data: {
          employeeId: emp3.id,
          type: 'MANIPULACION_ALIMENTOS',
          description: 'Carnet Oficial de Manipulador de Alimentos (Provincia de Buenos Aires)',
          expirationDate: new Date('2027-05-15')
        }
      });

      console.log('✅ Documentos y licencias con vencimiento cargados.');
    }

    console.log('🎉 Semilla de RRHH completada con éxito!');
  } catch (error) {
    console.error('❌ Error al poblar datos de RRHH:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedHR();
