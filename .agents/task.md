# Tablero Vivo de Tarea Activa (SDD)

## Tarea Actual: Modernización Estructural de Stock, Inventario y Movimientos
- [x] Actualizar esquema Prisma (`StockMovement`, `Order`, `PurchaseOrder`, `CreditNote`) con FKs y `movementId`
- [x] Generar migración segura con `--create-only`, limpiar `DROP SEQUENCE` y añadir backfill SQL
- [x] Aplicar migración con `prisma migrate deploy` y regenerar cliente con `prisma generate`
- [x] Actualizar servicios y controladores de backend (`order.service.ts`, `order.controller.ts`, `purchase.controller.ts`, `creditNote.controller.ts`, `product.service.ts`)
- [x] Actualizar vista de movimientos de inventario en frontend (`StockDashboard.tsx`)
- [x] Compilar backend y frontend sin errores
- [x] Generar walkthrough de verificación

---
*Instrucciones para próximas tareas:*
1. Reemplazar el título y los ítems de esta lista con los pasos y criterios de aceptación de la nueva tarea.
2. Cada agente consultará la spec correspondiente en `specs/modules/` antes de ejecutar.
3. Marcar los casilleros a medida que se verifiquen los cambios (`[x]`).
