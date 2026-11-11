================================================================================
FICHA TÉCNICA DEL SISTEMA: ERP-CRM DISTRIBUIDORA VICTORIA
================================================================================
Fecha de emisión: Septiembre 2026
Estado del sistema: En desarrollo activo / Producción local

Este documento detalla todas las tecnologías, lenguajes, bases de datos, 
librerías, herramientas externas y arquitecturas que dan vida a este software.

--------------------------------------------------------------------------------
1. BASE DE DATOS Y GESTIÓN DE DATOS
--------------------------------------------------------------------------------
• Motor de Base de Datos: PostgreSQL (versión 16)
  - ¿Por qué PostgreSQL y no MySQL?: Mayor rigor financiero (cumple con ACID al
    100%), soporte de secuencias continuas para comprobantes sin huecos,
    manejo nativo de dinero con tipos Decimal (sin errores de redondeo) y
    facilidad para migrar a la nube (Supabase, Neon, AWS).
• ORM (Mapeador Objeto-Relacional): Prisma ORM (v6)
  - Modela las tablas en TypeScript, previene inyecciones SQL y controla las
    migraciones de esquema de manera segura.
• Planilla Maestra (Fuente Única de Verdad - SSOT): Maestro1.xlsx (Excel)
  - Contiene Clientes, Productos, Precios, Rutas de Venta y Cuentas Bancarias.
• Copias de Seguridad (Backups):
  - Sistema automatizado en backend/backups/ con respaldos en JSON y SQL.

--------------------------------------------------------------------------------
2. BACKEND (SERVIDOR Y LÓGICA DE NEGOCIO)
--------------------------------------------------------------------------------
• Entorno de Ejecución: Node.js (v24 LTS)
• Lenguaje Principal: TypeScript (compilado a JavaScript moderno)
• Framework de API: Express.js
  - Gestiona todas las rutas y peticiones REST (clientes, facturación, stock,
    reparto, caja, finanzas, etc.).
• Autenticación y Seguridad:
  - JWT (JSON Web Tokens): Para sesiones seguras y control de accesos.
  - bcryptjs: Encriptación irreversible de contraseñas de usuarios.
• Subida de Archivos y Fotos:
  - Multer: Procesa subidas de fotos y adjuntos en backend/uploads/.
• Procesamiento Rápido de Planillas:
  - Python (v3) + OpenPyXL: Scripts ultra-rápidos que leen y sincronizan
    miles de filas de Excel en menos de 2 segundos.
• Facturación Electrónica (AFIP):
  - Integración nativa con Web Services de AFIP (WSAA y WSFE) mediante
    certificados digitales (.crt y .key) para emisión de Facturas A, B y C.

--------------------------------------------------------------------------------
3. FRONTEND (INTERFAZ DE USUARIO Y PANTALLAS)
--------------------------------------------------------------------------------
• Lenguaje Principal: TypeScript
• Biblioteca de UI: React 19
• Empaquetador y Servidor Local: Vite (v8)
  - Proporciona recarga instantánea en milisegundos (Hot Module Replacement).
• Enrutamiento: React Router
  - Navegación fluida entre pantallas (Dashboard, Depósito, Ventas, Finanzas, etc.).
• Diseño y Estilos:
  - CSS3 puro con Variables CSS (Custom Properties).
  - Estética corporativa de alta fidelidad inspirada en Stripe, Linear y Notion:
    fondos limpios, tipografía legible, grises de alta definición y uso selectivo
    del rojo corporativo (#E30613) solo para acciones críticas y alertas.
• Iconografía: Lucide React (paquete de íconos vectoriales modernos y ligeros).
• Generación de Documentos y Reportes:
  - pdf-lib: Creación y renderizado de comprobantes PDF en memoria.
  - html2canvas: Captura de pantallas y resúmenes gráficos para compartir.

--------------------------------------------------------------------------------
4. COMUNICACIÓN, CRM Y RED
--------------------------------------------------------------------------------
• Mensajería y CRM: WhatsApp Cloud API (Meta Developers)
  - Permite enviar y recibir mensajes directamente desde el ERP.
• Infraestructura de Producción Unificada: Railway (HTTPS 24/7)
  - Un único contenedor Node.js 24 sirve tanto el Frontend SPA compilado como la
    API Express bajo un mismo dominio HTTPS seguro, recibiendo directamente los
    Webhooks de Meta (WhatsApp) sin depender de túneles locales ni PCs encendidas.
• Acceso en Red Local (Celulares / Tablets de Preventa y Depósito):
  - Configurado en 0.0.0.0 para que cualquier dispositivo conectado a la misma
    red WiFi pueda usar el sistema desde su navegador con la IP local.

--------------------------------------------------------------------------------
5. CONTROL DE VERSIONES Y HERRAMIENTAS DE DESARROLLO
--------------------------------------------------------------------------------
• Control de Versiones: Git (con repositorio local y branches)
• Automatización de Inicio: Concurrently
  - El comando "npm run dev" levanta en simultáneo el frontend (puerto 5173) y
    el backend (puerto 3000) en una sola terminal.
• Terminal y Shell: PowerShell en Windows 11.

================================================================================
RESUMEN EJECUTIVO:
El sistema es una aplicación web empresarial moderna (Full-Stack TypeScript),
apoyada en una base de datos relacional de grado bancario (PostgreSQL), un
frontend ultra-rápido (React + Vite) y una integración híbrida con hojas
maestras de Excel y servicios en la nube (AFIP y WhatsApp).
================================================================================
