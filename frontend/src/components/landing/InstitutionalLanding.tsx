import React, { useState } from 'react';

interface InstitutionalLandingProps {
  onOpenStore: () => void;
  onOpenStaffLogin: () => void;
}

const BRANDS_LIST = [
  { id: 'melincue', name: 'Quesos Melincué', filename: 'melincue.png', accent: '#991B1B' },
  { id: 'branca', name: 'Fratelli Branca', filename: 'branca.png', accent: '#1E293B' },
  { id: 'natura', name: 'Natura', filename: 'natura.png', accent: '#15803D' },
  { id: 'agd', name: 'AGD', filename: 'agd.png', accent: '#1E3A8A' },
  { id: 'baggio', name: 'Baggio', filename: 'baggio.png', accent: '#DC2626' },
  { id: 'marolio', name: 'Marolio', filename: 'marolio.png', accent: '#B45309' },
  { id: 'sancor', name: 'SanCor', filename: 'sancor.png', accent: '#0369A1' },
  { id: '308', name: 'Fideos 308', filename: '308.png', accent: '#BE123C' }
];

const BrandCardLogo = ({ brand, onClick }: { brand: typeof BRANDS_LIST[0]; onClick: () => void }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onClick}
      className="brand-card-hover"
      title={`Ver catálogo de ${brand.name}`}
    >
      {!imgError ? (
        <img
          src={`/brands/${brand.filename}`}
          alt={brand.name}
          onError={() => setImgError(true)}
          style={{ maxHeight: '90px', maxWidth: '88%', objectFit: 'contain' }}
        />
      ) : (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: brand.accent, letterSpacing: '-0.01em' }}>
            {brand.name}
          </span>
        </div>
      )}
    </div>
  );
};

export const InstitutionalLanding: React.FC<InstitutionalLandingProps> = ({
  onOpenStore,
  onOpenStaffLogin
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [activeNav, setActiveNav] = useState<'inicio' | 'empresa' | 'marcas' | 'contacto' | 'tienda'>('inicio');
  const [activeSocial, setActiveSocial] = useState<'ig' | 'wsp' | 'fb' | null>(null);
  
  const [contactForm, setContactForm] = useState({
    businessName: '',
    phone: '',
    message: ''
  });
  const [formSent, setFormSent] = useState(false);

  const handleNavClick = (sectionId: string, navKey: 'inicio' | 'empresa' | 'marcas' | 'contacto' | 'tienda') => {
    setActiveNav(navKey);
    if (navKey === 'tienda') {
      onOpenStore();
      return;
    }
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmitContact = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSent(true);
  };

  return (
    <div style={styles.pageWrapper}>
      {/* 1. HEADER CON MENÚ PILL & REDES SOCIALES INTERACTIVAS */}
      <header style={styles.navbar}>
        <div style={styles.navContainer} className="landing-nav-container">
          {/* BRAND / LOGO ACTUAL DEL ERP 2026 */}
          <div style={styles.brandGroup} onClick={() => handleNavClick('inicio', 'inicio')}>
            {!logoFailed ? (
              <img
                src="/logo.png"
                alt="Don Venancio Distribuidora"
                style={{ height: '56px', objectFit: 'contain', cursor: 'pointer' }}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div style={styles.brandFallback}>DON VENANCIO</div>
            )}
          </div>

          {/* MENÚ PILL CAPSULE CON BORDE COMPLETO AL SELECCIONAR */}
          <nav style={styles.pillNavContainer} className="landing-pill-nav">
            <button
              onClick={() => handleNavClick('inicio', 'inicio')}
              style={{
                ...styles.pillNavItem,
                ...(activeNav === 'inicio' ? styles.pillNavItemActive : {})
              }}
            >
              Inicio
            </button>

            <button
              onClick={() => handleNavClick('empresa', 'empresa')}
              style={{
                ...styles.pillNavItem,
                ...(activeNav === 'empresa' ? styles.pillNavItemActive : {})
              }}
            >
              Empresa
            </button>

            <button
              onClick={() => handleNavClick('marcas', 'marcas')}
              style={{
                ...styles.pillNavItem,
                ...(activeNav === 'marcas' ? styles.pillNavItemActive : {})
              }}
            >
              Marcas
            </button>

            <button
              onClick={() => handleNavClick('contacto', 'contacto')}
              style={{
                ...styles.pillNavItem,
                ...(activeNav === 'contacto' ? styles.pillNavItemActive : {})
              }}
            >
              Contacto
            </button>

            <button
              onClick={() => handleNavClick('tienda', 'tienda')}
              style={{
                ...styles.pillNavItem,
                ...styles.pillNavItemTienda,
                ...(activeNav === 'tienda' ? styles.pillNavItemActive : {})
              }}
            >
              🛒 Tienda
            </button>
          </nav>

          {/* REDES SOCIALES INTERACTIVAS CON ANILLO ROSADO AL SELECCIONAR/HOVER */}
          <div style={styles.socialAndActionsGroup}>
            <div style={styles.socialButtonsGroup}>
              {/* INSTAGRAM */}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                title="Síguenos en Instagram"
                className={`social-circle-btn btn-ig ${activeSocial === 'ig' ? 'active' : ''}`}
                onClick={() => setActiveSocial('ig')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>

              {/* WHATSAPP */}
              <a
                href="https://wa.me/5493388526852"
                target="_blank"
                rel="noopener noreferrer"
                title="Contactar por WhatsApp"
                className={`social-circle-btn btn-wsp ${activeSocial === 'wsp' ? 'active' : ''}`}
                onClick={() => setActiveSocial('wsp')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </a>

              {/* FACEBOOK */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                title="Síguenos en Facebook"
                className={`social-circle-btn btn-fb ${activeSocial === 'fb' ? 'active' : ''}`}
                onClick={() => setActiveSocial('fb')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* 2. HERO MINIMALISTA & LIMPIO */}
      <section id="inicio" style={styles.heroSection}>
        <div style={styles.heroContent}>
          <span style={styles.minimalBadge}>DON VENANCIO DISTRIBUIDORA</span>

          <h1 style={styles.heroTitle}>
            Distribución Mayorista de Alimentos y Bebidas
          </h1>

          <p style={styles.heroSubtitle}>
            Abastecimiento directo para supermercados, almacenes, fiambrerías y gastronomía. Calidad, logística propia y atención personalizada.
          </p>

          <div style={styles.heroCtaRow}>
            <button onClick={onOpenStore} style={styles.btnPrimaryRed}>
              🛒 Ingresar a la Tienda B2B
            </button>
            <a
              href="https://wa.me/5491112345678?text=Hola,%20quisiera%20consultar%20por%20ventas%20mayoristas"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.btnSecondaryClean}
            >
              💬 WhatsApp Directo
            </a>
          </div>
        </div>
      </section>

      {/* 3. EMPRESA / NOSOTROS MINIMALISTA */}
      <section id="empresa" style={styles.sectionClean}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>EMPRESA</span>
          <h2 style={styles.sectionTitle}>Más de 20 años acompañando a comercios</h2>
        </div>

        <div style={styles.grid3Cols}>
          <div style={styles.minimalCard}>
            <div style={styles.minimalCardNumber}>01</div>
            <h3 style={styles.minimalCardTitle}>Logística y Frío</h3>
            <p style={styles.minimalCardText}>
              Flota propia de vehículos refrigerados con rutas organizadas por zona para asegurar entregas en 24/48hs.
            </p>
          </div>

          <div style={styles.minimalCard}>
            <div style={styles.minimalCardNumber}>02</div>
            <h3 style={styles.minimalCardTitle}>Autogestión B2B</h3>
            <p style={styles.minimalCardText}>
              Acceso exclusivo para clientes con listas de precios personalizadas, pedidos en 1-clic y cuenta corriente en vivo.
            </p>
          </div>

          <div style={styles.minimalCard}>
            <div style={styles.minimalCardNumber}>03</div>
            <h3 style={styles.minimalCardTitle}>Compromiso Comercial</h3>
            <p style={styles.minimalCardText}>
              Atención personalizada con preventistas de zona y asesoramiento continuo para potenciar la rentabilidad de tu negocio.
            </p>
          </div>
        </div>
      </section>

      {/* 4. MARCAS LÍDERES */}
      <section id="marcas" style={{
        backgroundColor: '#FAFAFA',
        padding: '60px 20px',
        borderTop: '1px solid #F1F5F9',
        borderBottom: '1px solid #F1F5F9',
        minHeight: 'calc(100vh - 65px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box'
      }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
          <div style={{ marginBottom: '36px', textAlign: 'left' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', margin: '0 0 12px 0', letterSpacing: '-0.025em' }}>
              Trabajamos con marcas líderes.
            </h2>
            <p style={{ color: '#64748B', fontSize: '15px', lineHeight: 1.6, maxWidth: '860px', margin: 0 }}>
              Quesos Melincué de Remotti, Sancor, Fratelli Branca, Aceites y Aderezos Natura (AGD), Productos Baggio, La Huerta (RPB), Marolio y muchas más.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px'
          }}>
            {BRANDS_LIST.map((brand) => (
              <BrandCardLogo key={brand.id} brand={brand} onClick={onOpenStore} />
            ))}
          </div>
        </div>
      </section>

      {/* 5. CONTACTO PROLIJO */}
      <section id="contacto" style={styles.sectionClean}>
        <div style={styles.contactWrapper}>
          <div style={styles.contactInfo}>
            <span style={styles.sectionTag}>CONTACTO</span>
            <h2 style={styles.sectionTitle}>Contactate con Don Venancio</h2>
            <p style={{ fontSize: '15px', color: '#64748B', lineHeight: 1.6, marginBottom: '24px' }}>
              Dejanos tu mensaje o consulta comercial y un preventista te contactará a la brevedad.
            </p>

            <div style={styles.contactList}>
              <div>📍 <strong>Depósito Central:</strong> Buenos Aires, Argentina</div>
              <div>📞 <strong>Ventas:</strong> +54 9 11 1234-5678</div>
              <div>✉️ <strong>Email:</strong> ventas@donvenancio.com.ar</div>
            </div>

            {/* REDES SOCIALES DEBAJO DE CONTACTO TAMBIÉN */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" style={styles.socialCircleBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path></svg>
              </a>
              <a href="https://wa.me/5491112345678" target="_blank" rel="noopener noreferrer" style={styles.socialCircleBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" style={styles.socialCircleBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
            </div>
          </div>

          <div style={styles.contactFormCard}>
            {formSent ? (
              <div style={styles.successBox}>
                ✅ Recibimos tu mensaje. ¡Nos contactaremos a la brevedad!
              </div>
            ) : (
              <form onSubmit={handleSubmitContact} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input
                  type="text"
                  placeholder="Nombre Comercial / Razón Social"
                  required
                  value={contactForm.businessName}
                  onChange={(e) => setContactForm({ ...contactForm, businessName: e.target.value })}
                  style={styles.inputClean}
                />
                <input
                  type="tel"
                  placeholder="Teléfono / WhatsApp"
                  required
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  style={styles.inputClean}
                />
                <textarea
                  placeholder="Mensaje o consulta..."
                  rows={3}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  style={{ ...styles.inputClean, resize: 'vertical' }}
                />
                <button type="submit" style={styles.btnPrimaryRed}>
                  Enviar Consulta
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER ULTRA MINIMALISTA */}
      <footer style={styles.footerClean}>
        <div style={styles.footerContent}>
          <span>© {new Date().getFullYear()} Don Venancio Distribuidora</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={onOpenStore} style={styles.footerLinkBtn}>Tienda B2B</button>
          </div>
        </div>
      </footer>

      {/* ESTILOS CSS INLINE Y HOVER DE ICONOS Y PILL */}
      <style>{`
        .social-circle-btn {
          transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease;
        }
        .social-circle-btn:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important;
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    minHeight: '100vh'
  },
  navbar: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid #F1F5F9',
    padding: '10px 0'
  },
  navContainer: {
    maxWidth: '1140px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  brandFallback: {
    fontSize: '18px',
    fontWeight: 900,
    color: '#E30613',
    letterSpacing: '-0.5px'
  },
  
  /* CONTENEDOR PILL CAPSULE EXACTO A LA FOTO 1 */
  pillNavContainer: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '999px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
    gap: '2px'
  },
  pillNavItem: {
    border: '1.5px solid transparent',
    background: 'transparent',
    padding: '7px 18px',
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#0F172A',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  pillNavItemActive: {
    backgroundColor: '#FEF2F2',
    color: '#0F172A',
    fontWeight: 800,
    border: '1.5px solid #E30613',
    boxShadow: '0 2px 8px rgba(227, 6, 19, 0.15)'
  },
  pillNavItemTienda: {
    fontWeight: 700,
    color: '#0F172A'
  },

  /* GRUPO DE ICONOS SOCIALES Y ERP */
  socialAndActionsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  socialButtonsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  socialCircleBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
    textDecoration: 'none',
    cursor: 'pointer'
  },
  btnStaffLink: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 8px'
  },

  /* HERO */
  heroSection: {
    minHeight: 'calc(100vh - 65px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '60px 20px',
    textAlign: 'center',
    background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
    borderBottom: '1px solid #F1F5F9',
    boxSizing: 'border-box'
  },
  heroContent: {
    maxWidth: '780px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  minimalBadge: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#E30613',
    textTransform: 'uppercase',
    marginBottom: '16px'
  },
  heroTitle: {
    fontSize: '42px',
    fontWeight: 800,
    lineHeight: 1.18,
    color: '#0F172A',
    margin: '0 0 16px 0',
    letterSpacing: '-0.02em'
  },
  heroSubtitle: {
    fontSize: '17px',
    lineHeight: 1.6,
    color: '#64748B',
    margin: '0 0 32px 0'
  },
  heroCtaRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  btnPrimaryRed: {
    backgroundColor: '#E30613',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    padding: '13px 26px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(227, 6, 19, 0.25)',
    transition: 'transform 0.2s ease'
  },
  btnSecondaryClean: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    padding: '13px 22px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center'
  },

  /* SECCIONES PROLIJAS PANTALLA COMPLETA */
  sectionClean: {
    maxWidth: '1140px',
    margin: '0 auto',
    padding: '60px 20px',
    minHeight: 'calc(100vh - 65px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxSizing: 'border-box'
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '44px'
  },
  sectionTag: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    color: '#94A3B8',
    textTransform: 'uppercase'
  },
  sectionTitle: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#0F172A',
    marginTop: '6px'
  },
  grid3Cols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px'
  },
  minimalCard: {
    padding: '28px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #F1F5F9',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
  },
  minimalCardNumber: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#E30613',
    marginBottom: '12px'
  },
  minimalCardTitle: {
    fontSize: '17px',
    fontWeight: 700,
    margin: '0 0 8px 0',
    color: '#0F172A'
  },
  minimalCardText: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: 1.5,
    margin: 0
  },
  grid4Cols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px'
  },
  brandCard: {
    padding: '24px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, border-color 0.2s ease'
  },
  brandEmoji: {
    fontSize: '28px',
    display: 'block',
    marginBottom: '10px'
  },
  brandTitle: {
    fontSize: '15px',
    fontWeight: 700,
    margin: '0 0 6px 0',
    color: '#0F172A'
  },
  brandDesc: {
    fontSize: '13px',
    color: '#64748B',
    margin: 0,
    lineHeight: 1.4
  },
  contactWrapper: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '40px'
  },
  contactInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  contactList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontSize: '14px',
    color: '#334155'
  },
  contactFormCard: {
    backgroundColor: '#FAFAFA',
    padding: '28px',
    borderRadius: '12px',
    border: '1px solid #F1F5F9'
  },
  inputClean: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  successBox: {
    padding: '16px',
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    color: '#166534',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center'
  },
  footerClean: {
    borderTop: '1px solid #F1F5F9',
    padding: '24px 20px',
    backgroundColor: '#FFFFFF'
  },
  footerContent: {
    maxWidth: '1140px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    fontSize: '13px',
    color: '#94A3B8'
  },
  footerLinkBtn: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer'
  }
};

export default InstitutionalLanding;
