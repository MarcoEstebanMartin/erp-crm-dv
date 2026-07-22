import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User as UserIcon, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert,
  FileText
} from 'lucide-react';

interface AuditLogEntry {
  id: number;
  userId: number;
  user: {
    id: number;
    username: string;
    role: string;
  };
  action: string;
  entityType: string;
  entityId: number;
  status: 'SUCCESS' | 'ERROR' | 'WARNING' | string;
  errorMessage?: string | null;
  oldValues?: any;
  newValues?: any;
  createdAt: string;
}

interface DocumentAuditTimelineProps {
  entityType: 'Order' | 'CreditNote' | 'Transaction' | string;
  entityId: number;
  title?: string;
}

export const DocumentAuditTimeline: React.FC<DocumentAuditTimelineProps> = ({
  entityType,
  entityId,
  title = "Historial y Auditoría de Movimientos"
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (entityId) {
      loadLogs();
    }
  }, [entityType, entityId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getDocumentAuditLogs(entityType, entityId);
      setLogs(data || []);
    } catch (error) {
      console.error('Error al cargar la auditoría del documento:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatActionName = (action: string): string => {
    const actionMap: Record<string, string> = {
      CREATE_ORDER: 'Creación de Comprobante',
      UPDATE_ORDER: 'Modificación de Comprobante',
      UPDATE_ORDER_WEIGHTS: 'Actualización de Pesos / Armado',
      EMIT_AFIP_INVOICE: 'Emisión de Factura AFIP',
      CANCEL_ORDER: 'Cancelación de Comprobante',
      CREATE_CREDIT_NOTE: 'Creación de Nota de Crédito',
      APPROVE_CREDIT_NOTE: 'Aprobación de Nota de Crédito',
      REJECT_CREDIT_NOTE: 'Rechazo de Nota de Crédito',
      REGISTER_PAYMENT: 'Registro de Cobro / Recibo',
      CANCEL_TRANSACTION: 'Anulación de Movimiento Financiero',
      CREATE_ORDER_FAILED: 'Intento Fallido de Creación',
    };
    return actionMap[action] || action.replace(/_/g, ' ');
  };

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 my-4">
        <div className="flex items-center gap-2 mb-3 text-neutral-400 text-sm font-medium">
          <Clock className="w-4 h-4 animate-spin text-neutral-400" />
          <span>Cargando historial de auditoría...</span>
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-4 my-4 text-center">
        <p className="text-xs text-neutral-400">Sin registros de auditoría guardados para este comprobante.</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 my-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-neutral-400" />
          <h4 className="text-sm font-semibold text-neutral-200">{title}</h4>
        </div>
        <span className="text-xs text-neutral-400 font-mono bg-neutral-800 px-2 py-0.5 rounded">
          {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-800">
        {logs.map((log) => {
          const isError = log.status === 'ERROR';
          const isWarning = log.status === 'WARNING';
          const isExpanded = expandedId === log.id;

          return (
            <div key={log.id} className="relative group">
              {/* Indicador en la línea de tiempo */}
              <div
                className={`absolute -left-[23px] top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-neutral-900 ${
                  isError
                    ? 'border-[#E30613] text-[#E30613]'
                    : isWarning
                    ? 'border-amber-500 text-amber-500'
                    : 'border-emerald-500 text-emerald-500'
                }`}
              >
                {isError ? (
                  <AlertCircle className="w-3 h-3" />
                ) : isWarning ? (
                  <ShieldAlert className="w-3 h-3" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
              </div>

              {/* Contenido del Evento */}
              <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3 hover:border-neutral-700 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-100">
                        {formatActionName(log.action)}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isError
                            ? 'bg-[#E30613]/10 text-[#E30613] border border-[#E30613]/30'
                            : isWarning
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>

                    {/* Metadata: Usuario, Rol, Fecha */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-neutral-400">
                      <span className="flex items-center gap-1 text-neutral-300 font-medium">
                        <UserIcon className="w-3 h-3 text-neutral-400" />
                        {log.user?.username || `Usuario #${log.userId}`}
                        {log.user?.role && (
                          <span className="text-[10px] text-neutral-400 bg-neutral-800/80 px-1.5 py-0.2 rounded uppercase">
                            {log.user.role}
                          </span>
                        )}
                      </span>
                      <span className="text-neutral-400">•</span>
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                  </div>

                  {(log.errorMessage || log.oldValues || log.newValues) && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      className="text-neutral-400 hover:text-neutral-200 text-xs flex items-center gap-1 p-1 hover:bg-neutral-800 rounded transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Detalle del Error si ocurrió */}
                {log.errorMessage && (
                  <div className="mt-2.5 p-2.5 bg-[#E30613]/10 border border-[#E30613]/20 rounded-md text-xs text-[#E30613]">
                    <span className="font-semibold block mb-0.5">Detalle del Error:</span>
                    <p className="font-mono text-[11px] whitespace-pre-wrap">{log.errorMessage}</p>
                  </div>
                )}

                {/* Vista Expandida de Cambios (JSON Diff) */}
                {isExpanded && (log.oldValues || log.newValues) && (
                  <div className="mt-3 pt-3 border-t border-neutral-800 text-xs space-y-2">
                    {log.oldValues && (
                      <div>
                        <span className="text-neutral-400 text-[11px] block mb-1 font-medium">Valores Anteriores:</span>
                        <pre className="bg-neutral-900 p-2 rounded border border-neutral-800 text-[11px] text-neutral-400 overflow-x-auto font-mono">
                          {JSON.stringify(log.oldValues, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.newValues && (
                      <div>
                        <span className="text-neutral-400 text-[11px] block mb-1 font-medium">Valores Nuevos:</span>
                        <pre className="bg-neutral-900 p-2 rounded border border-neutral-800 text-[11px] text-emerald-400/90 overflow-x-auto font-mono">
                          {JSON.stringify(log.newValues, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocumentAuditTimeline;
