const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Robust normalization function for name matching
const normalize = (str) => {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, ' ') // replace multiple spaces with single space
    .trim();
};

async function syncPersonas() {
  console.log('🔄 Iniciando la sincronización de localidades y direcciones desde Excel...');

  // 1. Backups
  const backendJsonPath = path.join(__dirname, '..', 'prisma', 'clients_data.json');
  const frontendJsonPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'clients_data.json');
  
  if (fs.existsSync(backendJsonPath)) {
    fs.copyFileSync(backendJsonPath, `${backendJsonPath}.bak`);
    console.log(`💾 Backup de backend clients_data.json creado en: ${backendJsonPath}.bak`);
  }
  if (fs.existsSync(frontendJsonPath)) {
    fs.copyFileSync(frontendJsonPath, `${frontendJsonPath}.bak`);
    console.log(`💾 Backup de frontend clients_data.json creado en: ${frontendJsonPath}.bak`);
  }

  // 2. Read Excel
  const excelPath = path.join(__dirname, '..', '..', 'Vendedores-Clientes.xlsx');
  if (!fs.existsSync(excelPath)) {
    throw new Error(`No se encontró el archivo Excel en ${excelPath}`);
  }
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  console.log(`📄 Leídas ${excelData.length} filas del archivo Excel.`);

  // 3. Load DB personas
  const dbPersonas = await prisma.persona.findMany();
  console.log(`🗄️ ${dbPersonas.length} personas encontradas en la base de datos.`);

  let updatedCount = 0;

  for (const row of excelData) {
    const name = row['Nombre y Apellido']?.trim();
    if (!name) continue;

    const normalizedExcelName = normalize(name);
    // Find matching persona in DB
    const dbMatch = dbPersonas.find(p => normalize(p.name) === normalizedExcelName);

    if (dbMatch) {
      const excelCity = row['Localidad / Pueblo']?.trim() || null;
      const excelProvince = row['Provincia']?.trim() || null;
      const excelDireccion = row['Dirección']?.trim() || null;
      const excelCuit = row['CUIT'] ? String(row['CUIT']).trim() : null;
      const excelPhone = row['Teléfono'] ? String(row['Teléfono']).trim() : null;
      const excelEmail = row['Email']?.trim() || null;

      // Construct address
      let address = excelDireccion || '';
      if (excelProvince && excelProvince !== '') {
        address += address ? `, ${excelProvince}` : excelProvince;
      }
      if (!address) address = null;

      // Determine if there are changes to apply
      const hasCityChange = dbMatch.city !== excelCity;
      const hasAddressChange = dbMatch.address !== address;
      const hasCuitChange = dbMatch.cuit !== excelCuit && excelCuit !== null;
      const hasPhoneChange = dbMatch.phone !== excelPhone && excelPhone !== null;
      const hasEmailChange = dbMatch.email !== excelEmail && excelEmail !== null;

      if (hasCityChange || hasAddressChange || hasCuitChange || hasPhoneChange || hasEmailChange) {
        await prisma.persona.update({
          where: { id: dbMatch.id },
          data: {
            city: excelCity,
            address: address,
            cuit: excelCuit || dbMatch.cuit,
            phone: excelPhone || dbMatch.phone,
            email: excelEmail || dbMatch.email
          }
        });
        updatedCount++;
      }
    }
  }

  console.log(`✅ Se actualizaron ${updatedCount} personas en la base de datos.`);

  // 4. Standardize localities (Clean & Unify)
  console.log('🧹 Estandarizando y unificando nombres de localidades en la base de datos...');
  const mapeos = [
    { from: 'RIVADAVIA AMERICA', to: 'RIVADAVIA' },
    { from: 'EMILIO V. BUNGE', to: 'EMILIO BUNGE' },
    { from: 'BERNARDO LARROUDE', to: 'BERNARDO LARROUDÉ' },
    { from: 'AMEGHINO', to: 'FLORENTINO AMEGHINO' },
    { from: 'BANDERALO', to: 'BANDERALÓ' },
    { from: 'VILLA SAUZE', to: 'VILLA SAUCE' },
    { from: 'CARLOS TEJEDOR, EST.TEJEDOR', to: 'CARLOS TEJEDOR' },
    { from: 'EST.TEJEDOR', to: 'CARLOS TEJEDOR' },
    { from: 'HIPOLITO BOUCHARD BUCHARDO ,EST.', to: 'BUCHARDO' },
    { from: 'S/N HIPOLITO BOUCHARD BUCHARDO ,EST.', to: 'BUCHARDO' },
    { from: 'TRES ALGARROBOS ,EST.CUENCA', to: 'TRES ALGARROBOS' },
    { from: 'EST.CUENCA', to: 'TRES ALGARROBOS' },
  ];

  for (const m of mapeos) {
    await prisma.persona.updateMany({
      where: { city: m.from },
      data: { city: m.to }
    });
  }

  const listaOficial = [
    "GENERAL VILLEGAS",
    "CARLOS TEJEDOR",
    "FLORENTINO AMEGHINO",
    "VILLA SAUCE",
    "SANSINENA",
    "PIEDRITAS",
    "CORONEL CHARLONE",
    "EMILIO BUNGE",
    "BUCHARDO",
    "BANDERALÓ",
    "BERNARDO LARROUDÉ",
    "TRES ALGARROBOS",
    "RIVADAVIA",
    "FORTIN OLAVARRIA",
    "INTENDENTE ALVEAR",
    "RUFINO",
    "Otros"
  ];

  const resOtros = await prisma.persona.updateMany({
    where: {
      city: {
        notIn: listaOficial,
        not: null
      }
    },
    data: { city: 'Otros' }
  });
  console.log(`👉 Movidos a 'Otros' las localidades no oficiales (${resOtros.count} registros).`);

  // Extra: clean up completely empty localities that might be lingering
  await prisma.persona.updateMany({
    where: { city: '0' },
    data: { city: null }
  });

  // 5. Export to clients_data.json (both backend and frontend)
  console.log('📤 Exportando la base de datos actualizada a seed JSON...');
  const updatedPersonas = await prisma.persona.findMany({
    include: { seller: true }
  });

  const mappedJson = updatedPersonas.map(p => {
    let sellerName = null;
    if (p.seller) {
      if (p.seller.username === 'diego') sellerName = 'Diego';
      else if (p.seller.username === 'fabian') sellerName = 'Fabian';
      else if (p.seller.username === 'norberto') sellerName = 'Norberto';
      else if (p.seller.username === 'maria_jose') sellerName = 'Maria Jose';
      else if (p.seller.username === 'OFICINA') sellerName = 'OFICINA';
    }
    return {
      id: p.id,
      name: p.name,
      cuit: p.cuit,
      address: p.address,
      city: p.city,
      phone: p.phone,
      email: p.email,
      priceList: p.priceList,
      discount: Number(p.discount),
      creditLimit: Number(p.creditLimit),
      outstandingBalance: Number(p.outstandingBalance),
      isClient: p.isClient,
      isProvider: p.isProvider,
      isSeller: p.isSeller,
      isCommissionAgent: p.isCommissionAgent,
      route: p.route,
      sellerName: sellerName
    };
  });

  const jsonContent = JSON.stringify(mappedJson, null, 2);
  fs.writeFileSync(backendJsonPath, jsonContent, 'utf8');
  console.log(`💾 Guardado ${backendJsonPath}`);

  fs.writeFileSync(frontendJsonPath, jsonContent, 'utf8');
  console.log(`💾 Guardado ${frontendJsonPath}`);

  console.log('✨ Sincronización completada con éxito.');
}

syncPersonas()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
