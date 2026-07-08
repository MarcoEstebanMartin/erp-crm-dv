# Estrategia de Mantenimiento y Pilares de Arquitectura - ERP-CRM DV

Este documento establece las frecuencias recomendadas para la limpieza de código y resolución de bugs, así como la alineación estratégica del ERP en base a los pilares de: Automatización, Sistematización, Delegar, Control, Seguridad, Escalabilidad, Minimalismo, Valor, Practicidad y Modernidad.

---

## 1. Ciclos de Limpieza de Código y Gestión de Bugs

Para evitar la degradación del software (*software rot*) y mantener un desarrollo ágil, se recomienda la siguiente disciplina:

| Frecuencia | Tipo de Limpieza | Acciones Requeridas |
| :--- | :--- | :--- |
| **Diario / Continuo** | Micro-refactorizaciones | - Eliminar `console.log` o comentarios de prueba antes de cada commit.<br>- Evitar tipados laxos (`any` implícitos) usando TypeScript estricto.<br>- Formateo de código estandarizado con Prettier/ESLint. |
| **Al cierre de Hito**<br>(Cada 1-2 semanas) | Estabilización del Sprint | - Asegurar la compilación impecable (`tsc --noEmit`) en todo el proyecto.<br>- Mover todos los scripts temporales (`fix_*.js`, `patch_*.js`) a una carpeta `/tools` para despejar la raíz.<br>- Pruebas rápidas de flujos críticos (caja, facturación, reparto). |
| **Mensual** | Auditoría y Mantenimiento | - Actualización controlada de dependencias (`npm audit`).<br>- Optimización de índices en PostgreSQL según volumen de datos.<br>- Refactorización de código duplicado en servicios/controladores. |

---

## 2. Los 10 Pilares para un ERP Increíble

### 1. Automatización
El sistema trabaja para el usuario.
* Facturación AFIP automática al marcar un reparto como entregado.
* Recálculo automático de precios de venta (`listPrice`, `listPriceB`, `listPriceC`) al actualizar costos o márgenes de *Rubro*.
* Optimización y asignación automática de rutas de reparto según la dirección del cliente.

### 2. Sistematización
Comportamiento robusto y predecible.
* Flujo de estados estricto y validado para pedidos:
  `PENDING -> PREPARING -> PREPARED -> DELIVERED / CANCELLED`.
* Manejo estandarizado de errores en el backend con respuestas unificadas.

### 3. Delegar
Permite al dueño delegar tareas con total control.
* Roles de usuario (`ADMIN`, `FACTURACION`, `VENDEDOR`, `DEPOSITO`) con restricciones estrictas de backend.
* Ocultar información financiera confidencial para perfiles operativos (como los montos de dinero en el módulo de reparto para choferes/logística).

### 4. Control
Visibilidad absoluta sobre las operaciones.
* Trazabilidad estricta por lotes (`ProductLot`) y fechas de vencimiento en cada movimiento de stock de alimentos/bebidas.
* Arqueos de caja declarativos obligatorios al cierre, comparando el saldo real contra el saldo calculado por sistema.

### 5. Seguridad
Proteger los activos del negocio.
* Historial de auditoría (`AuditLog`) para acciones críticas (cambios de precios, anulaciones, ajustes manuales de stock).
* Autenticación segura mediante tokens JWT.

### 6. Escalabilidad
Diseñar el sistema para crecer 100 veces su volumen actual.
* Paginación obligatoria (`take` y `skip`) en todas las tablas con volumen (pedidos, productos, transacciones).
* Uso estratégico de índices de base de datos (`@@index`) en campos de búsqueda comunes en `schema.prisma`.

### 7. Minimalismo (Estilo Stripe / Linear)
Evitar la fatiga visual del usuario.
* Interfaz limpia con bordes finos de 1px y abundante espacio.
* El color rojo corporativo `#E30613` se reserva exclusivamente para avisos críticos, errores y CTAs de riesgo, manteniendo el resto de la interfaz en tonos grises elegantes.

### 8. Valor
Enfoque en automatizar lo que verdaderamente genera rentabilidad.
* Cuentas corrientes claras, transparentes e históricas por cliente y proveedor.
* Cálculo automático de percepciones impositivas (como IIBB) directamente en la facturación.

### 9. Practicidad
Optimización de la velocidad de uso diario.
* Operabilidad completa sin ratón (atajos de teclado para facturación rápida).
* Integración nativa y veloz con lectores de códigos de barras.

### 10. Modernidad
Vigencia tecnológica del ERP.
* TypeScript al 100% en backend y frontend.
* Componentes frontend modulares de React con micro-animaciones fluidas para una sensación premium.

---

## 3. Recomendaciones Técnicas Inmediatas y Acciones Realizadas

* **Limpieza de la Raíz y Directorios (Ejecutado - 08/07/2026):** Se crearon carpetas organizadas para despejar el desorden de scripts temporales:
  * **Directorio raíz**: Se movieron más de 45 scripts (`fix_*.js`, `patch_*.js`, `*.py`, `*.csv`, `*.bak`) a [`/scripts/`](file:///c:/Users/Usuario/Desktop/ERP-CRM%20DV/scripts).
  * **Backend**: Se movieron los scripts de chequeo y migración a [`/backend/scripts/`](file:///c:/Users/Usuario/Desktop/ERP-CRM%20DV/backend/scripts) y se actualizó su `package.json` para apuntar a la nueva ruta.
  * **Frontend**: Se limpió `frontend/src/` moviendo los archivos de respaldo `*.bak` y `*.bak2` a [`/frontend/src/backup/`](file:///c:/Users/Usuario/Desktop/ERP-CRM%20DV/frontend/src/backup).
* **Separación de Lógica (Pendiente):** Mover la lógica pesada del backend desde los controladores a servicios dedicados en `backend/src/services`.
* **Estilos Centralizados (Pendiente):** Usar variables CSS globales en el frontend para asegurar consistencia visual y agilidad ante cambios de diseño.
* **Transacciones de Prisma (Pendiente):** Proteger operaciones financieras complejas (que involucren balances, cajas y transacciones simultáneas) envolviéndolas en `prisma.$transaction`.
