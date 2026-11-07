# Sistema de Especificaciones (Spec-Driven Development + GitHub Spec Kit)

Bienvenido al repositorio de especificaciones técnicas y de negocio de **ERP-CRM Distribuidora Victoria**.

Este proyecto implementa una integración híbrida de **[GitHub Spec Kit](https://github.com/github/spec-kit)** unida a nuestra **Única Fuente de Verdad (SSOT)**. Todo agente de IA, desarrollador o auditor debe consultar estos documentos antes de planificar o escribir código.

---

## 1. Mapa de Directorios SDD (`.specify/`, `specs/` y `.agents/`)

```text
ERP-CRM DV/
├── .specify/                        # Núcleo de GitHub Spec Kit
│   ├── feature.json                 # Puntero a la funcionalidad activa
│   ├── memory/
│   │   └── constitution.md          # Constitución innegociable del proyecto
│   ├── scripts/
│   │   └── new-feature.ps1          # Generador automático de workspaces de features
│   └── templates/
│       ├── spec-template.md         # Plantilla de Especificación Funcional (Qué/Porqué)
│       ├── plan-template.md         # Plantilla de Plan Técnico (Cómo)
│       └── tasks-template.md        # Plantilla de Desglose de Tareas por Rol
├── .agents/                         # Gobernanza Multiagente y Skills
│   ├── AGENTS.md                    # Reglas generales del entorno
│   ├── ROLES.md                     # Fronteras entre Lead, Backend, Frontend y QA
│   ├── task.md                      # Tablero vivo de la tarea en curso
│   └── skills/
│       └── speckit/SKILL.md         # Skill ejecutable del flujo Spec Kit
└── specs/                           # Fuente Única de Verdad (SSOT)
    ├── README.md                    # Este documento (Índice y Ciclo de Vida)
    ├── ARCHITECTURE.md              # Arquitectura global, puertos, contratos API y JWT
    ├── DATABASE.md                  # Invariantes de PostgreSQL, Prisma y Maestro1.xlsx
    ├── modules/                     # Especificaciones vivas por dominio de negocio
    │   ├── wms-deposito.md          # Almacén espacial, cámaras, racks, slots y stock
    │   ├── facturacion-afip.md      # Facturación electrónica, WSFE/WSAA, A/B/C/X y caja
    │   ├── crm-whatsapp.md          # Integración WhatsApp Cloud API, Webhooks y chat
    │   └── clientes-rutas.md        # Cuentas corrientes, imputación FIFO y rutas
    └── features/                    # Historial de funcionalidades creadas con Spec Kit
        └── <NNN-nombre-feature>/    # Workspace individual (spec.md, plan.md, tasks.md)
```

---

## 2. El Ciclo de Vida GitHub Spec Kit (5 Fases)

Cualquier cambio estructural, módulo nuevo o funcionalidad sigue estas 5 etapas secuenciales:

1. **Constitución (`constitution`)**:
   - Consultar `.specify/memory/constitution.md` para asegurar el cumplimiento de las reglas innegociables (estética minimalista `#E30613`, flujo `--create-only` protegiendo `movement_seq`, tipos `Decimal`, e inmunidad de `ARCHIVOS/fotos/Productos/`).
2. **Especificar (`specify`)**:
   - Para funcionalidades nuevas, inicializar el workspace con:
     `.\.specify\scripts\new-feature.ps1 -Id "001" -Name "nombre-feature"`
   - Definir el **qué** y el **porqué** en `specs/features/<id>/spec.md` y actualizar el módulo de dominio en `specs/modules/`.
3. **Planificar (`plan`)**:
   - Diseñar la arquitectura técnica en `specs/features/<id>/plan.md` validando contratos de API (`specs/ARCHITECTURE.md`) y modelos de datos (`specs/DATABASE.md`).
4. **Desglosar Tareas (`tasks`)**:
   - Generar la lista atómica de tareas por rol en `specs/features/<id>/tasks.md` y sincronizarla con el tablero activo `.agents/task.md`.
5. **Implementar y Verificar (`implement`)**:
   - Ejecutar respetando los límites de `.agents/ROLES.md`.
   - Pasar las pruebas de compilación obligatorias: `npx tsc --noEmit` en `backend/` y `frontend/`.
