import prisma from '../src/utils/prisma';
import XLSX from 'xlsx';
import path from 'path';

function classifyOfferGroup(rubroName?: string | null, subrubro?: string | null, productName?: string | null): string {
  const r = (rubroName || '').toString().toUpperCase().trim();
  const sub = (subrubro || '').toString().toUpperCase().trim();
  const p = (productName || '').toString().toUpperCase().trim();

  // 1. Refrigerados (Lácteos, Quesos, Manteca, Crema, Yogur)
  if (
    r === 'REMOTTI' || r === 'LECHES' || r === 'SANCOR Y CREMIGAL' || r === 'QUESOS RALLADOS' ||
    r.includes('LACTEO') || r.includes('LÁCTEO') || r.includes('QUESO') || r.includes('CREMA') || r.includes('MANTECA') || r.includes('YOGUR') ||
    p.includes('QUESO') || p.includes('CREMA') || p.includes('MANTECA') || p.includes('TYBO') || p.includes('MOZZARELLA') ||
    p.includes('CHEDDAR') || p.includes('DANBO') || p.includes('POR SALUT') || p.includes('SARDO') || p.includes('CREMIGAL') ||
    p.includes('SANCOR') || p.includes('MELINCUE') || p.includes('REMOTTI') || p.includes('GOUDA') || p.includes('REGGIANITO') ||
    p.includes('PROVOLONE') || p.includes('FONTINA') || p.includes('PORT SALUT') || p.includes('HOLANDO')
  ) {
    return 'Refrigerados';
  }

  // 2. Fiambres (Sodecar, Jamón, Salame, Paleta, Bondiola, Mortadela)
  if (
    r === 'SODECAR' || r.includes('FIAMBRE') || r.includes('EMBUTIDO') || r.includes('CHACINADO') ||
    p.includes('JAMON') || p.includes('PALETA') || p.includes('SALAME') || p.includes('BONDIOLA') ||
    p.includes('MORTADELA') || p.includes('LOMO') || p.includes('SALCHICHA') || p.includes('LONGANIZA') ||
    p.includes('CANTIMPALO') || p.includes('PANCETA') || p.includes('CHORIZO') || p.includes('SODECAR')
  ) {
    return 'Fiambres';
  }

  // 3. Bebidas Alcoholicas
  if (
    p.includes('CERVEZA') || p.includes('VINO') || p.includes('FERNET') || p.includes('GIN') ||
    p.includes('GANCIA') || p.includes('CAMPARI') || p.includes('APEROL') || p.includes('VODKA') ||
    p.includes('RON') || p.includes('LICOR') || p.includes('WHISKY') || p.includes('CHAMPAGNE') ||
    p.includes('ANANA FIZZ') || p.includes('CYNAR') || p.includes('SIDRA') || p.includes('SMIRNOFF') ||
    p.includes('DR. LEMON') || p.includes('DR LEMON') || p.includes('SCHNEIDER') || p.includes('HEINEKEN') ||
    p.includes('CORONA') || p.includes('STELLA') || p.includes('BRAHMA') || p.includes('QUILMES') ||
    p.includes('RUTINI') || p.includes('ALAMBRADO') || p.includes('TRUMPETER') || p.includes('LUIGI BOSCA')
  ) {
    return 'Bebidas Alcoholicas';
  }

  // 4. Bebidas
  if (
    r === 'BEBIDAS' || r.includes('BEBIDA') || r.includes('GASEOSA') || r.includes('JUGO') || r.includes('AGUA') ||
    p.includes('GASEOSA') || p.includes('JUGO') || p.includes('AGUA') || p.includes('COCA') ||
    p.includes('PEPSI') || p.includes('SPRITE') || p.includes('FANTA') || p.includes('MANAO') ||
    p.includes('SECO') || p.includes('BAGLEY JUGO') || p.includes('TERMA') || p.includes('BAGGIO') ||
    p.includes('SPEED') || p.includes('RED BULL') || p.includes('MONSTER')
  ) {
    return 'Bebidas';
  }

  // 5. Aderezos y Aceites
  if (
    r === 'A.G.D Y NIZA' || r.includes('ACEITE') || r.includes('ADEREZO') ||
    p.includes('ACEITE') || p.includes('MAYONESA') || p.includes('MOSTAZA') || p.includes('KETCHUP') ||
    p.includes('NATURA') || p.includes('NIZA') || p.includes('CADA DIA') || p.includes('SOJOLA') ||
    p.includes('SALSA DE SOJA') || p.includes('ADEREZO') || p.includes('HEINZ') || p.includes('SAVORA')
  ) {
    return 'Aderezos y Aceites';
  }

  // 6. Pastas Secas
  if (
    r === 'PASTAS SECAS' || r === 'ARROZ' || r.includes('PASTA') || r.includes('HARINA') ||
    p.includes('FIDEO') || p.includes('ARROZ') || p.includes('HARINA') || p.includes('TALLARIN') ||
    p.includes('MOSTACHOL') || p.includes('TIRABUZON') || p.includes('SPAGHETTI') || p.includes('NIDO') ||
    p.includes('LUCCHETTI') || p.includes('MATARAZZO') || p.includes('TERRABUSI') || p.includes('DON VICENTE') ||
    p.includes('MAROLIO FIDEO') || p.includes('GALLOCANTO') || p.includes('ALA') || p.includes('SAMAN')
  ) {
    return 'Pastas Secas';
  }

  // 7. Conservas
  if (
    r === 'CONSERVAS' || r.includes('CONSERVA') ||
    p.includes('ATUN') || p.includes('CABALLA') || p.includes('SARDINA') || p.includes('CHOCLO') ||
    p.includes('ARVEJA') || p.includes('LENTEJA') || p.includes('POROTO') || p.includes('PURE DE TOMATE') ||
    p.includes('TOMATE PERITA') || p.includes('DURAZNO') || p.includes('PICADILLO') || p.includes('PATE')
  ) {
    return 'Conservas';
  }

  // 8. Pescadería
  if (
    r === 'PESCADERIA' || r.includes('PESCA') ||
    p.includes('FILET') || p.includes('MERLUZA') || p.includes('CALAMAR') || p.includes('CORNALITO') ||
    p.includes('LANGOSTINO') || p.includes('KANI KAMA') || p.includes('SALMON')
  ) {
    return 'Pescadería';
  }

  // 9. Papeles
  if (
    r === 'PAPELES' || r.includes('PAPEL') ||
    p.includes('HIGIENICO') || p.includes('ROLLO DE COCINA') || p.includes('SERVILLETAS') || p.includes('PAÑUELOS') ||
    p.includes('ELEGANTE') || p.includes('HIGIENOL') || p.includes('SUSSEX') || p.includes('KOTEX')
  ) {
    return 'Papeles';
  }

  // 10. No comestibles
  if (
    r === 'NO COMESTIBLES' || r.includes('LIMPIEZA') ||
    p.includes('DETERGENTE') || p.includes('LAVANDINA') || p.includes('JABON') || p.includes('DESINFECTANTE') ||
    p.includes('SUAVIZANTE') || p.includes('SHAMPOO') || p.includes('ACONDICIONADOR') || p.includes('ESPONJA') ||
    p.includes('BOLLITA') || p.includes('TRAPO') || p.includes('DESODORANTE') || p.includes('CREMA DENTAL')
  ) {
    return 'No comestibles';
  }

  // 11. Estucheria y Regalerìa
  if (
    r === 'REGALERIA' || r.includes('REGAL') || r.includes('ESTUCH') ||
    p.includes('ESTUCHE') || p.includes('COMBO') || p.includes('REGALO') || p.includes('BOMBON')
  ) {
    return 'Estucheria y Regalerìa';
  }

  return 'Varios';
}

async function main() {
  console.log('🚀 Iniciando actualización masiva de Categoría Comercial en la Base de Datos...');

  const products = await prisma.product.findMany({
    include: { rubro: true }
  });

  const categoryCounts: Record<string, number> = {};
  let updatedCount = 0;

  for (const prod of products) {
    const category = classifyOfferGroup(prod.rubro?.name, '', prod.name);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    await prisma.product.update({
      where: { id: prod.id },
      data: { commercialCategory: category }
    });
    updatedCount++;
  }

  console.log(`\n✅ ¡${updatedCount} productos actualizados con éxito en PostgreSQL!`);
  console.log('\n📊 Resumen de productos por Categoría Comercial:');
  console.table(categoryCounts);
}

main()
  .catch((e) => {
    console.error('❌ Error en script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
