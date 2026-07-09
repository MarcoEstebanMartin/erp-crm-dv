# Tareas: Reporte de Deudores por Ruta y Sucursales

- [x] Modificar el esquema de base de datos (`schema.prisma`) para agregar el campo `route`
- [x] Modificar el sembrador (`seed.js`) para importar las rutas de los clientes
- [x] Ejecutar la migración de la base de datos y correr el sembrador
- [x] Agregar validación del campo `route` en el validador del backend (`persona.validator.ts`)
- [x] Modificar los métodos de creación y actualización en `persona.service.ts` para soportar `route`
- [x] Implementar el cálculo FIFO de deudas por sucursal y reporte de deudores en `persona.service.ts`
- [x] Exponer el nuevo controlador de reporte de deudores en `persona.controller.ts` y registrar su ruta
- [x] Modificar el cliente API del frontend para agregar la llamada al reporte de deudores
- [x] Integrar el campo `route` en el modal de registro y edición de clientes en `AdminDashboard.tsx`
- [x] Diseñar e implementar la vista de reporte premium de deudores por ruta en `AdminDashboard.tsx` con filtros por ruta y avisos de múltiples boletas
- [x] Validar la compilación de TypeScript de backend y frontend
