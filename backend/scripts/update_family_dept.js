const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Actualizando departamento a "DIRECCION" para socios/familia...');

  const familyDnis = ['35385924', 'LEG-0012', 'LEG-0013'];
  
  const updated = await prisma.employee.updateMany({
    where: {
      OR: [
        { dni: { in: familyDnis } },
        { lastName: { contains: 'Martín', mode: 'insensitive' } },
        { firstName: { contains: 'Viviana', mode: 'insensitive' } }
      ]
    },
    data: {
      department: 'DIRECCION'
    }
  });

  console.log(`✅ ${updated.count} legajos actualizados al departamento "DIRECCION".`);

  const emps = await prisma.employee.findMany({
    where: { department: 'DIRECCION' }
  });

  console.log('📌 Legajos en DIRECCION:');
  emps.forEach(e => console.log(`  └─ ${e.lastName}, ${e.firstName} (${e.position})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
