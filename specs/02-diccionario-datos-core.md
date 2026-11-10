# Spec 02: Diccionario de Datos Core (Esquema `erp` + Esquema `public` de `CHATBOT-DV`)

Este documento define:
1. La estructura exacta relevada del esquema **`public`** ya existente en producción en Supabase (`CHATBOT-DV`).
2. Las tablas fundacionales del nuevo esquema contable **`erp`**, diseñadas para convivir sin colisiones en la misma base de datos.

---

## 1. Esquema `public` Existente en Producción (`CHATBOT-DV` — NO MODIFICAR ESTRUCTURA)

Estas tablas ya están activas en Supabase y alimentan la Tienda Online, el Bot de WhatsApp y el CRM en Render:

### 1.1. `public.products` (Fuente viva actual de productos, precios y fotos)
| Columna | Tipo PostgreSQL | Nullable | Notas de Integración con `erp` |
| :--- | :--- | :--- | :--- |
| `sku` | `character varying` | `NO` | **Clave Primaria / Vínculo Único** con `erp.products.sku`. |
| `name` | `character varying` | `NO` | Nombre comercial del producto. |
| `price` | `numeric` | `YES` | Precio unitario de venta (Lista base). |
| `price_formatted` | `character varying` | `YES` | Precio formateado para exhibición web/bot. |
| `old_price` | `numeric` | `YES` | Precio anterior (para mostrar tachado/oferta). |
| `box_price` | `numeric` | `YES` | Precio por caja/bulto cerrado. |
| `cost_price` | `numeric` | `YES` | Costo actual del producto. |
| `stock` | `integer` | `YES` | Stock disponible sincronizado desde `erp.stock_ledger`. |
| `min_qty` | `character varying` | `YES` | Cantidad mínima de compra. |
| `variedades` | `text` | `YES` | Sabores o variedades disponibles. |
| `category` | `character varying` | `YES` | Categoría general. |
| `rubro` | `character varying` | `YES` | Rubro principal. |
| `subrubro` | `character varying` | `YES` | Subrubro. |
| `photo_file` | `character varying` | `YES` | Nombre/ruta del archivo de imagen actualizado. |
| `has_photo` | `integer` | `YES` | Indicador `1 / 0` de foto disponible. |
| `photo_updated_manually` | `integer` | `YES` | Flag de actualización manual de foto. |
| `active` | `integer` | `YES` | Indicador `1 / 0` de producto activo en tienda. |
| `barcode` | `character varying` | `YES` | Código de barras EAN. |
| `badge` | `character varying` | `YES` | Etiqueta comercial (ej. Oferta, Nuevo). |
| `created_at` / `updated_at` | `timestamptz` | `YES` | Marcas de tiempo. |

### 1.2. `public.orders` y `public.order_items` (Pedidos entrantes de Tienda y Bot)
- **`public.orders`**: `id` (`text`, PK), `customer_phone` (`text`), `customer_name` (`text`), `delivery_address` (`text`), `delivery_method` (`text`), `notes` (`text`), `subtotal` (`real`), `discount` (`real`), `total_amount` (`real`), `status` (`text`), `source` (`text`), `created_at` (`timestamp`), `updated_at` (`timestamp`).
- **`public.order_items`**: `id` (`integer`, PK), `order_id` (`text`), `sku` (`text`), `product_name` (`text`), `unit_price` (`real`), `quantity` (`integer`), `subtotal` (`real`).
- **`public.order_status_history`**: `id` (`integer`), `order_id` (`text`), `from_status` (`text`), `to_status` (`text`), `changed_by` (`text`), `notes` (`text`), `changed_at` (`timestamp`).

### 1.3. `public.customers` (Contactos comerciales de WhatsApp / Web)
- `phone` (`varchar`, PK), `name` (`varchar`), `business_name` (`text`), `customer_type` (`text`), `address` (`text`), `status` (`varchar`), `notes` (`text`), `total_orders` (`integer`), `total_spent` (`real`), `last_message_at` (`timestamptz`), `created_at` (`timestamptz`), `updated_at` (`timestamp`).

### 1.4. Otras tablas de `public` (Uso interno del Bot/CRM)
- `public.chat_messages`, `public.whatsapp_conversations`, `public.whatsapp_messages`, `public.price_history`, `public.unmatched_queries`, `public.metadata`.

---

## 2. Mapa de Entidades del Nuevo Esquema Contable (`erp`)

### Módulo 1: Catálogo y Precios (`erp`)
| Tabla | Clave Primaria | Propósito y Vínculo con `public` |
| :--- | :--- | :--- |
| **`erp.categories`** | `id` (Serial) | Rubros y subrubros normalizados. |
| **`erp.products`** | `id` (Serial) / `sku` (Unique) | Maestro contable de productos. Incluye `cost_price`, `margin_a`, `price_a` (espejo de `public.products.price`), `price_b` (espejo de `box_price`), `price_c` (`NUMERIC(14,2)` enteros), `is_weighable` (Boolean), `approx_weight_kg` (`NUMERIC(12,3)`), `units_per_box`, `iva_rate` (`21.00`, `10.50`, `0.00`), `photo_file`. Se sincroniza automáticamente con `public.products` por `sku`. |
| **`erp.price_history`** | `id` (Serial) | Auditoría histórica de cambios de costos, márgenes y precios de lista con usuario responsable. |

### Módulo 2: Inventario e Inmutabilidad de Stock (`erp`)
| Tabla | Clave Primaria | Propósito |
| :--- | :--- | :--- |
| **`erp.stock_ledger`** | `id` (BigSerial) | Libro mayor inmutable de movimientos de stock (`movement_number` secuencial, `product_id`, `type` [`IN`, `OUT`, `ADJUSTMENT`], `quantity`, `weight_kg`, `balance_after`, **`lot_id` (`INT NULL`)**, **`expiration_date` (`DATE NULL`)**, `reference_type`, `reference_id`, `user_id`, `notes`, `created_at`). Los campos de lote y vencimiento nacen opcionales (`NULL`) e invisibles hoy en la operatoria diaria, listos para activar **FEFO automático** en el futuro sin migrar tablas. |
| **`erp.product_lots`** | `id` (Serial) | Tabla preparada para control futuro de lotes y fechas de vencimiento (`product_id`, `lot_code`, `expiration_date`, `remaining_qty`, `created_at`) bajo criterio **FEFO (*First Expired, First Out*)**. |

### Módulo 3: Clientes, Proveedores, Pedidos y Facturación (`erp`)
| Tabla | Clave Primaria | Propósito |
| :--- | :--- | :--- |
| **`erp.stakeholders`** | `id` (Serial) | Clientes y Proveedores fiscales (`cuit`, `tax_condition`, `business_name`, `trade_name`, `phone` vinculado opcionalmente a `public.customers.phone`, `address`, `city`, `sale_route_id`, `price_list` [`A`, `B`, `C`], `default_discount_pct`, `credit_limit`, `iibb_perception_pct`). |
| **`erp.sale_routes`** | `id` (Serial) | Rutas de preventa y reparto (importables desde `reference/Maestro1.xlsx`). |
| **`erp.orders`** | `id` (Serial) | Pedidos de venta (`order_number`, `stakeholder_id`, `seller_id`, `source` [`ERP`, `WEB_STORE`, `WHATSAPP_BOT`], `external_order_id` apuntando a `public.orders.id`, `status` [`DRAFT_WEB`, `PENDING`, `WEIGHING`, `PREPARED`, `INVOICED`, `DELIVERED`, `CANCELLED`], `billing_type` [`INTERNAL`, `OFFICIAL`], `subtotal_amount`, `discount_amount`, `tax_amount`, `total_amount`). |
| **`erp.order_items`** | `id` (Serial) | Renglones de pedido con **Snapshots Históricos Obligatorios**: `product_id`, `sku_snapshot`, `name_snapshot`, `ordered_qty`, `is_weighable`, `actual_weight_kg` (`NUMERIC(12,3)`), `unit_cost_snapshot`, `list_price_snapshot`, `discount_pct`, `net_unit_price`, `line_subtotal`, `line_cost_total`, `line_profit`. |
| **`erp.invoices`** | `id` (Serial) | Comprobantes emitidos (Facturas A/B/C, Notas de Crédito por devolución con destino `STOCK_SANO` vs `MERMA`, Presupuestos/Remitos Internos) con datos de CAE AFIP y desglose fiscal. |
| **`erp.delivery_trips`** | `id` (Serial) | Hojas de Ruta / Repartos por camión o chofer (`trip_number`, `driver_id` rol `REPARTIDOR`, `status` [`LOADING`, `IN_TRANSIT`, `RENDITION_PENDING`, `CLOSED`], consolidado de bultos y rendición ciega de cobros). |

### Módulo 4: Cuentas Corrientes, Tesorería y Auditoría (`erp`)
| Tabla | Clave Primaria | Propósito |
| :--- | :--- | :--- |
| **`erp.account_ledger`** | `id` (BigSerial) | Libro mayor inmutable de Cuenta Corriente de Clientes y Proveedores (`stakeholder_id`, `entry_type` [`DEBIT`, `CREDIT`], `document_type` [`INVOICE`, `CREDIT_NOTE`, `RECEIPT`, `PAYMENT_ORDER`, `INITIAL_BALANCE`], `document_id`, `billing_type` [`INTERNAL`, `OFFICIAL`], `amount` `NUMERIC(14,2)`, `running_balance` `NUMERIC(14,2)`, `created_at`). |
| **`erp.receipts`** | `id` (Serial) | Recibos de cobro a clientes y Órdenes de Pago a proveedores (`receipt_number`, `stakeholder_id`, `total_amount`, `notes`, `user_id`). |
| **`erp.treasury_accounts`** | `id` (Serial) | Cajas físicas de efectivo y Cuentas Bancarias (con soporte de **Arqueo Ciego** declarando efectivo contado antes de comparar con saldo teórico). |
| **`erp.treasury_movements`** | `id` (BigSerial) | Libro mayor de ingresos/egresos de dinero en Cajas y Bancos (vinculado a recibos, gastos o transferencias entre cuentas). |
| **`erp.checks`** | `id` (Serial) | Cartera de cheques de terceros y propios (`check_number`, `bank_name`, `amount`, `issue_date`, `due_date`, `status` [`IN_PORTFOLIO`, `DEPOSITED`, `ENDORSED`, `REJECTED`]). |
| **`erp.audit_logs`** | `id` (BigSerial) | **Caja Negra del Sistema**: registro inmutable de qué usuario, fecha/hora, acción (`PRICE_CHANGE`, `STOCK_ADJUST`, `VOID_INVOICE`, `BLIND_CASH_CLOSE`), entidad y JSON `before / after` se ejecutó. |
