/**
 * Formatea el nombre del responsable de un cierre de caja o movimiento financiero
 * priorizando el Nombre y Apellido del legajo de empleado (ej. "Diego Lejarza", "Agustín Montiel", "Fabián Maya").
 */
export function formatResponsibleName(d: any): string {
  if (!d) return 'S/D';

  // 1. Si la caja viene con la relación del empleado vinculado en la BD
  if (d.user?.employee?.firstName && d.user?.employee?.lastName) {
    return `${d.user.employee.firstName} ${d.user.employee.lastName}`;
  }

  // 2. Extraer texto del campo branch o username
  const raw = (d.branch || d.user?.username || '').trim();
  if (!raw) return 'Responsable S/D';

  // Limpiar prefijos de sistema (ej: "Caja: VENDEDOR: DIEGO", "VENDEDOR: FABIAN", "REPARTIDOR: Agustin (Ruta #1)")
  const clean = raw
    .replace(/^Caja:\s*/i, '')
    .replace(/^VENDEDOR:\s*/i, '')
    .replace(/^REPARTIDOR:\s*/i, '')
    .trim();

  // Quitar el sufijo de ruta entre paréntesis ej: "(Ruta #1)"
  const cleanNameOnly = clean.replace(/\s*\([^)]*\)/g, '').trim();

  // 3. Mapeo de nombres conocidos a Nombre y Apellido oficiales
  const lower = cleanNameOnly.toLowerCase();
  if (lower === 'diego' || lower === 'diego lejarza') return 'Diego Lejarza';
  if (lower === 'fabian' || lower === 'fabián' || lower === 'fabian maya' || lower === 'fabián maya') return 'Fabián Maya';
  if (lower === 'agustin' || lower === 'agustín' || lower === 'agustin montiel' || lower === 'agustín montiel') return 'Agustín Montiel';
  if (lower === 'norberto' || lower === 'norberto ramos') return 'Norberto Ramos';
  if (lower === 'mariajose' || lower === 'maria_jose' || lower === 'maria jose' || lower === 'maría josé videla') return 'María José Videla';
  if (lower === 'dario' || lower === 'darío' || lower === 'dario torri' || lower === 'darío torri') return 'Darío Torri';
  if (lower === 'matias' || lower === 'matías' || lower === 'matias rodriguez') return 'Matías Rodríguez';
  if (lower === 'thiago' || lower === 'tiago' || lower === 'thiago balmaceda') return 'Tiago Balmaceda';
  if (lower === 'rocio' || lower === 'rocío' || lower === 'rocio aliendro') return 'Rocío Aliendro';
  if (lower === 'miguel' || lower === 'miguel alberca') return 'Miguel Alberca';
  if (lower === 'oficina') return 'Oficina Central';
  if (lower === 'admin' || lower === 'administrador') return 'Administración';

  // 4. Si no es un nombre mapeado pero tiene caracteres, formatear en Title Case
  if (cleanNameOnly.length > 0) {
    return cleanNameOnly
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return raw;
}
