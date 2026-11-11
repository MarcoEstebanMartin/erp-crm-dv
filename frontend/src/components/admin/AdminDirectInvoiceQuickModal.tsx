import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { useDirectInvoice } from '../billing/sales/useDirectInvoice';
import { DirectInvoiceModal } from '../billing/sales/DirectInvoiceModal';
import { InvoicePreviewModal } from '../billing/sales/InvoicePreviewModal';

interface AdminDirectInvoiceQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: any[];
  products: any[];
  onSuccess: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export function AdminDirectInvoiceQuickModal({
  isOpen,
  onClose,
  clients,
  products,
  onSuccess,
  setErrorMsg,
  setSuccessMsg,
}: AdminDirectInvoiceQuickModalProps) {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [activeDrawers, setActiveDrawers] = useState<any[]>([]);
  const [ivaPerceptionAliquot, setIvaPerceptionAliquot] = useState<number>(3.0);
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);

  const directInvoice = useDirectInvoice({
    personas: clients,
    products,
    bankAccounts,
    activeDrawers,
    ivaPerceptionAliquotOverride: ivaPerceptionAliquot,
    loadData: onSuccess,
    setErrorMsg,
    setSuccessMsg,
    onInvoiceCreated: (inv) => setPreviewInvoice(inv),
    onModalClosed: onClose,
  });

  useEffect(() => {
    if (!isOpen) return;

    directInvoice.setShowDirectInvoiceModal(true);

    let cancelled = false;
    (async () => {
      const [drawers, banks, perceptionsRes] = await Promise.all([
        api.getActiveDrawers().catch(() => []),
        api.getBankAccounts().catch(() => []),
        api.getPerceptions().catch(() => null),
      ]);
      if (cancelled) return;
      setActiveDrawers(drawers || []);
      setBankAccounts(banks || []);
      const pIva = perceptionsRes?.perceptions?.find((p: any) => p.code === 'IVA_5329');
      if (pIva) {
        setIvaPerceptionAliquot(Number(pIva.aliquot));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen && !previewInvoice) return null;

  return (
    <>
      <DirectInvoiceModal
        directInvoice={directInvoice}
        products={products}
        activeDrawers={activeDrawers}
        bankAccounts={bankAccounts}
      />

      <InvoicePreviewModal
        invoice={previewInvoice}
        onClose={() => {
          setPreviewInvoice(null);
          onClose();
        }}
      />
    </>
  );
}
