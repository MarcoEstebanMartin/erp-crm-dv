import prisma from '../../utils/prisma';
import { roundToIntegerPeso, toDecimal } from '../../core/money';

export type QuesoSubtype = 'duro' | 'semiduro' | 'semiblando' | 'blando' | 'rallado';

export function classifyQuesoSubtype(productName: string): QuesoSubtype {
  const p = productName.toUpperCase();
  if (p.includes('RALLADO') || p.includes('RALL')) return 'rallado';
  if (
    p.includes('REGG') || p.includes('SARDO') || p.includes('SBRINZ') ||
    p.includes('PEPATO') || p.includes('PROV') || p.includes('GOYA') ||
    p.includes('PARMESANO') || p.includes('ROMANO')
  ) {
    return 'duro';
  }
  if (
    p.includes('PATE') || p.includes('CHEDDAR') || p.includes('DANBO') ||
    p.includes('GOUDA') || p.includes('EDAM') || p.includes('BANQUETE')
  ) {
    return 'semiduro';
  }
  if (
    p.includes('FONT') || p.includes('TYBO') || p.includes('HOLANDO') ||
    p.includes('BARRA') || p.includes('DANIELA')
  ) {
    return 'semiblando';
  }
  return 'blando';
}

function helperMatch(name: string, terms: string[]): boolean {
  const upper = name.toUpperCase();
  return terms.some((t) => upper.includes(t.toUpperCase()));
}

export const offerRecommendationsService = {
  async getWeeklyOfferRecommendations(params: { week?: string }) {
    const week = params.week || 'auto';

    const campaigns = await prisma.offerCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    let currentWeekNumber = 1;
    if (week === '1') currentWeekNumber = 1;
    else if (week === '2') currentWeekNumber = 2;
    else {
      const last = campaigns[0];
      if (last && (last.title.includes('Semana 1') || last.title.includes('15 de Agosto'))) {
        currentWeekNumber = 2;
      }
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        rubro: true,
        lots: { where: { stock: { gt: 0 } }, orderBy: { expirationDate: 'asc' } },
        offerCampaignItems: {
          include: { campaign: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const fortyFiveDaysFromNow = new Date();
    fortyFiveDaysFromNow.setDate(fortyFiveDaysFromNow.getDate() + 45);

    const mapProduct = (
      p: any,
      group: string,
      isFixedAlways = false,
      isRotatedIn = false,
      overrideReason?: string,
      overrideTag?: string,
    ) => {
      const listPriceDec = roundToIntegerPeso(p.listPrice);
      let suggestedPriceDec = listPriceDec;
      let tag = overrideTag || null;
      let reason =
        overrideReason ||
        (isFixedAlways
          ? 'Fijo Obligatorio (Catálogo)'
          : isRotatedIn
            ? `Rotación Semana ${currentWeekNumber}`
            : 'Sugerido por Stock');

      const earliestLot = p.lots[0];
      if (
        earliestLot?.expirationDate &&
        new Date(earliestLot.expirationDate) <= fortyFiveDaysFromNow
      ) {
        const formattedExp = new Date(earliestLot.expirationDate).toLocaleDateString('es-AR');
        reason = `⚠️ Lote próximo a vencer (${formattedExp})`;
        tag = tag || '🔥 OPORTUNIDAD';
        suggestedPriceDec = roundToIntegerPeso(toDecimal(p.listPrice).times('0.9'));
      } else if (p.stock > 40) {
        tag = tag || '💥 OFERTÓN';
      }

      const minStock = p.minStock || 5;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock: p.stock,
        minStock,
        listPrice: listPriceDec.toNumber(),
        suggestedPrice: suggestedPriceDec.toNumber(),
        suggestedTag: tag,
        campaignGroup: group,
        isFixedAlways,
        isRotatedIn,
        reason,
        stockStatus: p.stock <= 0 ? 'OUT_OF_STOCK' : p.stock <= minStock ? 'LOW_STOCK' : 'OK',
      };
    };

    const resultByGroup: Record<string, any[]> = {
      MELINCUE: [],
      CREMIGAL: [],
      'R.P.B': [],
      BEBIDAS: [],
      ALMACEN: [],
      'ARTICULOS POR CANTIDAD': [],
    };

    // 1. MELINCUE
    const melincueProds = products.filter((p) => helperMatch(p.name, ['MELINCUE']));
    const pickSubtype = (sub: QuesoSubtype, sortByStock = true) => {
      const list = melincueProds.filter((p) => classifyQuesoSubtype(p.name) === sub);
      if (sortByStock) list.sort((a, b) => b.stock - a.stock);
      return list.slice(0, 2);
    };
    pickSubtype('duro').forEach((p) => resultByGroup.MELINCUE.push(mapProduct(p, 'MELINCUE', false, true, '2 Quesos Duros')));
    pickSubtype('semiduro').forEach((p) => resultByGroup.MELINCUE.push(mapProduct(p, 'MELINCUE', false, true, '2 Quesos Semiduros')));
    pickSubtype('semiblando').forEach((p) => resultByGroup.MELINCUE.push(mapProduct(p, 'MELINCUE', false, true, '2 Quesos Semiblandos')));
    pickSubtype('blando').forEach((p) => resultByGroup.MELINCUE.push(mapProduct(p, 'MELINCUE', false, true, '2 Quesos Blandos')));
    pickSubtype('rallado', false).forEach((p) => resultByGroup.MELINCUE.push(mapProduct(p, 'MELINCUE', true, false, '2 Quesos Rallados')));

    // 2. CREMIGAL
    const cremigalProds = products.filter((p) => helperMatch(p.name, ['CREMIGAL']));
    cremigalProds
      .filter((p) => helperMatch(p.name, ['UNTABLE', 'QUESO CREMA']))
      .slice(0, 3)
      .forEach((p) => resultByGroup.CREMIGAL.push(mapProduct(p, 'CREMIGAL', true, false, '1 Untable / Queso Crema Obligatorio')));

    if (currentWeekNumber === 1) {
      const l800 = cremigalProds.find((p) => helperMatch(p.name, ['LECHE EN POLVO', '800']));
      const d400 = cremigalProds.find((p) => helperMatch(p.name, ['DULCE DE LECHE', '400']));
      const m200 = cremigalProds.find((p) => helperMatch(p.name, ['MANTECA', '200']));
      [l800, d400, m200].forEach((p) => p && resultByGroup.CREMIGAL.push(mapProduct(p, 'CREMIGAL', false, true, 'Rotación Semana 1')));
    } else {
      const l400 = cremigalProds.find((p) => helperMatch(p.name, ['LECHE EN POLVO', '400'])) || cremigalProds.find((p) => helperMatch(p.name, ['LECHE EN POLVO']));
      const d250 = cremigalProds.find((p) => helperMatch(p.name, ['DULCE DE LECHE', '250'])) || cremigalProds.find((p) => helperMatch(p.name, ['REPOSTERO']));
      const m100 = cremigalProds.find((p) => helperMatch(p.name, ['MANTECA', '100'])) || cremigalProds.find((p) => helperMatch(p.name, ['MANTECA']));
      [l400, d250, m100].forEach((p) => p && resultByGroup.CREMIGAL.push(mapProduct(p, 'CREMIGAL', false, true, 'Rotación Semana 2')));
    }

    cremigalProds
      .filter((p) => helperMatch(p.name, ['SARDO', 'PATEGRAS', 'LECHE UAT', 'YOGURT']))
      .slice(0, 5)
      .forEach((p) => resultByGroup.CREMIGAL.push(mapProduct(p, 'CREMIGAL', true, false, 'Básico Fijo Cremigal')));

    // 3. R.P.B
    products
      .filter((p) => helperMatch(p.name, ['BAGGIO', 'MOCORETA', 'RPB', 'VIDA']))
      .slice(0, 6)
      .forEach((p) => resultByGroup['R.P.B'].push(mapProduct(p, 'R.P.B', true, false, 'Jugo Baggio / Vida (Fijo)')));

    // 4. BEBIDAS
    const bebidasTerms = ['FERNET', 'BRANCA', 'CAZALIS', 'CINZANO', 'GANCIA', 'SERNOVA', 'VODKA', 'GIN', 'CAMPARI', 'TERMA', 'VIÑA DE BALBO', 'SANTA JULIA', 'BIANCHI', 'ALAMBRADO', 'DON DAVID', 'PERDIZ', 'ZUCCARDI', 'LOPEZ', 'RURAL'];
    const bebidasProds = products.filter((p) => helperMatch(p.name, bebidasTerms));
    bebidasProds.filter((p) => helperMatch(p.name, ['FERNET', 'BRANCA'])).forEach((p) => {
      const tag = p.name.includes('1') || p.name.includes('LT') ? 'Cada 6 un. $21200' : 'Cada 12 un. $16112';
      resultByGroup.BEBIDAS.push(mapProduct(p, 'BEBIDAS', true, false, 'Fernet Branca (Fijo)', tag));
    });

    if (currentWeekNumber === 1) {
      const cazalis = bebidasProds.find((p) => helperMatch(p.name, ['CAZALIS', 'LEGER']));
      const sernova = bebidasProds.find((p) => helperMatch(p.name, ['SERNOVA', 'VODKA']));
      if (cazalis) resultByGroup.BEBIDAS.push(mapProduct(cazalis, 'BEBIDAS', false, true, 'Rotación Aperitivos (Semana 1)'));
      if (sernova) resultByGroup.BEBIDAS.push(mapProduct(sernova, 'BEBIDAS', false, true, 'Rotación Vodkas (Semana 1)'));
    } else {
      const cinzano = bebidasProds.find((p) => helperMatch(p.name, ['CINZANO', 'ROSSO']));
      const gancia = bebidasProds.find((p) => helperMatch(p.name, ['GANCIA', 'GIN', 'CAMPARI']));
      if (cinzano) resultByGroup.BEBIDAS.push(mapProduct(cinzano, 'BEBIDAS', false, true, 'Rotación Aperitivos (Semana 2)'));
      if (gancia) resultByGroup.BEBIDAS.push(mapProduct(gancia, 'BEBIDAS', false, true, 'Rotación Aperitivos (Semana 2)'));
    }

    bebidasProds
      .filter((p) => helperMatch(p.name, ['BALBO', 'JULIA', 'BIANCHI', 'ALAMBRADO', 'DON DAVID', 'PERDIZ', 'ZUCCARDI', 'LOPEZ', 'RURAL']))
      .slice(0, 6)
      .forEach((p) => resultByGroup.BEBIDAS.push(mapProduct(p, 'BEBIDAS', true, false, 'Vino Seleccionado de Bodega')));

    // 5. ALMACEN
    const almacenProds = products.filter((p) => !helperMatch(p.name, ['MELINCUE', 'CREMIGAL', 'BAGGIO', 'MOCORETA', 'BRANCA', 'FERNET']));
    almacenProds.filter((p) => helperMatch(p.name, ['GIACOMO'])).slice(0, 2).forEach((p) => {
      resultByGroup.ALMACEN.push(mapProduct(p, 'ALMACEN', true, false, 'Capelettini Giacomo (Fijo)'));
    });

    if (currentWeekNumber === 1) {
      almacenProds
        .filter((p) => helperMatch(p.name, ['NATURA', 'MAYONESA']) && helperMatch(p.name, ['125', '500']))
        .forEach((p) => resultByGroup.ALMACEN.push(mapProduct(p, 'ALMACEN', false, true, 'Rotación Mayonesa Natura (Semana 1)')));
    } else {
      almacenProds
        .filter((p) => helperMatch(p.name, ['NATURA', 'MAYONESA']) && (helperMatch(p.name, ['250', 'KG', '1000']) || !p.name.includes('125')))
        .slice(0, 2)
        .forEach((p) => resultByGroup.ALMACEN.push(mapProduct(p, 'ALMACEN', false, true, 'Rotación Mayonesa Natura (Semana 2)')));
    }

    const aderezo = almacenProds.find((p) => helperMatch(p.name, ['MOSTAZA', 'KETCHUP', 'SALSA GOLF']));
    if (aderezo) resultByGroup.ALMACEN.push(mapProduct(aderezo, 'ALMACEN', false, true, `Rotación Aderezos (Semana ${currentWeekNumber})`));

    almacenProds.filter((p) => helperMatch(p.name, ['ANDRESITO', 'AMANDA', 'PLAYADITO'])).slice(0, 3).forEach((p) => {
      resultByGroup.ALMACEN.push(mapProduct(p, 'ALMACEN', false, true, `Rotación Yerba Mate (Semana ${currentWeekNumber})`));
    });

    almacenProds
      .filter((p) => helperMatch(p.name, ['ROLLO', 'CAMPANITA', 'HIGIENOL', '308', 'RECORD', 'CUMANA', 'MAROLIO', 'ARLISTAN', 'VIRGINIA']))
      .slice(0, 8)
      .forEach((p) => resultByGroup.ALMACEN.push(mapProduct(p, 'ALMACEN', false, false, 'Almacén de Alta Rotación')));

    // 6. ARTICULOS POR CANTIDAD
    products
      .filter((p) => p.stock > 15 && (helperMatch(p.name, ['NATURA', 'ACEITE', '308', 'AZUCAR', 'AMANDA', 'FERNET']) || p.unitsPerBox > 1))
      .slice(0, 6)
      .forEach((p) => {
        let bulkTag = 'Llevando por caja descuento especial';
        if (p.name.includes('MAYONESA') && p.name.includes('125')) bulkTag = 'Cada 4 cajas la unidad a $599';
        else if (p.name.includes('MAYONESA') && p.name.includes('250')) bulkTag = 'Cada 3 cajas la unidad a $1369';
        else if (p.name.includes('ACEITE') && p.name.includes('NATURA')) bulkTag = 'Cada 2 cajas la unidad a $3817';
        else if (p.name.includes('308')) bulkTag = 'Cada 1 bolsón la unidad a $1099';
        else if (p.name.includes('AMANDA')) bulkTag = 'Cada 1 pack la unidad a $2699';
        resultByGroup['ARTICULOS POR CANTIDAD'].push(mapProduct(p, 'ARTICULOS POR CANTIDAD', false, false, 'Oferta por Cantidad / Bulto', bulkTag));
      });

    Object.keys(resultByGroup).forEach((grp) => {
      const seen = new Set<number>();
      resultByGroup[grp] = resultByGroup[grp].filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    });

    return {
      detectedWeekNumber: currentWeekNumber,
      weekLabel: `Semana ${currentWeekNumber}`,
      recommendationsByGroup: resultByGroup,
      totalSelected: Object.values(resultByGroup).flat().length,
    };
  },
};
