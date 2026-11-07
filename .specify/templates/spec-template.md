# Especificación Funcional: [NOMBRE DE LA FUNCIONALIDAD / CAMBIO]

- **ID / Rama de Funcionalidad**: `[NNN-nombre-corto]`
- **Módulo Afectado (`specs/modules/`)**: `[wms-deposito | facturacion-afip | crm-whatsapp | clientes-rutas | otro]`
- **Fecha**: `[YYYY-MM-DD]`
- **Estado**: `[Borrador | En Revisión | Aprobado | Implementado]`

---

## 1. Contexto y Problema a Resolver (*El Qué y el Porqué*)
> Describir brevemente qué necesidad operativa de la distribuidora resuelve esta funcionalidad (ej. preventistas en ruta, operadores de depósito, cajeros o administración).

---

## 2. Escenarios de Usuario y Flujos Operativos

### Historia de Usuario Principal (P1 - Crítica)
- **Como**: `[Rol: ADMIN | VENTAS | DEPOSITO]`
- **Quiero**: `[Acción concreta en el sistema]`
- **Para**: `[Beneficio operativo medible]`

#### Escenarios de Aceptación (Dado / Cuando / Entonces):
1. **Dado** `[estado inicial]`, **Cuando** `[acción del usuario]`, **Entonces** `[resultado esperado]`.
2. **Dado** `[condición de borde o error]`, **Cuando** `[acción]`, **Entonces** `[respuesta controlada del sistema]`.

---

## 3. Reglas de Negocio e Invariantes
- **RN-01**: `[Detalle de regla de negocio, cálculo de precios/listas A-B-C, imputación FIFO, o movimiento de stock]`
- **RN-02**: `[Restricciones de permisos según rol JWT]`
- **RN-03**: `[Impacto en documentos maestros o secuencias como movement_seq]`

---

## 4. Casos de Borde (Edge Cases)
- ¿Qué ocurre si el usuario pierde conexión WiFi local o reintenta la petición (idempotencia)?
- ¿Qué ocurre si el stock es insuficiente o el cliente supera su límite de cuenta corriente?

---

## 5. Criterios de Éxito y Verificación Funcional
- [ ] Cumple estética minimalista Stripe/Linear/Notion (rojo `#E30613` solo en alertas/CTAs críticos).
- [ ] Optimización de clics verificada para el rol operativo.
- [ ] Sin datos de relleno (placeholders) en la interfaz.
