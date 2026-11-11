# Constitución del Proyecto (ERP-CRM Distribuidora Victoria / Don Venancio)

> **Propósito**: Este documento (`.specify/memory/constitution.md`) constituye la ley suprema e innegociable de ingeniería, arquitectura, rigor contable y diseño para cualquier agente de IA o desarrollador humano que opere en este repositorio bajo el flujo **GitHub Spec Kit (Spec-Driven Development)**.

---

## Artículo I: Filosofía Spec-First y Regla Cero (Paso a Paso)
1. **Paso a Paso Estricto (1 Sola Cosa a la Vez)**: Prohibido avanzar a la siguiente fase sin que el paso actual esté explicado en lenguaje claro, compilado con `0 errores` (`tsc --noEmit`), verificado con tests automáticos (`vitest run`) y validado por el usuario.
2. **Prohibición de "Vibe Coding"**: Ningún código de negocio, endpoint o migración puede escribirse de forma improvisada sin consultar o actualizar la especificación correspondiente en `specs/`.
3. **Única Fuente de Verdad (SSOT)**:
   - Arquitectura y Contratos API: `specs/ARCHITECTURE.md`
   - Invariantes Contables y Motor AFIP: `specs/01-invariantes-contables-y-afip.md`
   - Esquema e Invariantes de Datos: `specs/DATABASE.md`
   - Especificaciones de Módulos: `specs/modules/*.md` y `specs/001-*` a `specs/004-*`
   - Tablero Activo de Ejecución: `.agents/task.md`

---

## Artículo II: Arquitectura Anti-Espagueti (Cohesión, Semáforo 250–450 Líneas y 4 Capas)
1. **Cohesión por Responsabilidad y Semáforo de Tamaño (Sin Cortes Artificiales)**:
   - **Zona Ideal (`150–300` líneas)**: Tamaño objetivo para mantener velocidad de edición y radio de impacto cero.
   - **Zona Permitida por Cohesión (`300–450` líneas)**: Permitida cuando una transacción contable (`prisma.$transaction`) o componente forma una sola unidad cohesiva; queda prohibido partir flujos atómicos artificialmente generando "espagueti fragmentado".
   - **Límite Duro (`> 450` líneas)**: Requiere refactorizar extrayendo responsabilidades secundarias (excepto `*.test.ts`, tipos generados y seeds).
2. **Separación en 4 Capas Especializadas**:
   - **Capa 1 — Motor Matemático (`src/core/*.ts` y `src/engines/*.engine.ts`)**: Solo cuentas puras con `Decimal.js`, sin acoplamiento a UI ni base de datos, 100% probado con `Vitest`.
   - **Capa 2 — Contratos (`*.schema.ts` / `*.validator.ts`)**: Validación estricta de entradas y salidas con `Zod`.
   - **Capa 3 — Controladores Delgados (`*.controller.ts` < 120 líneas) y Servicios (`*.service.ts`, objetivo `< 300` / máx. `450` por cohesión)**: Los controladores jamás hacen cuentas ni consultas directas a Prisma; solo delegan al servicio y motor.
   - **Capa 4 — Pestañas y Modales Aislados (`*Tab.tsx` / `*Modal.tsx`, objetivo `< 300` / máx. `450` por cohesión)**: Cada vista y ventana emergente vive en su propio archivo independiente.

---

## Artículo III: Rigor Financiero, Snapshots y Libro Mayor Inmutable
1. **Motor Matemático Bancario (`Decimal.js`)**: Queda prohibido usar `Float`, `Number()` o `Math.round()` nativo de JavaScript para dinero o pesajes. Todo cálculo pasa por `src/core/money.ts` (`precision: 20, rounding: Decimal.ROUND_HALF_UP`).
2. **Política de "Pesos Enteros en Origen"**: Todo precio de lista y todo subtotal de renglón (`OrderItem.subtotal`) se redondea al peso entero más cercano (`ROUND_HALF_UP`, 0 decimales). La suma de los renglones visibles coincide **siempre al 100%** con el total del comprobante.
3. **Desglose Fiscal Interno AFIP/ARCA**: Al emitir Factura Electrónica Oficial (A/B/C), el motor calcula hacia adentro los 2 decimales exactos exigidos por AFIP (`ImpNeto + ImpIVA + ImpTrib === ImpTotal`), garantizando aprobación de CAE sin ensuciar la operatoria diaria en pesos enteros.
4. **Congelamiento Histórico en Ventas (`Snapshots`)**: Cada `OrderItem` congela en el instante de la venta `unitCostSnapshot`, `listPriceSnapshot` y `discountPctSnapshot`. Las ganancias históricas son 100% inmunes a futuros cambios de costos.
5. **Contabilidad por Libro Mayor Inmutable (`Ledger Pattern`)**:
   - **Cuenta Corriente**: Ningún saldo se edita a mano; surge de asientos `DEBIT` (facturas/remitos) y `CREDIT` (cobros/notas de crédito), con contra-asiento automático al anular.
   - **Inventario (`StockMovement`)**: Todo cambio de stock deja movimiento auditable (`IN`, `OUT`, `ADJUSTMENT`), y las hormas pesables se valorizan por `unidades × approximateWeight × costo/kg`.

---

## Artículo IV: Invariantes Sagradas de Base de Datos y Archivos Maestros
1. **Inmutabilidad de Migraciones**: Los archivos en `backend/prisma/migrations/` ya aplicados son **SAGRADOS**.
2. **Flujo Seguro Obligatorio (`--create-only`)**:
   - Toda migración nueva se crea con `npx prisma migrate dev --name <nombre> --create-only`.
   - Antes de aplicarla, se abre `migration.sql`, se **elimina cualquier `DROP SEQUENCE movement_seq`** y se asegura `CREATE SEQUENCE IF NOT EXISTS movement_seq`.
   - Se aplica con `npx prisma migrate deploy` y `npx prisma generate`.
3. **Repositorio Maestro de Fotos (`ARCHIVOS/fotos/Productos/`)**: Es sagrado e inmutable (`[SKU].[ext]`).

---

## Artículo V: Estética UI (Stripe / Linear / Notion) y Puertas de Calidad
1. **Minimalismo y Velocidad**: Abundante espacio en blanco, bordes de `1px`, paleta de grises de alta fidelidad y rojo `#E30613` reservado exclusivamente para CTAs críticos o peligro.
2. **Puertas de Calidad Obligatorias (Quality Gates)**: Ningún paso se da por terminado sin aprobar con **0 errores**:
   - `cd backend && npx tsc --noEmit`
   - `cd backend && npx vitest run`
   - `cd frontend && npx tsc --noEmit`

---
**Versión de Constitución**: 2.0.0 (Fusión Blindada SDD) | **Estado**: Activa y Vinculante
