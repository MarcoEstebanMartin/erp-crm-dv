# Plan de Arquitectura Técnica: [NOMBRE DE LA FUNCIONALIDAD]

- **Especificación Origen**: `specs/[NNN-nombre-corto]/spec.md` (o `specs/modules/[modulo].md`)
- **Fecha**: `[YYYY-MM-DD]`
- **Autor / Agente**: `Lead / Orchestrator`

---

## 1. Verificación contra la Constitución (`.specify/memory/constitution.md`)
- [ ] **Estética y UX**: ¿Respeta diseño minimalista, bordes `1px` y uso exclusivo de `#E30613` para CTAs/peligro?
- [ ] **Rigor Financiero**: ¿Usa `Decimal(12,2)` para todo valor monetario?
- [ ] **Seguridad de Base de Datos**: Si hay cambios en Prisma, ¿está planificado el flujo `--create-only` protegiendo `movement_seq`?
- [ ] **Inmunidad de Maestros**: ¿Garantiza que `ARCHIVOS/fotos/Productos/` no sufre borrados ni renombrados?
- [ ] **Fronteras de Roles**: ¿Están claramente separadas las tareas de Backend (`backend/src/`) y Frontend (`frontend/src/`)?

---

## 2. Impacto en Base de Datos (`specs/DATABASE.md`)
> Indicar si requiere migración en `backend/prisma/schema.prisma` o si opera sobre el esquema actual.

- **Modelos Afectados**: `[Ninguno | Lista de modelos Prisma]`
- **Estrategia de Migración**:
  1. `cd backend && npx prisma migrate dev --name <nombre> --create-only`
  2. Limpiar `DROP SEQUENCE` del SQL generado.
  3. `npx prisma migrate deploy && npx prisma generate`

---

## 3. Contratos de API REST (`specs/ARCHITECTURE.md`)
> Todo endpoint debe devolver `{ "success": boolean, "data"?: any, "error"?: string }`.

### `[MÉTODO]` `/api/[ruta]`
- **Roles Permitidos**: `[ADMIN | VENTAS | DEPOSITO]`
- **Payload / Query Params**:
  ```json
  {}
  ```
- **Respuesta Exitosa (`200` / `201`)**:
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

---

## 4. Diseño por Capas y Archivos a Modificar

### 4.1. Capa Backend (`backend/src/`)
- `backend/src/routes/...`
- `backend/src/controllers/...`
- `backend/src/services/...`

### 4.2. Capa Frontend (`frontend/src/`)
- `frontend/src/types/...`
- `frontend/src/components/...`

---

## 5. Estrategia de Verificación (Quality Gate)
1. Compilación Backend: `cd backend && npx tsc --noEmit`
2. Compilación Frontend: `cd frontend && npx tsc --noEmit`
3. Prueba funcional del flujo de extremo a extremo.
