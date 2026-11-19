import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check, Download, Printer, Share2, ShieldAlert, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { apiClient } from '../api/apiClient';
import {
  downloadReceiptPdf,
  formatReceiptDateTimeAr,
  shareOrDownloadReceiptPdf,
  type PublicReceiptData,
} from '../utils/receiptPdfGenerator';
import {
  formatCustomerDisplayName,
  formatPaymentMethodLabel,
  formatReceiptAmountAr,
} from '../utils/receiptWhatsApp';
import './ReceiptView.css';

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
    const targetUrl =
      receipt?.publicUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!receipt || !targetUrl) return;

    QRCode.toDataURL(targetUrl, {
      width: 176,
      margin: 1,
      color: { dark: '#111827', light: '#FFFFFF' },
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
      await shareOrDownloadReceiptPdf(receipt);
    } catch {
      // Usuario canceló el sheet nativo de compartir
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <main className="dv-receipt-page" aria-busy="true" aria-live="polite">
        <div className="dv-receipt-loading">Verificando comprobante…</div>
      </main>
    );
  }

  if (error || !receipt) {
    return (
      <main className="dv-receipt-page">
        <section className="dv-receipt-status-card" role="alert">
          <div className="dv-receipt-error-icon">
            <ShieldAlert size={22} aria-hidden="true" />
          </div>
          <h1 className="dv-receipt-status-title">Comprobante no válido</h1>
          <p className="dv-receipt-status-text">{error}</p>
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
    <main className="dv-receipt-page">
      <article className="dv-receipt-card">
        <header className="dv-receipt-header">
          <div className="dv-receipt-brand">
            <div className="dv-receipt-monogram" aria-hidden="true">
              DV
            </div>
            <div className="dv-receipt-brand-text">
              <h1 className="dv-receipt-company">Don Venancio</h1>
              <p className="dv-receipt-subtitle">Recibo de Cobro</p>
            </div>
          </div>
          <span className="dv-receipt-number">{receiptNo}</span>
        </header>

        <section className="dv-receipt-amount-section">
          <div className="dv-receipt-badge">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Comprobante oficial</span>
          </div>
          <div className="dv-receipt-amount">{amountText}</div>
        </section>

        <dl className="dv-receipt-details">
          {details.map((item) => (
            <div key={item.label} className="dv-receipt-row">
              <dt className="dv-receipt-label">{item.label}</dt>
              <dd
                className={`dv-receipt-value${item.mono ? ' dv-receipt-value--mono' : ''}`}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        {(receipt.verificationCode || qrDataUrl) && (
          <section className="dv-receipt-verify">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Código QR de verificación"
                className="dv-receipt-qr"
              />
            )}
            <div className="dv-receipt-verify-meta">
              <div className="dv-receipt-verify-status">
                <Check size={14} aria-hidden="true" />
                <span>Código único verificado</span>
              </div>
              {receipt.verificationCode && (
                <div className="dv-receipt-verify-code">{receipt.verificationCode}</div>
              )}
            </div>
          </section>
        )}

        <footer className="dv-receipt-actions">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="dv-receipt-btn dv-receipt-btn--primary"
          >
            <Download size={16} aria-hidden="true" />
            <span>{downloading ? 'Generando…' : 'Descargar PDF'}</span>
          </button>

          {canNativeShare ? (
            <button
              type="button"
              onClick={handleSharePdf}
              disabled={downloading}
              className="dv-receipt-btn dv-receipt-btn--secondary"
              aria-label="Compartir PDF"
            >
              <Share2 size={16} aria-hidden="true" />
              <span>Compartir</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.print()}
              className="dv-receipt-btn dv-receipt-btn--secondary"
              aria-label="Imprimir"
            >
              <Printer size={16} aria-hidden="true" />
              <span>Imprimir</span>
            </button>
          )}
        </footer>
      </article>
    </main>
  );
};

export default ReceiptView;
