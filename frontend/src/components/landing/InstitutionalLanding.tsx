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
          style={{ maxHeight: '95px', maxWidth: '86%', objectFit: 'contain' }}
        />
      ) : (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: brand.accent, letterSpacing: '-0.01em' }}>
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

    const messageText = `Hola Don Venancio, quisiera realizar una consulta comercial:\n\n` +
      `🏢 *Razón Social / Nombre:* ${contactForm.businessName}\n` +
      `📞 *Teléfono:* ${contactForm.phone}\n` +
      (contactForm.message ? `💬 *Consulta:* ${contactForm.message}` : '');

    const encodedText = encodeURIComponent(messageText);
    const whatsappUrl = `https://api.whatsapp.com/send/?phone=5493388526852&text=${encodedText}&type=phone_number&app_absent=0`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
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
                href="https://www.instagram.com/donvenanciodistribuidora/?hl=es"
                target="_blank"
                rel="noopener noreferrer"
                title="Síguenos en Instagram"
                className={`social-circle-btn btn-ig ${activeSocial === 'ig' ? 'active' : ''}`}
                onClick={() => setActiveSocial('ig')}
              >
                <i className="fa-brands fa-instagram"></i>
              </a>

              {/* WHATSAPP */}
              <a
                href="https://api.whatsapp.com/send/?phone=5493388526852&text&type=phone_number&app_absent=0"
                target="_blank"
                rel="noopener noreferrer"
                title="Contactar por WhatsApp"
                className={`social-circle-btn btn-wsp ${activeSocial === 'wsp' ? 'active' : ''}`}
                onClick={() => setActiveSocial('wsp')}
              >
                <i className="fa-brands fa-whatsapp"></i>
              </a>

              {/* FACEBOOK */}
              <a
                href="https://www.facebook.com/DonVenanciodistribuidora/"
                target="_blank"
                rel="noopener noreferrer"
                title="Síguenos en Facebook"
                className={`social-circle-btn btn-fb ${activeSocial === 'fb' ? 'active' : ''}`}
                onClick={() => setActiveSocial('fb')}
              >
                <i className="fa-brands fa-facebook-f"></i>
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
            Desde 1996 abasteciendo comercios de la región
          </h1>

          <p style={styles.heroSubtitle}>
            <strong style={{ color: '#0F172A', fontWeight: 700 }}>Distribuidora mayorista de alimentos y bebidas.</strong> 30 años acompañando a comercios de General Villegas y toda la zona, con stock permanente, atención personalizada, logística propia y entregas semanales garantizadas.
          </p>

          <div style={styles.heroCtaRow}>
            <button
              onClick={() => handleNavClick('contacto', 'contacto')}
              style={styles.btnPrimaryRed}
            >
              CONTACTO
            </button>
          </div>
        </div>
      </section>

      {/* 3. EMPRESA / NOSOTROS MINIMALISTA */}
      <section id="empresa" style={styles.sectionClean}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>EMPRESA</span>
          <h2 style={styles.sectionTitle}>Experiencia, cercanía y servicio.</h2>
          <p style={{ color: '#475569', fontSize: '17px', lineHeight: 1.65, maxWidth: '820px', margin: '14px 0 0 0' }}>
            Somos una empresa familiar fundada en 1996, con base en General Villegas. Repartimos en todos los pueblos de la zona, cubriendo un radio aproximado de 70 km, con el compromiso de sostener un servicio prolijo, rápido y cercano.
          </p>
        </div>

        <div style={styles.grid3Cols}>
          <div style={styles.minimalCard}>
            <div style={styles.minimalCardNumber}>01</div>
            <h3 style={styles.minimalCardTitle}>Servicio directo</h3>
            <p style={styles.minimalCardText}>
              Atención clara, contacto permanente.
            </p>
          </div>

          <div style={styles.minimalCard}>
            <div style={styles.minimalCardNumber}>02</div>
            <h3 style={styles.minimalCardTitle}>Distribución regional</h3>
            <p style={styles.minimalCardText}>
              Visitas semanales a todos los comercios de la zona.
            </p>
          </div>

          <div style={styles.minimalCard}>
            <div style={styles.minimalCardNumber}>03</div>
            <h3 style={styles.minimalCardTitle}>Relación a largo plazo</h3>
            <p style={styles.minimalCardText}>
              Cumplimiento, continuidad y criterio comercial.
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
        <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
          <div style={{ marginBottom: '40px', textAlign: 'left' }}>
            <h2 style={{ fontSize: '38px', fontWeight: 800, color: '#0F172A', margin: '0 0 14px 0', letterSpacing: '-0.03em' }}>
              Trabajamos con marcas líderes.
            </h2>
            <p style={{ color: '#475569', fontSize: '17px', lineHeight: 1.65, maxWidth: '960px', margin: 0 }}>
              Quesos Melincué de Remotti, Sancor, Fratelli Branca, Aceites y Aderezos Natura (AGD), Productos Baggio, La Huerta (RPB), Marolio y muchas más.
            </p>
          </div>

          <div className="brands-grid-container">
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
            <h2 style={styles.sectionTitle}>Contáctanos</h2>
            <p style={{ fontSize: '15px', color: '#64748B', lineHeight: 1.6, marginBottom: '24px' }}>
              Dejanos tu mensaje o consulta comercial y un preventista te contactará a la brevedad.
            </p>

            <div style={styles.contactList}>
              <div>📍 <strong>Depósito Central:</strong> Pringles 116, General Villegas, Pcia. Bs.As</div>
              <div>📞 <strong>Ventas / WhatsApp:</strong> +54 9 3388 52-6852</div>
              <div>✉️ <strong>Email:</strong> contacto@donvenancio.com.ar</div>
            </div>

            {/* REDES SOCIALES EN SECCIÓN CONTACTO */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <a
                href="https://www.instagram.com/donvenanciodistribuidora/?hl=es"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram Don Venancio"
                className="social-circle-btn btn-ig"
              >
                <i className="fa-brands fa-instagram"></i>
              </a>
              <a
                href="https://api.whatsapp.com/send/?phone=5493388526852&text&type=phone_number&app_absent=0"
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp Directo"
                className="social-circle-btn btn-wsp"
              >
                <i className="fa-brands fa-whatsapp"></i>
              </a>
              <a
                href="https://www.facebook.com/DonVenanciodistribuidora/"
                target="_blank"
                rel="noopener noreferrer"
                title="Facebook Don Venancio"
                className="social-circle-btn btn-fb"
              >
                <i className="fa-brands fa-facebook-f"></i>
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
    padding: '60px 20px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #F1F5F9',
    boxSizing: 'border-box'
  },
  heroContent: {
    maxWidth: '1280px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left'
  },
  minimalBadge: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.14em',
    color: '#E30613',
    textTransform: 'uppercase',
    marginBottom: '20px'
  },
  heroTitle: {
    fontSize: '56px',
    fontWeight: 800,
    lineHeight: 1.1,
    color: '#0F172A',
    margin: '0 0 24px 0',
    letterSpacing: '-0.035em',
    maxWidth: '980px'
  },
  heroSubtitle: {
    fontSize: '18px',
    lineHeight: 1.65,
    color: '#475569',
    margin: '0 0 36px 0',
    maxWidth: '880px'
  },
  heroCtaRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-start'
  },
  btnPrimaryRed: {
    backgroundColor: '#E30613',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '999px',
    padding: '16px 42px',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(227, 6, 19, 0.28)',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase'
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
    maxWidth: '1280px',
    width: '100%',
    margin: '0 auto',
    padding: '60px 20px',
    minHeight: 'calc(100vh - 65px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxSizing: 'border-box'
  },
  sectionHeader: {
    textAlign: 'left',
    marginBottom: '40px'
  },
  sectionTag: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    color: '#E30613',
    textTransform: 'uppercase'
  },
  sectionTitle: {
    fontSize: '38px',
    fontWeight: 800,
    color: '#0F172A',
    marginTop: '8px',
    letterSpacing: '-0.03em'
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
