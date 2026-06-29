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

