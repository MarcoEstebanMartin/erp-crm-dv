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

### Fase 1: Orden de Casa, GitHub Único y Cuentas Unificadas (`estebanmartin06@gmail.com`)
- [x] **Paso 1.1**: Separar `OFERTAS-DV` como carpeta hermana en `C:\Users\Usuario\Desktop\OFERTAS-DV` dejando ambos repositorios Git limpios y sin anidamiento.
- [x] **Paso 1.2**: Alinear el email global de Git en esta PC a `estebanmartin06@gmail.com` y subir `ERP-CRM DV` a un repositorio **Privado** en GitHub (`MarcoEstebanMartin/erp-crm-dv`) para respaldo y descarga en cualquier otra PC.
- [ ] **Paso 1.3**: Migrar la base activa de `OFERTAS-DV` (`sdamxjajnxvykgwyqczo` en EE.UU.) hacia la cuenta única de Supabase de `estebanmartin06@gmail.com` en **Brasil (`sa-east-1`)**, actualizar `DATABASE_URL` en Railway y dar de baja Render + la cuenta secundaria `martinmarcoesteban@gmail.com`.

### Fases Siguientes Planificadas
- [ ] **Fase 2**: Banco único de fotos en Cloudflare R2 (`media.donvenancio.com.ar`) + despliegue de `ERP-CRM DV` en la nube (`sistema.donvenancio.com.ar`).
- [ ] **Fase 3**: Sincronización inicial segura **Producción -> ERP** (precios y 465 fotos vigentes sin pisar producción) y puente unificado de catálogo/stock/pedidos sobre una única base en Brasil.
- [ ] **Fase 4**: Conexión de Agentes de IA (`agencia-bots`) sobre la API validada del ERP + `pgvector`.
