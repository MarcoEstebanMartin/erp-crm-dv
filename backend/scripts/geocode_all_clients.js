const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

function fetchCoordinates(address, city, province) {
  return new Promise((resolve) => {
    const fullQuery = `${address || ''}, ${city || ''}, ${province || 'BUENOS AIRES'}, ARGENTINA`
      .replace(/\s+/g, ' ')
      .trim();

    if (!address || address.length < 3) {
      return resolve(null);
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQuery)}&format=json&limit=1`;

    https.get(url, { headers: { 'User-Agent': 'ERP-CRM-DV-Geocoder/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.length > 0) {
            resolve({
              lat: parseFloat(json[0].lat),
              lng: parseFloat(json[0].lon)
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  console.log('🚀 Iniciando geocodificación automática de direcciones de clientes...');
  const clients = await prisma.persona.findMany({
    where: {
      isClient: true,
      isActive: true,
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    },
    take: 50 // Lote seguro
  });

  console.log(`📌 Se encontraron ${clients.length} clientes pendientes de coordenadas GPS.`);
  let updatedCount = 0;

  for (const client of clients) {
    if (!client.address) continue;
    
    // Esperar 1 segundo entre peticiones para respetar la política de OpenStreetMap
    await new Promise(r => setTimeout(r, 1100));

    const coords = await fetchCoordinates(client.address, client.city, client.province);
    if (coords) {
      await prisma.persona.update({
        where: { id: client.id },
        data: {
          latitude: coords.lat,
          longitude: coords.lng
        }
      });
      updatedCount++;
      console.log(`✅ [${updatedCount}] ${client.name} (${client.address}, ${client.city}): ${coords.lat}, ${coords.lng}`);
    } else {
      console.log(`⚠️ No se hallaron coordenadas exactas para: ${client.name} (${client.address}, ${client.city})`);
    }
  }

  console.log(`✨ Proceso finalizado. ${updatedCount} clientes geolocalizados en la base de datos.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
