const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySequences() {
  console.log('🔍 Verificando integridad de secuencias nativas de PostgreSQL...');
  try {
    const result = await prisma.$queryRaw`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_name = 'movement_seq';
    `;

    if (Array.isArray(result) && result.length > 0) {
      console.log('✅ Secuencia nativa "movement_seq" verificada OK.');
    } else {
      console.warn('⚠️ ATENCIÓN: Secuencia "movement_seq" no encontrada. Recreándola...');
      await prisma.$executeRaw`CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1 INCREMENT BY 1;`;
      console.log('✅ Secuencia "movement_seq" creada exitosamente.');
    }
  } catch (error) {
    console.error('❌ Error verificando secuencias en base de datos:', error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySequences();
