const fs = require('fs');

const f = 'frontend/src/components/CajasDashboard.tsx';
let c = fs.readFileSync(f, 'utf8');

if (!c.includes('const [historicalDrawers, setHistoricalDrawers] = useState<any[]>([])')) {
  c = c.replace(
    'const [cajaGrandeBalance, setCajaGrandeBalance] = useState(0);',
    'const [cajaGrandeBalance, setCajaGrandeBalance] = useState(0);\n  const [historicalDrawers, setHistoricalDrawers] = useState<any[]>([]);'
  );

  c = c.replace(
    'setCajaGrandeBalance(totalCajaGrande);',
    'setCajaGrandeBalance(totalCajaGrande);\n      const history = [...closed].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());\n      setHistoricalDrawers(history);'
  );

  const historyHtml = `
      {/* Historial */}
      <div style={{ marginTop: '40px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: 600 }}>Historial de Arqueos (Cajas Cerradas)</h3>
        <div className="table-responsive card">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Caja</th>
                <th style={{ padding: '12px' }}>Apertura</th>
                <th style={{ padding: '12px' }}>Cierre</th>
                <th style={{ padding: '12px' }}>Fondo Inicial</th>
                <th style={{ padding: '12px' }}>Saldo Teórico</th>
                <th style={{ padding: '12px' }}>Arqueo Real</th>
                <th style={{ padding: '12px' }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {historicalDrawers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No hay historiales de cajas cerradas.</td>
                </tr>
              ) : (
                historicalDrawers.map((d: any) => {
                  const dif = Number(d.realBalance) - Number(d.closingBalance);
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{CAJAS.find(c => c.id === d.branch)?.name || d.branch}</td>
                      <td style={{ padding: '12px' }}>{new Date(d.openedAt).toLocaleString('es-AR', {dateStyle:'short', timeStyle:'short'})}</td>
                      <td style={{ padding: '12px' }}>{new Date(d.closedAt).toLocaleString('es-AR', {dateStyle:'short', timeStyle:'short'})}</td>
                      <td style={{ padding: '12px' }}>\${Number(d.openingBalance).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '12px' }}>\${Number(d.closingBalance).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>\${Number(d.realBalance).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: dif >= 0 ? '#10b981' : '#ef4444' }}>
                        {dif > 0 ? '+' : ''}\${dif.toLocaleString('es-AR', {minimumFractionDigits:2})}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
  `;

  c = c.replace(
    '    </div>\n  );\n}',
    historyHtml + '\n    </div>\n  );\n}'
  );

  fs.writeFileSync(f, c);
  console.log('Added historical drawers to CajasDashboard');
} else {
  console.log('Already added');
}
