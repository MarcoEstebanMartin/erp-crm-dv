import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../utils/prisma';
import { validateProductsExcel, validatePricesExcel, validateClientsExcel, ValidationReport } from '../services/excel_validator.service';

/**
 * Controller de Pre-Inspección ("Dry-Run") de planillas Excel.
 * Lee el archivo cargado y retorna el informe detallado sin modificar la base de datos.
 */
export async function previewExcel(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo Excel.' });
    }

    const domain = (req.body.domain || 'PRODUCTS').toUpperCase();
    const fileBuffer = req.file.buffer || fs.readFileSync(req.file.path);

    let report: ValidationReport;
    if (domain === 'PRICES') {
      report = await validatePricesExcel(fileBuffer);
    } else if (domain === 'CLIENTS') {
      report = await validateClientsExcel(fileBuffer);
    } else {
      report = await validateProductsExcel(fileBuffer);
    }

    return res.json({
      success: true,
      report
    });
  } catch (error: any) {
    console.error('❌ Error al procesar vista previa de Excel:', error);
    return res.status(500).json({ error: 'Error interno al analizar la planilla Excel', details: error.message });
  }
}


/**
 * Controller para la confirmación e importación transaccional (`prisma.$transaction`).
 * Ejecuta en bloque todos los cambios aprobados. Si ocurre un fallo, revierte todo.
 */
export async function commitExcel(req: Request, res: Response) {
  try {
    const { domain, rows } = req.body;
    const userId = (req as any).user?.id || 1;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No se recibieron filas válidas para importar.' });
    }

    // Filtrar solo las filas que no tienen errores bloqueantes
    const validRowsToCommit = rows.filter((r: any) => r.status !== 'ERROR' && r.action !== 'NONE');

    if (validRowsToCommit.length === 0) {
      return res.status(400).json({ error: 'Todas las filas enviadas contienen errores o no tienen cambios.' });
    }

    let createdCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      if (domain === 'PRODUCTS') {
        // 1. Asegurar existencia de rubros
        const rubroNames = [...new Set(validRowsToCommit.map((r: any) => r.data.rubro).filter(Boolean))];
        const rubroMap = new Map<string, number>();

        for (const rName of rubroNames) {
          let rubro = await tx.rubro.findFirst({
            where: { name: { equals: rName, mode: 'insensitive' } }
          });
          if (!rubro) {
            rubro = await tx.rubro.create({
              data: { name: rName, description: `Rubro ${rName}` }
            });
          }
          rubroMap.set(rName.toLowerCase(), rubro.id);
        }

        // 2. Procesar productos
        for (const row of validRowsToCommit) {
          const { sku, name, rubro, costPrice, listPrice, unitsPerBox } = row.data;
          const rubroId = rubro ? rubroMap.get(rubro.toLowerCase()) : null;

          if (row.action === 'CREATE') {
            await tx.product.create({
              data: {
                sku,
                name,
                costPrice,
                listPrice,
                unitsPerBox: unitsPerBox || 1,
                rubroId: rubroId || null,
                isActive: true
              }
            });
            createdCount++;
          } else if (row.action === 'UPDATE') {
            await tx.product.update({
              where: { sku },
              data: {
                name,
                costPrice,
                listPrice,
                unitsPerBox: unitsPerBox || 1,
                ...(rubroId ? { rubroId } : {}),
                lastPriceUpdateAt: new Date()
              }
            });
            updatedCount++;
          }
        }
      } else if (domain === 'PRICES') {
        for (const row of validRowsToCommit) {
          const { sku, costPrice, listPrice, listPriceB, listPriceC } = row.data;
          await tx.product.update({
            where: { sku },
            data: {
              costPrice,
              listPrice,
              ...(listPriceB ? { listPriceB } : {}),
              ...(listPriceC ? { listPriceC } : {}),
              lastPriceUpdateAt: new Date()
            }
          });
          updatedCount++;
        }
      } else if (domain === 'CLIENTS') {
        for (const row of validRowsToCommit) {
          const { id, name, cuit, address, city, phone, email, route } = row.data;
          if (row.action === 'CREATE') {
            await tx.persona.create({
              data: {
                name,
                cuit: cuit || null,
                address: address || null,
                city: city || null,
                phone: phone || null,
                email: email || null,
                route: route || null,
                isClient: true
              }
            });
            createdCount++;
          } else if (row.action === 'UPDATE' && id) {
            await tx.persona.update({
              where: { id },
              data: {
                name,
                ...(cuit ? { cuit } : {}),
                ...(address ? { address } : {}),
                ...(city ? { city } : {}),
                ...(phone ? { phone } : {}),
                ...(email ? { email } : {}),
                ...(route ? { route } : {})
              }
            });
            updatedCount++;
          }
        }
      }


      // 3. Registrar Log de Auditoría
      await tx.auditLog.create({
        data: {
          userId,
          action: 'EXCEL_IMPORT',
          entityType: domain,
          entityId: 0,
          newValues: {
            domain,
            totalProcessed: validRowsToCommit.length,
            createdCount,
            updatedCount
          },
          status: 'SUCCESS'
        }
      });
    });

    // Intentar auto-sincronizar / verificar imágenes maestras si la carpeta existe
    try {
      const auditScriptPath = path.join(__dirname, '../../scripts/audit_photos.js');
      if (fs.existsSync(auditScriptPath)) {
        require(auditScriptPath);
      }
    } catch (e) {
      // Ignorar fallo en sync de fotos no crítico
    }

    return res.json({
      success: true,
      message: `Importación completada con éxito. Se crearon ${createdCount} y actualizaron ${updatedCount} registros.`,
      stats: { createdCount, updatedCount }
    });
  } catch (error: any) {
    console.error('❌ Error durante la importación transaccional:', error);
    return res.status(500).json({ error: 'Error al aplicar cambios en la base de datos. Se revirtieron todas las operaciones.', details: error.message });
  }
}
