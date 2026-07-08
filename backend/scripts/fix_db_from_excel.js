const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixDB() {
  const filePath = path.join(__dirname, '..', 'Vendedores-Clientes.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  console.log(`Verificando y arreglando ${data.length} filas del archivo Excel...`);
  
  let fixedCount = 0;

  for (let i = 0; i < data.length; i++) {
    if (i % 100 === 0 && i > 0) console.log(`Procesando fila ${i}...`);
    const row = data[i];
    
    let personaName = row['Nombre y Apellido']?.trim();
    if (!personaName) continue;

    let cuit = row['CUIT'] ? String(row['CUIT']).trim() : null;
    let city = row['Localidad / Pueblo']?.trim();
    let provincia = row['Provincia']?.trim();
    let direccion = row['Dirección']?.trim();
    
    let address = direccion || '';
    if (provincia && provincia !== '') {
        address += address ? `, ${provincia}` : provincia;
    }
    
    // Find the persona by exact name, because CUITs might be shared
    let existingPersona = await prisma.persona.findFirst({
        where: { name: personaName }
    });

    if (existingPersona) {
        // Only update if the city or address is different, to save time
        if (existingPersona.city !== (city || null) || existingPersona.address !== (address || null)) {
            await prisma.persona.update({
                where: { id: existingPersona.id },
                data: {
                    city: city || null,
                    address: address || null,
                    cuit: cuit || null
                }
            });
            fixedCount++;
        }
    }
  }

  console.log(`Se arreglaron ${fixedCount} personas en la base de datos que habían sido salteadas.`);
  
  // Extra: clean up completely empty localities that might be lingering
  await prisma.persona.updateMany({
      where: { city: '0' },
      data: { city: null }
  });

  await prisma.$disconnect();
}

fixDB().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
