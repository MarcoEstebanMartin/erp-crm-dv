# Sistema de Especificaciones (Spec-Driven Development - ERP-CRM DV)

Bienvenido al repositorio de especificaciones técnicas y de negocio de **ERP-CRM Distribuidora Victoria**.

Este directorio es la **Única Fuente de Verdad (SSOT)** de las reglas del software. Todo agente de IA, desarrollador o auditor debe consultar estos documentos antes de planificar o escribir código.

---

## 1. Índice de Documentos

```text
specs/
├── README.md                  # Este documento (Índice y Ciclo de Vida)
├── ARCHITECTURE.md            # Arquitectura global, puertos, servicios, contratos API y JWT
├── DATABASE.md                # Invariantes de PostgreSQL, Prisma, migraciones seguras y Maestro1.xlsx
└── modules/                   # Especificaciones funcionales por dominio de negocio
    ├── wms-deposito.md        # Almacén espacial, cámaras, racks, slots y movimientos de stock
    ├── facturacion-afip.md    # Facturación electrónica, WSFE/WSAA, tipos A/B/C/X y tesorería
    ├── crm-whatsapp.md        # Integración WhatsApp Cloud API, Webhooks Ngrok y chat
    └── clientes-rutas.md      # Cuentas corrientes, imputación FIFO de deudas y reparto por rutas
```

---

## 2. El Ciclo de Vida SDD (Spec-Driven Development)

Cualquier cambio, corrección de bug o nueva funcionalidad sigue obligatoriamente estas 4 fases:

1. **Especificar (Spec)**:
   - Identificar a qué módulo de `specs/modules/` afecta la solicitud.
   - Si se requiere una nueva regla de negocio o nuevo endpoint, se documenta primero en la especificación correspondiente.
2. **Planificar (Plan)**:
   - Configurar la tarea activa en `.agents/task.md` con su lista de verificación y criterios de aceptación claros.
   - Respetar los límites de cada rol definidos en `.agents/ROLES.md`.
3. **Implementar (Build)**:
   - Escribir el código respetando los contratos y tipos de datos establecidos.
   - Seguir el flujo seguro de migraciones (`--create-only`) si se toca la base de datos.
4. **Verificar (Verify)**:
   - Compilación estricta de TypeScript: `npx tsc --noEmit` en backend y frontend.
   - Verificar que no haya secuencias rotas ni fotos maestras alteradas.
   - Marcar la tarea en `task.md` como completada al 100%.
