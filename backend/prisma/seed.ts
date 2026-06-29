import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando la siembra de la base de datos (Seeding)...');

  // 1. Limpiar datos existentes en orden inverso de dependencias
  await prisma.auditLog.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('🧹 Limpieza de tablas completada.');

  // 2. Crear Usuarios con contraseñas encriptadas
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const vendedorPassword = await bcrypt.hash('vendedor123', salt);
  const depositoPassword = await bcrypt.hash('deposito123', salt);
  const facturacionPassword = await bcrypt.hash('facturacion123', salt);

  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const vendedor = await prisma.user.create({
    data: {
      username: 'vendedor',
      passwordHash: vendedorPassword,
      role: Role.VENDEDOR,
    },
  });

  const deposito = await prisma.user.create({
    data: {
      username: 'deposito',
      passwordHash: depositoPassword,
      role: Role.DEPOSITO,
    },
  });

  const facturacion = await prisma.user.create({
    data: {
      username: 'facturacion',
      passwordHash: facturacionPassword,
      role: Role.FACTURACION,
    },
  });

  console.log('👥 Usuarios creados:', {
    admin: admin.username,
    vendedor: vendedor.username,
    deposito: deposito.username,
    facturacion: facturacion.username,
  });

  // 3. Crear Clientes Mock
  const client1 = await prisma.client.create({
    data: {
      name: 'Almacén Don Julio',
      cuit: '20222334449',
      address: 'Av. Corrientes 1540, CABA',
      phone: '11-4567-8901',
      email: 'donjulio@gmail.com',
      sellerId: vendedor.id,
    },
  });

  const client2 = await prisma.client.create({
    data: {
      name: 'Supermercado Sol de Mayo',
      cuit: '30444555669',
      address: 'Pampa 3200, CABA',
      phone: '11-9876-5432',
      email: 'soldemayo@gmail.com',
      sellerId: vendedor.id,
    },
  });

  const client3 = await prisma.client.create({
    data: {
      name: 'Distribuidora San Telmo (Minorista)',
      cuit: '27333222119',
      address: 'Defensa 840, CABA',
      phone: '11-3322-1100',
      email: 'santelmo@gmail.com',
      sellerId: vendedor.id,
    },
  });

  console.log('🏢 Clientes mock creados.');

  // 4. Crear Productos Mock
  const products = [
    {
      sku: 'PROD-CERV-01',
      name: 'Cerveza Quilmes Clásica 1L (Retornable)',
      description: 'Cajón de cerveza Quilmes 1L. Bebida nacional.',
      costPrice: 950.00,
      listPrice: 1400.00,
      stock: 120,
      minStock: 24,
    },
    {
      sku: 'PROD-COCA-02',
      name: 'Gaseosa Coca Cola Original 1.5L',
      description: 'Pack x6 botellas de Coca Cola sabor original.',
      costPrice: 1200.00,
      listPrice: 1800.00,
      stock: 80,
      minStock: 18,
    },
    {
      sku: 'PROD-HARI-03',
      name: 'Harina de Trigo Favorita 000 1kg',
      description: 'Bulto x10 unidades de harina 000.',
      costPrice: 450.00,
      listPrice: 650.00,
      stock: 200,
      minStock: 50,
    },
    {
      sku: 'PROD-AGUA-04',
      name: 'Agua Mineral Villavicencio Sin Gas 2L',
      description: 'Pack x6 botellas de agua mineral natural.',
      costPrice: 800.00,
      listPrice: 1150.00,
      stock: 150,
      minStock: 30,
    },
    {
      sku: 'PROD-FIDE-05',
      name: 'Fideos Tallarín Lucchetti 500g',
      description: 'Bulto x20 paquetes de fideos tallarín.',
      costPrice: 380.00,
      listPrice: 550.00,
      stock: 90,
      minStock: 20,
    },
  ];

  for (const prod of products) {
    const createdProduct = await prisma.product.create({
      data: {
        sku: prod.sku,
        name: prod.name,
        description: prod.description,
        costPrice: prod.costPrice,
        listPrice: prod.listPrice,
        stock: prod.stock,
        minStock: prod.minStock,
      },
    });

    // Registrar un movimiento de stock inicial para auditoría
    await prisma.stockMovement.create({
      data: {
        productId: createdProduct.id,
        quantity: prod.stock,
        type: 'IN',
        reason: 'Carga de stock inicial (Semilla)',
        userId: admin.id,
      },
    });
  }

  console.log('📦 Productos y movimientos de stock iniciales creados.');
  console.log('✨ Proceso de siembra finalizado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la siembra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
