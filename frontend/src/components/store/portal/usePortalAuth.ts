import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../../utils/api';
import type {
  CartItem,
  ClientProfile,
  PendingClientInfo,
  PortalTab,
  StoreProduct
} from './portal.types';

interface UsePortalAuthCallbacks {
  onTargetTab: (tab: PortalTab) => void;
  onMagicDraftLoaded: (products: StoreProduct[], draftItems: CartItem[]) => void;
  onClearCart: () => void;
}

export function usePortalAuth({
  onTargetTab,
  onMagicDraftLoaded,
  onClearCart
}: UsePortalAuthCallbacks) {
  const [client, setClient] = useState<ClientProfile | null>(() => {
    const saved = localStorage.getItem('store_client_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [loginSearch, setLoginSearch] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [pendingClient, setPendingClient] = useState<PendingClientInfo | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);
  const [magicBanner, setMagicBanner] = useState<string | null>(null);

  const handleMagicLogin = async (token: string, draftId?: string | null, targetTab?: string | null) => {
    setIsLoggingIn(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/store/magic-login?token=${encodeURIComponent(token)}${draftId ? `&draftId=${draftId}` : ''}`
      );
      const json = await res.json();

      if (json.status === 'success' && json.data?.client) {
        const loggedClient = json.data.client;
        setClient(loggedClient);
        localStorage.setItem('store_client_session', JSON.stringify(loggedClient));
        if (json.data?.token) {
          localStorage.setItem('store_token', json.data.token);
        }

        if (targetTab === 'account') {
          onTargetTab('account');
        }

        if (json.data?.draft && json.data.draft.items && json.data.draft.items.length > 0) {
          const draftItems = json.data.draft.items;
          const catalogRes = await fetch(`${API_BASE_URL}/store/catalog?priceList=${loggedClient.priceList || 'A'}`);
          const catalogJson = await catalogRes.json();
          const storeProducts: StoreProduct[] = catalogJson.data?.products || [];

          const newCartItems: CartItem[] = [];
          for (const dItem of draftItems) {
            const matchedProd = storeProducts.find((p) => p.id === dItem.productId || p.sku === dItem.sku);
            if (matchedProd) {
              newCartItems.push({
                product: matchedProd,
                quantity: dItem.quantity,
                unitPrice: dItem.unitPrice || matchedProd.price
              });
            }
          }

          onMagicDraftLoaded(storeProducts, newCartItems);
          if (newCartItems.length > 0) {
            setMagicBanner(
              `🛒 ¡Hola ${loggedClient.name}! Precargamos en tu carrito tu pedido de WhatsApp ($${json.data.draft.totalEstimated?.toLocaleString('es-AR')}). Revisalo y confirmalo en 1 clic.`
            );
          } else {
            setMagicBanner(`✨ ¡Bienvenido/a ${loggedClient.name}! Accediste a tu Tienda B2B por WhatsApp.`);
          }
        } else {
          setMagicBanner(`✨ ¡Bienvenido/a ${loggedClient.name}! Accediste sin clave a tu Tienda B2B.`);
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setLoginError(json.message || 'El enlace de acceso por WhatsApp no es válido o ha expirado.');
      }
    } catch (e) {
      console.error('Error al procesar inicio de sesión por enlace mágico:', e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const magicToken = urlParams.get('token') || urlParams.get('magicToken');
    const draftId = urlParams.get('draftId');
    const targetTab = urlParams.get('tab');

    if (magicToken) {
      handleMagicLogin(magicToken, draftId, targetTab);
    }
  }, []);

  const handleSelectClient = (selected: any, token?: string) => {
    if (token) {
      setClient(selected);
      localStorage.setItem('store_client_session', JSON.stringify(selected));
      localStorage.setItem('store_token', token);
    } else {
      setPendingClient(selected);
      setPinMessage(
        selected.hasPin
          ? 'Ingresá tu PIN secreto para ingresar a la tienda.'
          : 'Es tu primer ingreso. Creá un PIN secreto de 4 dígitos para proteger tu cuenta.'
      );
      setHasPin(Boolean(selected.hasPin));
      setPinInput('');
    }
  };

  const fetchAvailableClients = async (term: string) => {
    if (!term.trim()) {
      setLoginError('Por favor ingresá tu CUIT o el Nombre de tu comercio.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
    setAvailableClients([]);
    setPendingClient(null);
    setPinInput('');

    try {
      const res = await fetch(`${API_BASE_URL}/store/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: term.trim() })
      });
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        if (json.data.client) {
          handleSelectClient(json.data.client, json.data.token);
        } else if (json.data.clients && json.data.clients.length > 0) {
          setAvailableClients(json.data.clients);
        } else {
          setLoginError('No se encontró ningún comercio activo con los datos ingresados.');
        }
      } else if (json.status === 'requires_pin') {
        setPendingClient(json.client);
        setPinMessage(json.message);
        setHasPin(json.hasPin);
      } else {
        setLoginError(json.message || 'No se encontró el cliente.');
      }
    } catch {
      setLoginError('Error al conectar con el servidor.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingClient) return;

    if (!pinInput.trim()) {
      setLoginError('Por favor ingresá tu PIN numérico.');
      return;
    }
    if (pinInput.trim().length < 4) {
      setLoginError('El PIN debe tener al menos 4 dígitos.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/store/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: pendingClient.id,
          pin: pinInput.trim()
        })
      });
      const json = await res.json();
      if (json.status === 'success' && json.data?.client) {
        handleSelectClient(json.data.client, json.data.token);
      } else {
        setLoginError(json.message || 'Error al validar el PIN.');
      }
    } catch {
      setLoginError('Error al conectar con el servidor.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogoutClient = () => {
    setClient(null);
    setPendingClient(null);
    setPinInput('');
    setLoginSearch('');
    setAvailableClients([]);
    setLoginError(null);
    localStorage.removeItem('store_client_session');
    localStorage.removeItem('store_token');
    onClearCart();
  };

  const expireSession = () => {
    handleLogoutClient();
    setLoginError('Tu sesión en la tienda expiró. Por favor ingresá nuevamente tu PIN.');
  };

  return {
    client,
    loginSearch, setLoginSearch,
    isLoggingIn,
    loginError, setLoginError,
    availableClients,
    pendingClient, setPendingClient,
    pinInput, setPinInput,
    pinMessage,
    hasPin,
    logoFailed, setLogoFailed,
    magicBanner, setMagicBanner,
    fetchAvailableClients,
    handleSelectClient,
    handlePinSubmit,
    handleLogoutClient,
    expireSession
  };
}
