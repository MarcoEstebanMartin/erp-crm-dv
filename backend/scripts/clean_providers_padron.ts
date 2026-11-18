import 'dotenv/config';
import prisma from '../src/utils/prisma';
import { personaLedgerSubService } from '../src/services/personas/persona-ledger.service';

function formatCuitDashed(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function moveAllReferencesAndDelete(
  tx: any,
  secondaryId: number,
  primaryId: number,
): Promise<boolean> {
  const secondary = await tx.persona.findUnique({ where: { id: secondaryId } });
  if (!secondary) return false;

  const primary = await tx.persona.findUnique({ where: { id: primaryId } });
  if (!primary) {
    throw new Error(`Proveedor principal #${primaryId} no encontrado al fusionar #${secondaryId}.`);
  }

  await Promise.all([
    tx.product.updateMany({ where: { providerId: secondaryId }, data: { providerId: primaryId } }),
    tx.supplierInvoice.updateMany({ where: { personaId: secondaryId }, data: { personaId: primaryId } }),
    tx.purchaseOrder.updateMany({ where: { personaId: secondaryId }, data: { personaId: primaryId } }),
    tx.transaction.updateMany({ where: { personaId: secondaryId }, data: { personaId: primaryId } }),
    tx.vehicleMaintenance.updateMany({ where: { supplierId: secondaryId }, data: { supplierId: primaryId } }),
    tx.accountLedger.updateMany({ where: { personaId: secondaryId }, data: { personaId: primaryId } }),
    tx.taxWithholding.updateMany({ where: { personaId: secondaryId }, data: { personaId: primaryId } }),
    tx.personaNote.updateMany({ where: { personaId: secondaryId }, data: { personaId: primaryId } }),
    tx.order.updateMany({ where: { personaId: secondaryId }, data: { personaId: primaryId } }),
    tx.creditNote.updateMany({ where: { personaId: secondaryId }, data: { personaId: primaryId } }),
    tx.fieldReceipt.updateMany({ where: { personaId: secondaryId }, data: { personaId: primaryId } }),
  ]);

  const mappings = await tx.providerProductMapping.findMany({ where: { providerId: secondaryId } });
  for (const map of mappings) {
    const existsOnPrimary = await tx.providerProductMapping.findUnique({
      where: { providerId_providerCode: { providerId: primaryId, providerCode: map.providerCode } },
    });
    if (existsOnPrimary) {
      await tx.providerProductMapping.delete({ where: { id: map.id } });
    } else {
      await tx.providerProductMapping.update({ where: { id: map.id }, data: { providerId: primaryId } });
    }
  }

  await tx.persona.delete({ where: { id: secondaryId } });
  return true;
}

async function runCleanProvidersPadron() {
  const summary = {
    fleetDeduped: 0,
    azucarReassigned: 0,
    azucarCleared: 0,
    azucarDeleted: false,
    pairsMerged: 0,
    routesUnmarked: 0,
    cuitsNormalized: 0,
  };

  await prisma.$transaction(async (tx) => {
    const fleetPairs: Array<[number, number]> = [
      [10132, 10378], // Gonzalo Alvarez
      [10133, 10379], // Jorge Guerrera
      [10134, 10380], // Juan Manuel Ibarra
      [10136, 10382], // Juan Lopez
      [10137, 10383], // Ricardo Beron
      [10138, 10384], // Raul
    ];

    for (const [keepId, dropId] of fleetPairs) {
      if (await moveAllReferencesAndDelete(tx, dropId, keepId)) {
        summary.fleetDeduped += 1;
      }
      await tx.persona.updateMany({
        where: { id: keepId, OR: [{ rubro: null }, { rubro: '' }] },
        data: { rubro: 'Taller / Flota' },
      });
    }

    await tx.persona.updateMany({
      where: { id: 10381, OR: [{ rubro: null }, { rubro: '' }] },
      data: { rubro: 'Taller / Flota' },
    });

    const azucar = await tx.persona.findUnique({ where: { id: 10603 } });
    if (azucar) {
      const sancorMoved = await tx.product.updateMany({
        where: { providerId: 10603, name: { startsWith: 'SANCOR', mode: 'insensitive' } },
        data: { providerId: 9855 },
      });
      const cumanaMoved = await tx.product.updateMany({
        where: { providerId: 10603, name: { contains: 'CUMAN', mode: 'insensitive' } },
        data: { providerId: 10582 },
      });
      const baggioMoved = await tx.product.updateMany({
        where: { providerId: 10603, sku: '0796' },
        data: { providerId: 9569 },
      });
      const remainingCleared = await tx.product.updateMany({
        where: { providerId: 10603 },
        data: { providerId: null },
      });

      summary.azucarReassigned = sancorMoved.count + cumanaMoved.count + baggioMoved.count;
      summary.azucarCleared = remainingCleared.count;

      await tx.providerProductMapping.deleteMany({ where: { providerId: 10603 } });
      await tx.personaNote.deleteMany({ where: { personaId: 10603 } });
      await tx.persona.delete({ where: { id: 10603 } });
      summary.azucarDeleted = true;
    }

    await tx.persona.updateMany({ where: { id: 10582 }, data: { rubro: 'Conservas' } });
    await tx.persona.updateMany({ where: { id: 10601 }, data: { rubro: 'Lácteos' } });

    const mergeSpecs: Array<{ keepId: number; dropId: number; update: Record<string, any> }> = [
      {
        keepId: 8717,
        dropId: 10609,
        update: {
          name: 'CREMIGAL S.R.L.',
          cuit: '30-55538699-7',
          address: 'RUTA NAC. 12 KM 278 S/N',
          city: 'GENERAL GALARZA',
          rubro: 'Lácteos',
        },
      },
      {
        keepId: 9844,
        dropId: 10610,
        update: {
          name: 'REMOTTI S.A.',
          cuit: '30-50121427-9',
          address: 'JUAN DIAZ DE SOLIS 1270 Piso:3',
          city: 'VICENTE LOPEZ',
          rubro: 'Fiambres y Quesos',
        },
      },
      {
        keepId: 9855,
        dropId: 10611,
        update: {
          name: 'SANCOR COOPERATIVAS UNIDAS LIMITADA',
          cuit: '30-50167764-3',
          address: 'TENIENTE GENERAL RICHIERI 15',
          city: 'SUNCHALES',
          rubro: 'Lácteos',
        },
      },
      {
        keepId: 8828,
        dropId: 10612,
        update: {
          name: 'SODECAR S.A.',
          cuit: '30-69442441-0',
          address: 'L DE LA TORRE 1450',
          city: 'RAFAELA',
          rubro: 'Fiambres',
        },
      },
      {
        keepId: 9569,
        dropId: 10570,
        update: {
          name: 'R.P.B. S.A.',
          cuit: '30-66313737-5',
          city: 'GUALEGUAYCHU',
          rubro: 'Bebidas y Lácteos',
        },
      },
      {
        keepId: 9611,
        dropId: 9612,
        update: {
          address: 'MITRE 689',
          city: 'GENERAL VILLEGAS',
          cuit: '20-10060289-0',
        },
      },
      {
        keepId: 9758,
        dropId: 9762,
        update: {
          address: 'SARMIENTO Y ALTE. BROWN S/N',
          city: 'GENERAL VILLEGAS',
          cuit: '23-27228372-9',
        },
      },
      {
        keepId: 10542,
        dropId: 9416,
        update: {
          name: 'LACTEOS LA FAMILIA S.R.L.',
          address: '3 DE FEBRERO S/N',
          city: 'SALLIQUELO',
          cuit: '30-62896108-1',
          rubro: 'Lácteos',
        },
      },
      {
        keepId: 10543,
        dropId: 9464,
        update: {
          address: 'ZAPIOLA 667',
          city: 'GENERAL VILLEGAS',
          cuit: '30-71796436-1',
        },
      },
      {
        keepId: 8718,
        dropId: 9645,
        update: {},
      },
      {
        keepId: 8785,
        dropId: 9321,
        update: {
          isProvider: false,
          cuit: '20-35385924-3',
        },
      },
    ];

    for (const spec of mergeSpecs) {
      if (await moveAllReferencesAndDelete(tx, spec.dropId, spec.keepId)) {
        summary.pairsMerged += 1;
      }
      if (Object.keys(spec.update).length > 0) {
        await tx.persona.updateMany({ where: { id: spec.keepId }, data: spec.update });
      }
    }

    const r1 = await tx.persona.updateMany({
      where: { id: 10545 },
      data: { isProvider: false, cuit: '27-22966748-9' },
    });
    const r2 = await tx.persona.updateMany({
      where: { id: 10831 },
      data: { isProvider: false },
    });
    summary.routesUnmarked = r1.count + r2.count;

    const remainingProviders = await tx.persona.findMany({
      where: { isProvider: true },
      select: { id: true, cuit: true },
    });
    for (const prov of remainingProviders) {
      const normalized = formatCuitDashed(prov.cuit);
      if (normalized && normalized !== prov.cuit) {
        await tx.persona.update({ where: { id: prov.id }, data: { cuit: normalized } });
        summary.cuitsNormalized += 1;
      }
    }
  }, { maxWait: 15000, timeout: 60000 });

  const finalProviders = await prisma.persona.findMany({
    where: { isProvider: true },
    select: { id: true, name: true, cuit: true, rubro: true },
    orderBy: { name: 'asc' },
  });

  const nameCounts = new Map<string, number>();
  const cuitCounts = new Map<string, number>();
  for (const p of finalProviders) {
    const nk = p.name.trim().toUpperCase();
    nameCounts.set(nk, (nameCounts.get(nk) || 0) + 1);
    const ck = (p.cuit || '').replace(/\D/g, '');
    if (ck) cuitCounts.set(ck, (cuitCounts.get(ck) || 0) + 1);
  }

  const dupNames = [...nameCounts.entries()].filter(([, c]) => c > 1);
  const dupCuits = [...cuitCounts.entries()].filter(([, c]) => c > 1);
  const balanceMismatches = await personaLedgerSubService.checkAllBalances();

  console.log('Resumen saneamiento:', summary);
  console.log('Proveedores finales:', finalProviders.length);
  console.log('Duplicados nombre:', dupNames.length, 'Duplicados CUIT:', dupCuits.length);
  console.log('Descalces AccountLedger:', balanceMismatches.length);

  if (dupNames.length > 0 || dupCuits.length > 0 || balanceMismatches.length > 0) {
    console.error({ dupNames, dupCuits, balanceMismatches });
    process.exitCode = 1;
  }
}

runCleanProvidersPadron()
  .catch((err) => {
    console.error('Error en saneamiento de proveedores:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
