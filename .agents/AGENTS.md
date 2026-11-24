# Guías de Trabajo, Arquitectura Anti-Espagueti y Estética ERP-CRM DV

Este archivo define las reglas innegociables de comportamiento, arquitectura modular, rigor contable, estética y calidad profesional para el desarrollo del sistema:

## 0. Regla Cero: Paso a Paso Estricto y Claridad Total
- **Prohibido dar nada por hecho**: Explicar cada paso o decisión en lenguaje claro, sin jerga innecesaria.
- **Un paso a la vez**: Prohibido avanzar al paso siguiente sin que el paso actual esté explicado, probado (`tsc --noEmit` + `vitest run`) y validado por el usuario.
- **Garantizar 0% de errores en dinero y stock**: La exactitud financiera y operativa es la prioridad #1 absoluta.

## 1. Arquitectura Anti-Espagueti (Cohesión por Responsabilidad, Semáforo de Líneas y 4 Capas)
- **Cohesión Primero, Prohibido el "Espagueti Fragmentado"**: El criterio principal para dividir un archivo es **1 sola responsabilidad clara**, nunca cortar una función o transacción atómica (`prisma.$transaction`) por la mitad solo para cumplir un número arbitrario de líneas:
  - **Zona Ideal (`150–300` líneas)**: Tamaño objetivo natural para controladores, schemas, motores, pestañas y modales.
  - **Zona Permitida por Cohesión (`300–450` líneas)**: Válida cuando un servicio contable o vista compleja conforma una única unidad lógica indivisible y partirla dificultaría su lectura o seguridad.
  - **Techo Rojo Duro (`> 450` líneas)**: Señal obligatoria de que se mezclaron dos responsabilidades distintas; extraer subcomponente, hook o submódulo cohesivo. *(Excepción libre: suites de tests `*.test.ts`, tipos generados y seeds).*
- **Separación Estricta en 4 Capas que no se pisan entre sí**:
  1. **Motor Matemático (`*.engine.ts`)**: Solo hace cuentas puras con `Decimal.js`. No sabe qué es un botón ni consulta la base de datos. 100% cubierto por tests en `Vitest`.
  2. **Validador de Contratos (`*.schema.ts` / `*.validator.ts`)**: Valida con `Zod` que no entren datos rotos o vacíos.
  3. **Controlador Delgado (`*.controller.ts`, ideal `< 120` líneas) y Servicios (`*.service.ts`, objetivo `< 300` / máx. `450` por cohesión)**: El controlador tiene prohibido hacer cuentas matemáticas o consultas directas a Prisma; solo valida y delega al servicio/motor.
  4. **Pantallas divididas por Pestañas y Modales (`*Tab.tsx` / `*Modal.tsx`, objetivo `< 300` / máx. `450` por cohesión)**: Cada pestaña o ventana emergente vive en su propio archivo aislado para que tocar un modal jamás afecte al resto de la pantalla.

## 2. Rigor Financiero y Contable de Grado Bancario
- **Motor Matemático con `Decimal.js` (`src/core/money.ts`)**: Prohibido usar `Float`, `Number()` o `Math.round()` nativo de JavaScript para dinero o pesajes. Configuración obligatoria: `Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })`.
- **Política de "Pesos Enteros en Origen"**: Cada precio de lista y cada subtotal de renglón se redondea en origen al peso entero más cercano (`ROUND_HALF_UP`, 0 decimales). La suma visual de los renglones coincide siempre al 100% con el total del comprobante, sin centavos fantasma.
- **Desglose Fiscal Interno para AFIP/ARCA**: En mostrador y preventa se opera en pesos enteros limpios, pero al solicitar CAE (Factura A/B/C), el motor calcula hacia adentro los 2 decimales exactos exigidos por AFIP (`ImpNeto + ImpIVA + ImpTrib === ImpTotal`).
- **Snapshots Históricos Inmutables en Ventas**: Al confirmar un pedido o factura, cada renglón congela `unitCostSnapshot`, `listPriceSnapshot` y `discountPctSnapshot`. Cambiar costos hoy jamás altera la ganancia histórica de ventas pasadas.
- **Contabilidad por Libro Mayor Inmutable (Ledger Pattern)**: Prohibido editar saldos o stock con sumas/restas manuales sueltas. Todo cambio de saldo proviene de un asiento auditable (`DEBIT`/`CREDIT`) y todo cambio de stock proviene de un movimiento auditable (`IN`/`OUT`/`ADJUSTMENT`), con reversión automática al anular.

## 3. Estética y Diseño (Stripe / Linear / Notion)
- **Minimalismo y Velocidad**: Interfaz limpia, ágil, con abundante espacio en blanco, bordes finos de `1px` y grises de alta fidelidad.
- **Cero Palabras de Relleno (Minimalismo Premium)**: Mostrar únicamente datos reales importantes y acciones directas. Queda **prohibido**:
  1. Escribir subtítulos o párrafos explicativos debajo de títulos, interruptores o botones que ya se explican solos (ej.: usar únicamente el botón `"Cambiar Clave"`, jamás envolverlo en tarjetas con *"Seguridad de la Cuenta / Contraseña de acceso / Actualizá tu clave personal..."*).
  2. Agregar supratítulos decorativos (`SEGURIDAD DE LA CUENTA`, `REGLAS OPERATIVAS`, `PROMOCIONES COMERCIALES`) cuando el dato o tabla habla por sí mismo.
  3. Agregar notas al pie o estados obvios (*"Encabezado oficial sincronizado..."*, *"Ingresá tus credenciales"*, *"Conexión establecida"*, *"Hacé clic en una fila para ver..."*). Solo mostrar avisos cuando exista una alerta accionable o error real.
  4. Redactar botones o etiquetas verbosas: usar microcopy directo de 1 a 3 palabras (`Cambiar Clave`, `Editar`, `Guardar`, `Nuevo usuario`, `TXT AFIP (.zip)`, `Subdiarios PDF`).
- **Uso del Color**: Paleta de tonos grises y oscuros minimalistas. El color corporativo rojo `#E30613` se reserva exclusivamente para CTAs críticos, indicadores de peligro o alertas específicas.
- **Micro-animaciones y Optimización de Clics**: Transiciones suaves y diseño pensado para que las acciones comunes (buscar con buscador fonético, cambiar de pestaña, pesar en balanza, facturar o cobrar) se realicen en la menor cantidad de pasos posible.
- **Sin Datos de Relleno**: Prohibido usar placeholders temporales; poblar siempre con datos reales de la distribuidora.
- **Estándares Web Modernos (`modern-web-guidance`)**: Al iniciar cualquier tarea de interfaz web (HTML, CSS, modales/diálogos, tablas, formularios, accesibilidad o lógica cliente en `frontend/`), consultar primero `npx -y modern-web-guidance@latest search "<query>"` (y `retrieve "<id>"` cuando aplique) para usar primitivas nativas actuales del navegador antes de escribir soluciones manuales, informando su uso al cierre en `### Modern Web Guidance`.

## 4. Seguridad del Código y Git (Sincronización Continua Multi-PC)
- **Sincronización al Iniciar Sesión**: Antes de editar cualquier archivo en una nueva jornada, ejecutar `git status -sb` y `git pull --ff-only origin main` para asegurar que la PC actual tenga el último código de GitHub sin pisar cambios de otra máquina.
- **Commits + Push Automáticos por Tarea**: Al finalizar y validar cada tarea exitosa (`tsc --noEmit` + `vitest run`), hacer `git commit` descriptivo **seguido de `git push origin main`** para que GitHub esté siempre al día como respaldo vivo.
- **Copias de Seguridad (Backups)**: Antes de refactorizar o dividir archivos grandes, resguardar copia de seguridad y verificar compilación + tests.
- **Verificación de Reversiones**: Nunca utilizar `git checkout` o `git restore` sobre código de trabajo sin antes revisar `git status`.

## 5. Base de Datos y Migraciones (Prisma / PostgreSQL)
- **Inmutabilidad de Migraciones**: Los archivos en `prisma/migrations/` ya aplicados son SAGRADOS. Jamás se edita una migración aplicada.
- **Flujo Seguro con Objetos Nativos (`--create-only`)**: Toda migración nueva debe generarse SIEMPRE usando `npx prisma migrate dev --name <nombre> --create-only`, limpiar cualquier `DROP SEQUENCE movement_seq` del SQL generado y aplicarla con `npx prisma migrate deploy`.
- **Evitar Colisiones en Seeds**: En scripts de semilla, nunca definir valores manuales para campos autogenerados como `movementId`.

## 6. Comandos Rápidos y Stack Oficial (GitHub + Supabase + Railway)
- **Stack Único de Producción**: Código en **GitHub**, datos e imágenes maestras en **Supabase** (`sa-east-1`) y despliegue unificado 24/7 (Frontend SPA + Backend API bajo el mismo origen HTTPS, sin `ngrok` ni plataformas extra) en **Railway**.
- **Mapa de Servicios en Railway (Proyecto `don-venancio`)**:
  - **Web Oficial + Chatbot + Catálogo + Ofertas**: servicio `don-venancio` (`https://donvenancio.com.ar`, repo `MarcoEstebanMartin/chatbot-08-10-2026`). **No tocar** desde este repo.
  - **ERP-CRM DV (este proyecto, en pruebas)**: servicio `erp-dv-prueba` (`https://erp-dv-prueba-production.up.railway.app`). Despliegue con `railway.cmd up --detach -p fa70da17-b02f-4a41-b9ed-686161c04e07 -e 3ea8d1cb-d06d-4368-8f6f-ade2665e0ae8 -s f8b7a8df-aa9d-405d-b685-0aad665050f0`.
- **Comando "abri" / "abrir" / "abre todo" (Inicio Seguro de Jornada)**:
  1. Ejecutar `git status -sb` y `git pull --ff-only origin main` para bajar automáticamente cualquier avance hecho desde otra PC.
  2. Ejecutar `ipconfig` para obtener la IPv4 local activa.
  3. Iniciar `npm run dev` en la raíz en segundo plano (`Vite` + `Express`).
  4. Mostrar resumen con estado de GitHub (`al día`), servidores locales e IP WiFi para pruebas móviles.
- **Comando "cerra" / "cerrar" / "cierra" / "guarda todo" (Cierre Seguro de Jornada)**:
  1. Verificar compilación y tests (`tsc --noEmit` + `vitest run`) si hay cambios pendientes.
  2. Revisar `git status` (garantizando cero archivos `.env` expuestos), ejecutar `git add -A`, `git commit` descriptivo y `git push origin main`.
  3. Desplegar el servicio **`erp-dv-prueba`** en Railway ejecutando `railway.cmd up --detach -p fa70da17-b02f-4a41-b9ed-686161c04e07 -e 3ea8d1cb-d06d-4368-8f6f-ade2665e0ae8 -s f8b7a8df-aa9d-405d-b685-0aad665050f0` (sin tocar nunca el servicio `don-venancio`).
  4. Confirmar que el árbol quedó 100% limpio (`main...origin/main`) y que el despliegue en Railway (`https://erp-dv-prueba-production.up.railway.app`) quedó en curso o activo.
- **Auditorías de Integridad disponibles (Pre-Producción / Control bajo demanda, desde `backend/`)**:
  - `npm run db:audit-receipts` (9 controles de recibos de calle/oficina, rendiciones, cajas y `AccountLedger`; soporta `-- --fix` para estados seguros).
  - `npm run db:audit-balances` (integridad de saldos de cuentas corrientes; soporta `-- --fix`).
  - `npm run db:audit-photos` (integridad del banco de fotos de productos).
  - `npm run db:health-check` (chequeo general de salud de la base de datos).

## 7. Banco Único de Imágenes de Productos (SQL + Caché Limpia)
- **Fuente Única de Verdad en SQL (`chatbot-dv.product_images`)**: El banco oficial de fotos de productos vive en PostgreSQL (`chatbot-dv.product_images`) sincronizado con la caché local activa `backend/uploads/products/` (regenerable con `npm run db:sync-from-production`). Prohibido mantener carpetas paralelas duplicadas o acumular fotos huérfanas viejas en disco.

## 8. Metodología Spec-Driven Development (SDD - GitHub Spec Kit)
- **Constitución y Plantillas (`.specify/`)**: Gobernada por `.specify/memory/constitution.md` y las especificaciones en `specs/`.
- **Tablero Único de Tarea (`.agents/task.md`)**: Toda tarea activa se gestiona y verifica a través de `.agents/task.md`.

## 9. Nombres Limpios en Pruebas y Datos de Demo
- **Prohibido usar siglas técnicas (`qa_`, `E2E`, `test_`) en datos visibles**: Cada vez que se creen usuarios, vendedores, choferes o rutas para pruebas o demostraciones en el sistema, usar siempre nombres claros y prolijos: **`Gemini`** (Admin), **`Gemini Ventas`** (Vendedor) y **`Gemini Reparto`** (Chofer/Reparto).
