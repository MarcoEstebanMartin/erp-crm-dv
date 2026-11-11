import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../../utils/api';

export interface ModalBannerState {
  tone: 'success' | 'warning' | 'error';
  text: string;
  existingClientId?: number;
}

interface UseClientModalControllerParams {
  clientModal: any;
  setClientModal: (val: any) => void;
  fetchData: () => void;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
  setClientsVersion: React.Dispatch<React.SetStateAction<number>>;
}

export function useClientModalController({
  clientModal,
  setClientModal,
  fetchData,
  setSuccessMsg,
  setErrorMsg,
  setClientsVersion,
}: UseClientModalControllerParams) {
  const [isSearchingAfip, setIsSearchingAfip] = useState(false);
  const [modalBanner, setModalBanner] = useState<ModalBannerState | null>(null);
  const inFlightLookupRef = useRef(false);
  const lastLookedUpDigitsRef = useRef<string>('');
  const cuitInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const isOpen = Boolean(clientModal && clientModal.open);

  useEffect(() => {
    if (isOpen) {
      setModalBanner(null);
      lastLookedUpDigitsRef.current = '';
      if (clientModal?.mode === 'create') {
        setTimeout(() => cuitInputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, clientModal?.mode]);

  const updateData = (patch: Record<string, any>) => {
    setClientModal((prev: any) => ({
      ...prev,
      data: { ...prev.data, ...patch },
    }));
  };

  const handleSwitchToExistingClient = async (existingId: number) => {
    try {
      const personas = await api.getPersonas('ALL', '');
      const fullExisting = personas.find((p: any) => Number(p.id) === Number(existingId));
      if (fullExisting) {
        setModalBanner(null);
        setClientModal({ open: true, mode: 'edit', data: { ...fullExisting } });
      }
    } catch {
      setModalBanner({ tone: 'error', text: 'No se pudo abrir la ficha existente.' });
    }
  };

  const handleFetchAfipData = async () => {
    if (inFlightLookupRef.current || !clientModal?.data) return;
    const cuitClean = (clientModal.data.cuit || '').replace(/\D/g, '');
    if (cuitClean.length < 7 || (cuitClean.length > 8 && cuitClean.length !== 11)) {
      setModalBanner({
        tone: 'error',
        text: 'Ingresá un DNI válido (7 u 8 números) o un CUIT completo (11 números).',
      });
      return;
    }

    inFlightLookupRef.current = true;
    lastLookedUpDigitsRef.current = cuitClean;
    setIsSearchingAfip(true);
    setModalBanner(null);

    try {
      const afipData = await api.getPersonaFromAFIP(cuitClean);
      if (!afipData || afipData.found === false) {
        setModalBanner({
          tone: 'warning',
          text: afipData?.message || 'No se encontraron registros públicos para ese DNI/CUIT. Completá el nombre manualmente.',
        });
        return;
      }

      setClientModal((prev: any) => {
        const prevCuitDigits = (prev.data.cuit || '').replace(/\D/g, '');
        const resolvedDigits = (afipData.cuit || '').replace(/\D/g, '');
        const switchedPerson = Boolean(resolvedDigits && prevCuitDigits && resolvedDigits !== prevCuitDigits);
        const nextAddress = afipData.address
          ? afipData.address
          : prev.mode === 'create' || switchedPerson
            ? ''
            : prev.data.address;
        const nextCity = afipData.location
          ? afipData.location
          : prev.mode === 'create' || switchedPerson
            ? ''
            : prev.data.city;

        return {
          ...prev,
          data: {
            ...prev.data,
            cuit: afipData.cuit || prev.data.cuit,
            name: afipData.name || prev.data.name,
            address: nextAddress,
            city: nextCity,
          },
        };
      });

      if (afipData.alreadyRegistered && clientModal.mode === 'create' && afipData.existingPersona) {
        setModalBanner({
          tone: 'warning',
          text: `⚠️ Este CUIT ya está registrado en tu padrón como "${afipData.existingPersona.name}".`,
          existingClientId: afipData.existingPersona.id,
        });
      } else {
        const hasAddress = Boolean(afipData.address);
        setModalBanner({
          tone: 'success',
          text: `✓ ${afipData.name}`,
        });
        if (!hasAddress) {
          setTimeout(() => addressInputRef.current?.focus(), 60);
        }
      }
    } catch (err: any) {
      setModalBanner({ tone: 'error', text: err?.message || 'No se pudieron consultar los datos fiscales.' });
    } finally {
      inFlightLookupRef.current = false;
      setIsSearchingAfip(false);
    }
  };

  const handleBlurCuitInput = () => {
    const clean = (clientModal?.data?.cuit || '').replace(/\D/g, '');
    const isValidLen = clean.length === 7 || clean.length === 8 || clean.length === 11;
    if (isValidLen && !clientModal?.data?.name && clean !== lastLookedUpDigitsRef.current) {
      handleFetchAfipData();
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { mode, data } = clientModal;
    if (!data.name || !data.name.trim()) {
      setModalBanner({ tone: 'error', text: 'El Nombre Comercial / Razón Social es obligatorio.' });
      return;
    }

    try {
      const payload = {
        name: data.name.trim(),
        cuit: data.cuit ? data.cuit.replace(/\D/g, '') || data.cuit : '',
        address: data.address,
        city: data.city,
        barrio: data.barrio,
        phone: data.phone,
        email: data.email,
        webPin: data.webPin !== undefined ? data.webPin : undefined,
        route: data.route,
        saleRouteId: data.saleRouteId ? Number(data.saleRouteId) : null,
        creditLimit: Number(data.creditLimit || 0),
        maxUnpaidInvoices: Number(data.maxUnpaidInvoices || 0),
        priceList: data.priceList || 'A',
        discount: Number(data.discount || 0),
        isClient: Boolean(data.isClient),
        isProvider: Boolean(data.isProvider),
        isSeller: Boolean(data.isSeller),
        isCommissionAgent: Boolean(data.isCommissionAgent),
        sellerId: data.sellerId ? Number(data.sellerId) : null,
        isActive: data.isActive !== false,
      };

      if (mode === 'create') await api.createPersona(payload);
      else await api.updatePersona(data.id, payload);

      setClientModal({ ...clientModal, open: false });
      setSuccessMsg('Persona guardada exitosamente.');
      fetchData();
      setClientsVersion((prev) => prev + 1);
    } catch (err: any) {
      const msg = err?.message || 'Error al guardar persona.';
      setModalBanner({ tone: 'error', text: msg });
      setErrorMsg(msg);
    }
  };

  return {
    isOpen,
    isSearchingAfip,
    modalBanner,
    cuitInputRef,
    addressInputRef,
    updateData,
    handleSwitchToExistingClient,
    handleFetchAfipData,
    handleBlurCuitInput,
    handleClientSubmit,
  };
}
