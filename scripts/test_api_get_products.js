const http = require('http');

http.get('http://localhost:3000/api/products', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Status code:', res.statusCode);
      console.log('Response status:', json.status);
      console.log('Products count:', json.data ? json.data.products ? json.data.products.length : json.data.length : 'N/A');
      if (json.data && json.data.products) {
        const prodWithLots = json.data.products.filter(p => p.lots && p.lots.length > 0);
        console.log('Products with lots:', prodWithLots.length);
        prodWithLots.forEach(p => {
          console.log(`Product [${p.sku}] ${p.name}: ${p.lots.length} lots`);
          p.lots.forEach(l => console.log(`   -> Lot: ${l.lotNumber}, Stock: ${l.stock}, Location: "${l.location}"`));
        });
      }
    } catch (e) {
      console.error('Error parsing json:', e);
      console.log('Raw response:', data.substring(0, 300));
    }
  });
}).on('error', err => {
  console.error('HTTP Error:', err);
});
