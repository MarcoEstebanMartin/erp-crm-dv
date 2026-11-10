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

### Paso 7: Cirugía Financiera Parte 1 — Cajas, Bancos, Gastos y Cobranzas (`Decimal.js` + Transacciones ACID) ⏳ PENDIENTE (Siguiente paso)
- [ ] Desarmar `finance.controller.ts` (832 líneas), `collection.controller.ts` (620 líneas) y `expense.controller.ts` (576 líneas) en validadores `Zod`, servicios `< 250` líneas y controladores delgados
- [ ] Corregir bug contable en cierre de caja (`closeDrawer`) para que todo recibo impacte Caja y Cuenta Corriente dentro de una única transacción `prisma.$transaction` con `Decimal.js`
- [ ] Cubrir invariantes de arqueo, rendición e imputación con tests en `Vitest`

### Paso 8: Cirugía Financiera Parte 2 — Notas de Crédito, Compras y Facturación Impositiva ⏳ PENDIENTE
- [ ] Desarmar `creditNote.controller.ts` (733 líneas), `purchase.controller.ts` (755 líneas) y `billing.controller.ts` (467 líneas) en capas `< 250` líneas con `Zod` y `Decimal.js`
- [ ] Reemplazar numeración frágil (`count + 1`) de Notas de Crédito internas por secuencia segura basada en `movementId`
- [ ] Asegurar atomicidad en recepción de mercadería (`StockMovement` + costo + lotes) y anulación/aprobación de Notas de Crédito

### Paso 9: Libro Mayor Físico Inmutable (`AccountLedger`) en PostgreSQL ⏳ PENDIENTE
- [ ] Especificar y crear migración segura (`--create-only` cuidando `movement_seq`) para la tabla `AccountLedger`
- [ ] Hacer que toda venta entregada, recibo, nota de crédito, factura de proveedor y retención inserte su asiento inmutable (`DEBIT` / `CREDIT`) en la misma transacción
- [ ] Migrar consultas de resumen de cuenta y saldos a `AccountLedger` con script de verificación de paridad 100%

### Paso 10: Limpieza Final de Controladores Restantes y Pantallas Secundarias ⏳ PENDIENTE
- [ ] Modularizar controladores restantes (`hr`, `logistics`, `offers`, `store`, `fleet`) en servicios `< 250` líneas
- [ ] Dividir vistas secundarias grandes del Frontend (`StockDashboard.tsx`, `RendicionesDashboard.tsx`, `SalesBillingTab.tsx`, `ClientPortal.tsx`)
