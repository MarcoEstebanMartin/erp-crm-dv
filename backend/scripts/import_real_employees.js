const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando reemplazo de empleados de prueba por los reales desde Empleados.xlsx...');

  // 1. Limpiar dependencias asociadas a empleados (adelantos, liquidaciones, vacaciones, documentos)
  console.log('🧹 Limpiando registros de prueba previos de RRHH...');
  await prisma.salaryAdvance.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.employeeVacation.deleteMany({});
  await prisma.employeeDocument.deleteMany({});
  await prisma.employee.deleteMany({});

  console.log('✅ Base de datos de empleados limpia.');

  // Obtener lista de usuarios para vincular por username
  const users = await prisma.user.findMany();
  const userMap = {};
  users.forEach(u => {
    userMap[u.username.toLowerCase()] = u.id;
  });

  const realEmployees = [
    {
      firstName: 'Diego',
      lastName: 'Lejarza',
      dni: '26106000',
      cuil: '20-26106000-1',
      position: 'Vendedor Preventista',
      department: 'VENTAS',
      hireDate: new Date('2020-01-01'),
      baseSalary: 1000000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Mercado Pago',
      cbuAlias: '0000003100023998694574',
      notes: 'Sueldo Recibo: $1.000.000 | Extra al recibo: $2.000.000 | Total: $3.000.000',
      username: 'diego'
    },
    {
      firstName: 'Fabián',
      lastName: 'Maya',
      dni: '24044029',
      cuil: '20-24044029-0',
      position: 'Vendedor Preventista',
      department: 'VENTAS',
      hireDate: new Date('1999-07-01'),
      baseSalary: 800000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Banco Provincia',
      cbuAlias: '0140355603665704217313',
      notes: 'Sueldo Recibo: $800.000 | Extra al recibo: $800.000 | Total: $1.600.000',
      username: 'fabian'
    },
    {
      firstName: 'Darío',
      lastName: 'Torri',
      dni: '39291563',
      cuil: '20-39291563-0',
      position: 'Administrativo',
      department: 'ADMINISTRACION',
      hireDate: new Date('2021-01-01'),
      baseSalary: 700000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Mercado Pago',
      cbuAlias: '0000003100066586071689',
      notes: 'Sueldo Recibo: $700.000 | Extra al recibo: $700.000 | Total: $1.400.000',
      username: 'dario'
    },
    {
      firstName: 'Agustín',
      lastName: 'Montiel',
      dni: '44839749',
      cuil: '20-44839749-2',
      position: 'Administrativo',
      department: 'ADMINISTRACION',
      hireDate: new Date('2022-01-01'),
      baseSalary: 600000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Mercado Pago',
      cbuAlias: '0000003100080206162823',
      notes: 'Sueldo Recibo: $600.000 | Extra al recibo: $400.000 | Total: $1.000.000',
      username: 'agustin'
    },
    {
      firstName: 'Matías Ignacio',
      lastName: 'Rodríguez',
      dni: '47159975',
      cuil: '20-47159975-2',
      position: 'Chofer / Repartidor',
      department: 'LOGISTICA',
      hireDate: new Date('2023-01-01'),
      baseSalary: 500000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Banco Provincia',
      cbuAlias: '0140355603665753116081',
      notes: 'Depósito y Reparto. Sueldo Recibo: $500.000 | Extra al recibo: $500.000 | Total: $1.000.000',
      username: 'matias'
    },
    {
      firstName: 'Tiago Iván',
      lastName: 'Balmaceda',
      dni: '46411508',
      cuil: '20-46411508-1',
      position: 'Operario Depósito / Armado',
      department: 'DEPOSITO',
      hireDate: new Date('2026-06-01'),
      baseSalary: 500000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Mercado Pago',
      cbuAlias: '0000003100036178817841',
      notes: 'Depósito y Reparto. Sueldo Recibo: $500.000 | Extra al recibo: $500.000 | Total: $1.000.000',
      username: 'thiago'
    },
    {
      firstName: 'Rocío Anahí',
      lastName: 'Aliendro',
      dni: '42417866',
      cuil: '27-42417866-2',
      position: 'Operario Depósito / Mantenimiento',
      department: 'DEPOSITO',
      hireDate: new Date('2023-06-01'),
      baseSalary: 300000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Banco Provincia',
      cbuAlias: '0140355603665752311838',
      notes: 'Limpieza y Depósito. Sueldo Recibo: $300.000 | Extra al recibo: $300.000 | Total: $600.000',
      username: 'rocio'
    },
    {
      firstName: 'Miguel',
      lastName: 'Alberca',
      dni: '28665535',
      cuil: '20-28665535-2',
      position: 'Chofer / Repartidor',
      department: 'LOGISTICA',
      hireDate: new Date('2022-06-01'),
      baseSalary: 700000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Banco Provincia',
      cbuAlias: '0140355603665752667344',
      notes: 'Depósito y Reparto. Sueldo Recibo: $700.000 | Extra al recibo: $700.000 | Total: $1.400.000',
      username: 'miguel'
    },
    {
      firstName: 'Norberto',
      lastName: 'Ramos',
      dni: 'LEG-0009',
      cuil: null,
      position: 'Vendedor Preventista / Reparto',
      department: 'VENTAS',
      hireDate: new Date('2020-06-01'),
      baseSalary: 2000000,
      paymentMethod: 'CASH',
      bankName: null,
      cbuAlias: null,
      notes: 'Vendedor y Reparto. Sueldo Recibo: $2.000.000 | Extra al recibo: $3.000.000 | Total: $5.000.000',
      username: 'norberto'
    },
    {
      firstName: 'María José',
      lastName: 'Videla',
      dni: 'LEG-0010',
      cuil: null,
      position: 'Vendedor Preventista',
      department: 'VENTAS',
      hireDate: new Date('2024-02-01'),
      baseSalary: 600000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Mercado Pago',
      cbuAlias: null,
      notes: 'Extra al recibo: $600.000',
      username: 'maria_jose'
    },
    {
      firstName: 'Marco Esteban',
      lastName: 'Martín',
      dni: '35385924',
      cuil: '20-35385924-3',
      position: 'Administrativo / Gestión',
      department: 'ADMINISTRACION',
      hireDate: new Date('2021-10-01'),
      baseSalary: 2000000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Mercado Pago',
      cbuAlias: 'marco.estebanmartin',
      notes: 'Administración y Gestión. Sueldo Recibo: $2.000.000 | Extra al recibo: $3.000.000 | Total: $5.000.000',
      username: 'esteban'
    },
    {
      firstName: 'Jonathan David',
      lastName: 'Martín',
      dni: 'LEG-0012',
      cuil: null,
      position: 'Chofer / Repartidor',
      department: 'LOGISTICA',
      hireDate: new Date('2021-01-01'),
      baseSalary: 3500000,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Mercado Pago',
      cbuAlias: null,
      notes: 'Logística y Gestión. Extra al recibo: $3.500.000',
      username: null
    },
    {
      firstName: 'Viviana Ruth',
      lastName: 'Sosa',
      dni: 'LEG-0013',
      cuil: null,
      position: 'Administrativo / Logística',
      department: 'LOGISTICA',
      hireDate: new Date('2022-01-01'),
      baseSalary: 0,
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Mercado Pago',
      cbuAlias: null,
      notes: 'Logística y Gestión. Pendiente de completar datos salariales.',
      username: null
    }
  ];

  console.log(`📋 Insertando ${realEmployees.length} empleados reales...`);

  for (const empData of realEmployees) {
    const userId = empData.username ? userMap[empData.username.toLowerCase()] || null : null;
    
    await prisma.employee.create({
      data: {
        firstName: empData.firstName,
        lastName: empData.lastName,
        dni: empData.dni,
        cuil: empData.cuil,
        position: empData.position,
        department: empData.department,
        hireDate: empData.hireDate,
        baseSalary: empData.baseSalary,
        paymentMethod: empData.paymentMethod,
        bankName: empData.bankName,
        cbuAlias: empData.cbuAlias,
        notes: empData.notes,
        userId: userId
      }
    });
    console.log(`  └─ Legajo creado: ${empData.lastName}, ${empData.firstName} (${empData.position}) ${userId ? `[Usuario ID: ${userId}]` : ''}`);
  }

  console.log('🎉 Reemplazo de legajos completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error importando empleados reales:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
