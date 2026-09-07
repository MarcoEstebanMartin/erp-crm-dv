# Especificación de Módulo: Facturación Electrónica (AFIP) y Finanzas

Este documento define las reglas de facturación electrónica, comunicación con AFIP, emisión de comprobantes fiscales/internos y control de tesorería (cajas y bancos).

---

## 1. Integración con AFIP (Web Services)

La facturación electrónica oficial en Argentina se realiza contra la API SOAP de AFIP:

```text
[ Backend ERP ]
      │
      ├─► [ WSAA ] (Autenticación con certs/afip.crt y certs/afip.key)
      │       └── Devuelve: Token + Sign (Ticket de Acceso con validez de 12 horas)
      │
      └─► [ WSFE ] (Facturación con Token y Sign válidos)
              ├── Consulta último comprobante: FECompUltimoAutorizado
              └── Solicitud de CAE: FECAESolicitar ──► Devuelve: CAE + Vencimiento CAE
```

### 1.1. Invariantes de Seguridad y Certificados
- Los certificados digitales residen exclusivamente en `backend/certs/` y **NUNCA** deben comitearse a repositorios públicos.
- **Cache de Ticket de Acceso (TA)**: El backend debe almacenar en memoria o disco el TA mientras sea válido para evitar bloqueos por parte de AFIP por exceso de solicitudes de autenticación.
- **Punto de Venta (PV)**: Cada punto de venta electrónico debe estar previamente dado de alta en AFIP con el servicio correspondiente.

---

## 2. Tipos de Comprobantes

| Código AFIP | Tipo de Comprobante | Emisor | Receptor | Tratamiento de IVA |
| :--- | :--- | :--- | :--- | :--- |
| **001** | Factura A | Resp. Inscripto | Resp. Inscripto | Discrimina IVA (21%, 10.5%, etc.) |
| **006** | Factura B | Resp. Inscripto | Consumidor Final / Monotributo | IVA incluido en el precio |
| **003** | Nota de Crédito A | Resp. Inscripto | Resp. Inscripto | Discrimina IVA (anula parcial o total) |
| **008** | Nota de Crédito B | Resp. Inscripto | Consumidor Final / Monotributo | IVA incluido |
| **X (000)** | Presupuesto / Comprobante X | Cualquier emisor | Cliente interno | **No Fiscal** (Uso interno de reparto) |

### 2.1. Invariante de Numeración Continua
- Los números de factura fiscal son correlativos y estrictamente controlados por AFIP.
- Antes de emitir, el sistema debe consultar `FECompUltimoAutorizado` para asegurar que el número solicitado sea exactamente `último + 1`.
- Si AFIP rechaza una solicitud, la transacción contable queda en estado `ERROR_AFIP` y no debe avanzar a cuenta corriente hasta su resolución.

---

## 3. Emisión de PDF y Código QR Obligatorio

- Todo comprobante electrónico debe permitir generar su representación gráfica en PDF mediante `pdf-lib`.
- **Código QR AFIP**: Todo comprobante A o B debe incluir el código QR reglamentario que codifica en Base64 la URL con los parámetros:
  `{"ver":1,"fecha":"YYYY-MM-DD","cuit":30xxxxxxxx,"ptoVta":X,"tipoCmp":X,"nroCmp":X,"importe":X.XX,"moneda":"PES","ctz":1,"tipoDocRec":X,"nroDocRec":X,"tipoCodAut":"E","codAut":CAE}`.
- El formato de moneda en el PDF debe respetar el estándar argentino: separador de miles con punto y decimales con coma (`$ 1.250,50`).

---

## 4. Tesorería: Cajas y Bancos

- **Caja Chica / Mostrador**: Registra ingresos en efectivo de ventas al contado o cobranzas de repartidores.
- **Cuentas Bancarias**: Registra transferencias bancarias directas (asociadas a un CBU/alias) con su correspondiente número de comprobante o referencia.
- **Conciliación de Cobranza**: Una cobranza puede distribuirse en múltiples medios de pago (ej. 50% Efectivo + 50% Transferencia). La suma de los medios debe coincidir exactamente con el total del recibo.
