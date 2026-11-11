# Guía de Migración AFIP / ARCA a Producción - ERP-CRM DV

Esta guía detalla los pasos requeridos para activar la facturación electrónica oficial en entorno de producción utilizando los certificados digitales de la empresa.

---

## 1. Requisitos Previos en la Web de AFIP (Clave Fiscal)

1. **Obtener Certificado Digital (`.crt`) y Clave Privada (`.key`):**
   - Ingressar a AFIP con Clave Fiscal Nivel 3 o superior.
   - Ir al servicio **Administración de Certificados Digitales**.
   - Generar un nuevo certificado para el servicio `wsfe` (Facturación Electrónica).
   - Descargar el archivo `.crt` obtenido y renombrarlo a `produccion.crt`.
   - Guardar la clave privada generada como `produccion.key`.

2. **Delegar Servicio de Facturación Electrónica:**
   - Ir al servicio **Administrador de Relaciones de Clave Fiscal**.
   - Buscar la empresa y presionar **Nueva Relación**.
   - Seleccionar **AFIP -> WebServices -> Facturación Electrónica**.
   - Asignar el computador fiscal con el certificado creado.

3. **Habilitar Punto de Venta Electrónico:**
   - Ir al servicio **Regímenes de Facturación y Registración (REAPI) / ABM Puntos de Venta**.
   - Agregar un nuevo Punto de Venta (ejemplo: `Punto de Venta 00001` o `00002`).
   - Seleccionar tipo: **Factura Electrónica - Web Services (WSFE)**.

---

## 2. Configuración en el Servidor ERP (backend/.env)

En el archivo `backend/.env` del servidor de producción, configurar las siguientes variables de entorno:

```env
# Configuración AFIP Producción
AFIP_PRODUCTION=true
AFIP_CUIT=20409378472 # CUIT oficial de la distribuidora (sin guiones)
AFIP_CERT_PATH=./certs/produccion.crt
AFIP_KEY_PATH=./certs/produccion.key
```

Ubicación física de los certificados:
Colocar los archivos en el servidor en la ruta:
`backend/certs/produccion.crt`
`backend/certs/produccion.key`

---

## 3. Verificación de Funcionamiento

Ejecutar la suite de pruebas unitarias para confirmar que las fórmulas y modelos impositivos están activos:

```bash
cd backend
npm test
```

Al iniciar el backend (`npm run dev` o `pm2 start dist/index.js`), el sistema mostrará el siguiente log de confirmación:

```text
🔒 AFIP SDK Inicializado en modo PRODUCCIÓN.
```

---

## 4. Preguntas Frecuentes y Contingencia

* **¿Qué sucede si AFIP se cae o no responde?**
  El ERP maneja las facturas oficiales de forma aislada. Si AFIP no responde, el pedido queda resguardado en el sistema con sus importes exactos para reenviar la solicitud de CAE una vez restablecido el servicio de AFIP.
* **¿Cuándo vencen los certificados?**
  Los certificados de AFIP vencen a los 2 años. AFIP enviará avisos al Domicilio Fiscal Electrónico antes del vencimiento para su renovación.
