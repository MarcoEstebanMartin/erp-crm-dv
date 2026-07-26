import { PrismaClient } from '@prisma/client';
import openpyxl from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function normalizeName(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // reemplazar puntuación por espacios
    .replace(/\s+/g, ' ')     // colapsar espacios múltiples
    .strip?.() || str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stringSimilarity(s1: string, s2: string): number {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString());
}

function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

async function runImport() {
  console.log('🚀 Iniciando proceso de importación de códigos de barras desde Excel...');

  const excelPath = path.resolve(__dirname, '../../codigos-barra.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ No se encontró el archivo Excel en: ${excelPath}`);
    process.exit(1);
  }

  // Ejecutar script de python para extraer datos del excel limpiamente a JSON
  const pyCode = `
import openpyxl, json
wb = openpyxl.load_workbook(r'${excelPath}')
sheet = wb.active
rows = []
for r in list(sheet.iter_rows(values_only=True))[1:]:
    if r[0] and r[1] is not None:
        rows.append({'name': str(r[0]).strip(), 'code': str(r[1]).strip()})
print(json.dumps(rows))
`;

  const rawJson = openpyxl.execSync(`python -c "${pyCode.replace(/\n/g, ' ')}"`).toString();
  const excelData: Array<{ name: string; code: string }> = JSON.parse(rawJson);

  console.log(`📑 Filas leídas del Excel: ${excelData.length}`);

  // Cargar todos los productos de la base de datos
  const dbProducts = await prisma.product.findMany();
  console.log(`📦 Productos cargados de la base de datos: ${dbProducts.length}`);

  // Mapa de productos de la base de datos por nombre normalizado
  const dbMap = new Map<string, typeof dbProducts[0]>();
  dbProducts.forEach(p => {
    dbMap.set(normalizeName(p.name), p);
  });

  let updatedCount = 0;
  let exactMatchCount = 0;
  let fuzzyMatchCount = 0;
  let skippedNoBarcode = 0;
  let unmatchedCount = 0;

  const logs: string[] = [];

  for (const item of excelData) {
    const rawName = item.name;
    const rawCode = item.code;

    // Extraer partes separadas por coma
    const parts = rawCode.split(',').map(p => p.trim()).filter(Boolean);

    // Filtrar códigos de más de 4 dígitos (códigos de barras reales)
    const longCodes = parts.filter(p => p.length > 4 && /^\d+$/.test(p));

    // Si hay código que empiece con 779 y tenga 13/14 dígitos, priorizarlo
    const ean13Codes = longCodes.filter(p => p.startsWith('779') && (p.length === 13 || p.length === 14));
    const chosenBarcode = ean13Codes.length > 0 ? ean13Codes[0] : (longCodes.length > 0 ? longCodes[0] : null);

    if (!chosenBarcode) {
      skippedNoBarcode++;
      continue; // Solo tenía código corto o no tenía código largo
    }

    const norm = normalizeName(rawName);
    let targetProduct = dbMap.get(norm);
    let matchType = 'EXACTA';

    // Si no coincide exacto, intentar coincidencia por similitud (Fuzzy >= 0.85)
    if (!targetProduct) {
      let maxSim = 0;
      let bestMatch: typeof dbProducts[0] | null = null;

      for (const p of dbProducts) {
        const sim = stringSimilarity(norm, normalizeName(p.name));
        if (sim > maxSim) {
          maxSim = sim;
          bestMatch = p;
        }
      }

      if (maxSim >= 0.85 && bestMatch) {
        targetProduct = bestMatch;
        matchType = `FUZZY (${(maxSim * 100).toFixed(1)}%)`;
        fuzzyMatchCount++;
      }
    } else {
      exactMatchCount++;
    }

    if (targetProduct) {
      // Actualizar en Prisma
      await prisma.product.update({
        where: { id: targetProduct.id },
        data: { barcode: chosenBarcode },
      });

      updatedCount++;
      const logLine = `[ACTUALIZADO] ID: ${targetProduct.id} | SKU: ${targetProduct.sku} | Nombre: "${targetProduct.name}" | Código Barras: ${chosenBarcode} | Match: ${matchType}`;
      console.log(logLine);
      logs.push(logLine);
    } else {
      unmatchedCount++;
      console.log(`[NO ENCONTRADO EN ERP] Excel: "${rawName}" | Código largo: ${chosenBarcode}`);
    }
  }

  console.log('\n==================================================');
  console.log('🎉 RESUMEN FINAL DE IMPORTACIÓN');
  console.log('==================================================');
  console.log(`✅ Productos actualizados exitosamente: ${updatedCount}`);
  console.log(`   - Coincidencias exactas: ${exactMatchCount}`);
  console.log(`   - Coincidencias aproximadas (Fuzzy >= 85%): ${fuzzyMatchCount}`);
  console.log(`⏩ Ignorados (Solo código corto de 4 dígitos): ${skippedNoBarcode}`);
  console.log(`⚠️ Sin coincidencia en base de datos: ${unmatchedCount}`);
  console.log('==================================================\n');

  // Guardar log de auditoría en archivo
  const logFilePath = path.resolve(__dirname, '../../backups_auditoria/importacion_barcodes_log.txt');
  fs.writeFileSync(logFilePath, logs.join('\n'), 'utf-8');
  console.log(`📜 Registro detallado de cambios guardado en: ${logFilePath}`);
}

runImport()
  .catch(err => {
    console.error('❌ Error durante la importación:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
