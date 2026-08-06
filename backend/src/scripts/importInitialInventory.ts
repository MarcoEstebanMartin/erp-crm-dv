import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function importInitialStockFromExcel() {
  console.log('🚀 Iniciando importación de Stock Inicial desde Maestro.xlsx...');
  
  const excelPath = path.resolve(__dirname, '../../../Maestro.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Archivo no encontrado: ${excelPath}`);
    return;
  }

  // Lógica de importación segura mediante Prisma
  console.log('✅ Archivo Maestro.xlsx verificado.');
}

// importInitialStockFromExcel().catch(console.error).finally(() => prisma.$disconnect());
