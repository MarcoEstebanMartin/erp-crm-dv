# Desglose de Tareas Ejecutables: [NOMBRE DE LA FUNCIONALIDAD]

- **Especificación**: `specs/[NNN-nombre-corto]/spec.md`
- **Plan Técnico**: `specs/[NNN-nombre-corto]/plan.md`
- **Sincronizado con**: `.agents/task.md`

---

## Fase 1: Especificación y Base de Datos (Backend Specialist)
- [ ] **T001** [Spec] Actualizar documentación de dominio en `specs/modules/[modulo].md` si aplica.
- [ ] **T002** [DB] Modificar `backend/prisma/schema.prisma` (solo si aplica).
- [ ] **T003** [DB] Generar migración con `npx prisma migrate dev --name <nombre> --create-only`, limpiar `DROP SEQUENCE` y aplicar con `npx prisma migrate deploy`.

## Fase 2: Implementación Backend (`backend/src/`)
- [ ] **T004** [Backend] Implementar lógica de negocio y validaciones en `backend/src/services/`.
- [ ] **T005** [Backend] Exponer controlador y ruta en `backend/src/controllers/` y `backend/src/routes/` respetando envelope `{ success, data, error }`.

## Fase 3: Implementación Frontend (`frontend/src/`)
- [ ] **T006** [Frontend] Actualizar interfaces TypeScript en `frontend/src/types/`.
- [ ] **T007** [Frontend] Construir/actualizar componentes en `frontend/src/components/` respetando estética Stripe/Linear/Notion.

## Fase 4: Auditoría y Verificación (QA / Verifier)
- [ ] **T008** [QA] Ejecutar `cd backend && npx tsc --noEmit` (0 errores).
- [ ] **T009** [QA] Ejecutar `cd frontend && npx tsc --noEmit` (0 errores).
- [ ] **T010** [QA] Verificar integridad de `movement_seq` y carpeta `ARCHIVOS/fotos/Productos/`.
- [ ] **T011** [Git] Marcar `.agents/task.md` al 100% y realizar commit incremental.
