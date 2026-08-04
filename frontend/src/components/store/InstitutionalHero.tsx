import React from 'react';

interface InstitutionalHeroProps {
  onGoToCatalog: () => void;
  onOpenWhatsApp?: () => void;
  onOpenRegisterModal?: () => void;
}

export const InstitutionalHero: React.FC<InstitutionalHeroProps> = ({
  onGoToCatalog,
  onOpenWhatsApp,
  onOpenRegisterModal
}) => {
  return (
    <div style={styles.container}>
      {/* 1. HERO MAIN SECTION */}
      <section style={styles.heroSection}>
        <div style={styles.heroBadge}>
          <span style={styles.heroBadgePulse} />
          <span>✨ Distribuidora Mayorista de Alimentos y Bebidas</span>
        </div>

        <h1 style={styles.heroTitle}>
          Abastecimiento Rápido, Tecnológico y Confiable para tu Comercio
        </h1>

        <p style={styles.heroSubtitle}>
          En <strong>Don Venancio</strong> digitalizamos el suministro mayorista: catálogo en vivo con fotos reales, precios personalizados por lista, cuenta corriente en tiempo real y pedidos en 1-clic por WhatsApp.
        </p>

        <div style={styles.heroCtaGroup}>
          <button onClick={onGoToCatalog} style={styles.primaryCta}>
            🛒 Explorar Catálogo y Precios
          </button>

          <a
            href="https://wa.me/5491112345678?text=Hola,%20quisiera%20hacer%20un%20pedido%20o%20consultar%20precios"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (onOpenWhatsApp) {
                e.preventDefault();
                onOpenWhatsApp();
              }
            }}
            style={styles.secondaryCta}
          >
            💬 Pedir por WhatsApp
          </a>
        </div>
      </section>

      {/* 2. GRID DE PROPUESTA DE VALOR */}
      <section style={styles.featuresSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>¿POR QUÉ ELEGIRNOS?</span>
          <h2 style={styles.sectionTitle}>Diseñado para facilitar el día a día de tu negocio</h2>
        </div>

        <div style={styles.featuresGrid}>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🚚</div>
            <h3 style={styles.featureTitle}>Logística y Entregas 24/48hs</h3>
            <p style={styles.featureText}>
              Flota propia de reparto con control de cadena de frío y rutas programadas por zona para que nunca te quedes sin stock.
            </p>
          </div>

          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📱</div>
            <h3 style={styles.featureTitle}>Pedidos en 1-Clic sin Contraseña</h3>
            <p style={styles.featureText}>
              Ingresa al instante desde WhatsApp con nuestros <em>Magic Links</em> seguros y confirma tu pedido borrador en segundos.
            </p>
          </div>

          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📄</div>
            <h3 style={styles.featureTitle}>Estado de Cuenta Corriente 24/7</h3>
            <p style={styles.featureText}>
              Revisa tu saldo actualizado, comprobantes pendientes y descargá resúmenes de cuenta de forma transparente.
            </p>
          </div>

          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📦</div>
            <h3 style={styles.featureTitle}>Precios Escalonados por Volumen</h3>
            <p style={styles.featureText}>
              Precios transparentes por horma, caja, pack o kilo pesable, adaptados a la lista preferencial de tu comercio.
            </p>
          </div>
        </div>
      </section>

      {/* 3. RUBROS DESTACADOS */}
      <section style={styles.rubrosSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>CATÁLOGO DE MARCAS Y CATEGORÍAS</span>
          <h2 style={styles.sectionTitle}>Todo lo que tu comercio necesita en un solo lugar</h2>
        </div>

        <div style={styles.rubrosGrid}>
          <div onClick={onGoToCatalog} style={styles.rubroCard}>
            <div style={styles.rubroBadge}>🧀 Lácteos & Quesos</div>
            <h4 style={styles.rubroTitle}>Cremoso, Tybo, Sardo, Mozzarella</h4>
            <p style={styles.rubroDesc}>Marcas seleccionadas de primera calidad por horma y fraccionado.</p>
            <span style={styles.rubroLink}>Ver productos →</span>
          </div>

          <div onClick={onGoToCatalog} style={styles.rubroCard}>
            <div style={styles.rubroBadge}>🥓 Fiambres & Embutidos</div>
            <h4 style={styles.rubroTitle}>Jamón Cocido, Paleta, Salames, Salchichón</h4>
            <p style={styles.rubroDesc}>Piezas enteras e insumos ideales para fiambrerías y fiambreras.</p>
            <span style={styles.rubroLink}>Ver productos →</span>
          </div>

          <div onClick={onGoToCatalog} style={styles.rubroCard}>
            <div style={styles.rubroBadge}>🥤 Bebidas & Aguas</div>
            <h4 style={styles.rubroTitle}>Gaseosas, Aguas Minerales, Cervezas, Vinos</h4>
            <p style={styles.rubroDesc}>Packs cerrados directos de fábrica para máxima rentabilidad.</p>
            <span style={styles.rubroLink}>Ver productos →</span>
          </div>

          <div onClick={onGoToCatalog} style={styles.rubroCard}>
            <div style={styles.rubroBadge}>🥫 Almacén & Conservas</div>
            <h4 style={styles.rubroTitle}>Aceites, Conservas, Enlatados, Harinas</h4>
            <p style={styles.rubroDesc}>Productos de alta rotación para supermercados y almacenes de barrio.</p>
            <span style={styles.rubroLink}>Ver productos →</span>
          </div>
        </div>
      </section>

      {/* 4. CÓMO FUNCIONA EL PROCESO EN 3 PASOS */}
      <section style={styles.stepsSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>SIMPLICIDAD TOTAL</span>
          <h2 style={styles.sectionTitle}>Comprar en Don Venancio en 3 simples pasos</h2>
        </div>

        <div style={styles.stepsGrid}>
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>1</div>
            <h3 style={styles.stepTitle}>Arma tu Carrito</h3>
            <p style={styles.stepText}>Navega el catálogo interactivo o envía un mensaje al WhatsApp con los artículos que necesitas.</p>
          </div>

          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>2</div>
            <h3 style={styles.stepTitle}>Confirma en 1-Clic</h3>
            <p style={styles.stepText}>Revisa el borrador con precios exactos de tu lista y confirma sin ingresar contraseñas complejas.</p>
          </div>

          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>3</div>
            <h3 style={styles.stepTitle}>Recibe en tu Puerta</h3>
            <p style={styles.stepText}>Tu pedido entra directo al ERP de preparación y se despacha en el siguiente reparto programado.</p>
          </div>
        </div>
      </section>

      {/* 5. FOOTER / BANNER DE ATENCIÓN Y CONTACTO */}
      <footer style={styles.footerBanner}>
        <div style={styles.footerContent}>
          <div>
            <h3 style={styles.footerTitle}>¿Aún no eres cliente de Don Venancio?</h3>
            <p style={styles.footerSub}>Registra tu comercio para acceder a listas de precios preferenciales y crédito en cuenta corriente.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={onGoToCatalog} style={styles.primaryCta}>
              🛍️ Ir a la Tienda
            </button>
            {onOpenRegisterModal && (
              <button onClick={onOpenRegisterModal} style={styles.secondaryCta}>
                📝 Alta de Nuevo Comercio
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '48px',
    padding: '12px 0 32px 0',
    color: '#0F172A',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  heroSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '48px 24px',
    background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.03)'
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '20px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FEE2E2',
    color: '#991B1B',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '20px'
  },
  heroBadgePulse: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#E30613'
  },
  heroTitle: {
    fontSize: '36px',
    fontWeight: 800,
    lineHeight: 1.2,
    color: '#0F172A',
    maxWidth: '800px',
    margin: '0 0 16px 0',
    letterSpacing: '-0.02em'
  },
  heroSubtitle: {
    fontSize: '16px',
    lineHeight: 1.6,
    color: '#475569',
    maxWidth: '680px',
    margin: '0 0 32px 0'
  },
  heroCtaGroup: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  primaryCta: {
    padding: '12px 24px',
    backgroundColor: '#E30613',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(227, 6, 19, 0.25)',
    transition: 'all 0.2s ease'
  },
  secondaryCta: {
    padding: '12px 24px',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease'
  },
  featuresSection: {
    padding: '0 12px'
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '32px'
  },
  sectionTag: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#E30613',
    textTransform: 'uppercase'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0F172A',
    marginTop: '6px'
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px'
  },
  featureCard: {
    padding: '24px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  },
  featureIcon: {
    fontSize: '32px',
    marginBottom: '12px'
  },
  featureTitle: {
    fontSize: '16px',
    fontWeight: 700,
    margin: '0 0 8px 0',
    color: '#0F172A'
  },
  featureText: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: 1.5,
    margin: 0
  },
  rubrosSection: {
    padding: '0 12px'
  },
  rubrosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px'
  },
  rubroCard: {
    padding: '20px',
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  rubroBadge: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#1E293B',
    marginBottom: '10px'
  },
  rubroTitle: {
    fontSize: '15px',
    fontWeight: 700,
    margin: '0 0 6px 0',
    color: '#0F172A'
  },
  rubroDesc: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: 1.4,
    marginBottom: '14px'
  },
  rubroLink: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#E30613'
  },
  stepsSection: {
    padding: '24px 12px',
    backgroundColor: '#F8FAFC',
    borderRadius: '16px',
    border: '1px solid #E2E8F0'
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginTop: '20px'
  },
  stepCard: {
    textAlign: 'center',
    padding: '16px'
  },
  stepNumber: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    fontSize: '18px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px auto'
  },
  stepTitle: {
    fontSize: '16px',
    fontWeight: 700,
    margin: '0 0 6px 0',
    color: '#0F172A'
  },
  stepText: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: 1.4,
    margin: 0
  },
  footerBanner: {
    padding: '28px',
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    borderRadius: '16px'
  },
  footerContent: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px'
  },
  footerTitle: {
    fontSize: '20px',
    fontWeight: 700,
    margin: '0 0 6px 0',
    color: '#FFFFFF'
  },
  footerSub: {
    fontSize: '14px',
    color: '#94A3B8',
    margin: 0
  }
};

export default InstitutionalHero;
