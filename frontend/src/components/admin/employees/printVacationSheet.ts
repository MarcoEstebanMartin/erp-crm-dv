import { type EmployeeRecord, type EmployeeVacationRecord, formatDateAr } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTramoCell(records: EmployeeVacationRecord[]): string {
  if (records.length === 0) return '';
  return records
    .map((r) => `${formatDateAr(r.startDate)} al ${formatDateAr(r.endDate)} (${r.daysCount} d.)`)
    .join('<br/>');
}

export function printVacationSheet(employee: EmployeeRecord): void {
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const cuitCuil = employee.cuil || employee.dni || '';
  const hireDateStr = formatDateAr(employee.hireDate);
  const daysPerYear = Number(employee.vacationDaysPerYear) || 0;

  const byYear = new Map<number, { tramo1: EmployeeVacationRecord[]; tramo2: EmployeeVacationRecord[] }>();
  for (const v of employee.vacations || []) {
    if (v.type !== 'VACATION') continue;
    const entry = byYear.get(v.year) || { tramo1: [], tramo2: [] };
    if (v.tramo === 2) entry.tramo2.push(v);
    else entry.tramo1.push(v);
    byYear.set(v.year, entry);
  }

  // Asegurar al menos el año trabajado anterior (para goce en el año actual) si no figura aún
  const currentYear = new Date().getFullYear();
  const defaultWorkYear = currentYear - 1;
  if (!byYear.has(defaultWorkYear)) {
    byYear.set(defaultWorkYear, { tramo1: [], tramo2: [] });
  }

  const sortedYears = Array.from(byYear.keys()).sort((a, b) => a - b);

  const rowsHtml = sortedYears
    .map((workYear) => {
      const data = byYear.get(workYear)!;
      return `
        <tr>
          <td class="center">${workYear}</td>
          <td class="center">${workYear + 1}</td>
          <td class="center">${formatTramoCell(data.tramo1)}</td>
          <td class="center">${formatTramoCell(data.tramo2)}</td>
          <td class="signature"></td>
        </tr>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Registro de Vacaciones - ${escapeHtml(fullName)}</title>
  <style>
    @page { size: A4 landscape; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Calibri, Arial, Helvetica, sans-serif;
      color: #000;
      margin: 0;
      padding: 20px;
      background: #fff;
    }
    h1 {
      text-align: center;
      font-size: 20pt;
      font-weight: 700;
      margin: 0 0 24px 0;
      letter-spacing: 0.5px;
    }
    .info-table {
      border-collapse: collapse;
      margin-bottom: 22px;
      font-size: 11.5pt;
    }
    .info-table td {
      padding: 4px 12px 4px 0;
    }
    .info-table tr.underline td {
      border-bottom: 1.5px solid #000;
      padding-bottom: 6px;
    }
    .important {
      font-size: 11pt;
      margin: 18px 0 20px 0;
    }
    .vac-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11pt;
    }
    .vac-table th,
    .vac-table td {
      border: 1.25px solid #000;
      padding: 10px 8px;
    }
    .vac-table thead th {
      background-color: #d9d9d9;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .vac-table tbody td {
      height: 54px;
      vertical-align: middle;
    }
    .center { text-align: center; }
    .signature { min-width: 180px; }
  </style>
</head>
<body>
  <h1>REGISTRO DE VACACIONES</h1>

  <table class="info-table">
    <tr>
      <td>Nombre y apellido:</td>
      <td>${escapeHtml(fullName)}</td>
    </tr>
    <tr>
      <td>CUIT-CUIL:</td>
      <td>${escapeHtml(cuitCuil)}</td>
    </tr>
    <tr>
      <td>Fecha de ingreso:</td>
      <td>${escapeHtml(hireDateStr)}</td>
    </tr>
    <tr class="underline">
      <td colspan="2">Días Correspondientes por año : ${daysPerYear} días</td>
    </tr>
  </table>

  <p class="important"><strong>IMPORTANTE:</strong> Las vacaciones corresponden tomarse al año siguiente del año trabajado</p>

  <table class="vac-table">
    <thead>
      <tr>
        <th rowspan="2" style="width: 15%;">AÑO TRABAJADO</th>
        <th rowspan="2" style="width: 19%;">AÑO DE GOCE DE<br/>VACACIONES</th>
        <th colspan="2" style="width: 44%;">VACACIONES TOMADAS</th>
        <th rowspan="2" style="width: 22%;">FIRMA EMPLEADO</th>
      </tr>
      <tr>
        <th style="width: 22%;">TRAMO 1</th>
        <th style="width: 22%;">TRAMO 2</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <script>
    window.addEventListener('load', () => {
      window.focus();
      window.print();
    });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1024,height=720');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
