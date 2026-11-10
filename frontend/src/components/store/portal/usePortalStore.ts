import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../../utils/api';
import {
  type CartItem,
  type ClientProfile,
  type PortalTab,
  type StoreProduct,
  filterAndSortStoreProducts
} from './portal.types';

interface UsePortalStoreParams {
  client: ClientProfile | null;
  expireSession: () => void;
}

export function usePortalStore({ client, expireSession }: UsePortalStoreParams) {
  const [activeTab, setActiveTab] = useState<PortalTab>('catalog');
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [rubros, setRubros] = useState<any[]>([]);
  const [commercialGroups, setCommercialGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedRubroId, setSelectedRubroId] = useState<number | null>(null);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [accountData, setAccountData] = useState<any>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);

  const fetchCatalog = async (priceList: string) => {
    setIsLoadingCatalog(true);
    try {
      const res = await fetch(`${API_BASE_URL}/store/catalog?priceList=${encodeURIComponent(priceList)}`);
      const json = await res.json();
      if (json.status === 'success') {
        setProducts(json.data.products || []);
        setRubros(json.data.rubros || []);
        setCommercialGroups(json.data.commercialGroups || []);
      } else {
        console.error('Error del catálogo:', json.message);
      }
    } catch (e) {
      console.error('Error al cargar catálogo:', e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const fetchAccountData = async (personaId: number) => {
    setIsLoadingAccount(true);
    try {
      const [accRes, ordRes] = await Promise.all([
        fetch(`${API_BASE_URL}/store/account/${personaId}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/store/orders/${personaId}`, { credentials: 'include' })
      ]);

      if (accRes.status === 401 || ordRes.status === 401) {
        expireSession();
        return;
      }

      const accJson = await accRes.json();
      const ordJson = await ordRes.json();

      if (accJson.status === 'success') {
        setAccountData(accJson.data);
      }
      if (ordJson.status === 'success') {
        setRecentOrders(ordJson.data.orders || []);
      }
    } catch (e) {
      console.error('Error al cargar datos de cuenta:', e);
    } finally {
      setIsLoadingAccount(false);
    }
  };

  useEffect(() => {
    if (client) {
      fetchCatalog(client.priceList || 'A');
      fetchAccountData(client.id);
    }
  }, [client]);

  const filteredProducts = useMemo(
    () => filterAndSortStoreProducts(products, selectedGroupId, selectedRubroId, onlyOffers, searchQuery),
    [products, selectedGroupId, selectedRubroId, onlyOffers, searchQuery]
  );

  const addToCart = (product: StoreProduct, qty?: number) => {
    const minQty = product.minOrderQuantity || 1;
    const addedQty = qty !== undefined ? qty : minQty;
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + addedQty
        };
        return updated;
      }
      return [...prev, { product, quantity: addedQty, unitPrice: product.price }];
    });
  };

  const updateCartQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item)));
    }
  };

  const cartTotalFinal = useMemo(
    () => cart.reduce((sum, item) => sum + Math.round(item.unitPrice * item.quantity), 0),
    [cart]
  );
  const cartTotalNeto = Math.round((cartTotalFinal / 1.21) * 100) / 100;
  const cartTotalIva = Math.round((cartTotalFinal - cartTotalNeto) * 100) / 100;
  const cartTotalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmitOrder = async () => {
    if (!client || cart.length === 0) return;

    setIsSubmittingOrder(true);
    try {
      const res = await fetch(`${API_BASE_URL}/store/orders`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personaId: client.id,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            isEmergencyOverride: Boolean(
              item.isEmergencyOverride || item.quantity < (item.product.minOrderQuantity || 1)
            )
          })),
          notes: orderNotes
        })
      });

      if (res.status === 401) {
        expireSession();
        return;
      }

      const json = await res.json();
      if (json.status === 'success') {
        setOrderSuccessMessage('¡Tu pedido fue recibido con éxito! Un vendedor procesará tu orden.');
        setCart([]);
        setOrderNotes('');
        setIsCartOpen(false);
        fetchAccountData(client.id);
        setActiveTab('orders');
      } else {
        alert(json.message || 'Ocurrió un error al enviar el pedido.');
      }
    } catch {
      alert('Error de conexión al enviar el pedido.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleRepeatOrder = (pastOrder: any) => {
    if (!pastOrder.items || pastOrder.items.length === 0) return;
    pastOrder.items.forEach((item: any) => {
      const matchedProd = products.find((p) => p.id === item.productId);
      if (matchedProd) {
        addToCart(matchedProd, item.quantity);
      }
    });
    setIsCartOpen(true);
  };

  const handleMagicDraftLoaded = (storeProducts: StoreProduct[], draftItems: CartItem[]) => {
    setProducts(storeProducts);
    if (draftItems.length > 0) {
      setCart(draftItems);
      setIsCartOpen(true);
    }
  };

  return {
    activeTab, setActiveTab,
    products, rubros, commercialGroups,
    selectedGroupId, setSelectedGroupId,
    setSelectedRubroId,
    onlyOffers, setOnlyOffers,
    searchQuery, setSearchQuery,
    isLoadingCatalog,
    imageErrors, setImageErrors,
    cart, setCart,
    isCartOpen, setIsCartOpen,
    orderNotes, setOrderNotes,
    isSubmittingOrder,
    orderSuccessMessage, setOrderSuccessMessage,
    recentOrders, accountData, isLoadingAccount,
    filteredProducts,
    addToCart, updateCartQuantity,
    cartTotalFinal, cartTotalNeto, cartTotalIva, cartTotalItemsCount,
    handleSubmitOrder, handleRepeatOrder, handleMagicDraftLoaded
  };
}
