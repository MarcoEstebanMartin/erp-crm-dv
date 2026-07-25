import { useState, useEffect, useMemo, Fragment } from 'react';
import { X, Printer, Check, Info, FileText } from 'lucide-react';
import { api } from '../utils/api';

interface PriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  barcode: string | null;
  costPrice: number;
  listPrice: number;
  listPriceB: number;
  listPriceC: number;
  stock: number;
}

interface SubcategoryGroup {
  name: string;
  products: Product[];
  brands: { [brand: string]: Product[] };
}

interface CategoryGroup {
  name: string;
  directProducts: Product[];
  subcategories: { [sub: string]: SubcategoryGroup };
}

// Mapeo exhaustivo de descriptions a Rubros, Subrubros y Marcas
const CATEGORY_MAP: Record<string, { category: string; subcategory?: string; brand?: string }> = {
  // 1 - REMOTTI
  "MELINCUE": { category: "1 - REMOTTI", subcategory: "MELINCUE" },
  
  // 1.1 - LECHES
  "CHOCOLATADAS": { category: "1.1 - LECHES", subcategory: "CHOCOLATADAS" },
  "LECHES EN POLVO": { category: "1.1 - LECHES", subcategory: "LECHES EN POLVO" },
  "LECHES LIQUIDAS": { category: "1.1 - LECHES", subcategory: "LECHES LIQUIDAS" },
  "YOGURT": { category: "1.1 - LECHES", subcategory: "YOGURT" },
  
  // 1.2 - SANCOR y CREMIGAL
  "CREMAS": { category: "1.2 - SANCOR y CREMIGAL", subcategory: "CREMAS" },
  "DULCES DE LECHE": { category: "1.2 - SANCOR y CREMIGAL", subcategory: "DULCES DE LECHE" },
  "MANTECAS": { category: "1.2 - SANCOR y CREMIGAL", subcategory: "MANTECAS" },
  "MIEL": { category: "1.2 - SANCOR y CREMIGAL", subcategory: "MIEL" },
  "QUESOS": { category: "1.2 - SANCOR y CREMIGAL", subcategory: "QUESOS" },
  "QUESOS UNTABLES": { category: "1.2 - SANCOR y CREMIGAL", subcategory: "QUESOS UNTABLES" },
  
  // 1.21 - QUESOS RALLADOS
  "1.21 - QUESOS RALLADOS": { category: "1.21 - QUESOS RALLADOS" },
  
  // 1.4 - SODECAR
  "1.4 - SODECAR": { category: "1.4 - SODECAR" },
  
  // 1.5 - CONSERVAS
  "1.5 - CONSERVAS": { category: "1.5 - CONSERVAS" },
  
  // 1.6 - A.G.D Y NIZA
  "ACEITES Y VINAGRES": { category: "1.6 - A.G.D Y NIZA", subcategory: "ACEITES Y VINAGRES" },
  "ADEREZOS": { category: "1.6 - A.G.D Y NIZA", subcategory: "ADEREZOS" },
  
  // 1.7 - CAFE
  "1.7 - CAFE": { category: "1.7 - CAFE" },
  
  // 1.8 - ARROZ
  "1.8 - ARROZ": { category: "1.8 - ARROZ" },
  
  // 1.9 - YERBAS
  "1.9 - YERBAS": { category: "1.9 - YERBAS" },
  
  // 2 - AZUCAR
  "2 - AZUCAR": { category: "2 - AZUCAR" },
  
  // 2.1 - EDULCORANTES
  "2.1 - EDULCORANTES": { category: "2.1 - EDULCORANTES" },
  
  // 2.3 - PESCADERIA
  "2.3 - PESCADERIA": { category: "2.3 - PESCADERIA" },
  
  // 2.4 - PASTAS SECAS
  "2.4 - PASTAS SECAS": { category: "2.4 - PASTAS SECAS" },
  
  // 2.5 - PAPELES
  "HIGIENICOS": { category: "2.5 - PAPELES", subcategory: "HIGIENICOS" },
  "ROLLOS DE COCINA": { category: "2.5 - PAPELES", subcategory: "ROLLOS DE COCINA" },
  
  // 2.6 - REGALERIA
  "2.6 - REGALERIA": { category: "2.6 - REGALERIA" },
  
  // 2.7 - BEBIDAS
  "AGUAS SABORIZADAS Y JUGOS": { category: "2.7 - BEBIDAS", subcategory: "AGUAS SABORIZADAS Y JUGOS" },
  "AGUAS Y SODAS": { category: "2.7 - BEBIDAS", subcategory: "AGUAS Y SODAS" },
  "APERITIVOS Y BEBIDAS ESPECIALES": { category: "2.7 - BEBIDAS", subcategory: "APERITIVOS Y BEBIDAS ESPECIALES" },
  "CEPAS": { category: "2.7 - BEBIDAS", subcategory: "CEPAS" },
  "ESPUMANTES Y SIDRAS": { category: "2.7 - BEBIDAS", subcategory: "ESPUMANTES Y SIDRAS" },
  "FERNET": { category: "2.7 - BEBIDAS", subcategory: "FERNET" },
  "GASEOSAS": { category: "2.7 - BEBIDAS", subcategory: "GASEOSAS" },
  "LICORES": { category: "2.7 - BEBIDAS", subcategory: "LICORES" },
  "R.P.B": { category: "2.7 - BEBIDAS", subcategory: "R.P.B" },
  "R.P .B": { category: "2.7 - BEBIDAS", subcategory: "R.P.B" },
  "WHISKIES": { category: "2.7 - BEBIDAS", subcategory: "WHISKIES" },
  
  // VINOS FINOS (Bodegas y Marcas)
  "BODEGAS BIANCHI": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "BODEGAS BIANCHI" },
  "BODEGAS CATENA": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "BODEGAS CATENA" },
  "BODEGAS CHANDON": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "BODEGAS CHANDON" },
  "BODEGAS LA RURAL": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "BODEGAS LA RURAL" },
  "BODEGAS LOPEZ": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "BODEGAS LOPEZ" },
  "BODEGAS LOS HAROLDOS": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "BODEGAS LOS HAROLDOS" },
  "BODEGAS LOS HARoldOS": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "BODEGAS LOS HAROLDOS" },
  "BODEGAS ZUCCARDI": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "BODEGAS ZUCCARDI" },
  "GRUPO PEÑAFLOR": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "GRUPO PEÑAFLOR" },
  "GRUPO PEAFLOR": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "GRUPO PEÑAFLOR" },
  "NIETOS SENETINER": { category: "2.7 - BEBIDAS", subcategory: "VINOS FINOS", brand: "NIETOS SENETINER" },
  
  // 2.8 - NO COMESTIBLES
  "2.8 - NO COMESTIBLES": { category: "2.8 - NO COMESTIBLES" }
};

// Orden de aparición exacto de los rubros principales
const CATEGORY_ORDER = [
  "1 - REMOTTI",
  "1.1 - LECHES",
  "1.2 - SANCOR y CREMIGAL",
  "1.21 - QUESOS RALLADOS",
  "1.4 - SODECAR",
  "1.5 - CONSERVAS",
  "1.6 - A.G.D Y NIZA",
  "1.7 - CAFE",
  "1.8 - ARROZ",
  "1.9 - YERBAS",
  "2 - AZUCAR",
  "2.1 - EDULCORANTES",
  "2.3 - PESCADERIA",
  "2.4 - PASTAS SECAS",
  "2.5 - PAPELES",
  "2.6 - REGALERIA",
  "2.7 - BEBIDAS",
  "2.8 - NO COMESTIBLES",
  "VARIOS"
];

export default function PriceListModal({ isOpen, onClose }: PriceListModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configuración
  const [priceListType, setPriceListType] = useState<'A' | 'B' | 'C'>('A');
  const [targetType, setTargetType] = useState<'client' | 'staff'>('client');
  const [hideNumbers, setHideNumbers] = useState(true);
  const [fontScale, setFontScale] = useState<'small' | 'medium' | 'large'>('medium');
  const [listDate, setListDate] = useState(() => {
    const today = new Date();
    return `${today.getDate()} - ${today.getMonth() + 1} - ${today.getFullYear()}`;
  });

  const fontScaleConfig = useMemo(() => {
    switch (fontScale) {
      case 'small':
        return {
          viewSize: '0.66rem',
          viewHeaderSize: '0.74rem',
          viewSubheaderSize: '0.7rem',
          viewBrandSize: '0.66rem',
          viewPadding: '2.5px 5px',
          printSize: '7.5pt',
          printHeaderSize: '8.2pt',
          printSubheaderSize: '7.8pt',
          printBrandSize: '7.5pt',
          printPadding: '2px 4px',
        };
      case 'large':
        return {
          viewSize: '0.86rem',
          viewHeaderSize: '0.96rem',
          viewSubheaderSize: '0.9rem',
          viewBrandSize: '0.86rem',
          viewPadding: '5px 10px',
          printSize: '10.5pt',
          printHeaderSize: '11.5pt',
          printSubheaderSize: '11pt',
          printBrandSize: '10.5pt',
          printPadding: '4.5px 7px',
        };
      default: // medium
        return {
          viewSize: '0.76rem',
          viewHeaderSize: '0.84rem',
          viewSubheaderSize: '0.78rem',
          viewBrandSize: '0.74rem',
          viewPadding: '3.5px 6px',
          printSize: '9pt',
          printHeaderSize: '10pt',
          printSubheaderSize: '9.5pt',
          printBrandSize: '9pt',
          printPadding: '3.5px 6px',
        };
    }
  }, [fontScale]);

  // Cargar productos al abrir
  useEffect(() => {
    if (isOpen) {
      const fetchAllProducts = async () => {
        setLoading(true);
        setError(null);
        try {
          // Buscamos sin filtros para obtener todos los productos del catálogo
          const data = await api.getProducts('');
          setProducts(data);
        } catch (err: any) {
          setError('Error al obtener la lista de productos.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchAllProducts();
    }
  }, [isOpen]);

  // Limpiar el prefijo numérico de los rubros
  const cleanCategoryName = (name: string) => {
    if (!hideNumbers) return name;
    return name.replace(/^\d+(\.\d+)?\s*-\s*/, '');
  };

  // Mapear y agrupar productos por Rubro -> Subrubro -> Marca
  const groupedData = useMemo(() => {
    // Inicializar estructura vacía según el orden predefinido
    const groups: Record<string, CategoryGroup> = {};
    CATEGORY_ORDER.forEach((cat) => {
      groups[cat] = {
        name: cat,
        directProducts: [],
        subcategories: {}
      };
    });

    // Agrupar cada producto
    products.forEach((prod) => {
      const desc = (prod.description || "").trim();
      const mapping = CATEGORY_MAP[desc];

      let catKey = "VARIOS";
      let subKey: string | undefined;
      let brandKey: string | undefined;

      if (mapping) {
        catKey = mapping.category;
        subKey = mapping.subcategory;
        brandKey = mapping.brand;
      } else if (desc) {
        // Fallback dinámico si no está mapeado explícitamente
        // Si tiene formato 'X.X - TEXTO' lo usamos como rubro principal
        if (/^\d+(\.\d+)?\s*-\s*/.test(desc)) {
          catKey = desc;
          if (!groups[catKey]) {
            groups[catKey] = { name: catKey, directProducts: [], subcategories: {} };
          }
        } else {
          // Si no, lo metemos en VARIOS con subcategoría igual a la descripción
          catKey = "VARIOS";
          subKey = desc;
        }
      }

      const catGroup = groups[catKey] || groups["VARIOS"];

      if (subKey) {
        if (!catGroup.subcategories[subKey]) {
          catGroup.subcategories[subKey] = {
            name: subKey,
            products: [],
            brands: {}
          };
        }
        const subGroup = catGroup.subcategories[subKey];

        if (brandKey) {
          if (!subGroup.brands[brandKey]) {
            subGroup.brands[brandKey] = [];
          }
          subGroup.brands[brandKey].push(prod);
        } else {
          subGroup.products.push(prod);
        }
      } else {
        catGroup.directProducts.push(prod);
      }
    });

    // Filtrar rubros vacíos y ordenar subcategorías
    return CATEGORY_ORDER.map((catKey) => {
      const catGroup = groups[catKey];
      const hasDirect = catGroup.directProducts.length > 0;
      const subKeys = Object.keys(catGroup.subcategories);
      const hasSubs = subKeys.length > 0;

      if (!hasDirect && !hasSubs) return null;

      // Ordenar las subcategorías alfabéticamente para mantener el orden natural de leches, quesos, bebidas, etc.
      const sortedSubcategories = subKeys.sort().map((subKey) => {
        const subGroup = catGroup.subcategories[subKey];
        // Ordenar las marcas de vinos o similares alfabéticamente
        const sortedBrands = Object.keys(subGroup.brands).sort().map((bKey) => ({
          name: bKey,
          products: subGroup.brands[bKey].sort((a, b) => a.name.localeCompare(b.name))
        }));

        return {
          ...subGroup,
          products: subGroup.products.sort((a, b) => a.name.localeCompare(b.name)),
          sortedBrands
        };
      });

      return {
        ...catGroup,
        directProducts: catGroup.directProducts.sort((a, b) => a.name.localeCompare(b.name)),
        sortedSubcategories
      };
    }).filter(Boolean);
  }, [products]);

  // Obtener el precio según la lista seleccionada
  const getProductPrice = (prod: Product) => {
    switch (priceListType) {
      case 'B': return prod.listPriceB;
      case 'C': return prod.listPriceC;
      default: return prod.listPrice;
    }
  };

  // Dar formato al precio (sin centavos, redondeado al entero más cercano)
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(value));
  };

  // Imprimir
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Contenedor del Modal (Pantalla) */}
      <div className="no-print" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          width: '90%',
          maxWidth: '1000px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}>
          {/* Cabecera */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-light)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} style={{ color: 'var(--text-secondary)' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Generar Lista de Precios PDF</h2>
            </div>
            <button 
              onClick={onClose} 
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={18} />
            </button>
          </div>

          {/* Cuerpo */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            flex: 1,
            overflow: 'hidden'
          }}>
            {/* Panel de Configuración Lateral */}
            <div style={{
              padding: '20px',
              borderRight: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-light)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              {/* Destinatario */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destinatario de la Lista</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div 
                    onClick={() => setTargetType('client')}
                    style={{
                      border: targetType === 'client' ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      backgroundColor: targetType === 'client' ? 'var(--bg-card)' : 'transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Para Clientes</span>
                      {targetType === 'client' && <Check size={14} style={{ color: 'var(--text-primary)' }} />}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Muestra únicamente la columna con el precio final facturado.</p>
                  </div>
                  
                  <div 
                    onClick={() => setTargetType('staff')}
                    style={{
                      border: targetType === 'staff' ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      backgroundColor: targetType === 'staff' ? 'var(--bg-card)' : 'transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Para Personal / Interna</span>
                      {targetType === 'staff' && <Check size={14} style={{ color: 'var(--text-primary)' }} />}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Agrega una columna extra con el precio neto sin IVA (/1.21).</p>
                  </div>
                </div>
              </div>

              {/* Lista de Precios */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tarifa / Lista de Origen</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {(['A', 'B', 'C'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPriceListType(t)}
                      style={{
                        padding: '8px 0',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: priceListType === t ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        backgroundColor: priceListType === t ? 'var(--bg-card)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {t === 'A' ? 'Lista 4' : t === 'B' ? 'Lista Especial' : 'Lista Especial 2'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha Personalizada */}
              <div>
                <label htmlFor="listDateInput" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha de la Lista</label>
                <input
                  id="listDateInput"
                  type="text"
                  className="input"
                  style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                  value={listDate}
                  onChange={(e) => setListDate(e.target.value)}
                />
              </div>

              {/* Tamaño de Letra (Escala) */}
              <div>
                <label htmlFor="fontScaleSelect" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamaño de Letra</label>
                <select
                  id="fontScaleSelect"
                  className="input"
                  value={fontScale}
                  onChange={(e) => setFontScale(e.target.value as 'small' | 'medium' | 'large')}
                  style={{ fontSize: '0.85rem', padding: '8px 10px', height: '38px', width: '100%', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}
                >
                  <option value="small">Chico (Ahorro de papel - 7.5pt)</option>
                  <option value="medium">Mediano (Estándar - 9pt)</option>
                  <option value="large">Grande (Lectura fácil - 11pt)</option>
                </select>
              </div>

              {/* Checkbox Ocultar Números */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="hideNumbersCheck"
                  checked={hideNumbers}
                  onChange={(e) => setHideNumbers(e.target.checked)}
                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                />
                <label htmlFor="hideNumbersCheck" style={{ fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>
                  Ocultar números de rubro (Ej: 1.1)
                </label>
              </div>

              {/* Información */}
              <div style={{
                marginTop: 'auto',
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                border: '1px dashed var(--border-color)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <Info size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.35' }}>
                  Al presionar <strong>"Imprimir"</strong> se abrirá el diálogo nativo de su sistema para guardar la lista como PDF o enviarla a una impresora física.
                </p>
              </div>
            </div>

            {/* Panel de Vista Previa (Derecho) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: '#525659', // Fondo estilo visualizador de PDF
              padding: '24px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '24px',
                fontSize: '0.75rem',
                color: '#e5e5e5',
                fontWeight: 500,
                zIndex: 10
              }}>
                Vista Previa del Documento
              </div>

              {/* Hoja de papel simulada */}
              <div style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                padding: '40px 30px',
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                borderRadius: '2px',
                flex: 1,
                overflowY: 'auto',
                width: '100%',
                maxWidth: '650px',
                margin: '16px auto 0 auto',
                fontFamily: 'system-ui, sans-serif'
              }}>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                    <span style={{ fontSize: '0.88rem', color: '#666' }}>Cargando catálogo de productos...</span>
                  </div>
                ) : error ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'red', fontSize: '0.88rem' }}>
                    {error}
                  </div>
                ) : (
                  <div>
                    {/* Estilos CSS locales para el visor y la impresión */}
                    <style>{`
                      .price-list-view-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-family: system-ui, sans-serif;
                      }
                      .price-list-view-table td {
                        padding: ${fontScaleConfig.viewPadding};
                        font-size: ${fontScaleConfig.viewSize};
                        border-bottom: 1px solid #e5e5e7;
                        color: #000;
                      }
                      .price-list-view-table td.category-header {
                        background-color: #f2f2f7;
                        font-weight: 800;
                        font-size: ${fontScaleConfig.viewHeaderSize};
                        border-bottom: 1.5px solid #1c1c1e;
                        padding: 6px 6px 4px 6px;
                        text-transform: uppercase;
                        letter-spacing: 0.02em;
                      }
                      .price-list-view-table td.subcategory-header {
                        background-color: #f5f5f7;
                        font-weight: 700;
                        font-size: ${fontScaleConfig.viewSubheaderSize};
                        border-bottom: 1px solid #c7c7cc;
                        padding: 5px 6px 3px 6px;
                        text-transform: uppercase;
                        letter-spacing: 0.01em;
                      }
                      .price-list-view-table td.brand-header {
                        font-weight: 700;
                        font-size: ${fontScaleConfig.viewBrandSize};
                        color: #3a3a3c;
                        font-style: italic;
                        border-bottom: 1px dashed #e5e5e7;
                        padding: 4px 6px 4px 12px;
                      }

                      @media print {
                        .price-list-print-table {
                          width: 100% !important;
                          border-collapse: collapse !important;
                          font-family: system-ui, sans-serif !important;
                        }
                        .price-list-print-table tr {
                          page-break-inside: avoid !important;
                        }
                        .price-list-print-table td {
                          padding: ${fontScaleConfig.printPadding} !important;
                          font-size: ${fontScaleConfig.printSize} !important;
                          border-bottom: 1px solid #e5e5e7 !important;
                          color: #000000 !important;
                        }
                        .price-list-print-table td.category-header {
                          background-color: #eaeaea !important;
                          font-weight: 900 !important;
                          font-size: ${fontScaleConfig.printHeaderSize} !important;
                          border-bottom: 1.5px solid #000 !important;
                          padding: 5px 6px 4px 6px !important;
                          text-transform: uppercase !important;
                          letter-spacing: 0.02em !important;
                          print-color-adjust: exact !important;
                          -webkit-print-color-adjust: exact !important;
                        }
                        .price-list-print-table td.subcategory-header {
                          background-color: #f2f2f7 !important;
                          font-weight: 800 !important;
                          font-size: ${fontScaleConfig.printSubheaderSize} !important;
                          border-bottom: 1px solid #bbb !important;
                          padding: 4px 6px 3px 6px !important;
                          text-transform: uppercase !important;
                          letter-spacing: 0.01em !important;
                          print-color-adjust: exact !important;
                          -webkit-print-color-adjust: exact !important;
                        }
                        .price-list-print-table td.brand-header {
                          font-weight: 800 !important;
                          font-size: ${fontScaleConfig.printBrandSize} !important;
                          color: #111 !important;
                          font-style: italic !important;
                          border-bottom: 1px dashed #ccc !important;
                          padding: 4px 6px 3px 12px !important;
                        }
                      }
                    `}</style>

                    {/* Header Hoja */}
                    <div style={{ borderBottom: '2px solid #1c1c1e', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#000' }}>LISTA GENERAL DON VENANCIO</h1>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', margin: '2px 0 0 0' }}>
                          {targetType === 'client' ? 'TODOS LOS PRODUCTOS PRECIO FINAL' : 'PRECIOS CON Y SIN IVA'}
                        </p>
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#000' }}>
                        {listDate}
                      </div>
                    </div>

                    {/* Tabla de Productos de Vista Previa (Global y Única) */}
                    <table className="price-list-view-table">
                      <thead>
                        <tr style={{ borderBottom: '2px solid #1c1c1e', fontSize: fontScaleConfig.viewHeaderSize, fontWeight: 800 }}>
                          <th style={{ textAlign: 'left', padding: '4px 6px', color: '#1c1c1e' }}>Producto</th>
                          {targetType === 'staff' && <th style={{ textAlign: 'right', padding: '4px 6px', width: '90px', color: '#1c1c1e' }}>Sin IVA</th>}
                          <th style={{ textAlign: 'right', padding: '4px 6px', width: '90px', color: '#1c1c1e' }}>Precio Final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedData.map((cat) => {
                          if (!cat) return null;
                          return (
                            <Fragment key={cat.name}>
                              {/* Rubro Separador */}
                              <tr>
                                <td colSpan={targetType === 'staff' ? 3 : 2} className="category-header">
                                  {cleanCategoryName(cat.name)}
                                </td>
                              </tr>

                              {/* Productos Directos */}
                              {cat.directProducts.map((p) => {
                                const finalPrice = getProductPrice(p);
                                const netPrice = finalPrice / 1.21;
                                return (
                                  <tr key={p.id}>
                                    <td>{p.name}</td>
                                    {targetType === 'staff' && (
                                      <td style={{ width: '90px', textAlign: 'right', fontFamily: 'monospace', color: '#555' }}>
                                        {formatPrice(netPrice)}
                                      </td>
                                    )}
                                    <td style={{ width: '90px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                                      {formatPrice(finalPrice)}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Subcategorías */}
                              {cat.sortedSubcategories.map((sub) => {
                                const hasDirectProds = sub.products.length > 0;
                                const hasBrands = sub.sortedBrands.length > 0;
                                return (
                                  <Fragment key={sub.name}>
                                    <tr>
                                      <td colSpan={targetType === 'staff' ? 3 : 2} className="subcategory-header">
                                        {sub.name}
                                      </td>
                                    </tr>

                                    {/* Productos Subcategoría */}
                                    {hasDirectProds && sub.products.map((p) => {
                                      const finalPrice = getProductPrice(p);
                                      const netPrice = finalPrice / 1.21;
                                      return (
                                        <tr key={p.id}>
                                          <td>{p.name}</td>
                                          {targetType === 'staff' && (
                                            <td style={{ width: '90px', textAlign: 'right', fontFamily: 'monospace', color: '#555' }}>
                                              {formatPrice(netPrice)}
                                            </td>
                                          )}
                                          <td style={{ width: '90px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                                            {formatPrice(finalPrice)}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* Marcas (Vinos Finos) */}
                                    {hasBrands && sub.sortedBrands.map((b) => (
                                      <Fragment key={b.name}>
                                        <tr>
                                          <td colSpan={targetType === 'staff' ? 3 : 2} className="brand-header">
                                            {b.name}
                                          </td>
                                        </tr>
                                        {b.products.map((p) => {
                                          const finalPrice = getProductPrice(p);
                                          const netPrice = finalPrice / 1.21;
                                          return (
                                            <tr key={p.id}>
                                              <td>{p.name}</td>
                                              {targetType === 'staff' && (
                                                <td style={{ width: '90px', textAlign: 'right', fontFamily: 'monospace', color: '#555' }}>
                                                  {formatPrice(netPrice)}
                                                </td>
                                              )}
                                              <td style={{ width: '90px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                                                {formatPrice(finalPrice)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </Fragment>
                                    ))}
                                  </Fragment>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pie del Modal */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: 'var(--bg-light)'
          }}>
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={onClose}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>
            <button 
              type="button"
              className="btn btn-primary" 
              disabled={loading || products.length === 0}
              onClick={handlePrint}
              style={{ 
                padding: '8px 18px', 
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Printer size={15} />
              <span>Imprimir / Guardar PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenedor Imprimible (Solo Impresión) */}
      <div className="print-only" style={{ color: '#000', backgroundColor: '#fff', width: '100%', fontFamily: 'system-ui, sans-serif' }}>
        {/* Header de la lista impresa */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2.5px solid #000', paddingBottom: '8px', marginBottom: '18px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#000' }}>LISTA GENERAL DON VENANCIO</h1>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#333', margin: '3px 0 0 0' }}>
              {targetType === 'client' ? 'TODOS LOS PRODUCTOS PRECIO FINAL' : 'PRECIOS CON Y SIN IVA'}
            </p>
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#000' }}>
            {listDate}
          </div>
        </div>

        {/* Tabla Imprimible Global (Headers once, perfect layout) */}
        <table className="price-list-print-table">
          <tbody>
            {/* Cabecera ÚNICA del documento en la primera página */}
            <tr style={{ borderBottom: '2.5px solid #000', fontSize: fontScaleConfig.printHeaderSize, pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
              <td style={{ textAlign: 'left', fontWeight: 'bold', padding: '4px 6px' }}>Producto</td>
              {targetType === 'staff' && <td style={{ textAlign: 'right', fontWeight: 'bold', width: '100px', padding: '4px 6px' }}>Sin IVA</td>}
              <td style={{ textAlign: 'right', fontWeight: 'bold', width: '100px', padding: '4px 6px' }}>Precio Final</td>
            </tr>

            {groupedData.map((cat) => {
              if (!cat) return null;
              return (
                <Fragment key={cat.name}>
                  {/* Fila Separadora de Rubro */}
                  <tr style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
                    <td colSpan={targetType === 'staff' ? 3 : 2} className="category-header">
                      {cleanCategoryName(cat.name)}
                    </td>
                  </tr>

                  {/* Productos Directos */}
                  {cat.directProducts.map((p) => {
                    const finalPrice = getProductPrice(p);
                    const netPrice = finalPrice / 1.21;
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        {targetType === 'staff' && (
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#333' }}>
                            {formatPrice(netPrice)}
                          </td>
                        )}
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {formatPrice(finalPrice)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Subcategorías */}
                  {cat.sortedSubcategories.map((sub) => {
                    const hasDirectProds = sub.products.length > 0;
                    const hasBrands = sub.sortedBrands.length > 0;
                    return (
                      <Fragment key={sub.name}>
                        <tr style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
                          <td colSpan={targetType === 'staff' ? 3 : 2} className="subcategory-header">
                            {sub.name}
                          </td>
                        </tr>

                        {/* Productos de Subcategoría */}
                        {hasDirectProds && sub.products.map((p) => {
                          const finalPrice = getProductPrice(p);
                          const netPrice = finalPrice / 1.21;
                          return (
                            <tr key={p.id}>
                              <td>{p.name}</td>
                              {targetType === 'staff' && (
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#333' }}>
                                  {formatPrice(netPrice)}
                                </td>
                              )}
                              <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                                {formatPrice(finalPrice)}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Marcas (Vinos Finos) */}
                        {hasBrands && sub.sortedBrands.map((b) => (
                          <Fragment key={b.name}>
                            <tr style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
                              <td colSpan={targetType === 'staff' ? 3 : 2} className="brand-header">
                                {b.name}
                              </td>
                            </tr>
                            {b.products.map((p) => {
                              const finalPrice = getProductPrice(p);
                              const netPrice = finalPrice / 1.21;
                              return (
                                <tr key={p.id}>
                                  <td>{p.name}</td>
                                  {targetType === 'staff' && (
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#333' }}>
                                      {formatPrice(netPrice)}
                                    </td>
                                  )}
                                  <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                                    {formatPrice(finalPrice)}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ))}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
