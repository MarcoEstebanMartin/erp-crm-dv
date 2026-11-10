# Spec Funcional: 001 - Catálogo Maestro y Motor de Precios (Lista 4, Especial 1 y Especial 2)

> **Fase Spec-Kit**: `1. Specify (Qué y Por Qué)`
> **Estado**: `VALIDADO POR USUARIO (Auditoría Real Maestro1.xlsx + OFERTAS APP)`

---

## 1. Objetivo de Negocio (¿Para qué sirve este módulo en la distribuidora?)
El módulo **001 - Catálogo y Precios** es la fuente maestra y exacta de los **329+ productos** de **Distribuidora Don Venancio**. Unifica en una estructura contable sin fisuras:
1. Los precios vigentes en vivo de **`OFERTAS APP / CHATBOT-DV`** (`catalog.db` / `public.products`).
2. Los datos logísticos, fiscales y de proveedores de [`Maestro1.xlsx`](file:///c:/Users/Trisky/OneDrive/Escritorio/ERP/Maestro1.xlsx):
   - **Proveedor (`supplier_name`)**: ej. `REMOTTI`, `CREMIGAL`, `R.P.B`, `SODECAR`.
   - **Rubro, Subrubro, Categoría Comercial y Tipo de Queso (`cheese_type`)**: ej. `SEMIBLANDO`, `BLANDO`, `SEMIDURO`, `DURO`.
   - **Zona de Armado en Depósito (`storage_zone`)**: `FRIO` (Cámara Frigorífica) vs `SECO` (Galpón General).
   - **Unidades por Caja (`units_per_box`)** y **Mínimo de Venta (`min_sale_qty`)**.
   - **Condición de Pesable (`is_weighable`)** y **Peso Aproximado por Pieza/Horma (`approx_weight_kg`)**.
   - **Alícuota de IVA (`iva_rate`)**: `21%`, `10.5%` o `0%`.

Además, corrige de raíz las diferencias matemáticas detectadas en el Excel histórico y calcula con `Decimal.js` las **3 Listas Oficiales de Don Venancio en Pesos Enteros (0 centavos)**:
- **`Lista 4` (`price_list_4` — Precio Base Oficial)**: Precio mayorista oficial de lista (sincronizado con `public.products.price` de la Tienda/Bot).
- **`Lista Especial 1` (`price_special_1` — Código Lista `1`)**: Lista bonificada nivel 1 (ej. `-3%` en línea `MELINCUÉ` o margen especial configurado, redondeado al peso entero).
- **`Lista Especial 2` (`price_special_2` — Código Lista `2`)**: Lista bonificada nivel 2 (ej. `-5%` en línea `MELINCUÉ` o margen especial configurado, redondeado al peso entero).
- **Precio Caja Cerrada (`box_price` opcional)**: Para cuando un cliente de `Lista 4` lleva la cantidad mínima de bulto cerrado (`>= units_per_box`) en artículos con precio promocional por caja.

---

## 2. Escenarios de Uso Reales (Historias de Usuario)

### Escenario 1: Importación Inicial Unificada y Saneamiento Matemático (`OFERTAS APP` + `Maestro1.xlsx`)
- **Cuando**: Se inicializa el catálogo de `ERP-DV`.
- **El sistema debe**:
  1. Cruzar por `sku` los productos de `OFERTAS APP` (tomando el precio de venta vigente real y la foto `photo_file`) con las columnas operativas de [`Maestro1.xlsx`](file:///c:/Users/Trisky/OneDrive/Escritorio/ERP/Maestro1.xlsx) (`PROVEEDOR`, `ZONA ARMADO`, `PESABLE`, `PESO APROXIMADO`, `UNIDADES POR CAJA`, `ALICUOTA`, `COD.BARRAS`, `COSTO`).
  2. Redondear cualquier precio con centavos residuales (como el SKU `0100` que figuraba a `$6.169,98`) al peso entero más cercano (`$6.170`).
  3. **Saneamiento de Rentabilidad**: En lugar de usar el `%` desfasado del Excel que cambiaría los precios actuales, el motor toma el `price_list_4` vigente y el `cost_price` y calcula el **Porcentaje de Margen Real Exacto**:
     $$\text{MargenReal\%} = \text{round\_2dec}\left(\left(\frac{\text{PrecioLista4}}{\text{Costo}} - 1\right) \times 100\right)$$
  4. Calcular automáticamente `price_special_1` (`-3%` entero en subrubro `MELINCUE`, o igual a `Lista 4` en el resto salvo configuración distinta) y `price_special_2` (`-5%` entero en subrubro `MELINCUE`).

### Escenario 2: Búsqueda Instantánea Fonética (`F2`) y Operación 100% con Teclado
- **Cuando**: El operador presiona `F2` y escribe rápido (ej. `"melincue tibo"`, `"bagio chocolatada"`, `"cremoso 0003"` o `"remotti frio"`).
- **El sistema debe**:
  1. Filtrar instantáneamente por `SKU + Nombre + Proveedor + Rubro + Subrubro` usando [`search.ts`](file:///c:/Users/Trisky/OneDrive/Escritorio/ERP/backend/src/core/search.ts) (ignorando tildes y unificando `b/v`, `s/z/ce/ci`, dobles letras y palabras en cualquier orden).
  2. Permitir filtrar rápido por pestañas o selectores de **Proveedor** (`REMOTTI`, `CREMIGAL`, `R.P.B`, `SODECAR`), **Zona (`FRIO` / `SECO`)** o **Rubro**.
  3. Navegar filas con `↑/↓`, abrir edición con `Enter` y cerrar/cancelar con `Esc`.

### Escenario 3: Actualización de Costo de Proveedor (con Mini-Calculadora) y Recálculo Exacto
- **Cuando**: Llega una factura o lista nueva de un proveedor y el administrador actualiza el `cost_price` de un producto o cambia su `%` de margen.
- **El sistema debe**:
  1. Ofrecer una **Mini-Calculadora Auxiliar en Pantalla** (*Precio Factura Proveedor - % Descuento/Bonificación + % IVA = Costo Final Neto*).
  2. Recalcular en vivo con `Decimal.js`:
     - `price_list_4 = roundToIntegerPeso(cost_price * (1 + margin_list_4 / 100))`
     - `price_special_1` y `price_special_2` en pesos enteros según su variación porcentual o margen propio.
  3. Permitir también **Fijar Precio Entero Manual**: si el dueño escribe que `price_list_4` es `$11.500`, el sistema respeta `$11.500` exactos y recalcula `margin_list_4` a 2 decimales para que la cuenta cierre siempre al 100%.
  4. Guardar un registro inmutable en `erp.price_history` y en la Caja Negra `erp.audit_logs`.

### Escenario 4: Aumento Masivo por Proveedor o Rubro con Vista Previa (Antes vs. Después)
- **Cuando**: Un proveedor (ej. `CREMIGAL` o `REMOTTI`) avisa que toda su línea aumentó un porcentaje (ej. `+6%`).
- **El sistema debe**:
  1. Permitir seleccionar el **Proveedor** o **Rubro/Subrubro** y tipear el `%` de aumento de costo.
  2. Mostrar en pantalla la **Tabla Comparativa Antes vs. Después** (Costo Anterior $\rightarrow$ Costo Nuevo | Lista 4 Anterior $\rightarrow$ Lista 4 Nueva | Especial 1 y 2 Nuevas).
  3. Al confirmar, actualizar todos los productos en una única transacción ACID (`prisma.$transaction`) y registrar el historial auditable.

### Escenario 5: Sincronización Controlada con `OFERTAS APP / CHATBOT-DV` y Respaldo Excel
- **Cuando**: Se confirman nuevos precios en el ERP o el dueño pide descargar respaldo.
- **El sistema debe**:
  1. Sincronizar `price_list_4` $\rightarrow$ `public.products.price` (y `price_formatted`) en `OFERTAS APP` por `sku`.
  2. Permitir en 1 clic **"Exportar Catálogo y Listas a Excel/CSV"** para resguardo local inmediato en la PC.

### Escenario 6: Joyas Operativas y Visuales Rescatadas (`Inline Edit`, `Lista Imprimible`, `Ctrl+Q`, `Alta/Baja Lógica` y `Lightbox`)
- **Cuando**: El administrador u operador trabaja diariamente sobre el catálogo.
- **El sistema debe**:
  1. **Edición Rápida con 1 Clic en Celda (`Inline Edit` con Costo Sagrado)**: Al hacer clic directo sobre el `Costo Neto`, `% Margen` o `Lista 4 Oficial` en la fila y presionar `Enter`:
     - Si cambia `Costo Neto` o `% Margen` $\rightarrow$ recalcula las 3 listas en pesos enteros.
     - Si cambia `Lista 4 Oficial` $\rightarrow$ fija ese precio entero y recalcula el `% Margen`, **sin modificar jamás el `Costo Neto` del proveedor**.
  2. **Impresor de Lista de Precios Oficial (`Lista 4`)**: Generar la vista imprimible/PDF agrupada por las secciones clásicas de Don Venancio (`1 - REMOTTI`, `1.1 - LECHES`, `1.2 - SANCOR y CREMIGAL`, `1.4 - SODECAR`, `2.7 - BEBIDAS / Bodegas`) mostrando exclusivamente la **`Lista 4 Oficial (Precio Final)`**.
  3. **Consultor Rápido Flotante (`Ctrl + Q`)**: Disponible desde cualquier pantalla del ERP para consultar precios en 1 segundo con búsqueda fonética.
  4. **Alta de `+ Nuevo Producto` y Filtro `Todos / Activos / Inactivos` con botón `Desactivar / Reactivar`**.
  5. **Globito con Emoji de Categoría (`🧀`, `🥓`, `❄️`, `🥤`, `🍷`, `🍝`) sobre la miniatura + Visor de Foto Ampliada (`Lightbox`)** al hacer clic en la imagen.

---

## 3. Reglas de Negocio e Invariantes del Módulo
1. **Cero Centavos en Listas de Venta**: `price_list_4`, `price_special_1`, `price_special_2` y `box_price` son siempre números enteros en pesos (`Decimal.ROUND_HALF_UP`, 0 decimales).
2. **Exactitud Bidireccional Costo $\leftrightarrow$ Margen $\leftrightarrow$ Precio**: Nunca puede quedar grabado un porcentaje de margen que contradiga la relación matemática entre `cost_price` y `price_list_4`.
3. **Prohibición de Borrado Físico (`Soft Delete`)**: Ningún producto se elimina con `DELETE`; se marca `active = false`.
4. **Permisos por Rol**: Solo `ADMIN` ve costos, márgenes y edita precios. `FACTURACION` y `VENDEDOR` consultan precios de lista y stock. `DEPOSITO` y `REPARTIDOR` ven datos logísticos (`storage_zone`, `units_per_box`, `is_weighable`).

---

## 4. Criterios de Aceptación (Checklist del Dueño)
- [ ] Todos los productos reales de `OFERTAS APP` y `Maestro1.xlsx` se unifican por `sku` con sus costos y márgenes corregidos al centavo.
- [ ] Las 3 listas reales (`Lista 4`, `Lista Especial 1`, `Lista Especial 2`) dan siempre pesos enteros sin centavos.
- [ ] Puedo filtrar y aumentar precios masivamente por **Proveedor** (`REMOTTI`, `CREMIGAL`, etc.) o por **Rubro** viendo antes la vista previa.
- [ ] Cada producto indica su **Zona de Armado (`FRIO` / `SECO`)**, si es **Pesable (`SI` / `NO`)** y su **Peso Aproximado en kg**.
- [ ] El buscador fonético (`F2`) encuentra cualquier producto con o sin tildes y confundiendo `b/v` o `s/z/c`.
