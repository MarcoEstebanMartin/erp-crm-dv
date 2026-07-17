require('dotenv').config();
const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function importPersonas() {
  const filePath = path.join(__dirname, '..', '..', 'Vendedores-Clientes.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  console.log(`Leyendo ${data.length} filas del archivo Excel...`);

  let countNewUsers = 0;
  let countNewPersonas = 0;
  let countUpdatedPersonas = 0;

  // Track sellers in a map to avoid multiple db calls
  const sellerMap = new Map();

  for (let i = 0; i < data.length; i++) {
    if (i % 100 === 0 && i > 0) console.log(`Procesando fila ${i} de ${data.length}...`);
    const row = data[i];
    
    let personaName = row['Nombre y Apellido']?.trim();
    if (!personaName) continue; // Skip if no name

    // 1. Handle Vendedor
    let rawVendedor = row['Vendedor']?.trim().toUpperCase();
    let sellerId = null;

    if (rawVendedor && rawVendedor !== '') {
      if (sellerMap.has(rawVendedor)) {
        sellerId = sellerMap.get(rawVendedor);
      } else {
        // Try to find in DB
        let user = await prisma.user.findFirst({
          where: { username: rawVendedor }
        });
        
        if (!user) {
          // Create the user
          const passwordHash = await bcrypt.hash('123456', 10);
          user = await prisma.user.create({
            data: {
              username: rawVendedor,
              passwordHash: passwordHash,
              role: 'VENDEDOR'
            }
          });
          countNewUsers++;
          console.log(`Nuevo vendedor creado: ${rawVendedor}`);
        }
        
        sellerMap.set(rawVendedor, user.id);
        sellerId = user.id;
      }
    }

    // 2. Handle Persona Fields
    let tipoPersona = row['TIPO DE PERSONAS']?.trim().toUpperCase();
    let isProvider = (tipoPersona === 'PROVEEDOR');
    let isClient = (tipoPersona === 'CLIENTE' || (!isProvider && tipoPersona !== 'VENDEDOR')); // Default to client if not provider
    let isSeller = (tipoPersona === 'VENDEDOR');
    
    let cuit = row['CUIT'] ? String(row['CUIT']).trim() : null;
    let city = row['Localidad / Pueblo']?.trim();
    let provincia = row['Provincia']?.trim();
    let direccion = row['Dirección']?.trim();
    
    // Combine direccion and provincia if needed
    let address = direccion || '';
    if (provincia && provincia !== '') {
        address += address ? `, ${provincia}` : provincia;
    }
    
    let telefono = row['Teléfono'] ? String(row['Teléfono']).trim() : null;
    let email = row['Email']?.trim();
    let facturacion = row['Facturación']?.trim() || 'A';

    // 3. Find existing persona by CUIT or Name
    let existingPersona = null;
    if (cuit && cuit !== '') {
      existingPersona = await prisma.persona.findFirst({
        where: { cuit: cuit }
      });
    }
    
    if (!existingPersona) {
      existingPersona = await prisma.persona.findFirst({
        where: { name: personaName }
      });
    }

    if (existingPersona) {
      // Update
      await prisma.persona.update({
        where: { id: existingPersona.id },
        data: {
          isClient,
          isProvider,
          isSeller,
          sellerId,
          city,
          address: address || null,
          phone: telefono || null,
          email: email || null,
          priceList: facturacion,
          cuit: cuit || null
        }
      });
      countUpdatedPersonas++;
    } else {
      // Create
      await prisma.persona.create({
        data: {
          name: personaName,
          isClient,
          isProvider,
          isSeller,
          sellerId,
          city,
          address: address || null,
          phone: telefono || null,
          email: email || null,
          priceList: facturacion,
          cuit: cuit || null
        }
      });
      countNewPersonas++;
    }
  }

  console.log(`Importación finalizada.`);
  console.log(`Nuevos vendedores creados: ${countNewUsers}`);
  console.log(`Personas creadas: ${countNewPersonas}`);
  console.log(`Personas actualizadas: ${countUpdatedPersonas}`);
  
  await prisma.$disconnect();
}

importPersonas().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
