---
name: speckit
description: Flujo oficial de GitHub Spec Kit (Spec-Driven Development) adaptado para ERP-CRM DV. Úsalo cuando el usuario invoque comandos o fases de Spec Kit (constitution, specify, plan, tasks, implement) o pida desarrollar una funcionalidad siguiendo SDD estructurado.
---

# Skill: GitHub Spec Kit para ERP-CRM DV

Este proyecto implementa una **arquitectura híbrida de GitHub Spec Kit (`github/spec-kit`)** que une el control estructurado de `.specify/` con las especificaciones vivas de dominio en `specs/` y el protocolo multiagente de `.agents/`.

## Estructura del Kit en el Repositorio

- **Constitución Global**: `.specify/memory/constitution.md` (Reglas innegociables del proyecto).
- **Plantillas Oficiales**:
  - `.specify/templates/spec-template.md`
  - `.specify/templates/plan-template.md`
  - `.specify/templates/tasks-template.md`
- **Estado de Funcionalidad Activa**: `.specify/feature.json`
- **Script Generador de Features**: `.specify/scripts/new-feature.ps1`
- **Especificaciones de Dominio (SSOT)**:
  - `specs/ARCHITECTURE.md`
  - `specs/DATABASE.md`
  - `specs/modules/*.md`
- **Espacios de Trabajo por Feature**: `specs/features/<NNN-nombre>/` (`spec.md`, `plan.md`, `tasks.md`)
- **Tablero Activo y Roles**: `.agents/task.md` y `.agents/ROLES.md`

---

## Las 5 Fases y Comandos del Flujo Spec Kit

Cuando el usuario solicite trabajar con Spec Kit o invoque cualquiera de estas fases, ejecuta rigurosamente el paso correspondiente:

### 1. Fase `constitution` (`/speckit.constitution`)
- **Objetivo**: Consultar o actualizar los principios rectores en `.specify/memory/constitution.md`.
- **Acción**: Verifica que toda decisión respete la estética Stripe/Linear/Notion, el flujo seguro de Prisma (`--create-only` sin borrar `movement_seq`), el uso de `Decimal` para montos y el banco único SQL de imágenes (`chatbot-dv.product_images`).

### 2. Fase `specify` (`/speckit.specify <descripción>`)
- **Objetivo**: Definir **qué** se construye y **por qué** antes de pensar en código.
- **Acción**:
  1. Si es una funcionalidad nueva o épica, ejecuta `.\.specify\scripts\new-feature.ps1 -Id "<NNN>" -Name "<slug>"` o crea `specs/features/<NNN-slug>/spec.md` usando `.specify/templates/spec-template.md`.
  2. Identifica qué módulo de `specs/modules/` (`wms-deposito.md`, `facturacion-afip.md`, `crm-whatsapp.md`, `clientes-rutas.md`) se ve afectado y actualiza sus reglas de negocio si corresponde.
  3. Si hay dudas funcionales, pregunta al usuario antes de avanzar al plan.

### 3. Fase `plan` (`/speckit.plan`)
- **Objetivo**: Diseñar **cómo** se implementará técnicamente, validando cada punto contra `.specify/memory/constitution.md`.
- **Acción**:
  1. Completa `specs/features/<NNN-slug>/plan.md` usando `.specify/templates/plan-template.md`.
  2. Define modelos Prisma afectados, estrategia `--create-only`, contratos JSON REST (`{ success, data, error }`) y archivos exactos de Backend y Frontend.

### 4. Fase `tasks` (`/speckit.tasks`)
- **Objetivo**: Desglosar el plan técnico en pasos atómicos verificables y asignados por rol (`.agents/ROLES.md`).
- **Acción**:
  1. Genera la lista ordenada en `specs/features/<NNN-slug>/tasks.md` usando `.specify/templates/tasks-template.md`.
  2. Sincroniza la lista activa en `.agents/task.md`.

### 5. Fase `implement` (`/speckit.implement`)
- **Objetivo**: Ejecutar secuencialmente las tareas respetando las fronteras de cada rol.
- **Acción**:
  1. Ejecuta primero las tareas de Base de Datos y Backend (`backend/src/`).
  2. Ejecuta luego las tareas de Frontend (`frontend/src/`).
  3. Corre las puertas de calidad obligatorias (Quality Gates):
     - `cd backend && npx tsc --noEmit`
     - `cd frontend && npx tsc --noEmit`
  4. Marca cada ítem completado (`[x]`) en `tasks.md` y `.agents/task.md`.
