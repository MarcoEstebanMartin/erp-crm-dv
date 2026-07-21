# Guías de Trabajo y Estética ERP-CRM DV

Este archivo define las reglas de comportamiento, estética y calidad profesional acordadas para el desarrollo del sistema:

## 1. Estética y Diseño (Stripe / Linear / Notion)
- **Minimalismo y Velocidad**: Interfaz limpia, ágil, con abundante espacio en blanco, bordes finos de `1px` y grises de alta fidelidad.
- **Uso del Color**: Paleta de tonos grises y oscuros minimalistas. El color corporativo rojo `#E30613` se reserva exclusivamente para CTAs críticos, indicadores de peligro o alertas específicas, evitando sobrecargar la vista del usuario.
- **Micro-animaciones**: Transiciones y efectos hover suaves en botones, tarjetas, filas y menús para que la interacción se sienta fluida y premium.
- **Optimización de Clics**: Diseñar las pantallas para que las acciones comunes (buscar un producto, cambiar de pestaña, facturar o transferir fondos) se realicen en la menor cantidad de pasos posible.

## 2. Rigurosidad Técnica y Calidad
- **Sin Datos de Relleno**: No utilizar placeholders temporales en la UI. Si se requiere demostrar una característica, se deben poblar datos realistas que tengan sentido para una distribuidora de alimentos y bebidas.
- **Alineación Proactiva**: Ante dudas técnicas, de flujo o de interfaz, detenerse a documentar las opciones y preguntas en el `implementation_plan.md` para validación antes de realizar modificaciones profundas.
- **Compilación Robusta**: Asegurar la compilación impecable de TypeScript en frontend y backend antes de declarar un hito como completo.

## 3. Seguridad del Código y Git
- **Commits Incrementales**: Hacer commits con mensajes claros y descriptivos al finalizar cada tarea exitosa antes de pasar a la siguiente.
- **Copias de Seguridad (Backups)**: Antes de realizar operaciones de riesgo con expresiones regulares, scripts automatizados o reemplazos masivos, hacer una copia de seguridad del archivo (ej. `.bak`) en la carpeta del proyecto.
- **Verificación de Reversiones**: Nunca utilizar `git checkout` o `git restore` sobre código de trabajo sin antes revisar el estado del repositorio (`git status`) para evitar la pérdida accidental de cambios no confirmados.

## 4. Base de Datos y Migraciones (Prisma / PostgreSQL)
- **Inmutabilidad de Migraciones**: Los archivos de migración generados en `prisma/migrations/` son SAGRADOS. Jamás se debe editar un archivo de migración que ya haya sido aplicado a la base de datos. Cualquier cambio posterior en el esquema debe generar una nueva migración.
- **Flujo Seguro con Objetos Nativos (`--create-only`)**: Debido a que Prisma elimina por defecto objetos SQL nativos que no maneja (como la secuencia `movement_seq`), toda migración nueva debe generarse SIEMPRE usando `npx prisma migrate dev --name <nombre> --create-only`. Luego, se debe limpiar el archivo SQL generado eliminando los `DROP SEQUENCE` antes de aplicarlo con `npx prisma migrate deploy`.
- **Migraciones como Única Fuente de Verdad**: Todo cambio estructural en la base de datos debe realizarse a través de migraciones de Prisma, nunca alterando la base de datos de producción o test de forma directa o manual.
- **Mapeo de Objetos SQL Nativos**: Si se requieren objetos nativos de PostgreSQL (como la secuencia `movement_seq`), deben declararse al principio del archivo SQL de la migración utilizando cláusulas seguras (`CREATE SEQUENCE IF NOT EXISTS`).
- **Despliegues en Nuevos Entornos / Producción**: Utilizar siempre `npx prisma migrate deploy` para aplicar las migraciones de forma silenciosa y automática en servidores de test, staging o producción.
- **Evitar Colisiones en Seeds**: En los scripts de semilla (seed), evitar definir manualmente valores para campos autogenerados o secuenciales (como `movementId`), dejando que la base de datos se encargue de ello de manera automática.

## 5. Comandos Rápidos y Automatización
- **Comando "abri" / "abrir" / "abre todo"**: Cuando el usuario indique una palabra clave de inicio (como "abri", "abrir", "abre", "abre todo", "iniciar local"), el asistente debe de inmediato y sin necesidad de planes o aprobaciones complejas:
  1. Ejecutar `ipconfig` en la terminal para obtener la dirección IPv4 local activa.
  2. Iniciar el entorno de desarrollo local ejecutando `npm run dev` en la raíz del proyecto como tarea en segundo plano.
  3. Mostrar un resumen claro con el estado de los servidores, la IP local / enlace de acceso directo para el celular (ej. `http://<IP>:5173`) y el recordatorio de las credenciales de prueba disponibles para vendedores y administración.
