import { useState, useEffect, useCallback } from 'react';
import ExcelSpatialMapModal from './ExcelSpatialMapModal';
import SimpleStockLoadModal from './SimpleStockLoadModal';
import { api } from '../utils/api';
import { OrderStatus } from '../utils/types';
import type { Order, Product, ProductLot } from '../types';
import { Play, Check, RefreshCw, Eye, Warehouse, ClipboardList, Calendar, ShoppingCart, Map, Printer } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';

interface DepositoDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Reproducción de sonido de éxito/error usando Web Audio API
const playBeep = (type: 'success' | 'error') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Sonido agudo (La 5)
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime); // Sonido grave (La 3)
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.error('Audio context error:', e);
  }
};

export default function DepositoDashboard({ activeTab }: DepositoDashboardProps) {
  const confirm = useConfirm();
  const normalizedTab = activeTab === 'deposito' ? 'prepare-orders' : 'stock-adjust';
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  // Modal de ajuste de stock
  const [stockModal, setStockModal] = useState({
    open: false,
    product: null as Product | null,
    quantityChange: 0,
    reason: '',
    lotNumber: '',
    isNewLot: false,
    expirationDate: '',
    location: ''
  });
  
  // Asignaciones de lote para el pedido en picking
  // Formato: { [orderItemId: number]: { [lotId: number]: number } }
  const [lotAssignments, setLotAssignments] = useState<{ [orderItemId: number]: { [lotId: number]: number } }>({});
  
  // Ubicaciones de estantería confirmadas físicamente para este picking
  // Formato: { [lotId: number]: boolean }
  const [confirmedLocations, setConfirmedLocations] = useState<{ [lotId: number]: boolean }>({});

  // Limpiar ubicaciones confirmadas y asignaciones cuando cambia el pedido activo
  useEffect(() => {
    setConfirmedLocations({});
    setLotAssignments({});
  }, [selectedOrder]);

  // Pesos exactos para productos pesables
  const [pesableWeights, setPesableWeights] = useState<{ [orderItemId: number]: number }>({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiringLots, setExpiringLots] = useState<ProductLot[]>([]);
  
  // WMS Picking States
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [showBultoModal, setShowBultoModal] = useState(false);
  const [bultosData, setBultosData] = useState({
    frio: 0,
    secos: 0,
    tabla: 0,
    cajasCerradas: 0
  });
  const [labelsToPrint, setLabelsToPrint] = useState<any[]>([]);

  // --- NUEVOS ESTADOS PARA SELECCIÓN MÚLTIPLE Y FILTROS DE PICKING ---
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [routeFilter, setRouteFilter] = useState<string>('ALL');
  const [withdrawalFilter, setWithdrawalFilter] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedOrderIds, setSelectedOrderIds] = useState<{ [orderId: number]: boolean }>({});
  const [showConsolidatedView, setShowConsolidatedView] = useState<boolean>(false);
  const [consolidatedCheckedItems, setConsolidatedCheckedItems] = useState<{ [productId: number]: boolean }>({});
  const [consolidatedZone, setConsolidatedZone] = useState<string>('ALL');

  // --- SUB-PESTAÑAS DE DEPÓSITO Y ESTADOS WMS / REABASTECIMIENTO ---
  const [subTab, setSubTab] = useState<string>('picking');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('D1');
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isSimpleStockModalOpen, setIsSimpleStockModalOpen] = useState(false);
  
  // Estado del Editor Visual de Mapa y Sectores
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeBrush, setActiveBrush] = useState<string>('ESTANTERIA');
  const [chamberMap, setChamberMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('wms_custom_chamber_map_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [slotTypeMap, setSlotTypeMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('wms_custom_slottype_map_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedMapLocation, setSelectedMapLocation] = useState<string>('');
  const [allProducts, setAllProducts] = useState<any[]>([]); // Todos los productos para WMS y Reabastecimiento
  const [pendingPurchaseOrders, setPendingPurchaseOrders] = useState<any[]>([]);
  const [generatingPOForProvider, setGeneratingPOForProvider] = useState<number | null>(null);

  // Estandarización de ubicaciones físicas
    const LOCATION_MAP: Record<string, { label: string; icon: string; color: string; bg: string; description: string }> = {
    'D1-CAM2-R01-A': { label: 'D1-CAM2-R01-A - Quesos Tybo / Barra', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (A (Piso)): Rack Negro Pared Izquierda (Picking)' },
    'D1-CAM2-R01-B': { label: 'D1-CAM2-R01-B - Quesos Reserva / Pulmón', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (B (Viga 1)): Rack Negro Pared Izquierda (Pulmón)' },
    'D1-CAM2-R02-A': { label: 'D1-CAM2-R02-A - Mozzarella / Gouda', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (A (Piso)): Rack Negro Pared Izquierda (Picking)' },
    'D1-CAM2-R02-B': { label: 'D1-CAM2-R02-B - Mozzarella Reserva', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (B (Viga 1)): Rack Negro Pared Izquierda (Pulmón)' },
    'D1-CAM2-P01': { label: 'D1-CAM2-P01 - Pallet Queso Melincué Barra', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet (Piso): Pasillo Central Slot 1' },
    'D1-CAM2-P02': { label: 'D1-CAM2-P02 - Pallet Queso Melincué Tybo', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet (Piso): Pasillo Central Slot 2' },
    'D1-CAM2-P03': { label: 'D1-CAM2-P03 - Pallet Queso Cremoso Remotti', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet (Piso): Pasillo Central Slot 3' },
    'D1-CAM2-P04': { label: 'D1-CAM2-P04 - Pallet Fiambres / Embutidos', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet (Piso): Pasillo Central Slot 4' },
    'D1-CAM2-P05': { label: 'D1-CAM2-P05 - Pallet Queso Sardo / Bloque', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet (Piso): Fondo Cámara Slot 5' },
    'D1-CAM2-P06': { label: 'D1-CAM2-P06 - Pallet Por Salut / Fresco', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet (Piso): Fondo Cámara Slot 6' },
    'D1-CAM2-R03-A': { label: 'D1-CAM2-R03-A - Salames / Jamones / Fiambres', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (A (Piso)): Rack Negro Pared Derecha (Picking)' },
    'D1-CAM2-R03-B': { label: 'D1-CAM2-R03-B - Fiambres Reserva / Cajas', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (B (Viga 1)): Rack Negro Pared Derecha (Pulmón)' },
    'D1-CAM2-R04-A': { label: 'D1-CAM2-R04-A - Cremas / Mantecas / Lácteos', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (A (Piso)): Rack Negro Pared Derecha (Picking)' },
    'D1-CAM2-R04-B': { label: 'D1-CAM2-R04-B - Mantecas / Cremas Reserva', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (B (Viga 1)): Rack Negro Pared Derecha (Pulmón)' },
    'D1-CAM1-EST-N1': { label: 'D1-CAM1-EST-N1 - Queso Por Salut / Azul Potes', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería 5 Niveles (N1 (Piso)): Estantería Roja Nivel 1 (Inferior)' },
    'D1-CAM1-EST-N2': { label: 'D1-CAM1-EST-N2 - Quesos Fraccionados / Potes', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería 5 Niveles (N2): Estantería Roja Nivel 2' },
    'D1-CAM1-EST-N3': { label: 'D1-CAM1-EST-N3 - Yogures Potes / Cremas', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería 5 Niveles (N3): Estantería Roja Nivel 3' },
    'D1-CAM1-EST-N4': { label: 'D1-CAM1-EST-N4 - Postres / Sodecar Fraccionados', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería 5 Niveles (N4): Estantería Roja Nivel 4' },
    'D1-CAM1-EST-N5': { label: 'D1-CAM1-EST-N5 - Reposición Potes / Cajas', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería 5 Niveles (N5 (Superior)): Estantería Roja Nivel 5 (Superior)' },
    'D1-CAM1-P01': { label: 'D1-CAM1-P01 - Pallet Mozzarella Cremigal', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Slot Piso Pallet (Piso): Piso Frente Estantería 1' },
    'D1-CAM1-P02': { label: 'D1-CAM1-P02 - Pallet Queso Por Salut Melincu', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Slot Piso Pallet (Piso): Piso Frente Estantería 2' },
    'D1-CAM1-P03': { label: 'D1-CAM1-P03 - Pallet Sodecar / Embutidos', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Slot Piso Pallet (Piso): Piso Lateral 3' },
    'D1-CAM1-P04': { label: 'D1-CAM1-P04 - Pallet Stock Reserva Frío', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Slot Piso Pallet (Piso): Piso Lateral 4' },
    'D1-CAM3-R01-A': { label: 'D1-CAM3-R01-A - Conservas Cumaná / Puré Tomate', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Cámara 3 Seco - Rack Seco 2 Niveles (A (Piso)): Rack Seco Nivel A (Picking)' },
    'D1-CAM3-R01-B': { label: 'D1-CAM3-R01-B - Cumaná Reserva / Cajas', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Cámara 3 Seco - Rack Seco 2 Niveles (B (Viga 1)): Rack Seco Nivel B (Pulmón)' },
    'D1-CAM3-EST-N1': { label: 'D1-CAM3-EST-N1 - Aceites Fraccionados', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Cámara 3 Seco - Estantería Metálica (N1 (Piso)): Estantería Secos Nivel 1' },
    'D1-CAM3-EST-N2': { label: 'D1-CAM3-EST-N2 - Fraccionado Seco Pequeño', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Cámara 3 Seco - Estantería Metálica (N2): Estantería Secos Nivel 2' },
    'D1-CAM3-EST-N3': { label: 'D1-CAM3-EST-N3 - Galletitas / Especies', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Cámara 3 Seco - Estantería Metálica (N3): Estantería Secos Nivel 3' },
    'D1-CAM3-P01': { label: 'D1-CAM3-P01 - Pallet Conservas Cumaná', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Cámara 3 Seco - Slot Piso Pallet (Piso): Slot Piso Central 1' },
    'D1-CAM3-P02': { label: 'D1-CAM3-P02 - Pallet Aceites Secos', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Cámara 3 Seco - Slot Piso Pallet (Piso): Slot Piso Central 2' },
    'D1-RACK1-M01-A': { label: 'D1-RACK1-M01-A - Bebidas / Aperitivos Rotación', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (A (Piso)): Módulo 1 Piso (Picking)' },
    'D1-RACK1-M01-B': { label: 'D1-RACK1-M01-B - Bebidas Pulmón Nivel 1', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (B (Medio)): Módulo 1 Medio (Pulmón)' },
    'D1-RACK1-M01-C': { label: 'D1-RACK1-M01-C - Bebidas Pulmón Nivel 2', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (C (Alto)): Módulo 1 Alto (Pulmón)' },
    'D1-RACK1-M02-A': { label: 'D1-RACK1-M02-A - Aperitivos Sernova / Gordon\'s', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (A (Piso)): Módulo 2 Piso (Picking)' },
    'D1-RACK1-M02-B': { label: 'D1-RACK1-M02-B - Aperitivos Pulmón Nivel 1', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (B (Medio)): Módulo 2 Medio (Pulmón)' },
    'D1-RACK1-M02-C': { label: 'D1-RACK1-M02-C - Aperitivos Pulmón Nivel 2', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (C (Alto)): Módulo 2 Alto (Pulmón)' },
    'D1-RACK1-M03-A': { label: 'D1-RACK1-M03-A - Vinos / Espumantes', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (A (Piso)): Módulo 3 Piso (Picking)' },
    'D1-RACK1-M03-B': { label: 'D1-RACK1-M03-B - Vinos Pulmón Nivel 1', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (B (Medio)): Módulo 3 Medio (Pulmón)' },
    'D1-RACK1-M03-C': { label: 'D1-RACK1-M03-C - Vinos Pulmón Nivel 2', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (C (Alto)): Módulo 3 Alto (Pulmón)' },
    'D1-RACK1-M04-A': { label: 'D1-RACK1-M04-A - Sidras / Jugos', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (A (Piso)): Módulo 4 Piso (Picking)' },
    'D1-RACK1-M04-B': { label: 'D1-RACK1-M04-B - Jugos / Sidras Pulmón Nivel 1', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (B (Medio)): Módulo 4 Medio (Pulmón)' },
    'D1-RACK1-M04-C': { label: 'D1-RACK1-M04-C - Jugos / Sidras Pulmón Nivel 2', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Rack Heavy Duty 3 Niv (C (Alto)): Módulo 4 Alto (Pulmón)' },
    'D1-EST-LIC-N1': { label: 'D1-EST-LIC-N1 - Botellas Aperitivos Alta Rotac', icon: '🍾', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.08)', description: 'Estantería Licores - Estantería 3 Niveles (N1 (Piso)): Nivel 1 Piso' },
    'D1-EST-LIC-N2': { label: 'D1-EST-LIC-N2 - Licores / Fernet / Aperitivos', icon: '🍾', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.08)', description: 'Estantería Licores - Estantería 3 Niveles (N2 (Medio)): Nivel 2 Medio' },
    'D1-EST-LIC-N3': { label: 'D1-EST-LIC-N3 - Botellas Sueltas / Packs Espec', icon: '🍾', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.08)', description: 'Estantería Licores - Estantería 3 Niveles (N3 (Alto)): Nivel 3 Alto' },
    'D2-RACK-AZUL-M01-A': { label: 'D2-RACK-AZUL-M01-A - Cajas Cumaná / Puré / Tomate', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Rack Estructural 3 Niv (A (Piso)): Módulo 1 Piso (Picking)' },
    'D2-RACK-AZUL-M01-B': { label: 'D2-RACK-AZUL-M01-B - Cumaná Reserva', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Rack Estructural 3 Niv (B (Medio)): Módulo 1 Medio (Pulmón)' },
    'D2-RACK-AZUL-M01-C': { label: 'D2-RACK-AZUL-M01-C - Cumaná Reserva Masiva', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Rack Estructural 3 Niv (C (Alto)): Módulo 1 Alto (Pulmón)' },
    'D2-RACK-AZUL-M02-A': { label: 'D2-RACK-AZUL-M02-A - Latas Durazno / Ensaladas', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Rack Estructural 3 Niv (A (Piso)): Módulo 2 Piso (Picking)' },
    'D2-RACK-AZUL-M02-B': { label: 'D2-RACK-AZUL-M02-B - Latas Reserva', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Rack Estructural 3 Niv (B (Medio)): Módulo 2 Medio (Pulmón)' },
    'D2-RACK-AZUL-M02-C': { label: 'D2-RACK-AZUL-M02-C - Latas Reserva Masiva', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Rack Estructural 3 Niv (C (Alto)): Módulo 2 Alto (Pulmón)' },
    'D2-RACK-AZUL-M03-A': { label: 'D2-RACK-AZUL-M03-A - Legumbres / Arroz / Harinas', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Rack Estructural 3 Niv (A (Piso)): Módulo 3 Piso (Picking)' },
    'D2-RACK-AZUL-M03-B': { label: 'D2-RACK-AZUL-M03-B - Harinas / Arroz Reserva', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Rack Estructural 3 Niv (B (Medio)): Módulo 3 Medio (Pulmón)' },
    'D2-RACK-AZUL-M03-C': { label: 'D2-RACK-AZUL-M03-C - Harinas Reserva Masiva', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Rack Estructural 3 Niv (C (Alto)): Módulo 3 Alto (Pulmón)' },
    'D2-PISO-FID-01': { label: 'D2-PISO-FID-01 - Pallet Fideos 308 Tallarín', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Fideos 308 - Slot Piso Pallet (Piso): Slot Fideos 1' },
    'D2-PISO-FID-02': { label: 'D2-PISO-FID-02 - Pallet Fideos 308 Guisero', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Fideos 308 - Slot Piso Pallet (Piso): Slot Fideos 2' },
    'D2-PISO-FID-03': { label: 'D2-PISO-FID-03 - Pallet Fideos 308 Moñito', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Fideos 308 - Slot Piso Pallet (Piso): Slot Fideos 3' },
    'D2-PISO-FID-04': { label: 'D2-PISO-FID-04 - Pallet Fideos 308 Nido / Espec', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Fideos 308 - Slot Piso Pallet (Piso): Slot Fideos 4' },
    'D2-PISO-FID-05': { label: 'D2-PISO-FID-05 - Pallet Fideos 308 Reserva 1', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Fideos 308 - Slot Piso Pallet (Piso): Slot Fideos Reserva 5' },
    'D2-PISO-FID-06': { label: 'D2-PISO-FID-06 - Pallet Fideos 308 Reserva 2', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Fideos 308 - Slot Piso Pallet (Piso): Slot Fideos Reserva 6' },
    'D2-PISO-ACE-01': { label: 'D2-PISO-ACE-01 - Pallet Aceite Natura 900ml', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Aceites - Slot Piso Pallet (Piso): Slot Aceites 1' },
    'D2-PISO-ACE-02': { label: 'D2-PISO-ACE-02 - Pallet Aceite Natura 1.5L', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Aceites - Slot Piso Pallet (Piso): Slot Aceites 2' },
    'D2-PISO-ACE-03': { label: 'D2-PISO-ACE-03 - Pallet Aceite Cañuelas / Cada ', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Aceites - Slot Piso Pallet (Piso): Slot Aceites 3' },
    'D2-PISO-ACE-04': { label: 'D2-PISO-ACE-04 - Pallet Aceite Mezcla / Girasol', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Aceites - Slot Piso Pallet (Piso): Slot Aceites 4' },
    'D2-PISO-ACE-05': { label: 'D2-PISO-ACE-05 - Pallet Aceite Natura Reserva 1', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Aceites - Slot Piso Pallet (Piso): Slot Aceites Reserva 5' },
    'D2-PISO-ACE-06': { label: 'D2-PISO-ACE-06 - Pallet Aceite Natura Reserva 2', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Aceites - Slot Piso Pallet (Piso): Slot Aceites Reserva 6' },
    'D3-PISO-UAT-01': { label: 'D3-PISO-UAT-01 - Pallet Leche UAT Cremigal Ente', icon: '🥛', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Leches UAT - Slot Piso Pallet (Piso): Slot Leches UAT 1' },
    'D3-PISO-UAT-02': { label: 'D3-PISO-UAT-02 - Pallet Leche UAT Cremigal Desc', icon: '🥛', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Leches UAT - Slot Piso Pallet (Piso): Slot Leches UAT 2' },
    'D3-PISO-UAT-03': { label: 'D3-PISO-UAT-03 - Pallet Leche Chocolatada / Sac', icon: '🥛', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Leches UAT - Slot Piso Pallet (Piso): Slot Leches UAT 3' },
    'D3-PISO-UAT-04': { label: 'D3-PISO-UAT-04 - Pallet Leche UAT Reserva Masiv', icon: '🥛', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Leches UAT - Slot Piso Pallet (Piso): Slot Leches UAT Reserva 4' },
    'D3-PISO-PAPEL-01': { label: 'D3-PISO-PAPEL-01 - Pallet Papel Higiénico Felpita', icon: '📦', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Papelería - Slot Piso Pallet (Piso): Slot Papelería 1' },
    'D3-PISO-PAPEL-02': { label: 'D3-PISO-PAPEL-02 - Pallet Rollos Cocina RolMayor', icon: '📦', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Papelería - Slot Piso Pallet (Piso): Slot Papelería 2' },
    'D3-PISO-PAPEL-03': { label: 'D3-PISO-PAPEL-03 - Pallet Servilletas / Bobinas', icon: '📦', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Papelería - Slot Piso Pallet (Piso): Slot Papelería 3' },
    'D3-PISO-PAPEL-04': { label: 'D3-PISO-PAPEL-04 - Pallet Papelería Reserva', icon: '📦', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Papelería - Slot Piso Pallet (Piso): Slot Papelería Reserva 4' },
    'D3-RACK-FONDO-M01-A': { label: 'D3-RACK-FONDO-M01-A - Reserva Papelería / Fideos', icon: '📦', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Racks Fondo - Rack 2 Niveles (A (Piso)): Módulo 1 Piso' },
    'D3-RACK-FONDO-M01-B': { label: 'D3-RACK-FONDO-M01-B - Reserva Masiva Nivel 1', icon: '📦', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Racks Fondo - Rack 2 Niveles (B (Viga 1)): Módulo 1 Alto' },
    'D3-RACK-FONDO-M02-A': { label: 'D3-RACK-FONDO-M02-A - Reserva Envases / Rollos', icon: '📦', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Racks Fondo - Rack 2 Niveles (A (Piso)): Módulo 2 Piso' },
    'D3-RACK-FONDO-M02-B': { label: 'D3-RACK-FONDO-M02-B - Reserva Masiva Nivel 2', icon: '📦', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Racks Fondo - Rack 2 Niveles (B (Viga 1)): Módulo 2 Alto' },
    'S/U': { label: 'Sin Ubicación', icon: '📍', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Artículos sin ubicación física asignada' }
  };

  // Controlar las clases del body para impresión limpia
  useEffect(() => {
    const handleBeforePrint = () => {
      if (showConsolidatedView) {
        document.body.classList.add('printing-consolidated');
      } else if (labelsToPrint.length > 0) {
        document.body.classList.add('printing-labels');
      }
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-consolidated');
      document.body.classList.remove('printing-labels');
    };
    
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [showConsolidatedView, labelsToPrint]);

  const fetchData = useCallback(async () => {
    setErrorMsg(null);
    try {
      if (subTab === 'picking' || subTab === 'replenishment') {
        const data = await api.getOrders();
        const filtered = data.filter((o: any) => o.status === OrderStatus.PENDING || o.status === OrderStatus.PREPARING);
        setOrders(filtered);
      }

      if (subTab === 'picking' || subTab === 'lot-expiration') {
        try {
          const lotsRes = await api.getExpiringLots();
          setExpiringLots(lotsRes.lots || []);
        } catch (lotErr) {
          console.error('Error al obtener lotes vencidos:', lotErr);
        }
      }

      if (subTab === 'stock-list') {
        const data = await api.getProducts(debouncedSearchQuery);
        setProducts(data);
      }

      if (subTab === 'wms-map' || subTab === 'lot-expiration' || subTab === 'replenishment') {
        const allProds = await api.getProducts('');
        setAllProducts(allProds);
      }

      if (subTab === 'replenishment') {
        try {
          const pendingPurchs = await api.getPurchaseOrders({ status: 'PENDING' });
          setPendingPurchaseOrders(pendingPurchs || []);
        } catch (poErr) {
          console.error('Error al obtener órdenes de compra pendientes:', poErr);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
      setLoading(false);
    }
  }, [subTab, debouncedSearchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Limpiar mensajes y estados locales
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
    setSelectedOrderIds({});
    setShowConsolidatedView(false);
    setSelectedMapLocation('');
    
    // Si la pestaña principal cambia, ajustamos el subTab por defecto
    if (activeTab === 'products') {
      setSubTab('stock-list');
    } else {
      setSubTab('picking');
    }
  }, [activeTab]);

  // Auto-abrir modal de ajuste si se escanea/busca un SKU o código de barra exacto
  useEffect(() => {
    if (subTab === 'stock-list' && products.length === 1 && searchQuery.trim() !== '') {
      const match = products[0];
      const term = searchQuery.trim();
      if (match.barcode === term || match.sku === term) {
        setStockModal({
          open: true,
          product: match,
          quantityChange: 0,
          reason: 'Ajuste por escaneo rápido',
          lotNumber: '',
          isNewLot: false,
          expirationDate: '',
          location: ''
        });
        setSearchQuery('');
      }
    }
  }, [products, searchQuery, normalizedTab, subTab]);

  // --- LOGICA DE ESCANEO DE CODIGO DE BARRA / SKU (PICKING MANOS LIBRES) ---
  const processScannedCode = useCallback((code: string) => {
    if (!selectedOrder) return;

    const cleanCode = code.trim().toUpperCase();

    // 1. Verificar si el código corresponde a una ubicación de estantería de algún lote del pedido
    let foundLocationLotId: number | null = null;
    let foundLocationName = '';
    let foundProductName = '';
    
    for (const item of selectedOrder.items) {
      const productLots = item.product?.lots || [];
      const matchingLot = productLots.find((l: any) => l.location && l.location.trim().toUpperCase() === cleanCode);
      if (matchingLot) {
        foundLocationLotId = matchingLot.id;
        foundLocationName = matchingLot.location;
        foundProductName = item.product?.name || '';
        break;
      }
    }

    if (foundLocationLotId !== null) {
      setConfirmedLocations(prev => ({
        ...prev,
        [foundLocationLotId!]: true
      }));
      playBeep('success');
      setSuccessMsg(`Ubicación confirmada para "${foundProductName}": "${foundLocationName}"`);
      return;
    }

    // 2. Buscar coincidencia en productos del pedido
    const item = selectedOrder.items.find((i: any) => 
      i.product && (
        i.product.barcode === code || 
        i.product.sku === code || 
        i.product.name.toLowerCase() === code.toLowerCase()
      )
    );

    if (!item) {
      playBeep('error');
      setErrorMsg(`Producto o ubicación con código "${code}" no pertenece a este pedido.`);
      return;
    }

    const productLots = item.product?.lots || [];
    if (productLots.length === 0) {
      playBeep('error');
      setErrorMsg(`El producto "${item.product.name}" no tiene lotes registrados en depósito.`);
      return;
    }

    const itemAssignments = { ...(lotAssignments[item.id] || {}) };
    const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);

    if (assignedSum >= item.quantity) {
      playBeep('error');
      setErrorMsg(`La cantidad para "${item.product.name}" ya está completamente asignada.`);
      return;
    }

    // FIFO: Asignar al primer lote con stock disponible CUYA UBICACIÓN esté confirmada
    let assigned = false;
    for (const lot of productLots) {
      const currentLotQty = itemAssignments[lot.id] || 0;
      if (lot.stock > currentLotQty) {
        // Validar si requiere confirmación de ubicación física
        const needsConfirmation = lot.location && lot.location !== 'S/U';
        const isConfirmed = confirmedLocations[lot.id];
        
        if (needsConfirmation && !isConfirmed) {
          continue; // Saltar lote no confirmado físicamente
        }

        itemAssignments[lot.id] = currentLotQty + 1;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      playBeep('error');
      // Ver si saltamos lotes por no estar confirmados
      const unconfirmedLots = productLots.filter((l: any) => l.location && l.location !== 'S/U' && !confirmedLocations[l.id] && l.stock > (itemAssignments[l.id] || 0));
      if (unconfirmedLots.length > 0) {
        setErrorMsg(`Para preparar "${item.product.name}", primero debés confirmar la ubicación física: ${unconfirmedLots.map((l: any) => l.location).join(', ')}.`);
      } else {
        setErrorMsg(`No hay suficiente stock en los lotes de "${item.product.name}".`);
      }
      return;
    }

    setLotAssignments(prev => ({
      ...prev,
      [item.id]: itemAssignments
    }));

    playBeep('success');
    setSuccessMsg(`Escaneado: +1 u. de "${item.product.name}"`);
  }, [selectedOrder, lotAssignments, confirmedLocations]);

  useEffect(() => {
    if (!selectedOrder) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar entrada si está posicionado en algún input o select
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
      }

      const now = Date.now();
      // Si el tiempo de separación entre teclas supera los 150ms, consideramos que es un nuevo escaneo
      if (now - lastKeyTime > 150) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        const code = buffer.trim();
        if (code.length > 0) {
          processScannedCode(code);
        }
        buffer = '';
        e.preventDefault();
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder, lotAssignments, processScannedCode]);

  // Sincronizar lotAssignments al seleccionar o cambiar el pedido
  useEffect(() => {
    if (selectedOrder) {
      const initial: any = {};
      const initialWeights: any = {};
      
      selectedOrder.items.forEach((item: any) => {
        initial[item.id] = {};
        
        // Si el pedido ya tiene asignaciones registradas (ej: recarga), cargarlas
        if (item.orderItemLots && item.orderItemLots.length > 0) {
          item.orderItemLots.forEach((oil: any) => {
            initial[item.id][oil.productLotId] = oil.quantity;
          });
        }
        
        if (item.weight) {
          initialWeights[item.id] = Number(item.weight);
        }
      });
      setLotAssignments(initial);
      setPesableWeights(initialWeights);
      setSelectedZone('ALL');
    } else {
      setLotAssignments({});
      setPesableWeights({});
    }
  }, [selectedOrder]);

  // --- LOGICA DE PICKING ---
  const handleStartPicking = async (orderId: number) => {
    setErrorMsg(null);
    try {
      await api.updateOrderStatus(orderId, OrderStatus.PREPARING);
      setSuccessMsg(`Pedido #${orderId} en preparación.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar picking.');
    }
  };

  const handleLotQtyChange = (orderItemId: number, lotId: number, value: number, maxStock: number) => {
    const val = isNaN(value) || value < 0 ? 0 : value;
    const qty = val > maxStock ? maxStock : val;
    
    setLotAssignments(prev => ({
      ...prev,
      [orderItemId]: {
        ...(prev[orderItemId] || {}),
        [lotId]: qty
      }
    }));
  };

  const handleFIFOAutoFill = (item: any) => {
    const productLots = item.product?.lots || [];
    let remaining = item.quantity;
    const itemAssignments: { [lotId: number]: number } = {};

    // Asignar prioritariamente por fecha de vencimiento (los lotes ya vienen ordenados por vencimiento de menor a mayor)
    for (const lot of productLots) {
      if (remaining <= 0) break;
      const toTake = Math.min(lot.stock, remaining);
      if (toTake > 0) {
        itemAssignments[lot.id] = toTake;
        remaining -= toTake;
        
        // Auto-confirmar ubicación para los lotes seleccionados manualmente en pantalla
        if (lot.location && lot.location !== 'S/U') {
          setConfirmedLocations(prev => ({ ...prev, [lot.id]: true }));
        }
      }
    }

    setLotAssignments(prev => ({
      ...prev,
      [item.id]: itemAssignments
    }));
  };

  const handleFIFOAutoFillAll = () => {
    if (!selectedOrder) return;
    const newAssignments = { ...lotAssignments };
    const newConfirmations = { ...confirmedLocations };
    
    selectedOrder.items.forEach((item: any) => {
      const productLots = item.product?.lots || [];
      let remaining = item.quantity;
      const itemAssignments: { [lotId: number]: number } = {};

      for (const lot of productLots) {
        if (remaining <= 0) break;
        const toTake = Math.min(lot.stock, remaining);
        if (toTake > 0) {
          itemAssignments[lot.id] = toTake;
          remaining -= toTake;
          
          if (lot.location && lot.location !== 'S/U') {
            newConfirmations[lot.id] = true;
          }
        }
      }
      newAssignments[item.id] = itemAssignments;
    });
    
    setConfirmedLocations(newConfirmations);
    setLotAssignments(newAssignments);
  };
  

  const handleFinishPicking = async (_orderId: number) => {
    setErrorMsg(null);
    
    // Validar asignaciones
    let hasShortages = false;
    let totalAssignedAll = 0;
    
    for (const item of selectedOrder.items) {
      const itemAssignments = lotAssignments[item.id] || {};
      const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
      
      if (assignedSum > item.quantity) {
        setErrorMsg(`La cantidad asignada para "${item.product?.name}" (${assignedSum}) excede la cantidad pedida (${item.quantity}).`);
        return;
      }
      
      if (assignedSum < item.quantity) {
        hasShortages = true;
      }
      totalAssignedAll += assignedSum;
    }

    if (totalAssignedAll === 0) {
      setErrorMsg("No podés finalizar el armado con 0 unidades asignadas en total.");
      return;
    }

    if (hasShortages) {
      const confirmShortage = await confirm("Atención: Hay productos con faltantes (se asignó menos de la cantidad pedida). ¿Deseás continuar y cerrar el bulto con estos faltantes? El stock sobrante se liberará.", { type: 'warning' });
      if (!confirmShortage) return;
    }

    // Inicializar sugerencias de bulto y abrir el modal
    let suggestedFrio = 0;
    let suggestedSecos = 0;
    let suggestedTabla = 0;
    let suggestedCajas = 0;

    selectedOrder.items.forEach((item: any) => {
      const itemZone = item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
      const unitsPerBox = item.product?.unitsPerBox || 1;
      
      const itemAssignments = lotAssignments[item.id] || {};
      const assignedQty = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
      
      if (assignedQty === 0) return; // No sugerir bultos si no se armó nada de este item

      if (unitsPerBox > 1 && assignedQty % unitsPerBox === 0) {
        suggestedCajas += (assignedQty / unitsPerBox);
      } else {
        if (itemZone === 'FRIO') suggestedFrio = 1; // Al menos 1 bandeja de frío si hay sueltos
        else if (itemZone === 'TABLA') suggestedTabla += 1;
        else suggestedSecos = 1; // Al menos 1 bandeja de secos si hay sueltos
      }
    });

    setBultosData({
      frio: suggestedFrio,
      secos: suggestedSecos,
      tabla: suggestedTabla,
      cajasCerradas: suggestedCajas
    });
    setShowBultoModal(true);
  };

  const handleConfirmBultosAndFinish = async () => {
    if (!selectedOrder) return;
    setErrorMsg(null);
    setLoading(true);

    const totalBultos = Number(bultosData.frio) + Number(bultosData.secos) + Number(bultosData.tabla) + Number(bultosData.cajasCerradas);
    if (totalBultos <= 0) {
      setErrorMsg("Debés ingresar al menos 1 bulto para finalizar el pedido.");
      setLoading(false);
      return;
    }

    // Armar asignaciones para payload
    const assignmentsPayload: any = {};
    for (const item of selectedOrder.items) {
      const itemAssignments = lotAssignments[item.id] || {};
      assignmentsPayload[item.id] = Object.entries(itemAssignments)
        .filter(([_, qty]) => (qty as number) > 0)
        .map(([lotId, qty]) => ({
          lotId: Number(lotId),
          quantity: qty
        }));
    }

    try {
      // 1. Enviar pesos exactos si existen
      const weightItems = Object.entries(pesableWeights).map(([orderItemId, weight]) => ({
        orderItemId: Number(orderItemId),
        weight: Number(weight)
      })).filter(i => i.weight > 0);
      
      if (weightItems.length > 0) {
        await api.updateOrderWeights(selectedOrder.id, weightItems);
      }
      
      // 2. Finalizar pedido enviando la cantidad de bultos y el desglose
      await api.updateOrderStatus(selectedOrder.id, OrderStatus.PREPARED, assignmentsPayload, totalBultos, bultosData);
      
      // 3. Generar etiquetas de bulto
      const generatedLabels: any[] = [];
      let index = 1;

      for (let i = 0; i < bultosData.frio; i++) {
        generatedLabels.push({
          index: index++,
          total: totalBultos,
          zone: '❄️ SECTOR FRÍO (FRACCIONADO)',
          client: selectedOrder.persona?.name || selectedOrder.client?.name || 'Cliente',
          route: selectedOrder.persona?.route || 'RETIRO EN DEPÓSITO',
          sequence: selectedOrder.persona?.routeSequence ? `VISITA #${selectedOrder.persona.routeSequence}` : 'S/D',
          orderId: selectedOrder.id
        });
      }
      for (let i = 0; i < bultosData.secos; i++) {
        generatedLabels.push({
          index: index++,
          total: totalBultos,
          zone: '📥 SECTOR SECOS (FRACCIONADO)',
          client: selectedOrder.persona?.name || selectedOrder.client?.name || 'Cliente',
          route: selectedOrder.persona?.route || 'RETIRO EN DEPÓSITO',
          sequence: selectedOrder.persona?.routeSequence ? `VISITA #${selectedOrder.persona.routeSequence}` : 'S/D',
          orderId: selectedOrder.id
        });
      }
      for (let i = 0; i < bultosData.tabla; i++) {
        generatedLabels.push({
          index: index++,
          total: totalBultos,
          zone: '🍾 BEBIDAS / TABLA (CONSOLID.)',
          client: selectedOrder.persona?.name || selectedOrder.client?.name || 'Cliente',
          route: selectedOrder.persona?.route || 'RETIRO EN DEPÓSITO',
          sequence: selectedOrder.persona?.routeSequence ? `VISITA #${selectedOrder.persona.routeSequence}` : 'S/D',
          orderId: selectedOrder.id
        });
      }
      for (let i = 0; i < bultosData.cajasCerradas; i++) {
        generatedLabels.push({
          index: index++,
          total: totalBultos,
          zone: '📦 CAJA CERRADA / ORIGINAL',
          client: selectedOrder.persona?.name || selectedOrder.client?.name || 'Cliente',
          route: selectedOrder.persona?.route || 'RETIRO EN DEPÓSITO',
          sequence: selectedOrder.persona?.routeSequence ? `VISITA #${selectedOrder.persona.routeSequence}` : 'S/D',
          orderId: selectedOrder.id
        });
      }

      setSuccessMsg(`Pedido #${selectedOrder.id} preparado con éxito. Se enviaron ${totalBultos} bultos.`);
      setShowBultoModal(false);
      setSelectedOrder(null);
      fetchData();

      // Iniciar el proceso de impresión
      if (generatedLabels.length > 0) {
        setLabelsToPrint(generatedLabels);
        setTimeout(() => {
          window.print();
          setLabelsToPrint([]);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar detalles de bultos.');
    } finally {
      setLoading(false);
    }
  };

  // --- LOGICA DE AJUSTE DE STOCK ---
  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModal.product || !stockModal.quantityChange) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await api.adjustStock(
        stockModal.product.id,
        Number(stockModal.quantityChange),
        stockModal.reason || 'Ajuste manual depósito',
        stockModal.lotNumber || undefined,
        stockModal.isNewLot ? stockModal.expirationDate : undefined,
        stockModal.location || undefined
      );
      setSuccessMsg(`Stock de ${stockModal.product.name} ajustado con éxito.`);
      setStockModal({
        open: false,
        product: null,
        quantityChange: 0,
        reason: '',
        lotNumber: '',
        isNewLot: false,
        expirationDate: '',
        location: ''
      });
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al ajustar stock.');
    } finally {
      setLoading(false);
    }
  };

  // Verificar si todas las asignaciones de todos los artículos son menores o iguales a la pedida y hay al menos algo asignado
  const isOrderFullyAssigned = selectedOrder?.items.every((item: any) => {
    const itemAssignments = lotAssignments[item.id] || {};
    const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
    return assignedSum <= item.quantity;
  }) && selectedOrder?.items.some((item: any) => {
    const itemAssignments = lotAssignments[item.id] || {};
    const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
    return assignedSum > 0;
  }) || false;

  // --- LÓGICA DE FILTRADO Y BATCH PICKING ---

  // Obtener rutas únicas a partir de los pedidos cargados
  const uniqueRoutes = Array.from(
    new Set(
      orders
        .map((o) => o.persona?.route)
        .filter((route): route is string => typeof route === 'string' && route.trim().length > 0)
    )
  ).sort();

  // Filtrar pedidos según búsqueda, ruta, retiro y estado
  const filteredOrders = orders.filter((o) => {
    if (selectedStatus !== 'ALL' && o.status !== selectedStatus) {
      return false;
    }
    if (orderSearchQuery.trim() !== '') {
      const q = orderSearchQuery.toLowerCase();
      const matchesId = o.id.toString().includes(q);
      const matchesClient = o.persona?.name?.toLowerCase().includes(q) || false;
      const matchesCity = o.persona?.city?.toLowerCase().includes(q) || false;
      if (!matchesId && !matchesClient && !matchesCity) {
        return false;
      }
    }
    if (withdrawalFilter) {
      const isWithdrawal = !o.persona?.route || o.persona.route.trim() === '' || o.persona.route.toUpperCase() === 'RETIRO';
      if (!isWithdrawal) return false;
    } else if (routeFilter && routeFilter !== 'ALL') {
      if (o.persona?.route !== routeFilter) return false;
    }
    return true;
  });

  // Lista de pedidos que están tildados
  const selectedOrdersList = orders.filter(o => selectedOrderIds[o.id]);

  // Obtener la ubicación física de un producto consultando sus lotes con stock
  const getProductLocation = (product: any) => {
    if (!product?.lots || product.lots.length === 0) return 'S/U';
    const lotWithLocation = product.lots.find((l: any) => l.stock > 0 && l.location && l.location !== 'S/U');
    return lotWithLocation ? lotWithLocation.location : (product.lots[0]?.location || 'S/U');
  };

  const renderLocationTag = (locCode: string) => {
    const code = locCode || 'S/U';
    const info = LOCATION_MAP[code] || { label: code, icon: '📍', color: '#8E8E93', bg: 'var(--bg-secondary)', description: '' };
    return (
      <span className="badge" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.8rem',
        fontWeight: 600,
        backgroundColor: info.bg,
        color: info.color,
        border: `1px solid ${info.color}30`,
        padding: '3px 8px',
        borderRadius: '4px',
        fontFamily: 'monospace'
      }} title={info.description || ''}>
        {info.icon} {info.label}
      </span>
    );
  };

  // Helper para ponderar las ubicaciones físicas y trazar la ruta de picking óptima
  const getLocationWeight = (loc: string): number => {
    if (!loc || loc === 'S/U') return 999;
    const cleanLoc = loc.toUpperCase().trim();
    
    if (cleanLoc.startsWith('D1-RKA') || cleanLoc.startsWith('D1-RKB') || cleanLoc === 'D1-RACK') {
      return 10; // Racks entrada D1
    }
    if (cleanLoc.startsWith('D1-EST')) {
      return 20; // Estanterías D1
    }
    if (cleanLoc.startsWith('D1-CAM2')) {
      return 30; // Cámara Mediana D1
    }
    if (cleanLoc.startsWith('D1-CAM3')) {
      return 35; // Cámara Chica 3 D1 (cajas secas)
    }
    if (cleanLoc.startsWith('D1-CAM1')) {
      return 40; // Cámara Grande D1 (Frío - al final del recorrido D1)
    }
    if (cleanLoc.startsWith('D2-RK') || cleanLoc === 'D2-GEN') {
      return 50; // Depósito 2
    }
    if (cleanLoc.startsWith('D3-') || cleanLoc === 'D3-ENV') {
      return 60; // Depósito 3
    }
    return 100; // Otras ubicaciones personalizadas
  };

  const sortItemsByOptimalRoute = (items: any[]) => {
    return [...items].sort((a, b) => {
      // Intentar obtener ubicación del lote o del producto
      const locA = getProductLocation(a.product || a);
      const locB = getProductLocation(b.product || b);
      
      const wA = getLocationWeight(locA);
      const wB = getLocationWeight(locB);
      
      if (wA !== wB) return wA - wB;
      
      // Si tienen el mismo peso general, ordenar alfabéticamente por código para seguir pasillo
      return locA.localeCompare(locB);
    });
  };

  // Agrupar y consolidar todos los artículos de los pedidos seleccionados
  const consolidatedItems = (() => {
    const itemsMap: {
      [productId: number]: {
        product: any;
        totalQuantity: number;
        orderDetails: { orderId: number; clientName: string; route: string; quantity: number }[];
      };
    } = {};

    selectedOrdersList.forEach(order => {
      (order.items || []).forEach((item: any) => {
        if (!item.product) return;
        const prodId = item.product.id;
        if (!itemsMap[prodId]) {
          itemsMap[prodId] = {
            product: item.product,
            totalQuantity: 0,
            orderDetails: []
          };
        }
        itemsMap[prodId].totalQuantity += item.quantity;
        itemsMap[prodId].orderDetails.push({
          orderId: order.id,
          clientName: order.persona?.name || order.client?.name || 'Cliente',
          route: order.persona?.route || 'RETIRO EN DEPÓSITO',
          quantity: item.quantity
        });
      });
    });

    return sortItemsByOptimalRoute(Object.values(itemsMap));
  })();

  // Iniciar picking en lote de todos los pedidos seleccionados en estado PENDING
  const handleBatchStartPicking = async () => {
    const pendingSelected = selectedOrdersList.filter(o => o.status === OrderStatus.PENDING);
    if (pendingSelected.length === 0) {
      alert("No hay pedidos seleccionados en estado 'Esperando Picking'.");
      return;
    }

    if (!await confirm(`¿Deseás pasar los ${pendingSelected.length} pedidos seleccionados a 'En Preparación'?`)) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await Promise.all(
        pendingSelected.map(o => api.updateOrderStatus(o.id, OrderStatus.PREPARING))
      );
      setSuccessMsg(`Se inició el picking para ${pendingSelected.length} pedidos.`);
      setSelectedOrderIds({});
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al iniciar el picking en lote.");
    } finally {
      setLoading(false);
    }
  };

  // Alternar selección de todos los pedidos filtrados actualmente visibles
  const handleToggleSelectAll = () => {
    const allSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds[o.id]);
    const newSelected = { ...selectedOrderIds };
    filteredOrders.forEach(o => {
      if (allSelected) {
        delete newSelected[o.id];
      } else {
        newSelected[o.id] = true;
      }
    });
    setSelectedOrderIds(newSelected);
  };

  // --- FIN DE LÓGICA DE FILTRADO Y BATCH PICKING ---

  return (
    <div style={{ width: '100%' }}>
      {errorMsg && (
        <div style={{
          backgroundColor: 'var(--accent-bg-light)',
          color: 'var(--accent-color)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          marginBottom: '20px',
          border: '1px solid rgba(227, 6, 19, 0.15)'
        }}>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          marginBottom: '20px',
          border: '1px solid rgba(52, 199, 89, 0.15)'
        }} onClick={() => setSuccessMsg(null)}>
          {successMsg}
        </div>
      )}

      {/* Sub-tabs de Navegación interna (ocultos durante la preparación activa o en impresión) */}
      {!selectedOrder && !showConsolidatedView && (
        <div className="subtabs-nav no-print">
          <button
            className={`subtab-btn ${subTab === 'picking' ? 'active' : ''}`}
            onClick={() => setSubTab('picking')}
          >
            <ClipboardList size={16} />
            <span>📦 Armado de Pedidos (Picking)</span>
          </button>
          <button
            className={`subtab-btn ${subTab === 'wms-map' ? 'active' : ''}`}
            onClick={() => setSubTab('wms-map')}
          >
            <Map size={16} />
            <span>🗺️ Plano Interactivo WMS</span>
          </button>
          <button
            className={`subtab-btn ${subTab === 'stock-list' ? 'active' : ''}`}
            onClick={() => setSubTab('stock-list')}
          >
            <Warehouse size={16} />
            <span>📋 Control de Stock y Lotes</span>
          </button>
        </div>
      )}

      {/* ====================================================================
          1. PREPARACIÓN DE PEDIDOS (PICKING LIST)
          ==================================================================== */}
      {(subTab === 'picking' || selectedOrder || showConsolidatedView) && (
        <div>
          {selectedOrder ? (() => {
            const filteredItems = sortItemsByOptimalRoute(
              selectedOrder.items.filter((item: any) => selectedZone === 'ALL' || (item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS') === selectedZone)
            );
            const countZone = (zId: string) => {
              if (zId === 'ALL') return selectedOrder.items.length;
              return selectedOrder.items.filter((i: any) => (i.product?.pickingZone || i.product?.rubro?.pickingZone || 'CAJAS') === zId).length;
            };

            const totalItemsCount = selectedOrder.items.length;
            const itemsPreparedCount = selectedOrder.items.filter((item: any) => {
              const itemAssignments = lotAssignments[item.id] || {};
              const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
              return assignedSum === item.quantity;
            }).length;
            const itemsPartialCount = selectedOrder.items.filter((item: any) => {
              const itemAssignments = lotAssignments[item.id] || {};
              const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
              return assignedSum > 0 && assignedSum < item.quantity;
            }).length;
            
            const progressPercent = totalItemsCount > 0 
              ? Math.round(((itemsPreparedCount + itemsPartialCount) / totalItemsCount) * 100) 
              : 0;

            return (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3>Preparando Pedido #{selectedOrder.id}</h3>
                  <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Regresar al Listado</button>
                </div>

                <div style={{ marginBottom: '20px', fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <p><strong>Cliente:</strong> {selectedOrder.client?.name || selectedOrder.persona?.name}</p>
                    <p><strong>Dirección:</strong> {selectedOrder.client?.address || selectedOrder.persona?.address || 'Retiro en depósito'}</p>
                  </div>
                  <div>
                    <p><strong>Fecha pedido:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString('es-AR')}</p>
                    <p><strong>Vendedor:</strong> {selectedOrder.seller?.username || 'S/D'}</p>
                  </div>
                </div>

                {/* Barra de progreso de armado */}
                <div style={{ 
                  marginBottom: '24px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  padding: '14px 18px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border-color)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Progreso de Preparación
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: progressPercent === 100 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                      {itemsPreparedCount} listos, {itemsPartialCount} parciales de {totalItemsCount} productos ({progressPercent}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${progressPercent}%`, 
                      height: '100%', 
                      backgroundColor: progressPercent === 100 ? 'var(--color-success)' : '#4A5568', 
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
                    }} />
                  </div>
                </div>

                {/* Filtros de Sectores del Depósito */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '16px', 
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '12px',
                  flexWrap: 'wrap'
                }}>
                  {[
                    { id: 'ALL', label: '🌐 Todos los Sectores', color: '#1e293b' },
                    { id: 'FRIO', label: '❄️ Sector Frío', color: '#007AFF' },
                    { id: 'TABLA', label: '🍾 Sector Tabla/Bebidas', color: '#FF9500' },
                    { id: 'CAJAS', label: '📦 Sector Secos/Cajas', color: '#8E8E93' }
                  ].map(zone => {
                    const count = countZone(zone.id);
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        className="btn"
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.85rem',
                          borderRadius: '20px',
                          backgroundColor: selectedZone === zone.id ? zone.color : 'var(--bg-secondary)',
                          color: selectedZone === zone.id ? '#fff' : 'var(--text-primary)',
                          border: selectedZone === zone.id ? `1px solid ${zone.color}` : '1px solid var(--border-color)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => setSelectedZone(zone.id)}
                      >
                        {zone.label} ({count})
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Lista de Artículos a Preparar (Picking List)</h4>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)' }}
                    onClick={handleFIFOAutoFillAll}
                  >
                    ⚡ Auto-completar Todo (FIFO)
                  </button>
                </div>
                
                <div className="table-container" style={{ border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Artículo y Trazabilidad de Lotes</th>
                        <th>Cantidad Pedida</th>
                        <th>Stock General</th>
                        <th>Código SKU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item: any, idx: number) => {
                        const isLowStock = item.product ? item.product.stock < item.quantity : false;
                        const productLots = item.product?.lots || [];
                        const itemAssignments = lotAssignments[item.id] || {};
                        
                        const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
                        const _isValidAssignment = assignedSum === item.quantity;
                        
                        const itemZone = item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
                        const unitsPerBox = item.product?.unitsPerBox || 1;
                        
                        // Determinar tipo de empaque para visualización
                        let packingType = '';
                        let badgeStyle: React.CSSProperties = {};
                        
                        if (unitsPerBox > 1 && item.quantity % unitsPerBox === 0) {
                          const boxes = item.quantity / unitsPerBox;
                          packingType = `📦 ${boxes} Caja(s) Cerrada(s)`;
                          badgeStyle = { backgroundColor: 'rgba(52, 199, 89, 0.08)', color: '#34C759', border: '1px solid rgba(52, 199, 89, 0.15)' };
                        } else {
                          if (itemZone === 'FRIO') {
                            packingType = '❄️ Fracc. Frío';
                            badgeStyle = { backgroundColor: 'rgba(0, 122, 255, 0.08)', color: '#007AFF', border: '1px solid rgba(0, 122, 255, 0.15)' };
                          } else if (itemZone === 'TABLA') {
                            packingType = '🍾 Tabla/Consol.';
                            badgeStyle = { backgroundColor: 'rgba(255, 149, 0, 0.08)', color: '#FF9500', border: '1px solid rgba(255, 149, 0, 0.15)' };
                          } else {
                            packingType = '📥 Fracc. Secos';
                            badgeStyle = { backgroundColor: 'rgba(142, 142, 147, 0.08)', color: '#8E8E93', border: '1px solid rgba(142, 142, 147, 0.15)' };
                          }
                        }

                        return (
                          <tr key={idx} style={{ backgroundColor: isLowStock ? 'var(--accent-bg-light)' : 'transparent', borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ 
                              padding: '16px 12px', 
                              borderLeft: assignedSum === item.quantity 
                                ? '4px solid var(--color-success)' 
                                : assignedSum > 0 
                                  ? '4px solid var(--color-warning)' 
                                  : '4px solid #CBD5E0',
                              transition: 'border-left-color 0.3s ease'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.product?.name}</span>
                                {item.product?.defaultLocation && (
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    backgroundColor: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)'
                                  }}>
                                    📍 {item.product.defaultLocation}
                                  </span>
                                )}
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  ...badgeStyle
                                }}>
                                  {packingType}
                                </span>
                              </div>
                            
                            {/* Selector de Lotes */}
                            <div style={{ 
                              backgroundColor: 'var(--bg-secondary)', 
                              padding: '12px', 
                              borderRadius: 'var(--radius-sm)', 
                              border: '1px solid var(--border-color)',
                              marginTop: '10px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  Lotes Disponibles en Góndola:
                                </span>
                                <button 
                                  type="button" 
                                  className="btn btn-ghost" 
                                  style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', color: 'var(--accent-color)' }}
                                  onClick={() => handleFIFOAutoFill(item)}
                                >
                                  ⚡ Auto-completar (FIFO)
                                </button>
                              </div>
                              
                              {productLots.length === 0 ? (
                                <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)' }}>
                                  ⚠️ Sin lotes registrados en depósito. Ajustá stock y creá un lote primero.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {productLots.map((lot: any) => {
                                    const qty = itemAssignments[lot.id] || 0;
                                    const isConfirmed = !lot.location || lot.location === 'S/U' || confirmedLocations[lot.id];
                                    return (
                                      <div key={lot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                          <strong>Lote: {lot.lotNumber}</strong> (Físico: {lot.stock} u.) 
                                          <span style={{ color: 'var(--text-secondary)' }}>
                                            [Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}]
                                          </span>
                                          {lot.location && lot.location !== 'S/U' && (
                                            <span style={{ 
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              padding: '2px 6px',
                                              backgroundColor: isConfirmed ? '#e6f4ea' : '#fef7e0',
                                              border: isConfirmed ? '1px solid #137333' : '1px solid #b06000',
                                              borderRadius: '4px',
                                              fontWeight: 600,
                                              fontSize: '0.72rem',
                                              color: isConfirmed ? '#137333' : '#b06000',
                                              marginLeft: '6px'
                                            }}>
                                              Estante: {lot.location}
                                              <button
                                                type="button"
                                                onClick={() => setConfirmedLocations(prev => ({ ...prev, [lot.id]: !prev[lot.id] }))}
                                                style={{
                                                  marginLeft: '6px',
                                                  background: 'none',
                                                  border: 'none',
                                                  color: isConfirmed ? '#137333' : '#b06000',
                                                  cursor: 'pointer',
                                                  padding: 0,
                                                  fontWeight: 700,
                                                  fontSize: '0.7rem'
                                                }}
                                                title={isConfirmed ? "Haga clic para desconfirmar" : "Haga clic para confirmar ubicación manualmente"}
                                              >
                                                {isConfirmed ? '✓' : 'Confirmar'}
                                              </button>
                                            </span>
                                          )}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <input
                                            type="number"
                                            className="input"
                                            style={{ 
                                              width: '70px', 
                                              padding: '4px 6px', 
                                              fontSize: '0.8rem', 
                                              height: '28px', 
                                              textAlign: 'center',
                                              opacity: isConfirmed ? 1 : 0.6
                                            }}
                                            min={0}
                                            max={lot.stock}
                                            value={qty || ''}
                                            onChange={(e) => handleLotQtyChange(item.id, lot.id, Number(e.target.value), lot.stock)}
                                            placeholder="0"
                                            disabled={!isConfirmed}
                                            title={!isConfirmed ? "Debés confirmar la ubicación física antes de ingresar cantidad" : ""}
                                          />
                                          <span style={{ color: 'var(--text-secondary)' }}>u.</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* Estado asignación */}
                              <div style={{ 
                                marginTop: '10px', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                fontSize: '0.8rem',
                                borderTop: '1px solid var(--border-color)',
                                paddingTop: '8px'
                              }}>
                                <span style={{ 
                                  fontWeight: 600, 
                                  color: assignedSum === item.quantity 
                                    ? 'var(--color-success)' 
                                    : assignedSum > 0 
                                      ? 'var(--color-warning)' 
                                      : 'var(--accent-color)' 
                                }}>
                                  {assignedSum === item.quantity 
                                    ? '✓ Completado' 
                                    : assignedSum > 0 
                                      ? `⚠️ Armado parcial (Faltante de ${item.quantity - assignedSum} u.)` 
                                      : `⚠️ Pendiente de asignación`}
                                </span>
                                <span style={{ fontWeight: 700 }}>
                                  {assignedSum} de {item.quantity} u.
                                </span>
                              </div>

                              {/* Input de peso exacto si es pesable */}
                              {item.product?.isPesable && (
                                <div style={{
                                  marginTop: '10px',
                                  paddingTop: '10px',
                                  borderTop: '1px solid var(--border-color)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                                    ⚖️ Peso Exacto Total:
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                      type="number"
                                      step="0.001"
                                      className="input"
                                      style={{ width: '90px', textAlign: 'right' }}
                                      placeholder={item.product?.approximateWeight ? `Aprox: ${Number(item.quantity) * Number(item.product.approximateWeight)}` : "Ej: 4.250"}
                                      value={pesableWeights[item.id] || ''}
                                      onChange={(e) => setPesableWeights(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                                    />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Kg</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, verticalAlign: 'top', paddingTop: '16px' }}>{item.quantity} u.</td>
                          <td style={{ verticalAlign: 'top', paddingTop: '16px' }}>{item.product ? `${item.product.stock} u.` : 'S/D'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', verticalAlign: 'top', paddingTop: '16px' }}>{item.product?.sku}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Cancelar Picking</button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleFinishPicking(selectedOrder.id)}
                  disabled={!isOrderFullyAssigned}
                >
                  <Check size={16} />
                  <span>Marcar como Armado y Cerrar Bulto</span>
                </button>
              </div>
            </div>
            );
          })() : showConsolidatedView ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }} className="no-print">
                <div>
                  <h3 style={{ margin: 0 }}>Planilla de Picking Consolidada</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Sumatoria de {selectedOrdersList.length} pedidos seleccionados.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => window.print()}
                  >
                    🖨️ Imprimir Planilla A4
                  </button>
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowConsolidatedView(false);
                      setConsolidatedCheckedItems({});
                    }}
                  >
                    Volver al Listado
                  </button>
                </div>
              </div>
              
              {/* Resumen de Pedidos y Rutas en pantalla */}
              <div className="no-print" style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                marginBottom: '20px',
                fontSize: '0.85rem'
              }}>
                <div style={{ marginBottom: '6px' }}>
                  <strong>Pedidos incluidos:</strong>{' '}
                  {selectedOrdersList.map(o => `#${o.id}`).join(', ')}
                </div>
                <div>
                  <strong>Rutas de despacho:</strong>{' '}
                  {Array.from(new Set(selectedOrdersList.map(o => o.persona?.route || 'RETIRO EN DEPÓSITO'))).join(', ')}
                </div>
              </div>

              {/* Filtros de Sectores en pantalla */}
              <div className="no-print" style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '16px', 
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px',
                flexWrap: 'wrap'
              }}>
                {[
                  { id: 'ALL', label: '🌐 Todo Consolidado', color: '#1e293b' },
                  { id: 'FRIO', label: '❄️ Sector Frío', color: '#007AFF' },
                  { id: 'TABLA', label: '🍾 Sector Tabla/Bebidas', color: '#FF9500' },
                  { id: 'CAJAS', label: '📦 Sector Secos/Cajas', color: '#8E8E93' }
                ].map(zone => {
                  const count = zone.id === 'ALL' 
                    ? consolidatedItems.length 
                    : consolidatedItems.filter(i => (i.product?.pickingZone || i.product?.rubro?.pickingZone || 'CAJAS') === zone.id).length;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      className="btn"
                      style={{
                        padding: '6px 14px',
                        fontSize: '0.85rem',
                        borderRadius: '20px',
                        backgroundColor: consolidatedZone === zone.id ? zone.color : 'var(--bg-secondary)',
                        color: consolidatedZone === zone.id ? '#fff' : 'var(--text-primary)',
                        border: consolidatedZone === zone.id ? `1px solid ${zone.color}` : '1px solid var(--border-color)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setConsolidatedZone(zone.id)}
                    >
                      {zone.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Tabla consolidada en pantalla */}
              <div className="table-container no-print" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>✓</th>
                      <th style={{ width: '120px' }}>Ubicación</th>
                      <th>Artículo / SKU</th>
                      <th style={{ width: '120px' }}>Sector</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Cant. Total</th>
                      <th>Desglose por Pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredConsolidated = consolidatedItems.filter(
                        item => consolidatedZone === 'ALL' || (item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS') === consolidatedZone
                      );
                      if (filteredConsolidated.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0' }}>
                              No hay artículos en este sector.
                            </td>
                          </tr>
                        );
                      }
                      return filteredConsolidated.map((item, idx) => {
                        const isChecked = !!consolidatedCheckedItems[item.product.id];
                        const location = getProductLocation(item.product);
                        const itemZone = item.product?.rubro?.pickingZone || 'CAJAS';
                        const _rubroName = item.product?.rubro?.name || 'General';
                        
                        let badgeStyle: React.CSSProperties = {};
                        if (itemZone === 'FRIO') {
                          badgeStyle = { backgroundColor: 'rgba(0, 122, 255, 0.08)', color: '#007AFF', border: '1px solid rgba(0, 122, 255, 0.15)' };
                        } else if (itemZone === 'TABLA') {
                          badgeStyle = { backgroundColor: 'rgba(255, 149, 0, 0.08)', color: '#FF9500', border: '1px solid rgba(255, 149, 0, 0.15)' };
                        } else {
                          badgeStyle = { backgroundColor: 'rgba(142, 142, 147, 0.08)', color: '#8E8E93', border: '1px solid rgba(142, 142, 147, 0.15)' };
                        }

                        return (
                          <tr key={idx} style={{ 
                            backgroundColor: isChecked ? 'rgba(52, 199, 89, 0.02)' : 'transparent',
                            opacity: isChecked ? 0.7 : 1,
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'all 0.2s'
                          }}>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setConsolidatedCheckedItems(prev => ({
                                    ...prev,
                                    [item.product.id]: !prev[item.product.id]
                                  }));
                                }}
                              />
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                backgroundColor: location !== 'S/U' ? '#FFFBEB' : 'var(--bg-secondary)',
                                color: location !== 'S/U' ? '#B06000' : 'var(--text-secondary)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: location !== 'S/U' ? '1px solid #FFE0B2' : '1px solid var(--border-color)',
                                fontFamily: 'monospace'
                              }}>
                                📍 {location}
                              </span>
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', textDecoration: isChecked ? 'line-through' : 'none' }}>
                                {item.product.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                SKU: {item.product.sku}
                              </div>
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                ...badgeStyle
                              }}>
                                {itemZone}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', verticalAlign: 'middle', paddingRight: '12px' }}>
                              {item.totalQuantity} u.
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {item.orderDetails.map((det: any, dIdx: number) => (
                                  <span key={dIdx} style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    padding: '2px 6px',
                                    borderRadius: '4px'
                                  }} title={`Cliente: ${det.clientName} | Ruta: ${det.route}`}>
                                    Pedido #{det.orderId}: <strong>{det.quantity} u.</strong>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              {expiringLots.length > 0 && (
                <div className="card" style={{ 
                  backgroundColor: '#FFF2F2', 
                  border: '1px solid #FFD1D1', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#C0392B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚠️ Lotes Próximos a Vencer (Menos de 30 días)
                  </h4>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {expiringLots.map((lot) => {
                      const daysLeft = Math.ceil((new Date(lot.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                      const isExpired = daysLeft <= 0;
                      return (
                        <div key={lot.id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          fontSize: '0.85rem', 
                          padding: '6px 10px', 
                          backgroundColor: '#fff', 
                          borderRadius: '4px',
                          borderLeft: isExpired ? '4px solid #C0392B' : '4px solid #F39C12'
                        }}>
                          <div>
                            <strong>{lot.product?.name}</strong> <span style={{ color: 'var(--text-secondary)' }}>(SKU: {lot.product?.sku})</span>
                            <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                              Lote: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{lot.lotNumber}</span> | Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR')}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ 
                              fontWeight: 'bold', 
                              color: isExpired ? '#C0392B' : '#E67E22', 
                              backgroundColor: isExpired ? '#FDEDEC' : '#FEF9E7',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              display: 'inline-block',
                              marginBottom: '2px'
                            }}>
                              {isExpired ? 'VENCIDO' : `Vence en ${daysLeft} días`}
                            </span>
                            <div style={{ fontWeight: 600 }}>Stock: {lot.stock} u.</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Pedidos en cola de distribución cargados por vendedores. Iniciá el picking para armar bultos físicos.
              </p>

              {/* Barra de Filtros de Pedidos */}
              <div className="actions-bar" style={{ flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div className="search-input-wrapper" style={{ minWidth: '280px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Buscar nro pedido, cliente, localidad..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Selector de Ruta */}
                  <select
                    className="select"
                    style={{ width: '200px', height: '38px', padding: '6px 12px' }}
                    value={routeFilter}
                    onChange={(e) => {
                      setRouteFilter(e.target.value);
                      if (e.target.value !== 'ALL') {
                        setWithdrawalFilter(false);
                      }
                    }}
                  >
                    <option value="ALL">📍 Todas las Rutas</option>
                    {uniqueRoutes.map((r) => (
                      <option key={r} value={r}>
                        🛣️ {r}
                      </option>
                    ))}
                  </select>

                  {/* Botón de Retiro en Depósito */}
                  <button
                    type="button"
                    className="btn"
                    style={{
                      height: '38px',
                      padding: '0 16px',
                      backgroundColor: withdrawalFilter ? 'var(--color-corp-red)' : 'var(--bg-card)',
                      borderColor: withdrawalFilter ? 'var(--color-corp-red)' : 'var(--border-color)',
                      color: withdrawalFilter ? '#fff' : 'var(--text-secondary)',
                      boxShadow: 'var(--shadow-sm)',
                      border: '1px solid var(--border-color)',
                      fontWeight: 600
                    }}
                    onClick={() => {
                      const val = !withdrawalFilter;
                      setWithdrawalFilter(val);
                      if (val) {
                        setRouteFilter('ALL');
                      }
                    }}
                  >
                    🏢 Retiros Depósito
                  </button>

                  {/* Selector de Estado */}
                  <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '38px' }}>
                    {[
                      { id: 'ALL', label: 'Todos' },
                      { id: 'PENDING', label: 'Pendientes' },
                      { id: 'PREPARING', label: 'En Preparación' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        style={{
                          padding: '0 12px',
                          fontSize: '0.8rem',
                          border: 'none',
                          borderRadius: 0,
                          boxShadow: 'none',
                          backgroundColor: selectedStatus === st.id ? 'var(--accent-color)' : 'var(--bg-card)',
                          color: selectedStatus === st.id ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: selectedStatus === st.id ? 600 : 400
                        }}
                        onClick={() => setSelectedStatus(st.id)}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <button className="btn btn-secondary" style={{ height: '38px' }} onClick={() => fetchData()}>
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              {/* Barra de Acciones Masivas */}
              {Object.keys(selectedOrderIds).length > 0 && (
                <div style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px dashed var(--border-color)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    ⚡ {Object.keys(selectedOrderIds).length} pedido(s) seleccionado(s)
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '6px 14px' }}
                      onClick={() => setSelectedOrderIds({})}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '6px 14px', border: '1px solid var(--accent-color)' }}
                      onClick={handleBatchStartPicking}
                      disabled={loading}
                    >
                      🏁 Iniciar Picking en Lote
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', backgroundColor: 'var(--color-primary)' }}
                      onClick={() => {
                        setConsolidatedCheckedItems({});
                        setConsolidatedZone('ALL');
                        setShowConsolidatedView(true);
                      }}
                    >
                      👁️ Ver Picking Consolidado
                    </button>
                  </div>
                </div>
              )}

              {/* Tabla de Pedidos */}
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds[o.id])}
                          ref={(el) => {
                            if (el) {
                              const checkedCount = filteredOrders.filter(o => selectedOrderIds[o.id]).length;
                              el.indeterminate = checkedCount > 0 && checkedCount < filteredOrders.length;
                            }
                          }}
                          onChange={handleToggleSelectAll}
                        />
                      </th>
                      <th>Nro Pedido</th>
                      <th>Cliente / Localidad</th>
                      <th>Ruta / Despacho</th>
                      <th>Items a preparar</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0' }}>
                          No hay pedidos para mostrar con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => {
                        const isChecked = !!selectedOrderIds[o.id];
                        const isWithdrawal = !o.persona?.route || o.persona.route.trim() === '' || o.persona.route.toUpperCase() === 'RETIRO';
                        return (
                          <tr key={o.id} style={{ backgroundColor: isChecked ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedOrderIds(prev => {
                                    const copy = { ...prev };
                                    if (copy[o.id]) {
                                      delete copy[o.id];
                                    } else {
                                      copy[o.id] = true;
                                    }
                                    return copy;
                                  });
                                }}
                              />
                            </td>
                            <td style={{ fontWeight: 700 }}>#{o.id}</td>
                            <td style={{ fontWeight: 600 }}>
                              <div>{o.persona?.name || o.client?.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                📍 {o.persona?.city || 'Sin Localidad'}
                              </div>
                            </td>
                            <td>
                              {isWithdrawal ? (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: '#10B981',
                                  backgroundColor: '#ECFDF5',
                                  border: '1px solid rgba(16, 185, 129, 0.15)',
                                  padding: '2px 8px',
                                  borderRadius: '4px'
                                }}>
                                  🏢 RETIRO DEPÓSITO
                                </span>
                              ) : (
                                o.persona?.route && (
                                  <span style={{ 
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                                    color: 'var(--color-primary)', 
                                    border: '1px solid rgba(59, 130, 246, 0.15)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700
                                  }}>
                                    🛣️ {o.persona.route}
                                  </span>
                                )
                              )}
                            </td>
                            <td>{(o.items || []).length} artículos distintos</td>
                            <td>
                              <span className={`badge ${o.status === 'PENDING' ? 'badge-pending' : 'badge-preparing'}`}>
                                {o.status === 'PENDING' ? 'Esperando Picking' : 'En Preparación'}
                              </span>
                            </td>
                            <td>
                              {o.status === 'PENDING' ? (
                                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleStartPicking(o.id)}>
                                  <Play size={12} />
                                  <span>Iniciar Armado</span>
                                </button>
                              ) : (
                                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setSelectedOrder(o)}>
                                  <Eye size={12} />
                                  <span>Ver Picking List</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          1.2 SUGERENCIAS DE COMPRA (REABASTECIMIENTO)
          ==================================================================== */}
      {subTab === 'replenishment' && !selectedOrder && !showConsolidatedView && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Sugerencias de Compra (Reabastecimiento)</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Productos con stock inferior al mínimo o con demanda insatisfecha por pedidos pendientes.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => fetchData()}>
                <RefreshCw size={16} />
              </button>
            </div>
            
            {loading ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite' }} />
                <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>Analizando inventario y pedidos...</p>
              </div>
            ) : (() => {
              // Calcular sugerencias de reabastecimiento
              // 1. Demanda pendiente
              const pendingDemand: Record<number, number> = {};
              orders.forEach(order => {
                (order.items || []).forEach((item: any) => {
                  const prodId = item.productId;
                  const qty = item.quantity;
                  // Si no está completamente armado
                  const assignedQty = item.orderItemLots?.reduce((sum: number, oil: any) => sum + (oil.quantity || 0), 0) || 0;
                  const remaining = Math.max(0, qty - assignedQty);
                  if (remaining > 0) {
                    pendingDemand[prodId] = (pendingDemand[prodId] || 0) + remaining;
                  }
                });
              });

              // 2. Tránsito (órdenes de compra pendientes)
              const inTransit: Record<number, number> = {};
              pendingPurchaseOrders.forEach(po => {
                if (po.status === 'PENDING') {
                  po.items.forEach((item: any) => {
                    inTransit[item.productId] = (inTransit[item.productId] || 0) + item.quantity;
                  });
                }
              });

              // 3. Evaluar productos
              const suggestionsMap: Record<number, { provider: any; items: any[] }> = {};
              allProducts.forEach(prod => {
                const currentStock = prod.stock || 0;
                const minStock = prod.minStock || 0;
                const demand = pendingDemand[prod.id] || 0;
                const transit = inTransit[prod.id] || 0;
                const deficit = minStock + demand - currentStock - transit;

                if (deficit > 0) {
                  const provider = prod.provider || { id: 0, name: 'Sin Proveedor Asignado' };
                  if (!suggestionsMap[provider.id]) {
                    suggestionsMap[provider.id] = { provider, items: [] };
                  }
                  suggestionsMap[provider.id].items.push({
                    product: prod,
                    currentStock,
                    minStock,
                    demand,
                    transit,
                    suggestedQty: deficit
                  });
                }
              });

              const groupedSuggestions = Object.values(suggestionsMap);

              if (groupedSuggestions.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <Check size={32} style={{ color: 'var(--color-success)', marginBottom: '8px' }} />
                    <h4 style={{ margin: 0 }}>¡Stock en Niveles Saludables!</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      No se detectaron faltantes ni productos por debajo del stock mínimo.
                    </p>
                  </div>
                );
              }

              // Handler para crear orden de compra
              const handleCreatePO = async (providerId: number, items: any[]) => {
                if (!providerId || providerId === 0) {
                  alert("No se puede generar orden de compra para productos sin proveedor asignado. Asigná un proveedor al producto primero.");
                  return;
                }
                
                if (!await confirm(`¿Deseás generar la Orden de Compra para este proveedor con los ${items.length} productos sugeridos?`)) {
                  return;
                }

                setGeneratingPOForProvider(providerId);
                setErrorMsg(null);
                setSuccessMsg(null);

                try {
                  const poItems = items.map(item => ({
                    productId: item.product.id,
                    quantity: item.suggestedQty,
                    costPrice: Math.round(Number(item.product.costPrice)) || 0
                  }));

                  await api.createPurchaseOrder({
                    personaId: providerId,
                    items: poItems
                  });

                  setSuccessMsg(`Orden de compra generada con éxito.`);
                  // Recargar
                  fetchData();
                } catch (err: any) {
                  setErrorMsg(err.message || 'Error al generar la orden de compra.');
                } finally {
                  setGeneratingPOForProvider(null);
                }
              };

              return (
                <div className="replenishment-grid">
                  {groupedSuggestions.map((group: any) => {
                    const totalSum = group.items.reduce((sum: number, item: any) => {
                      return sum + (item.suggestedQty * (Number(item.product.costPrice) || 0));
                    }, 0);

                    return (
                      <div key={group.provider.id} className="provider-card">
                        <div className="provider-card-header">
                          <div>
                            <h4 style={{ margin: 0 }}>{group.provider.name}</h4>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {group.items.length} artículos a reponer
                            </span>
                          </div>
                          {group.provider.id !== 0 && (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '0.78rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                              onClick={() => handleCreatePO(group.provider.id, group.items)}
                              disabled={generatingPOForProvider === group.provider.id}
                            >
                              {generatingPOForProvider === group.provider.id ? 'Generando...' : 'Generar OC'}
                            </button>
                          )}
                        </div>
                        <div style={{ padding: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                <th style={{ textAlign: 'left', padding: '4px' }}>Artículo</th>
                                <th style={{ textAlign: 'center', padding: '4px' }}>Déficit</th>
                                <th style={{ textAlign: 'right', padding: '4px' }}>Costo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item: any, idx: number) => {
                                const boxText = item.product.unitsPerBox > 1 
                                  ? ` (${Math.ceil(item.suggestedQty / item.product.unitsPerBox)} cj)` 
                                  : '';
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--bg-secondary)' }}>
                                    <td style={{ padding: '8px 4px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      <strong>{item.product.name}</strong>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        Stock: {item.currentStock} / Mín: {item.minStock} {item.demand > 0 && `| Pedido: ${item.demand}`} {item.transit > 0 && `| Camino: ${item.transit}`}
                                      </div>
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                                      {item.suggestedQty} u.{boxText}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      ${(Number(item.product.costPrice) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
                          <span>Estimado Orden:</span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            ${totalSum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ====================================================================
          2. CONTROL DE STOCK (DEPÓSITO)
          ==================================================================== */}
      {/* 2.1 INVENTARIO Y CONTROL DE STOCK */}
      {subTab === 'stock-list' && !selectedOrder && !showConsolidatedView && (
        <div>
          <div className="actions-bar">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input"
                placeholder="Buscar por SKU, nombre o código de barra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary" onClick={() => fetchData()}>
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Artículo</th>
                  <th>Ubicación Principal</th>
                  <th>Lotes en Góndola</th>
                  <th>Stock Físico Total</th>
                  <th>Stock Mínimo</th>
                  <th>Estado</th>
                  <th>Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px 0' }}>No se encontraron productos.</td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const isLow = p.stock <= p.minStock;
                    const activeLots = (p.lots || []).filter((l: any) => l.stock > 0);
                    const mainLocation = getProductLocation(p);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.sku}</td>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td>{renderLocationTag(mainLocation)}</td>
                        <td>
                          {activeLots.length === 0 ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sin lotes activos</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {activeLots.map((l: any) => (
                                <span key={l.id} className="badge" style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                                  {l.lotNumber} ({l.stock} u. - V: {new Date(l.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: isLow ? 'var(--accent-color)' : 'inherit' }}>{p.stock} u.</td>
                        <td>{p.minStock} u.</td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 500,
                            color: isLow ? 'var(--color-warning)' : 'var(--color-success)'
                          }}>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: isLow ? 'var(--color-warning)' : 'var(--color-success)'
                            }} />
                            {isLow ? 'Stock Crítico' : 'Stock Saludable'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setStockModal({ open: true, product: p, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '', location: '' })}>
                            Modificar Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          2.2 MAPA VISUAL (WMS)
          ==================================================================== */}
                                                                                          {subTab === 'wms-map' && !selectedOrder && !showConsolidatedView && (
        <div className="wms-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
          {/* Header Principal Responsivo */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>🗺️ Plano Gráfico 2D de Depósito (WMS Interactivo)</h4>
                <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 9px' }}>210 Slots Limpios</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Hacé clic en las cámaras para filtrar o activá el <strong>Modo Edición 🎨</strong> para pintar y reasignar sectores manualmente.
              </p>
            </div>

            {/* Selector de Depósitos, Modo Edición y Pantalla Completa */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn ${isEditMode ? 'btn-danger' : 'btn-outline'}`}
                style={{
                  fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 700,
                  backgroundColor: isEditMode ? '#be185d' : '#fdf2f8',
                  color: isEditMode ? '#ffffff' : '#be185d',
                  border: '1.5px solid #be185d',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: isEditMode ? '0 0 10px rgba(190, 24, 93, 0.35)' : 'none'
                }}
                onClick={() => setIsEditMode(!isEditMode)}
              >
                <span>{isEditMode ? '❌ Salir Modo Edición' : '🎨 Modo Edición / Pintar Sectores'}</span>
              </button>

              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('ALL'); setSelectedSector('ALL'); }}
              >
                🌐 Planta Completa
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D1' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('D1'); setSelectedSector('ALL'); }}
              >
                🏢 Depósito 1
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D2' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('D2'); setSelectedSector('ALL'); }}
              >
                🏢 Depósito 2
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D3' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('D3'); setSelectedSector('ALL'); }}
              >
                🔄 Depósito 3
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setIsMapModalOpen(true)}
              >
                🖥️ Pantalla Completa
              </button>
            </div>
          </div>

          {/* PALETA DE PINCELES EN MODO EDICIÓN */}
          {isEditMode ? (
            <div style={{
              padding: '12px 18px', backgroundColor: '#fff1f2', border: '1.5px solid #fda4af', borderRadius: '8px',
              display: 'flex', gap: '10px', fontSize: '0.8rem', flexWrap: 'wrap', alignItems: 'center',
              boxShadow: '0 4px 12px rgba(244, 63, 94, 0.08)'
            }}>
              <div style={{ fontWeight: 800, color: '#9f1239', marginRight: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>🖌️ Elegir Pincel para Pintar Slots:</span>
              </div>

              {[
                { id: 'ESTANTERIA', label: '📦 Estanterías', bg: '#be185d', text: '#fff', border: '#be185d' },
                { id: 'RACK_ENTRADA', label: '🚪 Rack Entrada', bg: '#d97706', text: '#fff', border: '#d97706' },
                { id: 'CAMARA_2', label: '❄️ Cámara 2 Frío', bg: '#0284c7', text: '#fff', border: '#0284c7' },
                { id: 'CAMARA_1', label: '❄️ Cámara 1 Frío', bg: '#0891b2', text: '#fff', border: '#0891b2' },
                { id: 'CAMARA_3', label: '📦 Cámara 3 Seco', bg: '#7e22ce', text: '#fff', border: '#7e22ce' },
                { id: 'BANO', label: '🚻 Baño', bg: '#e11d48', text: '#fff', border: '#e11d48' },
                { id: 'GENERAL', label: '⚪ Sin Sector (General)', bg: '#64748b', text: '#fff', border: '#64748b' },
                { id: 'TOGGLE_LEVEL', label: '🔲 Cambiar Nivel (A/A-B/A-B-C)', bg: '#0f172a', text: '#fff', border: '#0f172a' }
              ].map(brush => (
                <button
                  key={brush.id}
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: activeBrush === brush.id ? brush.bg : '#ffffff',
                    color: activeBrush === brush.id ? brush.text : brush.bg,
                    border: `1.5px solid ${brush.border}`,
                    fontWeight: 700, fontSize: '0.78rem', padding: '5px 11px', borderRadius: '6px',
                    boxShadow: activeBrush === brush.id ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                    transform: activeBrush === brush.id ? 'scale(1.04)' : 'scale(1)',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setActiveBrush(brush.id)}
                >
                  {brush.label}
                </button>
              ))}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  style={{ fontSize: '0.74rem', padding: '4px 10px', fontWeight: 600 }}
                  onClick={() => {
                    if (window.confirm('¿Seguro que deseas restablecer la distribución a los valores por defecto del Excel?')) {
                      localStorage.removeItem('wms_custom_chamber_map_v2');
                      localStorage.removeItem('wms_custom_slottype_map_v2');
                      setChamberMap({});
                      setSlotTypeMap({});
                    }
                  }}
                >
                  🔄 Restablecer a Excel Original
                </button>
              </div>
            </div>
          ) : (
            /* Botones Interactivos Normales para Seleccionar Cámaras Exactas */
            <div style={{ padding: '10px 16px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '8px', fontSize: '0.78rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: '4px' }}>Seleccionar Sector / Cámara:</span>
              
              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'ESTANTERIA' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'ESTANTERIA' ? '#be185d' : '#fce7f3', color: selectedSector === 'ESTANTERIA' ? '#fff' : '#9d174d', border: '1.5px solid #be185d', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'ESTANTERIA' ? 'ALL' : 'ESTANTERIA'); setSelectedWarehouse('D1'); }}
              >
                📦 Estanterías
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'RACK_ENTRADA' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'RACK_ENTRADA' ? '#d97706' : '#fef3c7', color: selectedSector === 'RACK_ENTRADA' ? '#fff' : '#92400e', border: '1.5px solid #d97706', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'RACK_ENTRADA' ? 'ALL' : 'RACK_ENTRADA'); setSelectedWarehouse('D1'); }}
              >
                🚪 Rack Entrada
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'CAMARA_2' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'CAMARA_2' ? '#0284c7' : '#e0f2fe', color: selectedSector === 'CAMARA_2' ? '#fff' : '#0369a1', border: '1.5px solid #0284c7', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'CAMARA_2' ? 'ALL' : 'CAMARA_2'); setSelectedWarehouse('D1'); }}
              >
                ❄️ Cámara 2 Frío (Quesos)
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'CAMARA_1' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'CAMARA_1' ? '#0891b2' : '#ecfeff', color: selectedSector === 'CAMARA_1' ? '#fff' : '#0e7490', border: '1.5px solid #0891b2', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'CAMARA_1' ? 'ALL' : 'CAMARA_1'); setSelectedWarehouse('D1'); }}
              >
                ❄️ Cámara 1 Frío (Lácteos)
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'CAMARA_3' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'CAMARA_3' ? '#7e22ce' : '#f3e8ff', color: selectedSector === 'CAMARA_3' ? '#fff' : '#6b21a8', border: '1.5px solid #7e22ce', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'CAMARA_3' ? 'ALL' : 'CAMARA_3'); setSelectedWarehouse('D1'); }}
              >
                📦 Cámara 3 Seco (Conservas)
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'BANO' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'BANO' ? '#e11d48' : '#ffe4e6', color: selectedSector === 'BANO' ? '#fff' : '#9f1239', border: '1.5px solid #e11d48', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'BANO' ? 'ALL' : 'BANO'); setSelectedWarehouse('D1'); }}
              >
                🚻 Baño
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'ALL' ? 'btn-secondary' : 'btn-outline'}`}
                style={{ fontSize: '0.75rem', marginLeft: 'auto' }}
                onClick={() => setSelectedSector('ALL')}
              >
                🔄 Limpiar Selección
              </button>
            </div>
          )}

          {/* Vista Principal Ajustada 100% Responsiva Sin Cortar */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
            
            {/* Contenedor del Mapa con Ajuste Responsivo Fluido */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', overflowX: 'auto', maxWidth: '100%' }}>
              <div style={{
                display: 'block',
                width: '100%',
                backgroundColor: '#ffffff',
                border: isEditMode ? '2px dashed #f43f5e' : '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: '1.5px', width: '100%', tableLayout: 'fixed', fontSize: '0.65rem', fontFamily: 'sans-serif' }}>
                  <tbody>
                    {(() => {
                      const allRows = [[{"r": 1, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 1, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 2, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 2, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 3, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 3, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 4, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 4, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "ESTANTERIA"}, {"r": 4, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 7, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 4, "c": 8, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 4, "c": 9, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 4, "c": 10, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 4, "c": 11, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 4, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 4, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 5, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 4, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "ESTANTERIA"}, {"r": 5, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 7, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 5, "c": 8, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 5, "c": 9, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 5, "c": 10, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 5, "c": 11, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 5, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 5, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 6, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 4, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "ESTANTERIA"}, {"r": 6, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 7, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 6, "c": 8, "val": "CAMARA 2 FRIO", "fill": "#FFFFFF", "is_storage": false, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 6, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 6, "c": 10, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 6, "c": 11, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_2"}, {"r": 6, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 6, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 7, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 7, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 8, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 6, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 8, "c": 7, "val": "CAMARA 1 FRIO", "fill": "#FFFFFF", "is_storage": false, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 8, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 8, "c": 9, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 8, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 11, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 8, "c": 12, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 8, "c": 13, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 8, "c": 14, "val": "", "fill": "#FFFFFF", "is_storage": false, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 8, "c": 15, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 8, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 17, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 8, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 9, "c": 1, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "RACK_ENTRADA"}, {"r": 9, "c": 2, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "RACK_ENTRADA"}, {"r": 9, "c": 3, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "RACK_ENTRADA"}, {"r": 9, "c": 4, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "RACK_ENTRADA"}, {"r": 9, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 9, "c": 6, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 9, "c": 7, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 9, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 9, "c": 9, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 9, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 9, "c": 11, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 9, "c": 12, "val": "CAMARA 3 SECO", "fill": "#FFFFFF", "is_storage": false, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 9, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 9, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 9, "c": 15, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 9, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 9, "c": 17, "val": "BAÑO", "fill": "#FFFFFF", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 9, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 9, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 9, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 9, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 9, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 9, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 10, "c": 1, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "RACK_ENTRADA"}, {"r": 10, "c": 2, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "RACK_ENTRADA"}, {"r": 10, "c": 3, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "RACK_ENTRADA"}, {"r": 10, "c": 4, "val": "A-B-C", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "RACK_ENTRADA"}, {"r": 10, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 10, "c": 6, "val": "A-B-C-D-E-F", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 10, "c": 7, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 10, "c": 8, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 10, "c": 9, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_1"}, {"r": 10, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 10, "c": 11, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 10, "c": 12, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 10, "c": 13, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 10, "c": 14, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 10, "c": 15, "val": "A", "fill": "#B6D7A8", "is_storage": true, "dep_id": "D1", "chamber": "CAMARA_3"}, {"r": 10, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 10, "c": 17, "val": "", "fill": "#FFFFFF", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 10, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 10, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 10, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 10, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 10, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 10, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 11, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}, {"r": 11, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D1", "chamber": "GENERAL"}], [{"r": 12, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 12, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 13, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 13, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 14, "c": 1, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 2, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 3, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 4, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 5, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 6, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 7, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 8, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 9, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 10, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 11, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 12, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 13, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 14, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 15, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 16, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 17, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 18, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 19, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 20, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 21, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 22, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 14, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 15, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 15, "c": 23, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 16, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 3, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 4, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 6, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 7, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 9, "val": "A-B", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 10, "val": "A-B", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 12, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 13, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 15, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 16, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 19, "val": "A-B", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 20, "val": "A-B", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 21, "val": "A-B", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 16, "c": 23, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 17, "c": 1, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 3, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 4, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 6, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 7, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 9, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 10, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 12, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 13, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 15, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 16, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 19, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 20, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 21, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 17, "c": 23, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 18, "c": 1, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 3, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 4, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 6, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 7, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 9, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 10, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 12, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 13, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 15, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 16, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 19, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 20, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 21, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 18, "c": 23, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 19, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 3, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 4, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 6, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 7, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 9, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 10, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 12, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 13, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 15, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 16, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 19, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 20, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 21, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 19, "c": 23, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 20, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 20, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 21, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 21, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 21, "c": 23, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 22, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 9, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 10, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 11, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 12, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 13, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 14, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 17, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 18, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 19, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 21, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 22, "c": 23, "val": "A-B", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 23, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 9, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 17, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 18, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 19, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 21, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 23, "c": 23, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 24, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 9, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 10, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 11, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 12, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 13, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 14, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 15, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 17, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 18, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 19, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 21, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 24, "c": 23, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 25, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 25, "c": 23, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 26, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 9, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 11, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 12, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 13, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 14, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 15, "val": "A", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 17, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 18, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 19, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 21, "val": "A-B-C", "fill": "#FCE5CD", "is_storage": true, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 26, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 27, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}, {"r": 27, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D2", "chamber": "GENERAL"}], [{"r": 28, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 28, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 29, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 29, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 30, "c": 1, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 2, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 3, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 30, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 31, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 31, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 32, "c": 1, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 2, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 3, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 4, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 5, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 32, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 33, "c": 1, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 2, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 3, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 4, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 5, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 8, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 33, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 34, "c": 1, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 8, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 34, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 35, "c": 1, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 2, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 3, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 4, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 5, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 8, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 35, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 36, "c": 1, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 2, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 3, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 4, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 5, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 8, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 36, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 37, "c": 1, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 2, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 3, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 4, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 5, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 8, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 37, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 38, "c": 1, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 2, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 3, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 4, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 5, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 6, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 7, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 8, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 38, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}], [{"r": 39, "c": 1, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 2, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 3, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 4, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 5, "val": "A", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 6, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 7, "val": "A-B-C", "fill": "#D9D2E9", "is_storage": true, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 8, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 9, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 10, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 11, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 12, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 13, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 14, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 15, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 16, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 17, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 18, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 19, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 20, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 21, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 22, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}, {"r": 39, "c": 23, "val": "", "fill": "#000000", "is_storage": false, "dep_id": "D3", "chamber": "GENERAL"}]];
                      let filteredRows = allRows;

                      if (selectedWarehouse === 'D1') {
                        filteredRows = allRows.slice(0, 11);
                      } else if (selectedWarehouse === 'D2') {
                        filteredRows = allRows.slice(11, 27);
                      } else if (selectedWarehouse === 'D3') {
                        filteredRows = allRows.slice(27, 39);
                      }

                      const defaultSlots = [{"code": "D1-R04-C04", "dep_id": "D1", "deposito": "Depósito 1", "row": 4, "col": 4, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "ESTANTERIA"}, {"code": "D1-R04-C07", "dep_id": "D1", "deposito": "Depósito 1", "row": 4, "col": 7, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R04-C08", "dep_id": "D1", "deposito": "Depósito 1", "row": 4, "col": 8, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R04-C09", "dep_id": "D1", "deposito": "Depósito 1", "row": 4, "col": 9, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R04-C10", "dep_id": "D1", "deposito": "Depósito 1", "row": 4, "col": 10, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R04-C11", "dep_id": "D1", "deposito": "Depósito 1", "row": 4, "col": 11, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R05-C04", "dep_id": "D1", "deposito": "Depósito 1", "row": 5, "col": 4, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "ESTANTERIA"}, {"code": "D1-R05-C07", "dep_id": "D1", "deposito": "Depósito 1", "row": 5, "col": 7, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R05-C08", "dep_id": "D1", "deposito": "Depósito 1", "row": 5, "col": 8, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R05-C09", "dep_id": "D1", "deposito": "Depósito 1", "row": 5, "col": 9, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R05-C10", "dep_id": "D1", "deposito": "Depósito 1", "row": 5, "col": 10, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R05-C11", "dep_id": "D1", "deposito": "Depósito 1", "row": 5, "col": 11, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R06-C04", "dep_id": "D1", "deposito": "Depósito 1", "row": 6, "col": 4, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "ESTANTERIA"}, {"code": "D1-R06-C07", "dep_id": "D1", "deposito": "Depósito 1", "row": 6, "col": 7, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R06-C10", "dep_id": "D1", "deposito": "Depósito 1", "row": 6, "col": 10, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R06-C11", "dep_id": "D1", "deposito": "Depósito 1", "row": 6, "col": 11, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_2"}, {"code": "D1-R08-C06", "dep_id": "D1", "deposito": "Depósito 1", "row": 8, "col": 6, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_1"}, {"code": "D1-R08-C09", "dep_id": "D1", "deposito": "Depósito 1", "row": 8, "col": 9, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_1"}, {"code": "D1-R08-C11", "dep_id": "D1", "deposito": "Depósito 1", "row": 8, "col": 11, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R08-C12", "dep_id": "D1", "deposito": "Depósito 1", "row": 8, "col": 12, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R08-C13", "dep_id": "D1", "deposito": "Depósito 1", "row": 8, "col": 13, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R08-C15", "dep_id": "D1", "deposito": "Depósito 1", "row": 8, "col": 15, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R08-C17", "dep_id": "D1", "deposito": "Depósito 1", "row": 8, "col": 17, "nivel": "A", "fill": "#B6D7A8", "chamber": "GENERAL"}, {"code": "D1-R09-C01", "dep_id": "D1", "deposito": "Depósito 1", "row": 9, "col": 1, "nivel": "A", "fill": "#B6D7A8", "chamber": "RACK_ENTRADA"}, {"code": "D1-R09-C02", "dep_id": "D1", "deposito": "Depósito 1", "row": 9, "col": 2, "nivel": "A", "fill": "#B6D7A8", "chamber": "RACK_ENTRADA"}, {"code": "D1-R09-C03", "dep_id": "D1", "deposito": "Depósito 1", "row": 9, "col": 3, "nivel": "A", "fill": "#B6D7A8", "chamber": "RACK_ENTRADA"}, {"code": "D1-R09-C04", "dep_id": "D1", "deposito": "Depósito 1", "row": 9, "col": 4, "nivel": "A", "fill": "#B6D7A8", "chamber": "RACK_ENTRADA"}, {"code": "D1-R09-C06", "dep_id": "D1", "deposito": "Depósito 1", "row": 9, "col": 6, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_1"}, {"code": "D1-R09-C07", "dep_id": "D1", "deposito": "Depósito 1", "row": 9, "col": 7, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_1"}, {"code": "D1-R09-C09", "dep_id": "D1", "deposito": "Depósito 1", "row": 9, "col": 9, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_1"}, {"code": "D1-R09-C11", "dep_id": "D1", "deposito": "Depósito 1", "row": 9, "col": 11, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R09-C15", "dep_id": "D1", "deposito": "Depósito 1", "row": 9, "col": 15, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R10-C01", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 1, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "RACK_ENTRADA"}, {"code": "D1-R10-C02", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 2, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "RACK_ENTRADA"}, {"code": "D1-R10-C03", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 3, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "RACK_ENTRADA"}, {"code": "D1-R10-C04", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 4, "nivel": "A-B-C", "fill": "#B6D7A8", "chamber": "RACK_ENTRADA"}, {"code": "D1-R10-C06", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 6, "nivel": "A-B-C-D-E-F", "fill": "#B6D7A8", "chamber": "CAMARA_1"}, {"code": "D1-R10-C07", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 7, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_1"}, {"code": "D1-R10-C08", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 8, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_1"}, {"code": "D1-R10-C09", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 9, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_1"}, {"code": "D1-R10-C11", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 11, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R10-C12", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 12, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R10-C13", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 13, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R10-C14", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 14, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D1-R10-C15", "dep_id": "D1", "deposito": "Depósito 1", "row": 10, "col": 15, "nivel": "A", "fill": "#B6D7A8", "chamber": "CAMARA_3"}, {"code": "D2-R14-C01", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 1, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C02", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 2, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C03", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 3, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C04", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 4, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C05", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 5, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C06", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 6, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C07", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 7, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C08", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 8, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C09", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 9, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C10", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 10, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C11", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 11, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C12", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 12, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C13", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 13, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C14", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 14, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C15", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 15, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C16", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 16, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C17", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 17, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C18", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 18, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C19", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 19, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C20", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 20, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 21, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R14-C22", "dep_id": "D2", "deposito": "Depósito 2", "row": 14, "col": 22, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R15-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 15, "col": 23, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C03", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 3, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C04", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 4, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C06", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 6, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C07", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 7, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C09", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 9, "nivel": "A-B", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C10", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 10, "nivel": "A-B", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C12", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 12, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C13", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 13, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C15", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 15, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C16", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 16, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C19", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 19, "nivel": "A-B", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C20", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 20, "nivel": "A-B", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 21, "nivel": "A-B", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R16-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 16, "col": 23, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C01", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 1, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C03", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 3, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C04", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 4, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C06", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 6, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C07", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 7, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C09", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 9, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C10", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 10, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C12", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 12, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C13", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 13, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C15", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 15, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C16", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 16, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C19", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 19, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C20", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 20, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 21, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R17-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 17, "col": 23, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C01", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 1, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C03", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 3, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C04", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 4, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C06", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 6, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C07", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 7, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C09", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 9, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C10", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 10, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C12", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 12, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C13", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 13, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C15", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 15, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C16", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 16, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C19", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 19, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C20", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 20, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 21, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R18-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 18, "col": 23, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C03", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 3, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C04", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 4, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C06", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 6, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C07", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 7, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C09", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 9, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C10", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 10, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C12", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 12, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C13", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 13, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C15", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 15, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C16", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 16, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C19", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 19, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C20", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 20, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 21, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R19-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 19, "col": 23, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R21-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 21, "col": 21, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R21-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 21, "col": 23, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C09", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 9, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C10", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 10, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C11", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 11, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C12", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 12, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C13", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 13, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C14", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 14, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C17", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 17, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C18", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 18, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C19", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 19, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 21, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R22-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 22, "col": 23, "nivel": "A-B", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R23-C09", "dep_id": "D2", "deposito": "Depósito 2", "row": 23, "col": 9, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R23-C17", "dep_id": "D2", "deposito": "Depósito 2", "row": 23, "col": 17, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R23-C18", "dep_id": "D2", "deposito": "Depósito 2", "row": 23, "col": 18, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R23-C19", "dep_id": "D2", "deposito": "Depósito 2", "row": 23, "col": 19, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R23-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 23, "col": 21, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R23-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 23, "col": 23, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C09", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 9, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C10", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 10, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C11", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 11, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C12", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 12, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C13", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 13, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C14", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 14, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C15", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 15, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C17", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 17, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C18", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 18, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C19", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 19, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 21, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R24-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 24, "col": 23, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R25-C23", "dep_id": "D2", "deposito": "Depósito 2", "row": 25, "col": 23, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C09", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 9, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C11", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 11, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C12", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 12, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C13", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 13, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C14", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 14, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C15", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 15, "nivel": "A", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C17", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 17, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C18", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 18, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C19", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 19, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D2-R26-C21", "dep_id": "D2", "deposito": "Depósito 2", "row": 26, "col": 21, "nivel": "A-B-C", "fill": "#FCE5CD", "chamber": "GENERAL"}, {"code": "D3-R30-C01", "dep_id": "D3", "deposito": "Depósito 3", "row": 30, "col": 1, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R30-C02", "dep_id": "D3", "deposito": "Depósito 3", "row": 30, "col": 2, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R30-C03", "dep_id": "D3", "deposito": "Depósito 3", "row": 30, "col": 3, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R32-C01", "dep_id": "D3", "deposito": "Depósito 3", "row": 32, "col": 1, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R32-C02", "dep_id": "D3", "deposito": "Depósito 3", "row": 32, "col": 2, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R32-C03", "dep_id": "D3", "deposito": "Depósito 3", "row": 32, "col": 3, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R32-C04", "dep_id": "D3", "deposito": "Depósito 3", "row": 32, "col": 4, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R32-C05", "dep_id": "D3", "deposito": "Depósito 3", "row": 32, "col": 5, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R33-C01", "dep_id": "D3", "deposito": "Depósito 3", "row": 33, "col": 1, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R33-C02", "dep_id": "D3", "deposito": "Depósito 3", "row": 33, "col": 2, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R33-C03", "dep_id": "D3", "deposito": "Depósito 3", "row": 33, "col": 3, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R33-C04", "dep_id": "D3", "deposito": "Depósito 3", "row": 33, "col": 4, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R33-C05", "dep_id": "D3", "deposito": "Depósito 3", "row": 33, "col": 5, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R33-C08", "dep_id": "D3", "deposito": "Depósito 3", "row": 33, "col": 8, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R34-C08", "dep_id": "D3", "deposito": "Depósito 3", "row": 34, "col": 8, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R35-C01", "dep_id": "D3", "deposito": "Depósito 3", "row": 35, "col": 1, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R35-C02", "dep_id": "D3", "deposito": "Depósito 3", "row": 35, "col": 2, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R35-C03", "dep_id": "D3", "deposito": "Depósito 3", "row": 35, "col": 3, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R35-C04", "dep_id": "D3", "deposito": "Depósito 3", "row": 35, "col": 4, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R35-C05", "dep_id": "D3", "deposito": "Depósito 3", "row": 35, "col": 5, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R35-C08", "dep_id": "D3", "deposito": "Depósito 3", "row": 35, "col": 8, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R36-C01", "dep_id": "D3", "deposito": "Depósito 3", "row": 36, "col": 1, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R36-C02", "dep_id": "D3", "deposito": "Depósito 3", "row": 36, "col": 2, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R36-C03", "dep_id": "D3", "deposito": "Depósito 3", "row": 36, "col": 3, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R36-C04", "dep_id": "D3", "deposito": "Depósito 3", "row": 36, "col": 4, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R36-C05", "dep_id": "D3", "deposito": "Depósito 3", "row": 36, "col": 5, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R36-C08", "dep_id": "D3", "deposito": "Depósito 3", "row": 36, "col": 8, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R37-C01", "dep_id": "D3", "deposito": "Depósito 3", "row": 37, "col": 1, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R37-C02", "dep_id": "D3", "deposito": "Depósito 3", "row": 37, "col": 2, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R37-C03", "dep_id": "D3", "deposito": "Depósito 3", "row": 37, "col": 3, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R37-C04", "dep_id": "D3", "deposito": "Depósito 3", "row": 37, "col": 4, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R37-C05", "dep_id": "D3", "deposito": "Depósito 3", "row": 37, "col": 5, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R37-C08", "dep_id": "D3", "deposito": "Depósito 3", "row": 37, "col": 8, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R38-C01", "dep_id": "D3", "deposito": "Depósito 3", "row": 38, "col": 1, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R38-C08", "dep_id": "D3", "deposito": "Depósito 3", "row": 38, "col": 8, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R39-C01", "dep_id": "D3", "deposito": "Depósito 3", "row": 39, "col": 1, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R39-C02", "dep_id": "D3", "deposito": "Depósito 3", "row": 39, "col": 2, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R39-C03", "dep_id": "D3", "deposito": "Depósito 3", "row": 39, "col": 3, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R39-C04", "dep_id": "D3", "deposito": "Depósito 3", "row": 39, "col": 4, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R39-C05", "dep_id": "D3", "deposito": "Depósito 3", "row": 39, "col": 5, "nivel": "A", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R39-C06", "dep_id": "D3", "deposito": "Depósito 3", "row": 39, "col": 6, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}, {"code": "D3-R39-C07", "dep_id": "D3", "deposito": "Depósito 3", "row": 39, "col": 7, "nivel": "A-B-C", "fill": "#D9D2E9", "chamber": "GENERAL"}];

                      return filteredRows.map((row: any[], rIdx: number) => (
                        <tr key={rIdx}>
                          {row.map((cell: any, cIdx: number) => {
                            const isSlot = cell.is_storage;
                            const rStr = cell.r < 10 ? '0' + cell.r : cell.r;
                            const cStr = cell.c < 10 ? '0' + cell.c : cell.c;
                            const cellPosKey = `${cell.dep_id}-R${rStr}-C${cStr}`;
                            
                            let cellText = cell.val;
                            if (slotTypeMap[cellPosKey]) {
                              cellText = slotTypeMap[cellPosKey];
                            }

                            let bg = '#ffffff';
                            let color = '#334155';
                            let border = '1px solid #e2e8f0';

                            if (cellText.includes('BAÑO')) {
                              bg = '#fce7f3'; color = '#881337'; border = '1.5px solid #f43f5e';
                            } else if (cellText.includes('CAMARA 2')) {
                              bg = '#e0f2fe'; color = '#0369a1'; border = '2px solid #0284c7';
                            } else if (cellText.includes('CAMARA 1')) {
                              bg = '#ecfeff'; color = '#0e7490'; border = '2px solid #0891b2';
                            } else if (cellText.includes('CAMARA 3')) {
                              bg = '#f3e8ff'; color = '#6b21a8'; border = '2px solid #7e22ce';
                            }

                            if (isSlot) {
                              if (cellText === 'A') { bg = '#ffffff'; color = '#334155'; border = '1px solid #94a3b8'; }
                              else if (cellText === 'A-B') { bg = '#fef3c7'; color = '#92400e'; border = '1.5px solid #f59e0b'; }
                              else if (cellText === 'A-B-C') { bg = '#dbeafe'; color = '#1e40af'; border = '1.5px solid #3b82f6'; }
                              else if (cellText === 'A-B-C-D-E-F') { bg = '#dcfce7'; color = '#166534'; border = '2px solid #22c55e'; }
                            }

                            let hasStock = false;
                            let foundSlotObj: any = defaultSlots.find((s: any) => s.row === cell.r && s.col === cell.c);
                            if (foundSlotObj) {
                              const effChamber = chamberMap[cellPosKey] || foundSlotObj.chamber;
                              foundSlotObj = { ...foundSlotObj, chamber: effChamber, nivel: cellText };

                              allProducts.forEach(p => {
                                if (p.lots && p.lots.length > 0) {
                                  p.lots.forEach((l: any) => {
                                    if ((l.location === foundSlotObj.code || l.location.startsWith(foundSlotObj.code)) && l.stock > 0) hasStock = true;
                                  });
                                } else if (p.defaultLocation === foundSlotObj.code && p.stock > 0) {
                                  hasStock = true;
                                }
                              });
                            }

                            const currentChamber = chamberMap[cellPosKey] || (foundSlotObj ? foundSlotObj.chamber : 'GENERAL');
                            const isChamberSelected = selectedSector !== 'ALL' && currentChamber === selectedSector;
                            const isSelected = selectedSlot && foundSlotObj && selectedSlot.code === foundSlotObj.code;

                            // Colores de sector en modo edición o filtrado
                            if (currentChamber === 'ESTANTERIA') {
                              bg = '#fce7f3'; color = '#be185d'; border = '1.5px solid #be185d';
                            } else if (currentChamber === 'RACK_ENTRADA') {
                              bg = '#fef3c7'; color = '#d97706'; border = '1.5px solid #d97706';
                            } else if (currentChamber === 'CAMARA_2') {
                              bg = '#e0f2fe'; color = '#0284c7'; border = '1.5px solid #0284c7';
                            } else if (currentChamber === 'CAMARA_1') {
                              bg = '#ecfeff'; color = '#0891b2'; border = '1.5px solid #0891b2';
                            } else if (currentChamber === 'CAMARA_3') {
                              bg = '#f3e8ff'; color = '#7e22ce'; border = '1.5px solid #7e22ce';
                            } else if (currentChamber === 'BANO') {
                              bg = '#ffe4e6'; color = '#e11d48'; border = '1.5px solid #e11d48';
                            }

                            return (
                              <td
                                key={cIdx}
                                onClick={() => {
                                  if (isEditMode) {
                                    // MODO EDICIÓN: PINTAR O CAMBIAR NIVEL
                                    if (activeBrush === 'TOGGLE_LEVEL') {
                                      const levelsSeq = ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F'];
                                      const curIdx = levelsSeq.indexOf(cellText);
                                      const nextNivel = curIdx === -1 || curIdx === levelsSeq.length - 1 ? 'A' : levelsSeq[curIdx + 1];
                                      const newTypeMap = { ...slotTypeMap, [cellPosKey]: nextNivel };
                                      setSlotTypeMap(newTypeMap);
                                      localStorage.setItem('wms_custom_slottype_map_v2', JSON.stringify(newTypeMap));
                                    } else {
                                      const newChamberMap = { ...chamberMap, [cellPosKey]: activeBrush };
                                      setChamberMap(newChamberMap);
                                      localStorage.setItem('wms_custom_chamber_map_v2', JSON.stringify(newChamberMap));
                                    }
                                  } else {
                                    // MODO INSPECCIÓN NORMAL
                                    if (isSlot && foundSlotObj) {
                                      setSelectedSlot(foundSlotObj);
                                      setSelectedMapLocation(foundSlotObj.code);
                                    }
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (!isEditMode && isSlot && foundSlotObj) {
                                    setSelectedSlot(foundSlotObj);
                                    setIsSimpleStockModalOpen(true);
                                  }
                                }}
                                style={{
                                  border: isSelected 
                                    ? '2.5px solid #007AFF' 
                                    : isChamberSelected 
                                    ? '2.5px solid #be185d' 
                                    : hasStock 
                                    ? '2px solid #22c55e' 
                                    : border,
                                  backgroundColor: isSelected 
                                    ? '#e0f2fe' 
                                    : isChamberSelected 
                                    ? '#fbcfe8' 
                                    : hasStock 
                                    ? '#dcfce7' 
                                    : bg,
                                  color: isSelected ? '#007AFF' : isChamberSelected ? '#831843' : hasStock ? '#15803d' : color,
                                  fontWeight: isSlot || cellText.length > 2 ? 'bold' : 'normal',
                                  padding: '2px 3px',
                                  textAlign: 'center',
                                  height: '28px',
                                  cursor: isEditMode ? 'crosshair' : (isSlot ? 'pointer' : 'default'),
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  borderRadius: isSlot ? '3px' : '1px',
                                  boxShadow: isEditMode ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                }}
                                title={isEditMode ? `Pintar ${cellPosKey} con ${activeBrush}` : (isSlot && foundSlotObj ? `${foundSlotObj.code} (${foundSlotObj.deposito} - ${currentChamber})` : cellText)}
                              >
                                {isSlot ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                    <span>{cellText}</span>
                                    {hasStock && <span style={{ color: '#22c55e', fontSize: '0.6rem' }}>🟢</span>}
                                  </div>
                                ) : (
                                  cellText
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Lateral de Inspección y Carga de Stock */}
            <div style={{ width: '350px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                📍 {isEditMode ? 'Pintador de Sectores Activo' : 'Detalle de Selección'}
              </h4>

              {isEditMode ? (
                <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fda4af', padding: '14px', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#9f1239', marginBottom: '6px' }}>
                    🎨 Pincel Seleccionado:
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#be185d', marginBottom: '8px' }}>
                    {activeBrush === 'ESTANTERIA' && '📦 Estanterías (Rosa)'}
                    {activeBrush === 'RACK_ENTRADA' && '🚪 Rack Entrada (Naranja)'}
                    {activeBrush === 'CAMARA_2' && '❄️ Cámara 2 Frío - Quesos (Azul)'}
                    {activeBrush === 'CAMARA_1' && '❄️ Cámara 1 Frío - Lácteos (Cyan)'}
                    {activeBrush === 'CAMARA_3' && '📦 Cámara 3 Seco - Conservas (Púrpura)'}
                    {activeBrush === 'BANO' && '🚻 Baño (Rosa Suave)'}
                    {activeBrush === 'GENERAL' && '⚪ Sin Sector (Gris)'}
                    {activeBrush === 'TOGGLE_LEVEL' && '🔲 Alternar Nivel (A -> A-B -> A-B-C)'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#be185d', lineHeight: '1.4' }}>
                    Hacé clic en cualquier casilla de la grilla para asignarle este sector o tipo al instante. Los cambios quedan guardados automáticamente.
                  </div>
                </div>
              ) : (
                selectedSector !== 'ALL' && !selectedSlot && (
                  <div style={{ backgroundColor: '#fce7f3', border: '1px solid #fbcfe8', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#9d174d', marginBottom: '4px' }}>
                      {selectedSector === 'ESTANTERIA' && '📦 Estanterías generales'}
                      {selectedSector === 'RACK_ENTRADA' && '🚪 Rack Entrada'}
                      {selectedSector === 'CAMARA_2' && '❄️ Cámara 2 Frío - Quesos'}
                      {selectedSector === 'CAMARA_1' && '❄️ Cámara 1 Frío - Lácteos'}
                      {selectedSector === 'CAMARA_3' && '📦 Cámara 3 Seco - Conservas'}
                      {selectedSector === 'BANO' && '🚻 Baño'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#be185d' }}>
                      Los slots exactos de este sector están resaltados. Tocá cualquier slot para inspeccionar o cargar productos.
                    </div>
                  </div>
                )
              )}

              {selectedSlot && !isEditMode ? (
                <div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {selectedSlot.code}
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2563eb', marginBottom: '2px' }}>
                      📍 {selectedSlot.deposito} - Sector: <span style={{ color: '#be185d' }}>{selectedSlot.chamber}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Fila {selectedSlot.row}, Columna {selectedSlot.col} de depositomapa.xlsx. Nivel: <strong>{selectedSlot.nivel}</strong>.
                    </div>
                  </div>

                  {(() => {
                    const matchingProducts: { product: any; lot: any }[] = [];
                    allProducts.forEach(p => {
                      if (p.lots && p.lots.length > 0) {
                        p.lots.forEach((l: any) => {
                          if ((l.location === selectedSlot.code || l.location.startsWith(selectedSlot.code)) && l.stock > 0) {
                            matchingProducts.push({ product: p, lot: l });
                          }
                        });
                      } else if (p.defaultLocation === selectedSlot.code && p.stock > 0) {
                        matchingProducts.push({ product: p, lot: { lotNumber: 'S/L', stock: p.stock } });
                      }
                    });

                    if (matchingProducts.length === 0) {
                      return (
                        <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '6px' }}>⚪</div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Slot Vacío (Disponible)</div>
                          <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                            Posición sin productos asignados.
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '14px', fontSize: '0.84rem', padding: '9px 14px', fontWeight: 700, borderRadius: '8px' }}
                            onClick={() => setIsSimpleStockModalOpen(true)}
                          >
                            ➕ Cargar Mercadería en este Slot
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>MERCADERÍA ASIGNADA</span>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>🟢 OCUPADO</span>
                        </div>

                        {matchingProducts.map(({ product, lot }, idx) => (
                          <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', backgroundColor: '#fafafa' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                              [{product.sku}] {product.name}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              <div>Lote: <strong style={{ color: 'var(--text-primary)' }}>{lot.lotNumber}</strong></div>
                              <div>Stock: <strong style={{ color: 'var(--color-primary)' }}>{lot.stock} un.</strong></div>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ width: '100%', marginTop: '8px', fontSize: '0.84rem', padding: '9px 14px', fontWeight: 700, borderRadius: '8px' }}
                          onClick={() => setIsSimpleStockModalOpen(true)}
                        >
                          ➕ Cargar / Añadir Más Stock
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                !isEditMode && (
                  <div style={{ padding: '35px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👆</div>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Seleccioná un sector o slot</div>
                    <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Tocá los botones de sectores/cámaras o cualquier celda A, A-B para inspeccionar.</div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          2.3 CONTROL DE LOTES Y VENCIMIENTOS
          ==================================================================== */}
      {subTab === 'lot-expiration' && !selectedOrder && !showConsolidatedView && (
        <div>
          {/* Tarjeta de alertas */}
          {expiringLots.length > 0 && (
            <div className="card" style={{ 
              backgroundColor: '#FFF2F2', 
              border: '1px solid #FFD1D1', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#C0392B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ Alerta: Lotes Vencidos o Próximos a Vencer (Menos de 30 días)
              </h4>
              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {expiringLots.map((lot) => {
                  const daysLeft = Math.ceil((new Date(lot.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  const isExpired = daysLeft <= 0;
                  return (
                    <div key={lot.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      fontSize: '0.85rem', 
                      padding: '6px 10px', 
                      backgroundColor: '#fff', 
                      borderRadius: '4px',
                      borderLeft: isExpired ? '4px solid #C0392B' : '4px solid #F39C12'
                    }}>
                      <div>
                        <strong>{lot.product?.name}</strong> <span style={{ color: 'var(--text-secondary)' }}>(SKU: {lot.product?.sku})</span>
                        <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                          Lote: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{lot.lotNumber}</span> | Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ 
                          fontWeight: 'bold', 
                          color: isExpired ? '#C0392B' : '#E67E22', 
                          backgroundColor: isExpired ? '#FDEDEC' : '#FEF9E7',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          display: 'inline-block'
                        }}>
                          {isExpired ? 'VENCIDO' : `Vence en ${daysLeft} días`}
                        </span>
                        <span style={{ fontWeight: 600, marginLeft: '12px' }}>Stock: {lot.stock} u.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Listado de todos los lotes activos */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Control General de Lotes</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Visualizá el vencimiento y la ubicación física de todos los lotes con stock en el sistema.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    // Generar lista de etiquetas para imprimir
                    const activeLots: any[] = [];
                    allProducts.forEach(prod => {
                      (prod.lots || []).forEach((lot: any) => {
                        if (lot.stock > 0) {
                          activeLots.push({
                            isLotLabel: true,
                            productName: prod.name,
                            sku: prod.sku,
                            lotNumber: lot.lotNumber,
                            expirationDate: lot.expirationDate,
                            location: lot.location
                          });
                        }
                      });
                    });
                    
                    if (activeLots.length === 0) {
                      alert("No hay lotes con stock para imprimir etiquetas.");
                      return;
                    }
                    
                    setLabelsToPrint(activeLots);
                    setTimeout(() => {
                      window.print();
                      setLabelsToPrint([]);
                    }, 200);
                  }}
                >
                  <Printer size={16} />
                  <span>Imprimir Todas las Etiquetas</span>
                </button>
                <button className="btn btn-secondary" onClick={() => fetchData()}>
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Artículo</th>
                    <th>Lote</th>
                    <th>Fecha Vencimiento</th>
                    <th>Estado Vence</th>
                    <th>Ubicación</th>
                    <th style={{ textAlign: 'right' }}>Stock Lote</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const allLotsList: any[] = [];
                    allProducts.forEach(prod => {
                      (prod.lots || []).forEach((lot: any) => {
                        allLotsList.push({ product: prod, lot });
                      });
                    });

                    // Ordenar por fecha de vencimiento
                    allLotsList.sort((a, b) => new Date(a.lot.expirationDate).getTime() - new Date(b.lot.expirationDate).getTime());

                    if (allLotsList.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '24px 0' }}>No hay lotes registrados.</td>
                        </tr>
                      );
                    }

                    return allLotsList.map((entry, idx) => {
                      const { product, lot } = entry;
                      const daysLeft = Math.ceil((new Date(lot.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                      const _isExpired = daysLeft <= 0;
                      
                      let badgeColor = 'expiry-normal';
                      let statusText = 'Saludable';
                      if (daysLeft <= 0) {
                        badgeColor = 'expiry-critical';
                        statusText = 'Vencido';
                      } else if (daysLeft <= 30) {
                        badgeColor = 'expiry-critical';
                        statusText = `Vence en ${daysLeft} d.`;
                      } else if (daysLeft <= 60) {
                        badgeColor = 'expiry-warning';
                        statusText = `Vence en ${daysLeft} d.`;
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{product.sku}</td>
                          <td style={{ fontWeight: 500 }}>{product.name}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{lot.lotNumber}</td>
                          <td>{new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                              <span className={`expiry-dot ${badgeColor}`} />
                              {statusText}
                            </span>
                          </td>
                          <td>{renderLocationTag(lot.location)}</td>
                          <td style={{ fontWeight: 700, textAlign: 'right' }}>{lot.stock} u.</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setStockModal({
                                    open: true,
                                    product,
                                    quantityChange: 0,
                                    reason: 'Ajuste de stock desde panel de vencimientos',
                                    lotNumber: lot.lotNumber,
                                    isNewLot: false,
                                    expirationDate: lot.expirationDate,
                                    location: lot.location || 'S/U'
                                  });
                                }}
                              >
                                Ajustar
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  // Imprimir etiqueta individual
                                  setLabelsToPrint([{
                                    isLotLabel: true,
                                    productName: product.name,
                                    sku: product.sku,
                                    lotNumber: lot.lotNumber,
                                    expirationDate: lot.expirationDate,
                                    location: lot.location
                                  }]);
                                  setTimeout(() => {
                                    window.print();
                                    setLabelsToPrint([]);
                                  }, 200);
                                }}
                              >
                                <Printer size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE DE STOCK */}
      {stockModal.open && stockModal.product && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Ajustar Stock Físico</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setStockModal({ open: false, product: null, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '', location: '' })}>✕</button>
            </div>
            <form onSubmit={handleStockAdjustSubmit}>
              <div style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
                <p><strong>Artículo:</strong> {stockModal.product.name}</p>
                <p><strong>SKU:</strong> {stockModal.product.sku}</p>
                <p><strong>Stock actual total:</strong> {stockModal.product.stock} u.</p>
              </div>

              <div className="form-group">
                <label>Cantidad a Sumar o Restar</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Ej: 50 para sumar, -20 para restar"
                  value={stockModal.quantityChange || ''}
                  onChange={(e) => setStockModal({ ...stockModal, quantityChange: Number(e.target.value) })}
                  required
                />
              </div>

              {/* Selector de Lotes */}
              <div className="form-group">
                <label>Lote Asociado</label>
                <select
                  className="select"
                  value={stockModal.isNewLot ? '__new__' : stockModal.lotNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__new__') {
                      setStockModal({ ...stockModal, isNewLot: true, lotNumber: '', expirationDate: '', location: '' });
                    } else {
                      const lot = (stockModal.product?.lots || []).find((l: any) => l.lotNumber === val);
                      setStockModal({ ...stockModal, isNewLot: false, lotNumber: val, expirationDate: '', location: lot ? (lot.location || '') : '' });
                    }
                  }}
                >
                  <option value="">Sin lote (Stock Genérico / General)</option>
                  {(stockModal.product?.lots || []).map((lot: any) => (
                    <option key={lot.id} value={lot.lotNumber}>
                      Lote: {lot.lotNumber} (Stock: {lot.stock} u. - Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })})
                    </option>
                  ))}
                  {Number(stockModal.quantityChange) > 0 && (
                    <option value="__new__">+ Crear nuevo lote...</option>
                  )}
                </select>
              </div>

              {(stockModal.lotNumber || stockModal.isNewLot) && (
                <div className="form-group">
                  <label>Ubicación Física Estandarizada</label>
                  <select
                    className="select"
                    value={Object.keys(LOCATION_MAP).includes(stockModal.location) ? stockModal.location : (stockModal.location && stockModal.location !== 'S/U') ? '__custom__' : 'S/U'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setStockModal({ ...stockModal, location: '' });
                      } else {
                        setStockModal({ ...stockModal, location: val });
                      }
                    }}
                  >
                    {Object.entries(LOCATION_MAP).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.icon} {info.label}
                      </option>
                    ))}
                    <option value="__custom__">✍️ Personalizada / Otra...</option>
                  </select>

                  {(!Object.keys(LOCATION_MAP).includes(stockModal.location) || stockModal.location === '') && (
                    <input
                      type="text"
                      className="input"
                      style={{ marginTop: '8px' }}
                      placeholder="Escribir ubicación personalizada..."
                      value={stockModal.location || ''}
                      onChange={(e) => setStockModal({ ...stockModal, location: e.target.value })}
                    />
                  )}
                </div>
              )}

              {stockModal.isNewLot && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Nro de Lote Nuevo</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ej: L-VENC-01"
                      value={stockModal.lotNumber}
                      onChange={(e) => setStockModal({ ...stockModal, lotNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fecha de Vencimiento</label>
                    <input
                      type="date"
                      className="input"
                      value={stockModal.expirationDate}
                      onChange={(e) => setStockModal({ ...stockModal, expirationDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Motivo del Ajuste de Stock</label>
                <select 
                  className="select"
                  value={stockModal.reason}
                  onChange={(e) => setStockModal({ ...stockModal, reason: e.target.value })}
                  required
                >
                  <option value="">Seleccionar motivo...</option>
                  <option value="Ingreso de mercadería por compras">Ingreso de mercadería por compras</option>
                  <option value="Ajuste por inventario físico mensual">Ajuste por inventario físico mensual</option>
                  <option value="Rotura / Vencimiento de lote">Rotura / Vencimiento de lote</option>
                  <option value="Devolución de cliente">Devolución de cliente</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStockModal({ open: false, product: null, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '', location: '' })}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Ajustando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONTROL Y CIERRE DE BULTOS */}
      {showBultoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Confirmación de Bultos Físicos</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowBultoModal(false)}>✕</button>
            </div>
            
            <div style={{ padding: '10px 0 20px 0' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Ingresá la cantidad de paquetes, bandejas o bultos armados para pegar las etiquetas de reparto:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Bandejas de Frio */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>❄️</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Bandejas de Frío (Lácteos sueltos)</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Productos sueltos de heladera</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '70px', textAlign: 'center', fontWeight: 'bold' }}
                    min={0}
                    value={bultosData.frio || ''}
                    onChange={(e) => setBultosData({ ...bultosData, frio: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                  />
                </div>

                {/* Bandejas de Secos */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📥</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Bandejas de Secos (Mercadería suelta)</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Paquetes o latas sueltas</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '70px', textAlign: 'center', fontWeight: 'bold' }}
                    min={0}
                    value={bultosData.secos || ''}
                    onChange={(e) => setBultosData({ ...bultosData, secos: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                  />
                </div>

                {/* Atados de Tabla */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🍾</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Bebidas / Tabla (Atados/Bolsones)</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Packs grandes o bolsas pesadas</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '70px', textAlign: 'center', fontWeight: 'bold' }}
                    min={0}
                    value={bultosData.tabla || ''}
                    onChange={(e) => setBultosData({ ...bultosData, tabla: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                  />
                </div>

                {/* Cajas Cerradas */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📦</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Cajas Cerradas (Bultos cerrados)</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cajas originales de fábrica</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '70px', textAlign: 'center', fontWeight: 'bold' }}
                    min={0}
                    value={bultosData.cajasCerradas || ''}
                    onChange={(e) => setBultosData({ ...bultosData, cajasCerradas: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                  />
                </div>

              </div>
              
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>Total Bultos:</span>
                <span style={{ 
                  fontSize: '1.4rem', 
                  fontWeight: 800, 
                  backgroundColor: 'rgba(227, 6, 19, 0.08)', 
                  color: 'var(--accent-color)', 
                  padding: '2px 14px', 
                  borderRadius: '20px',
                  border: '1px solid rgba(227, 6, 19, 0.1)'
                }}>
                  {Number(bultosData.frio) + Number(bultosData.secos) + Number(bultosData.tabla) + Number(bultosData.cajasCerradas)}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBultoModal(false)}>Cancelar</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleConfirmBultosAndFinish}
                disabled={loading || (Number(bultosData.frio) + Number(bultosData.secos) + Number(bultosData.tabla) + Number(bultosData.cajasCerradas)) <= 0}
              >
                {loading ? 'Finalizando...' : 'Confirmar y Generar Etiquetas 🖨️'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor de impresión de etiquetas térmicas */}
      {labelsToPrint.length > 0 && (
        <div className="print-only-layout" style={{ display: 'none' }}>
          {labelsToPrint.map((label, idx) => {
            if (label.isLotLabel) {
              return (
                <div key={idx} className="label-card" style={{
                  width: '80mm',
                  height: '80mm',
                  border: '2px solid #000',
                  padding: '16px',
                  margin: '0 auto 20px auto',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  backgroundColor: '#fff',
                  color: '#000',
                  pageBreakAfter: 'always'
                }}>
                  <div>
                    <div style={{ borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold' }}>CONTROL DE LOTE - WMS</span>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>ARTÍCULO:</strong>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '2px' }}>{label.productName}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <strong>SKU:</strong>
                        <div style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }}>{label.sku}</div>
                      </div>
                      <div>
                        <strong>UBICACIÓN:</strong>
                        <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{label.location || 'S/U'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <strong>LOTE:</strong>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', fontFamily: 'monospace', color: '#000' }}>{label.lotNumber}</div>
                      </div>
                      <div>
                        <strong>EXPIRA / VENCE:</strong>
                        <div style={{ fontWeight: 'bold' }}>{new Date(label.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', marginTop: '6px', textAlign: 'center' }}>
                    <div style={{ letterSpacing: '3px', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>
                      ||||| | || ||||| | |||
                    </div>
                    <span style={{ fontSize: '9px', color: '#666' }}>{label.sku}-{label.lotNumber}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className="label-card" style={{
                width: '80mm',
                height: '80mm',
                border: '2px solid #000',
                padding: '16px',
                margin: '0 auto 20px auto',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontFamily: 'monospace',
                fontSize: '11px',
                backgroundColor: '#fff',
                color: '#000',
                pageBreakAfter: 'always'
              }}>
                <div>
                  <div style={{ borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ARMADO DE PEDIDOS</span>
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <strong>CLIENTE:</strong>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>{label.client}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                    <div>
                      <strong>RUTA:</strong>
                      <div style={{ fontWeight: 'bold' }}>{label.route}</div>
                    </div>
                    <div>
                      <strong>ORDEN RUTA:</strong>
                      <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{label.sequence}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                    <div>
                      <strong>PEDIDO:</strong>
                      <div style={{ fontWeight: 'bold' }}>#{label.orderId}</div>
                    </div>
                    <div>
                      <strong>FECHA:</strong>
                      <div>{new Date().toLocaleDateString('es-AR')}</div>
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', marginTop: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '4px', border: '1px solid #000', marginBottom: '6px' }}>
                    {label.zone}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}>
                    BULTO: {label.index} de {label.total}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contenedor de impresión de la Planilla Consolidada */}
      {showConsolidatedView && (
        <div className="print-consolidated-sheet" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: '16px', letterSpacing: '0.05em' }}>Planilla de Picking Consolidada</h2>
            <div style={{ fontSize: '11px', marginTop: '6px' }}>
              <strong>Fecha Emisión:</strong> {new Date().toLocaleDateString('es-AR')} |{' '}
              <strong>Total Pedidos:</strong> {selectedOrdersList.length} ({selectedOrdersList.map(o => `#${o.id}`).join(', ')})
            </div>
            <div style={{ fontSize: '11px', marginTop: '3px' }}>
              <strong>Rutas de Despacho:</strong> {Array.from(new Set(selectedOrdersList.map(o => o.persona?.route || 'RETIRO EN DEPÓSITO'))).join(', ')}
            </div>
          </div>
          
          {['FRIO', 'TABLA', 'CAJAS'].map(zone => {
            const zoneItems = consolidatedItems.filter(i => (i.product?.pickingZone || i.product?.rubro?.pickingZone || 'CAJAS') === zone);
            if (zoneItems.length === 0) return null;
            
            const zoneName = zone === 'FRIO' ? '❄️ SECTOR FRÍO' : zone === 'TABLA' ? '🍾 SECTOR TABLA/BEBIDAS' : '📦 SECTOR SECOS/CAJAS';
            
            return (
              <div key={zone} style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
                <h3 style={{ borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                  {zoneName} ({zoneItems.length} artículos)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '25px', textAlign: 'center' }}>[ ]</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '90px', textAlign: 'left' }}>Ubicación</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '90px', textAlign: 'left' }}>SKU</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Artículo</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '70px', textAlign: 'right' }}>Cant.</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Detalle de Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zoneItems.map((item, idx) => {
                      const location = getProductLocation(item.product);
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>☐</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>{location}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontFamily: 'monospace' }}>{item.product.sku}</td>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{item.product.name}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: 'bold', fontSize: '11px' }}>
                            {item.totalQuantity} u.
                          </td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontSize: '9px', color: '#444' }}>
                            {item.orderDetails.map((det: any) => `#${det.orderId}(${det.quantity}u)`).join(' | ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Estilos adicionales e impresión */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Impresión de etiquetas térmica */
          body.printing-labels > * {
            display: none !important;
          }
          body.printing-labels .print-only-layout {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
          }
          body.printing-labels .label-card {
            page-break-after: always;
            box-shadow: none !important;
            border: 2px solid #000 !important;
          }

          /* Impresión de planilla de picking consolidada */
          body.printing-consolidated > * {
            display: none !important;
          }
          body.printing-consolidated .print-consolidated-sheet {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            background: #fff !important;
            color: #000 !important;
          }
        }
      `}} />
      {/* Modal / Ventana Ampliada del Plano Gráfico 95-100% Fiel a mapa deposito.xlsx */}
      <ExcelSpatialMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        allProducts={allProducts}
        onAssignStock={async (slotCode, productId, lotNumber, expDate, qty) => {
          try {
            const token = localStorage.getItem('token');
            await fetch('http://localhost:3001/api/products/' + productId + '/stock', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({
                quantityChange: qty,
                reason: 'Carga inicial desde Plano 2D WMS',
                lotNumber: lotNumber,
                expirationDate: expDate,
                location: slotCode
              })
            });
            fetchData();
          } catch (err) {
            console.error('Error al asignar stock desde el plano:', err);
          }
        }}
      />
      <SimpleStockLoadModal
        isOpen={isSimpleStockModalOpen}
        onClose={() => setIsSimpleStockModalOpen(false)}
        slot={selectedSlot}
        allProducts={allProducts}
        onSaveStock={async (slotCode, productId, lotNumber, expDate, qty) => {
          try {
            await api.adjustStock(
              productId,
              qty,
              'Carga desde Plano WMS',
              lotNumber,
              expDate,
              slotCode
            );
            playBeep('success');
            await fetchData();
          } catch (err: any) {
            console.error('Error al guardar stock:', err);
            playBeep('error');
            throw err;
          }
        }}
      />
    </div>
  );
}
