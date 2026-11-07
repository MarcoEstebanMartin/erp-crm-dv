# Constitución del Proyecto (ERP-CRM Distribuidora Victoria)

> **Propósito**: Este documento (`.specify/memory/constitution.md`) constituye la ley suprema e innegociable de ingeniería, arquitectura y diseño para cualquier agente de IA o desarrollador humano que opere en este repositorio bajo el flujo **GitHub Spec Kit (Spec-Driven Development)**.

---

## Artículo I: Filosofía Spec-First (Primero la Especificación)
1. **Prohibición de "Vibe Coding"**: Ningún código de negocio, endpoint o migración puede escribirse de forma improvisada sin antes consultar o actualizar la especificación correspondiente en `specs/` o en el workspace de la funcionalidad (`specs/<id>-<feature>/spec.md`).
2. **Única Fuente de Verdad (SSOT)**:
   - Arquitectura y Contratos API: `specs/ARCHITECTURE.md`
   - Esquema e Invariantes de Datos: `specs/DATABASE.md`
   - Reglas de Dominio por Módulo: `specs/modules/*.md`
   - Tablero Activo de Ejecución: `.agents/task.md`

---

## Artículo II: Estética y Diseño UI (Stripe / Linear / Notion)
1. **Minimalismo y Velocidad**: Interfaz limpia, ágil, con abundante espacio en blanco, bordes finos de `1px` y paleta de grises de alta fidelidad.
2. **Uso Estricto del Color Corporativo**: El rojo corporativo `#E30613` se reserva **exclusivamente** para CTAs críticos, indicadores de peligro o alertas específicas. Queda prohibido sobrecargar la vista.
3. **Cero Datos de Relleno**: Prohibido usar placeholders genéricos (`Lorem ipsum`, `Test 123`). Toda demostración o semilla debe emplear datos realistas de una distribuidora de alimentos y bebidas.
4. **Optimización de Clics**: Las acciones operativas frecuentes (preventa móvil, búsqueda de SKU, armado en depósito, facturación AFIP, cobros en caja) deben resolverse en la menor cantidad de pasos posibles.

---

## Artículo III: Invariantes Sagradas de Base de Datos y Migraciones
1. **Inmutabilidad de Migraciones**: Los archivos en `backend/prisma/migrations/` ya aplicados son **SAGRADOS**. Jamás se edita una migración pasada.
2. **Flujo Seguro Obligatorio (`--create-only`)**:
   - Prisma intenta eliminar por defecto objetos nativos de PostgreSQL como la secuencia `movement_seq`.
   - Toda migración nueva debe crearse **SIEMPRE** con:
     `npx prisma migrate dev --name <nombre> --create-only`
   - Antes de aplicarla, se debe abrir el `migration.sql` generado, **eliminar cualquier `DROP SEQUENCE`** y asegurar `CREATE SEQUENCE IF NOT EXISTS movement_seq` cuando corresponda.
   - Finalmente, aplicar con `npx prisma migrate deploy` y regenerar con `npx prisma generate`.
3. **Rigor Financiero (`Decimal`)**: Todo monto monetario, precio, impuesto o saldo de cuenta corriente debe usar estrictamente `Decimal` (`@db.Decimal(12, 2)`). Prohibido usar `Float` para dinero.
4. **Secuencias sin Colisiones**: En scripts de seed o pruebas, nunca forzar valores manuales en campos autogenerados como `movementId`.

---

## Artículo IV: Inmunidad de Archivos Maestros e Imágenes
1. **Repositorio Maestro de Fotos (`ARCHIVOS/fotos/Productos/`)**: Es sagrado e inmutable. Ningún script ni agente puede borrar, renombrar ni desplazar numéricamente (`+1 / -1`) los archivos existentes.
2. **Nomenclatura Estricta**: Cada imagen responde exclusivamente a `[SKU].[ext]` (ej. `0052.jpg`). Los SKUs son permanentes.
3. **Planilla Maestra (`Maestro1.xlsx`)**: Toda sincronización contra la base de datos debe operar en modo `upsert` preservando la integridad histórica.

---

## Artículo V: Confinamiento de Roles y Puertas de Calidad (Quality Gates)
1. **Fronteras por Especialidad (`.agents/ROLES.md`)**:
   - **Lead / Orchestrator**: Gestiona `.specify/`, `specs/` y `.agents/task.md`.
   - **Backend Specialist**: Confinado a `backend/src/` y `backend/prisma/`. Respeta el envelope JSON `{ success, data, error }`.
   - **Frontend Specialist**: Confinado a `frontend/src/`. Consume contratos tipados en React 19 + TypeScript + CSS nativo.
   - **QA / Verifier**: Audita compilación e invariantes sin alterar lógica de negocio.
2. **Compilación Estricta Obligatoria**: Ninguna tarea ni fase de implementación se considera terminada sin ejecutar y aprobar con **0 errores**:
   - `cd backend && npx tsc --noEmit`
   - `cd frontend && npx tsc --noEmit`
3. **Seguridad en Git**: Nunca ejecutar `git checkout` o `git restore` sobre archivos de trabajo sin verificar antes `git status` y resguardar cambios no confirmados.

---
**Versión de Constitución**: 1.0.0 | **Estado**: Activa y Vinculante
