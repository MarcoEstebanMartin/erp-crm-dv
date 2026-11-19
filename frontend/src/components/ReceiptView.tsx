import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check, Download, Printer, Share2, ShieldAlert, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { apiClient } from '../api/apiClient';
import {
  buildReceiptPdfFilename,
  downloadReceiptPdf,
  formatReceiptDateTimeAr,
  generateReceiptPdfBlob,
  type PublicReceiptData,
} from '../utils/receiptPdfGenerator';
import {
  formatCustomerDisplayName,
  formatPaymentMethodLabel,
  formatReceiptAmountAr,
} from '../utils/receiptWhatsApp';

interface ReceiptViewProps {
  receiptId?: string;
}

const ReceiptView: React.FC<ReceiptViewProps> = ({ receiptId }) => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const verificationToken = searchParams.get('v') || '';
  const activeId = receiptId || id;

  const [receipt, setReceipt] = useState<PublicReceiptData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchReceipt = async () => {
      try {
        const query = verificationToken ? `?v=${encodeURIComponent(verificationToken)}` : '';
        const data = await apiClient.get<PublicReceiptData>(
          `/collections/receipt/${activeId}${query}`,
        );
        if (!cancelled) {
          setReceipt(data);
        }
      } catch {
        if (!cancelled) {
          setError('Comprobante no válido o enlace vencido.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (activeId) {
      fetchReceipt();
    } else {
      setLoading(false);
      setError('Comprobante no válido.');
    }

    return () => {
      cancelled = true;
    };
  }, [activeId, verificationToken]);

  useEffect(() => {
    let cancelled = false;
    const targetUrl = receipt?.publicUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!receipt || !targetUrl) return;

    QRCode.toDataURL(targetUrl, {
      width: 176,
      margin: 1,
      color: { dark: '#18181B', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [receipt]);

  const handleDownloadPdf = async () => {
    if (!receipt || downloading) return;
    setDownloading(true);
    try {
      await downloadReceiptPdf(receipt);
    } finally {
      setDownloading(false);
    }
  };

  const handleSharePdf = async () => {
    if (!receipt || downloading) return;
    setDownloading(true);
    try {
      const blob = await generateReceiptPdfBlob(receipt);
      const file = new File([blob], buildReceiptPdfFilename(receipt), {
        type: 'application/pdf',
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Recibo ${receipt.receiptNumber || `REC-${receipt.id}`}`,
          files: [file],
        });
        return;
      }
      await downloadReceiptPdf(receipt);
    } catch {
      // Usuario canceló el sheet nativo de compartir
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <main
        className="min-h-screen bg-zinc-50 flex items-center justify-center p-4"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="text-sm text-zinc-500">Verificando comprobante…</div>
      </main>
    );
  }

  if (error || !receipt) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <section className="bg-white border border-zinc-200 rounded-xl p-8 text-center max-w-sm w-full">
          <div className="w-11 h-11 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-5 h-5 text-[#E30613]" aria-hidden="true" />
          </div>
          <h1 className="text-base font-semibold text-zinc-900">Comprobante no válido</h1>
          <p className="text-sm text-zinc-500 mt-1">{error}</p>
        </section>
      </main>
    );
  }

  const receiptNo = receipt.receiptNumber || `REC-${String(receipt.id).padStart(5, '0')}`;
  const customerName = formatCustomerDisplayName(receipt.persona?.name);
  const amountText = formatReceiptAmountAr(receipt.amount);
  const methodLabel = formatPaymentMethodLabel(receipt.paymentMethod, receipt.bankAccount?.name);
  const dateTimeLabel = formatReceiptDateTimeAr(receipt.createdAt);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const details: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: 'Cliente', value: customerName },
    ...(receipt.persona?.cuit ? [{ label: 'CUIT', value: receipt.persona.cuit, mono: true }] : []),
    { label: 'Fecha', value: dateTimeLabel, mono: true },
    { label: 'Medio de pago', value: methodLabel },
    ...(receipt.description ? [{ label: 'Concepto', value: receipt.description }] : []),
    ...(receipt.user?.username ? [{ label: 'Emitido por', value: receipt.user.username }] : []),
  ];

  return (
    <main className="min-h-screen bg-zinc-50 py-8 px-4 flex items-center justify-center font-sans print:bg-white print:p-0">
      <article className="bg-white max-w-md w-full rounded-xl border border-zinc-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        {/* Header institucional minimalista */}
        <header className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
              DV
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-zinc-900 truncate">Don Venancio</h1>
              <p className="text-xs text-zinc-500">Recibo de Cobro</p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold text-zinc-700 bg-zinc-100 px-2.5 py-1 rounded-md tabular-nums shrink-0">
            {receiptNo}
          </span>
        </header>

        {/* Monto y sello de autenticidad en vivo */}
        <section className="px-6 py-7 border-b border-zinc-100 text-center">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Verificado · Don Venancio</span>
          </div>
          <div className="text-4xl font-bold tracking-tight text-zinc-900 tabular-nums">
            {amountText}
          </div>
        </section>

        {/* Detalle del comprobante */}
        <dl className="px-6 py-5 divide-y divide-zinc-100">
          {details.map((item) => (
            <div key={item.label} className="py-2.5 flex items-baseline justify-between gap-4">
              <dt className="text-xs text-zinc-500 shrink-0">{item.label}</dt>
              <dd
                className={`text-sm font-medium text-zinc-900 text-right break-words ${
                  item.mono ? 'tabular-nums' : ''
                }`}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Bloque anti-estafas con QR y código de verificación */}
        {(receipt.verificationCode || qrDataUrl) && (
          <section className="mx-6 mb-6 p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/80 flex items-center gap-3.5">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Código QR de verificación"
                className="w-16 h-16 rounded border border-zinc-200 bg-white p-0.5 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Autenticidad verificable</span>
              </div>
              {receipt.verificationCode && (
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-900 tracking-wide">
                  {receipt.verificationCode}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Acciones directas */}
        <footer className="px-6 py-4 bg-zinc-50/70 border-t border-zinc-100 flex items-center gap-2.5 print:hidden">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex-1 bg-zinc-900 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-zinc-800 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{downloading ? 'Generando…' : 'Descargar PDF'}</span>
          </button>

          {canNativeShare ? (
            <button
              type="button"
              onClick={handleSharePdf}
              disabled={downloading}
              className="bg-white border border-zinc-200 text-zinc-700 text-sm font-medium py-2.5 px-3.5 rounded-lg hover:bg-zinc-100 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
              aria-label="Compartir PDF"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              <span>Compartir</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-white border border-zinc-200 text-zinc-700 text-sm font-medium py-2.5 px-3.5 rounded-lg hover:bg-zinc-100 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
              aria-label="Imprimir"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span>Imprimir</span>
            </button>
          )}
        </footer>
      </article>
    </main>
  );
};

export default ReceiptView;
