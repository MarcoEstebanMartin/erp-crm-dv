# Especificación de Módulo: CRM y WhatsApp Cloud API

Este documento define la arquitectura de mensajería bidireccional, integración con Meta WhatsApp Cloud API en Railway y atención de clientes.

---

## 1. Topología del Canal de Comunicación

```text
[ Cliente de WhatsApp ]
         │ (Mensaje de texto / pedido / comprobante)
         ▼
[ Servidores Meta (Cloud API) ]
         │ (Webhook POST HTTPS directo 24/7)
         ▼
[ Servicio Unificado en Railway (HTTPS) ]
         │
         ▼
[ Backend Express: /api/crm/whatsapp/webhook ]
         │
         ├── 1. Valida firma / token de verificación
         ├── 2. Normaliza número telefónico a formato E.164
         ├── 3. Vincula con cliente en base de datos (Persona)
         └── 4. Persiste mensaje y notifica al CRM en tiempo real
```

---

## 2. Endpoints del Webhook

### 2.1. Verificación Inicial de Meta (GET):
- **URL**: `GET /api/crm/whatsapp/webhook`
- **Parámetros Query**: `hub.mode`, `hub.verify_token`, `hub.challenge`
- **Comportamiento**: Si `hub.verify_token === WHATSAPP_VERIFY_TOKEN`, el servidor debe responder con código `200` y el texto plano del `hub.challenge`.

### 2.2. Recepción de Eventos y Mensajes (POST):
- **URL**: `POST /api/crm/whatsapp/webhook`
- **Tipos de Eventos Recibidos**:
  1. **Mensajes Entrantes**: Texto, imágenes, notas de voz, documentos PDF (comprobantes de pago).
  2. **Estados de Entrega**: `sent` (enviado), `delivered` (entregado en el celular), `read` (leído / doble tilde azul), `failed` (fallo de entrega).

---

## 3. Vinculación con Clientes (`Persona`)

1. **Normalización Telefónica**: Los números argentinos suelen tener prefijos variables (`+54 9 11...`, `15...`, etc.). El sistema normaliza el número eliminando espacios, guiones y el prefijo `15`, asegurando coincidencia con el campo `phone` de la tabla `Persona`.
2. **Contexto Inmediato del Cliente en el Chat**:
   Al abrir una conversación en el panel CRM, el operador debe ver:
   - Razón Social y Nombre de Fantasía.
   - Ruta de reparto asignada y preventista a cargo.
   - Saldo de cuenta corriente actual (deuda viva).
   - Últimos 3 pedidos o comprobantes emitidos.

---

## 4. Envío de Mensajes y Comprobantes

- **Endpoint de Salida**: `POST /api/crm/whatsapp/send`
- **Carga Útil**: `{ to: string, message?: string, mediaUrl?: string, mediaType?: "document" | "image" }`
- **Envío de Facturas / Presupuestos**:
  - El sistema puede enviar automáticamente el PDF del comprobante recién emitido al WhatsApp del cliente con un mensaje de cortesía predeterminado.
- **Límites de Seguridad**: Respetar las políticas de plantillas y ventanas de 24 horas impuestas por Meta para mensajes de iniciación comercial.
