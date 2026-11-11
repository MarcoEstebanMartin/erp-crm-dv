# Arquitectura Global del Sistema (ERP-CRM DV)

Este documento define la arquitectura técnica general, topología de servicios, protocolos de comunicación y estándares de integración del sistema **ERP-CRM Distribuidora Victoria**.

---

## 1. Topología y Mapa de Servicios

El sistema opera bajo un esquema Full-Stack TypeScript desacoplado, diseñado para alta velocidad local y conectividad externa controlada:

```text
[ Dispositivos Móviles / Preventistas / Depósito / Mostrador ]
                     │ (HTTPS Mismo Origen / PWA)
                     ▼
       ┌────────────────────────────────────────┐  HTTPS Directo 24/7
       │  Servicio Unificado en Railway         │ ◄────────────── [ WhatsApp Cloud API / Webhook ]
       │  (Express API + React 19 SPA Estático) │
       └───────────────────┬────────────────────┘
                           │ (Prisma ORM / TLS)
                           ▼
       ┌────────────────────────────────────────┐
       │  Supabase PostgreSQL 16 (sa-east-1)    │
       └────────────────────────────────────────┘
```

### Puertos y Entornos
- **Producción (Railway)**: Servicio unificado en puerto `3000` detrás del proxy HTTPS de Railway (`TRUST_PROXY=1`), sirviendo la SPA compilada (`frontend/dist`), `/uploads` con caché autocurada desde SQL y `/api/*` bajo un único origen (cookies `HttpOnly` `SameSite=Lax` nativas).
- **Desarrollo Local (`npm run dev`)**: Vite en puerto `5174` con proxy local hacia Express en puerto `3001`.
- **Base de Datos**: PostgreSQL 16 gestionado en Supabase (`sa-east-1`).

---

## 2. Convenciones de la API REST

Para evitar discrepancias entre frontend y backend, todas las respuestas HTTP deben seguir una estructura predecible.

### 2.1. Envelope Estándar de Respuesta (JSON)

#### Respuesta Exitosa (200 OK / 201 Created):
```json
{
  "success": true,
  "data": { ... },
  "message": "Operación realizada con éxito" // Opcional
}
```

#### Respuesta de Error (4xx / 5xx):
```json
{
  "success": false,
  "error": "Mensaje legible para el usuario o log",
  "details": [ ... ] // Opcional: lista de errores de validación
}
```

### 2.2. Códigos de Estado HTTP
- `200 OK`: Petición GET, PUT o PATCH exitosa.
- `201 Created`: Recurso creado exitosamente (POST).
- `400 Bad Request`: Error de validación en los datos enviados (gestionado por validators).
- `401 Unauthorized`: Token JWT inexistente o inválido.
- `403 Forbidden`: Usuario sin rol o permisos suficientes para la acción.
- `404 Not Found`: Recurso no encontrado en base de datos.
- `500 Internal Server Error`: Excepción no controlada (debe loguearse en el servidor).

---

## 3. Seguridad y Autenticación

- **Mecanismo**: JSON Web Tokens (JWT) firmados con secreto del entorno (`JWT_SECRET`).
- **Cabecera**: `Authorization: Bearer <token>` en todas las peticiones protegidas.
- **Roles del Sistema**:
  - `ADMIN`: Acceso irrestricto a finanzas, facturación, auditoría, maestros y configuración.
  - `VENTAS`: Preventa, catálogo de productos, registro de pedidos y clientes de su ruta.
  - `DEPOSITO`: Gestión de stock, WMS, armado de pedidos, transferencias entre cámaras y ajustes.
- **Contraseñas**: Hasheadas mediante `bcryptjs` (salt rounds >= 10).

---

## 4. Conectividad en Red Local y Móvil

1. **Binding en 0.0.0.0**: Tanto Vite como Express deben arrancar en `0.0.0.0` para permitir que celulares o tablets conectados al WiFi de la distribuidora operen el sistema.
2. **CORS y Cookies `HttpOnly` de Mismo Origen**: En producción (Railway), Frontend y Backend comparten el mismo dominio HTTPS (`CORS_ORIGIN` explícito). En desarrollo local se permite `localhost` e IP LAN WiFi.
3. **PWA / Responsive**: Las vistas operativas (Preventa y Depósito) deben estar preparadas para interacción táctil rápida en pantallas móviles.
