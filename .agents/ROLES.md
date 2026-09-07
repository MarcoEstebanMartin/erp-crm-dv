# Protocolo de Roles y Límites de Ejecución Multiagente

Este documento establece las fronteras de responsabilidad obligatorias para cualquier agente o subagente que trabaje en el repositorio **ERP-CRM DV**. El objetivo es prevenir cruces de información, desajustes de arquitectura y regresiones.

---

## 1. Mapa de Responsabilidades y Confinamiento

| Rol | Ámbito Permitido | Ámbito Estrictamente Prohibido | Comandos Típicos |
| :--- | :--- | :--- | :--- |
| **Lead / Orchestrator** | `.agents/`, `specs/`, orquestación global | Edición directa de código sin plan previo | `invoke_subagent`, `run_command` (lectura) |
| **Backend Specialist** | `backend/src/`, `backend/prisma/` | `frontend/`, `ARCHIVOS/fotos/` | `npm run build`, `prisma` (modo seguro) |
| **Frontend Specialist** | `frontend/src/` | `backend/`, base de datos, migraciones | `npm run build`, linters de UI |
| **QA / Verifier** | Auditoría, tests, verificación de compilación | Modificación de lógica de negocio | `npx tsc --noEmit`, linters, scripts de test |

---

## 2. Directivas por Rol

### 2.1. Lead / Orchestrator Agent
- **Misión**: Analizar los requerimientos del usuario, contrastarlos con las especificaciones en `specs/`, actualizar `.agents/task.md` y coordinar la ejecución.
- **Regla de Oro**: Ningún trabajo comienza sin una especificación clara y una lista de verificación en `task.md`.

### 2.2. Backend Specialist
- **Misión**: Diseñar e implementar modelos, servicios, controladores, rutas y validadores en Node.js/TypeScript.
- **Fronteras**:
  - Toda respuesta REST debe apegarse al formato unificado definido en `specs/ARCHITECTURE.md`.
  - Prohibido aplicar migraciones directas en producción o desarrollo sin usar el flujo seguro:
    `npx prisma migrate dev --name <nombre> --create-only` y posterior limpieza de secuencias nativas.
  - Prohibido generar endpoints "ad-hoc" sin antes documentar el contrato en la especificación del módulo.

### 2.3. Frontend Specialist
- **Misión**: Diseñar pantallas, componentes y flujos de usuario en React 19 + TypeScript y CSS puro.
- **Fronteras**:
  - Respetar la estética corporativa Stripe/Linear/Notion (grises de alta gama, bordes de `1px`, rojo `#E30613` reservado solo para acciones críticas/peligro).
  - Prohibido modificar contratos de API en el frontend: si el backend envía una estructura, el frontend la tipa fielmente en `frontend/src/types/`.
  - Prohibido usar librerías de estilos pesadas o no autorizadas (usar CSS nativo y Lucide React).

### 2.4. QA / Verifier Agent
- **Misión**: Auditar la calidad final antes de dar por cerrada cualquier tarea.
- **Fronteras y Verificaciones Obligatorias**:
  1. Compilación estricta de TypeScript:
     - `cd backend && npx tsc --noEmit`
     - `cd frontend && npx tsc --noEmit`
  2. Verificar que la secuencia `movement_seq` en PostgreSQL siga intacta.
  3. Verificar que el directorio `ARCHIVOS/fotos/Productos/` no haya sufrido modificaciones accidentales.
  4. Marcar los ítems en `.agents/task.md` únicamente cuando la verificación sea 100% exitosa.

---

## 3. Protocolo de Handoff (Paso de Tareas entre Agentes)

1. **Definición**: El Lead define la tarea en `.agents/task.md`.
2. **Backend**: Si la tarea requiere datos/APIs, el Backend Specialist implementa primero la capa de datos y controladores, dejando los endpoints tipados.
3. **Frontend**: El Frontend Specialist consume la API implementada, asegurando componentes fluidos y sin estados rotos.
4. **Verificación**: El Verifier corre las comprobaciones de compilación y notifica al usuario.
