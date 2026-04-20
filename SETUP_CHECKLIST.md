# ✅ Checklist de Configuración - Google Calendar Integration

## 📋 Antes de Iniciar

- [ ] Node.js instalado (v14 o superior)
- [ ] Proyecto WhatsApp AI Bot clonado/descargado
- [ ] Redis corriendo en localhost:6379
- [ ] Cuenta de Google activa

---

## 🔧 Paso 1: Configurar Google Cloud

### 1.1 Crear Proyecto en Google Cloud Console

- [ ] Ir a https://console.cloud.google.com/
- [ ] Crear nuevo proyecto llamado "WhatsApp Chatbot"
- [ ] Seleccionar el proyecto

### 1.2 Habilitar Google Calendar API

- [ ] Ir a APIs y Servicios → Biblioteca
- [ ] Buscar "Google Calendar API"
- [ ] Hacer clic en "Habilitar"

### 1.3 Crear Cuenta de Servicio

- [ ] Ir a APIs y Servicios → Credenciales
- [ ] Hacer clic en "+ Crear credenciales" → "Cuenta de servicio"
- [ ] Nombre: `whatsapp-chatbot`
- [ ] Hacer clic en "Crear y continuar"
- [ ] Saltar pasos opcionales → "Crear"

### 1.4 Descargar Clave Privada

- [ ] En la lista de cuentas de servicio, hacer clic en `whatsapp-chatbot`
- [ ] Ir a pestaña "Claves"
- [ ] Hacer clic en "Agregar clave" → "Crear clave nueva"
- [ ] Seleccionar "JSON"
- [ ] Hacer clic en "Crear"
- [ ] Guarda el archivo JSON descargado (contiene credenciales)

---

## 🛠️ Paso 2: Configurar Variables de Entorno

### 2.1 Abrir archivo `.env`

- [ ] Abrir el archivo `.env` en la raíz del proyecto

### 2.2 Copiar datos del JSON

Del archivo JSON descargado, copiar:
- [ ] `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- [ ] `private_key` → `GOOGLE_PRIVATE_KEY` (con `\n` en lugar de saltos reales)

### 2.3 Agregar variables de Google Calendar

```env
# Google Calendar
GOOGLE_SERVICE_ACCOUNT_EMAIL=whatsapp-chatbot@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhk...\n-----END PRIVATE KEY-----"
GOOGLE_CALENDAR_ID=primary
TIMEZONE=America/Mexico_City
```

Reemplazar:
- [ ] `whatsapp-chatbot@tu-proyecto.iam.gserviceaccount.com` con tu email real
- [ ] La clave privada completa (de 3-5 líneas típicamente)
- [ ] `TIMEZONE` con tu zona horaria (opcional, default: America/Mexico_City)

---

## 💾 Paso 3: Instalar Dependencias

- [ ] Abrir terminal en la raíz del proyecto
- [ ] Ejecutar: `npm install`
- [ ] Esperar a que termine

---

## 🧪 Paso 4: Pruebas Básicas

### 4.1 Verificar Configuración

- [ ] Verificar que el archivo `.env` está completo
- [ ] Verificar que Google Calendar API está habilitada
- [ ] Verificar que Redis está corriendo: `redis-cli ping` (debe retornar `PONG`)

### 4.2 Iniciar el servidor

- [ ] En terminal: `npm run dev` (modo desarrollo) o `npm start` (producción)
- [ ] Debe mostrar: `🚀 Server running on port 3000`

### 4.3 Probar Endpoint Basic

- [ ] Abrir Postman o similar
- [ ] GET `http://localhost:3000/`
- [ ] Debe retornar: `WhatsApp AI Bot running ✅`

---

## 📅 Paso 5: Pruebas de Google Calendar

### 5.1 Crear Reservación Manual

- [ ] POST `http://localhost:3000/reservations/book`
- [ ] Body:
```json
{
  "userId": "test-123",
  "clientName": "Test Client",
  "clientPhone": "5551234567",
  "clientEmail": "test@email.com",
  "serviceType": "instalación",
  "dateTime": "2024-01-25T10:00:00",
  "duration": 60,
  "address": "Calle Principal 123",
  "notes": "Test reservation"
}
```
- [ ] Debe retornar con `"success": true` y `eventId`

### 5.2 Verificar Evento en Google Calendar

- [ ] Abrir Google Calendar (calendar.google.com)
- [ ] Verificar que el evento aparece el 25/1/2024 a las 10 AM
- [ ] El evento debe llamarse "Visita Técnica: instalación - Test Client"

### 5.3 Ver Disponibilidad

- [ ] GET `http://localhost:3000/reservations/available?date=2024-01-26&duration=60`
- [ ] Debe retornar lista de slots disponibles

### 5.4 Ver Estadísticas

- [ ] GET `http://localhost:3000/reservations/stats`
- [ ] Debe mostrar total de reservaciones, tipos de servicio, etc.

---

## 🤖 Paso 6: Pruebas del Chatbot

### 6.1 Chat Manual - Sin Reservación

- [ ] POST `http://localhost:3000/chat`
- [ ] Body: `{"userId": "test-456", "message": "¿Cuál es el precio?"}`
- [ ] Debe retornar respuesta normal sin información de reservación

### 6.2 Chat Manual - Con Reservación

- [ ] POST `http://localhost:3000/chat`
- [ ] Body:
```json
{
  "userId": "test-789",
  "message": "Necesito una visita técnica de reparación para mañana a las 2 PM. Soy Pedro López, 5559876543, vivo en Av. Reforma 500"
}
```
- [ ] Debe:
  - [ ] Retornar respuesta del bot
  - [ ] Crear evento en Google Calendar
  - [ ] Incluir confirmación de reservación en la respuesta
  - [ ] Retornar `"reservation": {"success": true}`

### 6.3 Verificar Reservación en Google Calendar

- [ ] Abrir Google Calendar
- [ ] Debe existir nuevo evento para mañana a las 14:00 (2 PM)
- [ ] Evento debe llamarse "Visita Técnica: reparación - Pedro López"

---

## 🎯 Paso 7: Pruebas Avanzadas

- [ ] [ ] Cancelar una reservación: DELETE `/reservations/{eventId}`
- [ ] [ ] Ver historial del usuario: GET `/reservations/user?userId=test-789`
- [ ] [ ] Crear múltiples reservaciones y verificar estadísticas
- [ ] [ ] Cambiar zona horaria y verificar que los eventos se crean con hora correcta

---

## 🐛 Solución de Problemas

### Error: "Google Calendar no está configurado"

- [ ] Verificar que `GOOGLE_SERVICE_ACCOUNT_EMAIL` está en `.env`
- [ ] Verificar que `GOOGLE_PRIVATE_KEY` está en `.env`
- [ ] Verificar que la clave privada está correctamente formateada (con `\n`)
- [ ] Reiniciar servidor: `npm run dev`

### Error: "Invalid JSON"

- [ ] Verificar que la clave privada tiene `-----BEGIN PRIVATE KEY-----` al inicio
- [ ] Verificar que la clave privada tiene `-----END PRIVATE KEY-----` al final
- [ ] Las líneas dentro deben estar separadas con `\n` literal

### Error: "Calendar not found"

- [ ] Verificar que Google Calendar API está habilitada en Google Cloud Console
- [ ] Verificar que `GOOGLE_CALENDAR_ID=primary` en `.env` (o el ID correcto)

### Evento no aparece en Google Calendar

- [ ] Verificar que la zona horaria es correcta: `TIMEZONE=America/Mexico_City`
- [ ] Verificar que la fecha/hora está en formato ISO: `2024-01-25T10:00:00`
- [ ] Verificar que la hora no está en el pasado

### Redis Error

- [ ] Verificar que Redis está corriendo: `redis-cli ping`
- [ ] Si no está corriendo, iniciar: `redis-server`

---

## 📊 Checklist de Funcionalidad

### Chatbot

- [ ] Responde mensajes normales correctamente
- [ ] Detecta solicitudes de visita técnica
- [ ] Extrae datos del cliente automáticamente
- [ ] Crea eventos en Google Calendar
- [ ] Envía confirmación con link del evento
- [ ] Solicita datos faltantes si es necesario

### API de Reservaciones

- [ ] POST `/reservations/book` - Crear reservación
- [ ] GET `/reservations/user` - Ver reservaciones del usuario
- [ ] DELETE `/reservations/:eventId` - Cancelar reservación
- [ ] GET `/reservations/available` - Ver horarios disponibles
- [ ] GET `/reservations/stats` - Ver estadísticas

### Integración con WhatsApp

- [ ] Mensajes de WhatsApp se procesan correctamente
- [ ] Reservaciones se crean automáticamente desde WhatsApp
- [ ] Confirmaciones se envían a WhatsApp

---

## 🎉 ¡Listo!

Si todos los checkboxes están marcados, tu chatbot está correctamente configurado y listo para gestionar reservaciones de visitas técnicas automáticamente.

## 📖 Documentación Útil

- [CALENDAR_SETUP.md](./CALENDAR_SETUP.md) - Guía detallada
- [GOOGLE_CALENDAR_IMPLEMENTATION.md](./GOOGLE_CALENDAR_IMPLEMENTATION.md) - Resumen de cambios
- [postman-calendar-tests.json](./postman-calendar-tests.json) - Colección Postman para pruebas

---

## 🆘 Necesitas ayuda?

1. Revisa la sección "Solución de Problemas" anterior
2. Verifica los logs en la consola
3. Consulta [CALENDAR_SETUP.md](./CALENDAR_SETUP.md) para más detalles
4. Asegúrate de que todas las variables de entorno están correctas
