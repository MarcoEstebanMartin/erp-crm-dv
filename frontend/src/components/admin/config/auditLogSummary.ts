import { formatAuditIp, formatAuditMessage, formatAuditPesos } from './auditLogFormatter';
import { translateRole } from './auditLogDictionary';

const REDUNDANT_PREFIXES = [
  'Registró visita en ruta de preventa — Visita a ',
  'Registró visita en ruta de preventa — ',
  'Registró visita sin compra — ',
  'Emitió factura directa ',
  'Cambió estado de ',
  'Modificó artículos de ',
  'Ajustó stock físico de ',
  'Ajustó stock de ',
  'Ejecutó cierre de ',
  'Ejecutó ajuste masivo de stock en ',
  'Sincronizó catálogo desde ',
  'Importó precios CSV: ',
  'Actualizó su propia contraseña de acceso',
  'Actualizó ',
  'Facturó ',
  'Creó la cuenta del empleado ',
  'Eliminó la cuenta del empleado ',
  'Desactivó el acceso del empleado ',
  'Activó el acceso del empleado ',
  'Cambió el estado de acceso del empleado ',
  'Modificó al empleado ',
  'Modificó configuración: ',
  'Modificó ',
  'Creó ',
  'Eliminó ',
  'Anuló ',
  'Registró ',
  'Ubicó ',
  'Ingresó ',
  'Transfirió ',
  'Revirtió los precios de ',
];

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Resume la descripción de la columna "Operación" en Auditoría eliminando
 * el verbo redundante que ya muestra el badge de "Acción" y compactando separadores.
 */
export function formatAuditOperationSummary(log: any): string {
  if (!log) return '';

  const action = String(log.action || '').trim().toUpperCase();
  const newV = log.newValues && typeof log.newValues === 'object' ? log.newValues : {};

  if (action === 'LOGIN') {
    const parts: string[] = [];
    if (newV.role) parts.push(translateRole(newV.role));
    const ip = formatAuditIp(log.ipAddress);
    if (ip) parts.push(ip === 'Red local' ? ip : `IP ${ip}`);
    if (parts.length > 0) return parts.join(' · ');
  }

  if (action === 'CLOSE_OPERATIVE_DRAWER_RENDICION') {
    const count = Number(newV.transactionsCount ?? 0);
    return `Aprobada · ${count} mov. · Efvo ${formatAuditPesos(newV.realCash)}`;
  }

  let text = formatAuditMessage(log);
  if (!text) return '';

  if (action === 'TOGGLE_USER_STATUS') {
    const statusLabel = newV.isActive === false ? 'Desactivado' : newV.isActive === true ? 'Activado' : '';
    for (const prefix of REDUNDANT_PREFIXES) {
      if (text.startsWith(prefix)) {
        const who = text.slice(prefix.length).trim();
        return statusLabel && who ? `${who} · ${statusLabel}` : who || text;
      }
    }
  }

  for (const prefix of REDUNDANT_PREFIXES) {
    if (text.startsWith(prefix)) {
      const rest = text.slice(prefix.length).trim();
      if (rest) {
        text = rest;
      }
      break;
    }
  }

  // Evita repetir el mismo código entre paréntesis (ej: "Pedido #100 (INT-00100) — ABEL LLERA (INT-00100)")
  const seenParens = new Set<string>();
  text = text.replace(/\s*\(([^()]{3,30})\)/g, (fullMatch, inner) => {
    const key = inner.trim();
    if (seenParens.has(key)) return '';
    seenParens.add(key);
    return fullMatch;
  });

  text = text
    .replace(/\s+—\s+/g, ' · ')
    .replace(/\s+por\s+\$/g, ' · $')
    .replace(/\s+\[IP:\s*([^\]]+)\]/g, (_, ip) => (ip === 'Red local' ? ' · Red local' : ` · IP ${ip}`));

  return capitalizeFirst(text.trim());
}
