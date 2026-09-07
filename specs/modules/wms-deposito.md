# Especificación de Módulo: WMS y Depósito (Gestión Espacial y Stock)

Este documento detalla los requerimientos, contratos de datos, modelo espacial y flujos de trabajo para el módulo de Depósito (Warehouse Management System).

---

## 1. Modelo Espacial y Jerarquía de Almacenamiento

El depósito de la distribuidora está modelado espacialmente para permitir tanto visualización en grilla 2D como gestión de estanterías multinivel:

```text
Depósito Central
└── Cámara / Zona (ej. Cámara Lácteos, Cámara Congelados, Secos Arcor)
    └── Pasillo / Sector (ej. Pasillo A, Pasillo B)
        └── Rack / Módulo (ej. Rack 01, Rack 02)
            └── Nivel / Posición (ej. Nivel 1 - Piso, Nivel 2 - Altura)
                └── Slot / Coordenada Única (ej. "CAM-A-01-2")
```

### 1.1. Atributos de Posición / Slot:
- `code`: Identificador legible único del slot (ej. `A-01-1`).
- `chamber`: Identificador o nombre de la cámara frigorífica o sector térmico.
- `row`, `column`, `level`: Coordenadas de la grilla visual.
- `status`: Estado de la posición (`VACIA`, `OCUPADA`, `RESERVADA`, `BLOQUEADA`).
- `productId`: Producto almacenado (opcional si está vacía).
- `quantity`: Cantidad de bultos/unidades presentes en el slot.
- `lotNumber`: Número de lote para trazabilidad.
- `expirationDate`: Fecha de caducidad para rotación de producto.

---

## 2. Tipos de Movimientos de Stock

Toda alteración de inventario debe registrarse con trazabilidad completa mediante el servicio de movimientos:

| Tipo | Origen | Destino | Efecto en Stock | Requiere Comprobante |
| :--- | :--- | :--- | :--- | :--- |
| **INGRESO** | Proveedor / Compra | Slot de Depósito | Incrementa stock global y del slot | Sí (Factura compra / Remito) |
| **AJUSTE_POSITIVO** | Auditoría física | Slot de Depósito | Incrementa stock con motivo de ajuste | Opcional (Auditoría) |
| **AJUSTE_NEGATIVO** | Slot de Depósito | Merma / Rotura | Decrementa stock con motivo justificado | Opcional (Merma) |
| **TRASLADO** | Slot A (Origen) | Slot B (Destino) | Stock global inalterado, actualiza slots | No (Operativo interno) |
| **DESPACHO** | Slot de Depósito | Reparto / Cliente | Decrementa stock por remito/factura | Sí (Remito / Factura Venta) |

---

## 3. Invariantes del Módulo

1. **Atomicidad en Traslados**: Un traslado entre dos slots debe ejecutarse dentro de una transacción (`prisma.$transaction`). No puede ocurrir que el stock salga del slot A sin haber ingresado en el slot B.
2. **Liberación Automática de Slots**: Cuando la cantidad en un slot llega a `0` por despacho o traslado, el slot debe cambiar automáticamente su estado a `VACIA` y limpiar su `productId` y `lotNumber`.
3. **No Stock Negativo**: No se permite que un slot físico contenga cantidades negativas. Si el stock físico no coincide con el sistema, se debe forzar un movimiento de tipo `AJUSTE_NEGATIVO` con motivo documentado.
4. **Política FIFO / FEFO de Despacho**: En el momento del picking, el sistema debe sugerir al operario de depósito retirar primero los lotes con fecha de vencimiento más próxima (FEFO).

---

## 4. Endpoints Principales (REST API)

- `GET /api/deposito/layout`: Retorna la matriz completa de celdas, cámaras y estados para el render del mapa visual.
- `GET /api/deposito/slots/:code`: Información detallada de un slot (producto, stock, lote, movimientos recientes).
- `POST /api/deposito/move`: Ejecuta un traslado interno `{ fromSlot, toSlot, quantity, productId }`.
- `POST /api/deposito/adjust`: Ejecuta un ajuste físico `{ slotCode, productId, newQuantity, reason, type }`.
- `POST /api/deposito/vacate`: Vacia y resetea una posición física `{ slotCode }`.
