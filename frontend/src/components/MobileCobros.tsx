import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/apiClient';
import { useConfirm } from '../context/ConfirmContext';
import { formatIntegerARS } from '../utils/currency';
import { MobileCobrosClientList, type MobileCobrosPersona } from './vendedor/cobros/MobileCobrosClientList';
import { MobileCobrosFormView } from './vendedor/cobros/MobileCobrosFormView';
import { MobileCobrosReceiptView } from './vendedor/cobros/MobileCobrosReceiptView';

export type { MobileCobrosPersona };

interface MobileCobrosProps {
  selectedCityFilters?: string[];
  setSelectedCityFilters?: (filters: string[]) => void;
  uniqueCities?: string[];
  cleanCityName?: (city: string | null | undefined) => string;
}

const MobileCobros: React.FC<MobileCobrosProps> = ({
  selectedCityFilters = [], setSelectedCityFilters, uniqueCities = [], cleanCityName,
}) => {
  const confirm = useConfirm();
  const [personas, setPersonas] = useState<MobileCobrosPersona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<MobileCobrosPersona | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [checkNumber, setCheckNumber] = useState('');
  const [isEcheq, setIsEcheq] = useState(false);
  const [billingType, setBillingType] = useState('OFFICIAL');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any>(null);
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [isCreditOnAccount, setIsCreditOnAccount] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const data = await apiClient.get<MobileCobrosPersona[]>('/collections/pending');
      setPersonas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching pending balances', error);
    }
  }, []);

  const fetchPendingInvoices = useCallback(async (personaId: number) => {
    try {
      const res = await apiClient.get<any>(`/personas/${personaId}/pending-invoices`);
      if (res?.status === 'success' && Array.isArray(res?.data?.invoices)) setPendingInvoices(res.data.invoices);
    } catch (error) {
      console.error('Error fetching pending invoices', error);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  useEffect(() => {
    setErrorMsg(null);
    if (selectedPersona) { fetchPendingInvoices(selectedPersona.id); return; }
    setPendingInvoices([]);
    setSelectedInvoiceId(null);
    setIsCreditOnAccount(false);
    setBillingType('OFFICIAL');
    setCheckNumber('');
    setIsEcheq(false);
  }, [selectedPersona, fetchPendingInvoices]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPending();
      if (selectedPersona) fetchPendingInvoices(selectedPersona.id);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedPersona, fetchPending, fetchPendingInvoices]);

  const handleSync = async () => {
    setLoading(true);
    await fetchPending();
    if (selectedPersona) await fetchPendingInvoices(selectedPersona.id);
    setLoading(false);
  };

  const handleSelectInvoice = (val: string) => {
    setErrorMsg(null);
    if (!selectedPersona) return;
    if (val === '') {
      setSelectedInvoiceId(null);
      setAmount(Math.round(selectedPersona.outstandingBalance).toString());
      return;
    }
    const invId = Number(val);
    setSelectedInvoiceId(invId);
    setIsCreditOnAccount(false);
    const inv = pendingInvoices.find((i) => i.id === invId);
    if (inv) {
      setAmount(Math.round(inv.pendingAmount).toString());
      if (inv.billingType) setBillingType(inv.billingType);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersona || loading) return;
    setErrorMsg(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return setErrorMsg('Ingresá un monto mayor a cero.');
    if (paymentMethod === 'CHECK' && !checkNumber.trim()) return setErrorMsg('Ingresá el número de cheque.');
    if (pendingInvoices.length > 0 && !selectedInvoiceId && !isCreditOnAccount) return setErrorMsg('Seleccioná una factura o tildá "Dejar a favor".');

    if (parsedAmount > selectedPersona.outstandingBalance) {
      const ok = await confirm(`El monto (${formatIntegerARS(parsedAmount)}) supera el saldo (${formatIntegerARS(selectedPersona.outstandingBalance)}). El excedente quedará a favor.`, { type: 'warning' });
      if (!ok) return;
    }

    setLoading(true);
    try {
      const finalCheckStr = paymentMethod === 'CHECK' ? (isEcheq ? `E-CHEQ #${checkNumber.trim()}` : checkNumber.trim()) : undefined;
      const res = await apiClient.post<any>('/collections/register', {
        personaId: selectedPersona.id, amount: parsedAmount, paymentMethod, billingType, orderId: selectedInvoiceId, isCreditOnAccount, checkNumber: finalCheckStr,
      });
      setSuccessReceipt(res.transaction);
      fetchPending();
    } catch (error: any) {
      console.error('Error registering collection', error);
      setErrorMsg(error?.message || 'Error al registrar el cobro.');
    } finally {
      setLoading(false);
    }
  };

  if (successReceipt) {
    return (
      <MobileCobrosReceiptView
        receipt={successReceipt} clientName={selectedPersona?.name} paymentMethod={paymentMethod} checkNumber={checkNumber} isEcheq={isEcheq}
        onBack={() => { setSuccessReceipt(null); setSelectedPersona(null); setAmount(''); setCheckNumber(''); setIsEcheq(false); }}
      />
    );
  }

  if (selectedPersona) {
    return (
      <MobileCobrosFormView
        persona={selectedPersona} pendingInvoices={pendingInvoices} selectedInvoiceId={selectedInvoiceId} isCreditOnAccount={isCreditOnAccount}
        amount={amount} paymentMethod={paymentMethod} checkNumber={checkNumber} isEcheq={isEcheq} billingType={billingType} loading={loading} errorMsg={errorMsg}
        onBack={() => setSelectedPersona(null)}
        onSelectInvoice={handleSelectInvoice}
        onToggleCreditOnAccount={(checked) => { setErrorMsg(null); setIsCreditOnAccount(checked); if (checked) setSelectedInvoiceId(null); }}
        onChangeAmount={(val) => { setErrorMsg(null); setAmount(val); }}
        onChangePaymentMethod={(method) => { setErrorMsg(null); setPaymentMethod(method); }}
        onChangeCheckNumber={(val) => { setErrorMsg(null); setCheckNumber(val); }}
        onToggleEcheq={setIsEcheq}
        onChangeBillingType={setBillingType}
        onSubmit={handleRegister}
      />
    );
  }

  return (
    <MobileCobrosClientList
      personas={personas} selectedCityFilters={selectedCityFilters} setSelectedCityFilters={setSelectedCityFilters} uniqueCities={uniqueCities} cleanCityName={cleanCityName} loading={loading} onSync={handleSync}
      onSelectPersona={(p) => { setSelectedPersona(p); setAmount(p.outstandingBalance > 0 ? Math.round(p.outstandingBalance).toString() : ''); }}
    />
  );
};

export default MobileCobros;
