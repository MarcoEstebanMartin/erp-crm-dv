# Tablero Vivo de Tarea Activa (SDD — Limpieza Profunda y Blindaje)

## Reglas de Oro Activas (Innegociables)
1. **Paso a Paso Estricto (Regla Cero)**: Hacer 1 sola fase a la vez, explicar en lenguaje claro, verificar `tsc --noEmit` (Backend y Frontend) + `vitest run` y esperar validación del usuario antes de avanzar al paso siguiente.
2. **Límite Estricto de 250–300 líneas por archivo** (`.ts` y `.tsx`) en 4 capas separadas (`*.engine.ts`, `*.validator.ts`, `*.service.ts`, `*.controller.ts` / `*Tab.tsx` / `*Modal.tsx`).
3. **Rigor Financiero y Seguridad**: `Decimal.js` obligatorio (`money.ts`), Pesos Enteros en Origen (`ROUND_HALF_UP`), Snapshots históricos inmutables, transacciones `prisma.$transaction`, `authenticateJWT` + `requireRole` + `Zod` en el 100% de las rutas.

---

## Historial Base Completado (Cimientos Rescatados)
- [x] **Paso 1**: Constitución SDD y Trasplante del Núcleo Matemático (`core/money.ts`, `engines/*` + 43 tests Vitest en verde).
- [x] **Paso 2**: Migración Segura Prisma (`OrderItem` Snapshots) y Padrón Maestro Saneado (clientes, rutas, proveedores, productos).
- [x] **Paso 3**: Cirugía Modular inicial de Backend en Catálogo, Pedidos/AFIP, Stock y Admin/Clientes.
- [x] **Paso 4**: Cirugía Modular inicial de los 9 paneles principales del Frontend (`< 300` líneas).

---

## Hoja de Ruta Actual: Limpieza Profunda y Blindaje de Producción

### Paso 5: Higiene Profunda del Repositorio, Cierre de Exposición de Archivos y Resguardo Git ✅ COMPLETADO
- [x] Mover archivos `.zip` de código fuente fuera de `backend/uploads/` (estaban en carpeta pública estática) hacia `backups_auditoria/`
- [x] Eliminar archivo residual vacío `=` de la raíz y blindar `.gitignore` (`*.zip`, `*.exe`, `backend/uploads/*`)
- [x] Alinear `specs/00-arquitectura-y-ecosistema.md` con la arquitectura real PostgreSQL + Prisma + JWT de `ERP-CRM DV`
- [x] Verificar compilación limpia (`tsc --noEmit` Backend/Frontend) y `vitest run` (`43/43` tests)
- [x] Guardar commit limpio de resguardo en Git con todo el trabajo modular consolidado

### Paso 6: Blindaje Total de Seguridad (Rutas Internas, RBAC y Tienda Mayorista) ✅ COMPLETADO
- [x] Proteger endpoints abiertos sin autenticación: `iva.routes.ts` (`ADMIN`, `FACTURACION`) y `offers.ts` (lectura autenticada, escritura `ADMIN`/`FACTURACION`)
- [x] Cerrar vulnerabilidad IDOR, secreto hardcodeado y manipulación de precios en `store.routes.ts` y `store.controller.ts` (dividido de 772 a 121 líneas en `store-auth.service.ts`, `store-magic.service.ts`, `store-catalog.service.ts` y `store-order.service.ts`):
  - Eliminado `JWT_SECRET` hardcodeado usando `env.JWT_SECRET`
  - Creado middleware `authenticateStoreClientJWT` anti-IDOR y esquemas `Zod` (`store.validator.ts`)
  - Cálculo de precios 100% en servidor con `Decimal.js` + `Snapshots` + reserva atómica de stock y `StockMovement` + corrección de doble IVA en carrito web + hash `bcrypt` de `webPin` con migración transparente
- [x] Completar `requireRole` en `purchase.routes.ts`, `fleet.routes.ts`, `logistics.routes.ts`, `excel_importer.routes.ts` y `crm_whatsapp.routes.ts`
- [x] Agregar suite `store-security.test.ts` en Vitest (`12 suites / 48 tests` en verde) y validar compilación `tsc --noEmit` en Backend y Frontend

### Paso 7: Cirugía Financiera Parte 1 — Cajas, Bancos, Gastos y Cobranzas (`Decimal.js` + Transacciones ACID) ✅ COMPLETADO
- [x] Crear motor matemático puro `drawer-arqueo.engine.ts` (`Decimal.js`) y validadores `Zod` (`finance.validator.ts`, `collection.validator.ts`, `expense.validator.ts`)
- [x] Desarmar `finance.controller.ts` (de 953 a 227 líneas), `collection.controller.ts` (de 704 a 124 líneas) y `expense.controller.ts` (de 656 a 135 líneas) en 10 servicios cohesivos `< 250–300` líneas
- [x] Corregir bugs contables y de seguridad:
  - `closeDrawer`: imputación atómica en `prisma.$transaction`, normalización `'A'`/`'X'` -> `OFFICIAL`/`INTERNAL`, generación de `REC-XXXXX`, descuento en `Persona.outstandingBalance` y arqueo exacto de efectivo + cheques físicos
  - `verifyTransaction` y `transferFunds`: invariante exacta de acreditación bancaria sin doble conteo ni transferencias coladas en rendiciones pendientes
  - `getReceipt`: sanitización de campos públicos (eliminada exposición de `user.passwordHash` y `persona.webPin`) + `publicApiRateLimiter`
  - `verifyRendicion`: unificación de creación de caja cerrada y verificación de cobros en una única `prisma.$transaction` interactiva
  - `createExpense`: persistencia del `cashDrawerId` resuelto automáticamente cuando se omite en el request
- [x] Cubrir invariantes de arqueo, conciliación bancaria, rendición, recibos y gastos en `Vitest` (`14 suites / 57 tests` en verde)

### Paso 8: Cirugía Financiera Parte 2 — Notas de Crédito, Compras y Facturación Impositiva ✅ COMPLETADO
- [x] Crear motor matemático puro `credit-purchase.engine.ts` (`Decimal.js`) y validadores `Zod` (`creditNote.validator.ts`, `purchase.validator.ts`, `billing.validator.ts`)
- [x] Desarmar `creditNote.controller.ts` (de 816 a 99 líneas), `purchase.controller.ts` (de 833 a 105 líneas) y `billing.controller.ts` (de 523 a 116 líneas) en 9 servicios cohesivos `< 270` líneas
- [x] Corregir bugs operativos, contables y de seguridad:
  - Reemplazada numeración frágil `count + 1` de Notas de Crédito internas por secuencia atómica `NCI-${movementId}` basada en `movement_seq`
  - Unificada la emisión interna y de aprobación en una única `prisma.$transaction` atómica y extraída la restauración proporcional de lotes en `credit-note-stock.helper.ts`
  - Eliminado el campo inexistente `productIdRef` que rompía `createPurchaseOrder` en Prisma y preservados los 2 decimales de costos de proveedor
  - Vinculado `productLotId` en `StockMovement` al confirmar facturas/remitos por OCR (`confirmExtractedDocument`) para reversión determinística de lotes al anular en `deleteSupplierInvoice`
  - Cerrada exposición de `seller.passwordHash` en `getSalesInvoices`
- [x] Cubrir invariantes con nuevas suites `credit-purchase.engine.test.ts` y `credit-purchase.service.test.ts` (`16 suites / 64 tests` en verde)

### Paso 9: Libro Mayor Físico Inmutable (`AccountLedger`) en PostgreSQL ✅ COMPLETADO
- [x] Especificar y aplicar migración aditiva segura (`20261110154500_add_account_ledger`, preservando `movement_seq`) para la tabla física `AccountLedger` e índices compuestos `(personaId, occurredAt, id)`
- [x] Crear motor matemático puro `account-ledger.engine.ts` (`Decimal.js`) y servicio atómico único `account-ledger.service.ts` (`recordLedgerMovement`)
- [x] Conectar el 100% de las mutaciones de cuenta corriente al Libro Mayor dentro de la misma `prisma.$transaction`:
  - Pedidos y facturación en mostrador/reparto (`order-tax.helpers.ts`, `order-billing.service.ts`, `order-status.service.ts`, `logistics.controller.ts` — corrigiendo deuda fantasma en cobros de chofer y cheques parciales)
  - Cobranzas, arqueos de caja, anulaciones de recibos y conciliaciones (`collection.service.ts`, `receipt.service.ts`, `cash-drawer.service.ts`, `transaction-admin.service.ts`, `persona-payment.service.ts`)
  - Notas de Crédito aprobadas, órdenes/documentos de compra, facturas de proveedor y retenciones (`credit-note.service.ts`, `credit-note-approval.service.ts`, `purchase-order.service.ts`, `purchase-document.service.ts`, `supplier-invoice.service.ts`, `tax-withholding.service.ts`)
- [x] Migrar `persona-ledger.service.ts` a lecturas físicas directas desde `AccountLedger` (eliminando problema N+1 en `checkAllBalances` y filtrando solo Notas de Crédito `APPROVED` en pendientes)
- [x] Ejecutar backfill histórico idempotente (`ledger-backfill.service.ts`) sobre las **1.879 personas** reales en PostgreSQL con **100,00% de paridad (`0` discrepancias)** y validar `tsc --noEmit` + `18 suites / 73 tests` en `Vitest`

### Paso 10: Blindaje RLS en Supabase y Limpieza Final de Controladores y Pantallas ✅ COMPLETADO
- [x] **Candado RLS en Supabase (`erp-desarrollo`)**: Aplicada migración `20261110163000_enable_rls_prisma_tables` habilitando Row Level Security en las 48 tablas de Prisma (`0` alertas críticas en Supabase Security Advisor; PostgREST público bloqueado por defecto y Prisma operativo al 100%)
- [x] **Modularización Backend (`< 260` líneas por archivo, `Decimal.js`, `Zod` + sanitización de `passwordHash`/`webPin`)**:
  - `logistics.controller.ts` (`795` -> `155` l.) + `logistics.validator.ts` + `delivery-route.service.ts`, `route-settlement.service.ts` (preservando `AccountLedger` al 100%) y `route-custody-gps.service.ts`
  - `fleet.controller.ts` (`512` -> `122` l.) + `fleet.validator.ts` + `vehicle.service.ts`, `vehicle-maintenance.service.ts` y `vehicle-expiry.service.ts`
  - `hr.controller.ts` (`794` -> `173` l.) + `hr.validator.ts` + `employee.service.ts`, `salary-advance.service.ts`, `payroll.service.ts` (cerrada filtración de `user.passwordHash` en `calculatePayroll` y comisiones/sueldos en `Decimal.js`) y `hr-leave-doc.service.ts`
  - `offersController.ts` (`801` -> `128` l.) + `offers.validator.ts` + `offer-campaign.service.ts`, `offer-item.service.ts`, `offer-recommendations.service.ts` y `offer-analytics.service.ts`
- [x] **Modularización Frontend (`80/80` archivos auditados `< 260` líneas máx., `0` errores TypeScript + build de producción Vite limpio)**:
  - `StockDashboard.tsx` (`1.877` -> `243` l.) + `14` submódulos en `frontend/src/components/stock/*`
  - `RendicionesDashboard.tsx` (`1.717` -> `183` l.) + `13` submódulos en `frontend/src/components/rendiciones/*`
  - `SalesBillingTab.tsx` (`1.520` -> `60` l.) + `12` submódulos en `frontend/src/components/billing/sales/*`
  - `ClientPortal.tsx` (`1.984` -> `160` l.) + `15` submódulos en `frontend/src/components/store/portal/*`
- [x] **Suite Completa de Calidad**: `20` suites / `83` tests en verde (`Vitest`), `tsc --noEmit` en Backend y Frontend con `0` errores

---

## Siguiente Etapa: Integración Segura con Proyecto en Producción (`don-venancio`)
> **REGLA CRÍTICA DE DATOS REALES**: El proyecto actualmente en producción tiene las **fotos y los precios actualizados al día**, mientras que el padrón de productos en `erp-desarrollo` puede tener precios/fotos desactualizados.
> **Dirección obligatoria de sincronización inicial**: **Producción -> ERP** (importar precios vigentes y fotos desde producción hacia el ERP; **PROHIBIDO** pisar producción con precios viejos del ERP).

### Fase 1: Orden de Casa, GitHub Único y Cuentas Unificadas (`estebanmartin06@gmail.com`) ✅ COMPLETADA
- [x] **Paso 1.1**: Separar `OFERTAS-DV` como carpeta hermana en `C:\Users\Usuario\Desktop\OFERTAS-DV` dejando ambos repositorios Git limpios y sin anidamiento.
- [x] **Paso 1.2**: Alinear el email global de Git en esta PC a `estebanmartin06@gmail.com` y subir `ERP-CRM DV` a un repositorio **Privado** en GitHub (`MarcoEstebanMartin/erp-crm-dv`) para respaldo y descarga en cualquier otra PC.
- [x] **Paso 1.3**: Migrar el 100% del ERP (`52` tablas, `3.756` registros, secuencias `movement_seq`, `AccountLedger` con paridad exacta al centavo `ARS -2.620.465,55` y candados RLS) hacia `erp-dv` (`rtdoeoyeoomzqzagmpzn`, **Brasil `sa-east-1`**) y migrar el 100% de la Tienda/Bot en vivo (`11` tablas, `442` productos, `437` fotos verificadas byte por byte `76.633.181` bytes y `379` mensajes WA) hacia `chatbot-dv` (`vnklxnvahkmazoymiqlk`, **Brasil `sa-east-1`**), ambos dentro de la cuenta única **`MarcoEstebanMartin` (`estebanmartin06@gmail.com`)** y con `donvenancio.com.ar` desplegado en Railway (`[SUCCESS]`) sin corte de servicio.

### Fases Siguientes Planificadas (Integración Ecosistema)
- [ ] **Fase 2**: Banco único de fotos en Cloudflare R2 (`media.donvenancio.com.ar`) + despliegue de `ERP-CRM DV` en la nube (`sistema.donvenancio.com.ar`).
- [x] **Fase 3**: Sincronización inicial segura **Producción -> ERP** (precios y fotos vigentes sin pisar producción) y puente unificado en vivo de catálogo, stock y pedidos Web/WhatsApp (`chatbot-dv <-> erp-dv`) sobre Brasil `sa-east-1` ✅ COMPLETADA.
- [ ] **Fase 4**: Conexión de Agentes de IA (`agencia-bots`) sobre la API validada del ERP + `pgvector`.

---

## Plan Activo: Blindaje Ultraseguro y Eficiencia Operativa del Stack (Paso a Paso)

- [x] **Paso S1: Perímetro HTTP, Anti-Spoofing, Docker Seguro y Caché de Sesión en Memoria** ✅ COMPLETADO
  - [x] Endurecer `env.config.ts` (`TRUST_PROXY='loopback'` por defecto, `JSON_BODY_LIMIT='1mb'`, bloqueo fatal de `CORS_ORIGIN='*'` en `production`)
  - [x] Crear `securityHeaders.middleware.ts` (`CSP` estricto en `/api/*`, `HSTS` en producción, `Permissions-Policy`, ocultar `x-powered-by`) y limitar payloads en `app.ts`
  - [x] Blindar `rateLimiter.middleware.ts` contra falsificación de `X-Forwarded-For` usando `req.ip` validado, tope `MAX_RATE_LIMIT_KEYS` y cabeceras `Retry-After`
  - [x] Crear `session-cache.util.ts` (`45s` TTL) conectado a `authenticateJWT` y `authenticateStoreClientJWT` con invalidación en `0ms` al desactivar/editar en `admin-users.service.ts` y `persona.service.ts`
  - [x] Cerrar puerto `5432` al exterior, exigir secretos reales sin defaults inseguros y aislar red `internal_net` en `docker-compose.prod.yml`
  - [x] Validar `tsc --noEmit` (Backend y Frontend) + `21 suites / 87 tests` en verde (`security-perimeter.test.ts`)
- [x] **Paso S2: Cookies `HttpOnly` Anti-XSS + Unificación de Cliente HTTP + Limpieza de `axios` y `jest`** ✅ COMPLETADO
  - [x] Crear `cookie-auth.util.ts` (`dv_staff_session` y `dv_store_session` con `HttpOnly`, `SameSite=lax`, `Path=/api`, `Secure` dinámico HTTPS/WiFi y guardia anti-CSRF cross-site) + endpoints `POST /api/auth/logout` y `POST /api/store/logout`
  - [x] Eliminar guardado de `auth_token` y `store_token` en `localStorage` en todo el Frontend, unificando `MobileCobros.tsx`, `ReceiptView.tsx`, `ExcelImportModal.tsx` (corrigiendo bug `getItem('token')`), `apiClient.ts`, `api.ts`, `usePortalAuth.ts` y `usePortalStore.ts` con `credentials: 'include'`
  - [x] Migrar `whatsapp.service.ts` de `axios` no declarado a `fetch` nativo con timeout y desinstalar `axios`, `jest`, `ts-jest` y `@types/jest` (**-307 paquetes** eliminados) + `22 suites / 90 tests` en verde (`cookie-auth.test.ts`)
- [x] **Paso S3: Erradicación de Vulnerabilidades en Planillas (`xlsx` -> `exceljs` Seguro)** ✅ COMPLETADO
  - [x] Reemplazar `xlsx` (`0.18.5`) en Backend (`excel-reader.util.ts`, `expense-import.service.ts`) y Frontend (`excelBrowserReader.ts`, `StandaloneOffersManager.tsx`) por `exceljs` con escudos anti-Prototype-Pollution, bloqueo de `.xls` BIFF8 y límites anti-DoS (`15 MB`, `15.000` filas)
  - [x] Modularizar `excel_validator.service.ts` (`430` -> `15` l. + `excel-parser.helpers.ts`, `excel-products-prices.validator.ts`, `excel-clients.validator.ts` todos `< 220` l.) y endurecer filtros en `upload.ts`
  - [x] Ejecutar `npm audit fix` + `overrides` seguros dejando **`0` vulnerabilidades en Backend y `0` vulnerabilidades en Frontend** (`npm audit` 100% limpio + `23 suites / 93 tests` en verde)
- [x] **Paso S4: Escudo Anti-Doble Clic (`Idempotency-Key`) en Operaciones de Dinero y Stock** ✅ COMPLETADO
  - [x] Crear `idempotency.middleware.ts` (`162` l.) con soporte para `Idempotency-Key` explícita (`24h` TTL), huella automática SHA-256 anti-ráfaga (`3s`), bloqueo concurrente `409 IDEMPOTENT_IN_PROGRESS`, detección `422 IDEMPOTENCY_PAYLOAD_MISMATCH`, replay `X-Idempotency-Replayed: true` y liberación inmediata ante errores `4xx/5xx`
  - [x] Proteger las 10 familias críticas de rutas de dinero y stock (`order`, `store`, `collection`, `finance`, `expense` + upgrade a `uploadExcelFile`, `billing`, `creditNote`, `persona`, `purchase` y `logistics`)
  - [x] Crear `idempotencyClient.ts` (`64` l., compatible con WiFi local HTTP y HTTPS) e integrarlo en `apiClient.ts`, `api.ts` y `usePortalStore.ts`
  - [x] Validar `tsc --noEmit` (Backend y Frontend), `vite build` y `24 suites / 97 tests` en verde (`idempotency-guard.test.ts`)
- [x] **Paso S5: Modo Offline / PWA para Preventa en Ruta (`IndexedDB` + Sincronización Automática)** ✅ COMPLETADO
  - [x] Configurar PWA instalable (`manifest.webmanifest`, `index.html`, `sw.js` con *Network-First* en navegación, caché de imágenes con tope de `260` fotos y exclusión total de `/api/*`, más `registerPwa.ts`)
  - [x] Construir base local `IndexedDB` (`offlineCatalogDb.ts` `151` l.) con snapshots de catálogo, clientes, rubros y rutas + buscador local sin tildes/mayúsculas (`filterCachedProducts`)
  - [x] Construir cola persistente e idempotente (`offlineQueueStore.ts` `192` l. + `offlineSyncManager.ts` `147` l.) con migración transparente de `localStorage`, detección de "4G fantasma", candado *single-flight* y preservación de `Idempotency-Key` en Pedidos y Visitas (`saleRoute.routes.ts`)
  - [x] Modularizar preventa (`vendedorCatalogFetcher.ts` `140` l., `useVendedorOfflineSync.ts` `169` l., `useVendedorController.ts` `232` l. y `VendedorOfflineBanner.tsx` `179` l.) y validar `tsc --noEmit` + `vite build` + `25 suites / 101 tests` en verde (`offline-preventa-sync.test.ts`)
- [x] **Paso S6: Cola Resiliente de Reintentos (AFIP / WhatsApp) + Backups Encriptados (`AES-256-GCM`)** ✅ COMPLETADO
  - [x] Crear `resilient-retry-queue.util.ts` (`194` l.) con `executeWithResilientRetry` y `ResilientAsyncQueue` deduplicada (*exponential backoff* + *jitter* + concurrencia controlada)
  - [x] Crear `external-integrations-retry.service.ts` (`165` l.) + modularizar `order-billing.service.ts` (`295` l. + `order-cae-deferred.helper.ts` `134` l.) y `whatsapp.service.ts` (`247` l. + `whatsapp-order-parser.service.ts` `186` l.), habilitando contingencia automática `PRE-A`/`PRE-B` con obtención diferida de CAE en segundo plano y reintentos reales en Meta Cloud API
  - [x] Crear motor criptográfico `encrypted-backup.util.ts` (`132` l., `AES-256-GCM` + `scrypt` + `Gzip` nivel 9 + rotación automática) + `database-backup.service.ts` (`197` l.) + CLI `npm run db:backup-encrypted` (`encrypted_backup_cli.ts` `42` l.) y programador nocturno opcional
  - [x] Validar `tsc --noEmit` (Backend y Frontend), `npm audit` (`0` vulnerabilidades) y **`26 suites / 105 tests` en verde** (`resilience-and-backup.test.ts`)

---

## Plan Activo: Unión de Catálogo, Precios e Imágenes (`Producción chatbot-dv -> ERP erp-dv`)

- [x] **Paso U1: Resguardo Cifrado Previo + Auditoría Exacta en Seco (`Dry-Run`)** ✅ COMPLETADO
  - [x] Generar backup cifrado previo de `erp-dv` (`backup_ERP_2026-11-11T00-02-13.dvbackup.enc`, `-92,2%` `AES-256-GCM`)
  - [x] Auditar SKU por SKU `chatbot-dv` (`442` total / `331` activos / `437` fotos `bytea`) vs `erp-dv` (`424` total / `398` activos / `365` fotos): detectados **`80` precios a actualizar**, **`50` productos `S/F` que ganan foto**, **`120` productos con foto `.png` nueva editada manualmente** (`170` fotos en total) y **`8` productos activos en web pero apagados en ERP**
- [x] **Paso U2: Nivelación Inicial 100% Unidireccional (`Producción -> ERP`) de las 437 Fotos y Precios Vigentes** ✅ COMPLETADO
  - [x] Crear motor matemático/determinístico `catalog-sync.engine.ts` (`Decimal.js`, pesos enteros en origen, preservación de proporciones Lista B/C y nombres anti-colisión) + servicio `production-catalog-sync.service.ts` con transacción `READ ONLY` sobre `chatbot-dv` (`0` escrituras sobre Producción) y CLI `npm run db:sync-from-production`
  - [x] Descargar y verificar por MD5 las **`382` fotos HD** hacia `backend/uploads/products/`, sumar únicamente los **`69` SKUs faltantes** en `ARCHIVOS/fotos/Productos` (`0` archivos existentes modificados/borrados), actualizar los **`80` precios** y espejar los **`331` productos activos** de `donvenancio.com.ar` (`0` productos activos sin foto `S/F`, `27 suites / 110 tests` en verde)
- [x] **Paso U3: Puente Vivo Permanente (`ERP -> Producción`) y Banco Único de Imágenes** ✅ COMPLETADO
  - [x] Crear motor de salida `catalog-bridge.engine.ts` (`187` l., formato `$9.112`, normalización SKU y parche atómico de `metadata.catalog_active_state` incluyendo combos) y servicio resiliente `production-outbound-bridge.service.ts` (`272` l., cola FIFO `ResilientAsyncQueue` con reintentos exponenciales)
  - [x] Conectar las **8 vías de mutación** del ERP (`createProduct`, `updateProduct`, `importPrices`, `bulkUpdatePrices`, `revertPrices`, `uploadSingleProductImage`, `importProductImagesFromZip` y `commitExcel`) hacia `chatbot-dv` (`products`, `price_history`, `product_images` bytea y `metadata.catalog_active_state`) + endpoints `ADMIN` `/api/products/bridge/*` (`28 suites / 114 tests` en verde)

---

## Plan Activo: Puente Unificado de Pedidos Web y WhatsApp (`chatbot-dv <-> erp-dv`)

- [x] **Paso P1: Motor Matemático de Traducción (Pesables, Combos y Teléfonos AR) + Servicio Atómico de Ingreso + Auditoría en Seco (`Dry-Run`)** ✅ COMPLETADO
  - [x] Crear `web-order-sync.engine.ts` (`282` l., `Decimal.js`, desglose `$/kg` para balanza en pesables, expansión de `COMBOS` a SKUs físicos reales y normalización telefónica Argentina) + `web-order-commit.helper.ts` (`197` l.) + `production-order-sync.service.ts` (`207` l.) con candado `pg_advisory_xact_lock` e idempotencia estricta por `webOrderId`
  - [x] Validar `tsc --noEmit` (Backend y Frontend) + suite `web-order-sync.test.ts` (`29 suites / 118 tests` en verde) + ejecutar `--dry-run` sobre `DV-1004` (`$54.128` exactos) y `DV-1005` (`$42.017` exactos)
- [x] **Paso P2: Recepción Automática en Vivo (`Poller` cada `30s` + Botón Manual) y Retorno Bidireccional de Estados (`ERP -> Web`)** ✅ COMPLETADO
  - [x] Crear `web-order-lifecycle.engine.ts` (`130` l., corte automático de pruebas `DV-1004`/`DV-1005`, preservación inmutable de `webOrderId` al cerrar bultos físicos y mapeo de estados) + `web-order-status-bridge.service.ts` (`137` l., cola `ResilientAsyncQueue` hacia `chatbot-dv.orders` y `order_status_history`)
  - [x] Crear poller *single-flight* `web-order-poller.service.ts` (`125` l., cada `30s` con pre-chequeo rápido de cabeceras y cancelación automática de pedidos `PENDING` anulados en web) + controlador `web-order-sync.controller.ts` (`50` l.) + rutas `/api/orders/sync-web` + botón **"Sincronizar Web"** e insignia `Web · DV-XXXX` en `OrdersTab.tsx` (`271` l.)
  - [x] Modularizar `order-status.service.ts` (`171` l. + `order-lot-picking.helper.ts` `163` l.) y `order-billing.service.ts` (`220` l. + `order-invoice-tx.helper.ts` `139` l.), conectando `order-scale.service.ts` (`145` l.) y `route-settlement.service.ts` (`229` l.) al retorno de estados + validar `30 suites / 123 tests` en verde (`web-order-poller-status.test.ts`)

---

## Plan Activo: Consolidación del Stack Unificado (`GitHub + Supabase + Railway`) y Limpieza de Obsoletos

- [x] **Paso R1: Purga de Plataformas Descartadas (`Vercel`/`PM2`/`Nginx`/`Ngrok`) y Unificación SPA + API para Railway** ✅ COMPLETADO
  - [x] Eliminar configuraciones obsoletas (`frontend/vercel.json`, `backend/ecosystem.config.js`, `docs/nginx.conf`, `frontend/nginx.conf`, `frontend/Dockerfile`, `backend/Dockerfile`, `docker-compose.prod.yml`, `frontend/README.md` y `.vercel`)
  - [x] Quitar del índice de Git las `34` fotos viejas `backend/uploads/products/*.jpg` (`git rm --cached`, conservando el 100% de las fotos en disco) y purgar paquetes huérfanos en la raíz (`npm prune` + `npm audit fix` -> **`0` vulnerabilidades en raíz, backend y frontend**)
  - [x] Crear `spa-static.middleware.ts` (`75` l., entrega unificada de `frontend/dist` + caché inmutable en `/assets` + `no-cache` en PWA + `404 JSON` en `/api/*`), `product-image-cache.middleware.ts` (`122` l., autocuración `READ ONLY` desde `chatbot-dv.product_images`) y `Dockerfile` + `.dockerignore` únicos de producción en la raíz (`node:24-slim`, usuario no-root)
  - [x] Alinear `env.config.ts` para detección segura de entorno Railway (`TRUST_PROXY=1` y origen propio HTTPS) y actualizar documentación (`AGENTS.md`, `TECH_STACK.md`, `ARCHITECTURE.md`, `crm-whatsapp.md`, `.env.example`)
- [x] **Paso R2: Commit Limpio y Respaldo en GitHub (`MarcoEstebanMartin/erp-crm-dv`)** ✅ COMPLETADO (Despliegue en Railway reservado para cuando finalicen las pruebas locales de Frontend/ERP)

---

## Plan Activo: Pulido Operativo de Panel Principal y Accesos Directos (Paso a Paso)

- [x] **Acceso Directo 1 (`Facturar Directo`)**: Abrir directamente la consola **"Emitir Factura de Venta Directa"** (`DirectInvoiceModal`) con foco automático en el buscador de cliente al tocar el acceso directo desde `HomeTab.tsx` (`00cc04b`) ✅ COMPLETADO.
- [x] **Acceso Directo 2 (`Agregar / Editar Cliente` + Buscador `⚡ ARCA` en Vivo)**:
  - [x] Ampliar y modularizar `ClientModal.tsx` (`555` -> `169` l., `maxWidth: 1320px`) en `useClientModalController.ts` (`212` l.), `ClientIdentityRolesCard.tsx` (`234` l.) y `ClientLocationCommercialCard.tsx` (`230` l.), sin textos ni etiquetas abreviadas y con detección instantánea de CUIT duplicado (`Abrir ficha existente`).
  - [x] Construir motor puro Módulo-11 `arca-cuit.engine.ts` (`152` l.), firmador CMS/PKCS#7 nativo `arca-wsaa-cms.util.ts` (`255` l.), generador CSR `arca-csr.util.ts` (`67` l.) y servicio directo `arca-padron.service.ts` (`270` l.) conectado a **ARCA Padrón Alcance 13** en solo lectura (`~370 ms`, trayendo Razón Social, CUIT de 11 dígitos, Domicilio Fiscal y Localidad + CP con solo ingresar DNI o CUIT, eliminando mocks `Avenida Falsa 123`) ✅ COMPLETADO.
- [x] **Acceso Directo 3 (`Generar Lista de Precios PDF` + Espejo Directo `chatbot-dv`)**:
  - [x] Conectar `PriceListModal.tsx` (`188` l.), `priceListHelpers.ts` (`191` l.) y `PriceListTableRenderer.tsx` (`109` l.) al endpoint en vivo `GET /api/products/price-list-catalog` (`price-list-live.service.ts` `144` l.), leyendo directamente desde `chatbot-dv` (`vnklxnvahkmazoymiqlk`) los **331 productos en stock (`active = 1`)**, sus **precios al día** y las **21 categorías exactas** (`Melincué`, `Cremigal`, `Sancor`, `Fiambres`, ..., `Limpieza`) en el mismo orden de `metadata.catalog_active_state`, eliminando la mezcla vieja bajo `REMOTTI`/`VARIOS` y simplificando el botón a ícono de impresora + **PDF**.
  - [x] Ampliar `catalog-sync.engine.ts` (`297` l.) y `production-catalog-sync.service.ts` (`274` l. + `product-upload-writer.helper.ts` `37` l.) para espejar también `commercialCategory`, `rubroId`, `subrubro` y SKUs faltantes desde `chatbot-dv -> erp-dv` + suite `price-list-grouping.test.ts` ✅ COMPLETADO.
