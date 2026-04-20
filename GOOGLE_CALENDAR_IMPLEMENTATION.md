# 📅 Google Calendar Integration - Resumen de Cambios

Se han agregado funcionalidades completas para que tu chatbot pueda gestionar automáticamente las reservaciones de visitas técnicas usando Google Calendar.

## 🎯 Lo que se implementó

### 1. **Configuración de Google Calendar** 
- Archivo: `src/config/google-calendar.config.js`
- Inicializa cliente de Google Calendar
- Soporta autenticación por Service Account
- Validación de credenciales

### 2. **Servicio de Reservaciones**
- Archivo: `src/services/reservation.service.js`
- Funciones implementadas:
  - `createReservation()` - Crear eventos en Google Calendar
  - `getUserReservations()` - Obtener reservaciones del usuario
  - `cancelReservation()` - Cancelar reservaciones
  - `getAvailableSlots()` - Ver horarios disponibles
  - `getReservationStats()` - Estadísticas de reservaciones

### 3. **Controlador de Reservaciones**
- Archivo: `src/controllers/reservation.controller.js`
- Endpoints para manejo de reservaciones
- Validación de datos de entrada
- Respuestas estructuradas

### 4. **Rutas de Reservaciones**
- Archivo: `src/routes/reservation.routes.js`
- Nuevos endpoints:
  - `POST /reservations/book` - Crear reservación
  - `GET /reservations/user` - Ver reservaciones del usuario
  - `DELETE /reservations/:eventId` - Cancelar reservación
  - `GET /reservations/available` - Ver disponibilidad
  - `GET /reservations/stats` - Estadísticas

### 5. **Integración en IA Service**
- Archivo: `src/services/ai.service.js`
- Nuevas funciones:
  - `detectAndExtractReservationData()` - Detecta solicitudes de visita técnica
  - `validateAndFormatReservationData()` - Valida y formatea datos
- La IA ahora retorna información sobre reservaciones

### 6. **Actualización de Chat Controller**
- Archivo: `src/controllers/chat.controller.js`
- Manejo automático de reservaciones
- Integración con Google Calendar
- Respuestas confirmando reservaciones

### 7. **Actualización de Webhook Controller**
- Archivo: `src/controllers/webhook.controller.js`
- Manejo automático de reservaciones desde WhatsApp
- Envío de confirmaciones a clientes

### 8. **Actualización de App.js**
- Importación de nuevas rutas
- Registro del endpoint `/reservations`

### 9. **Dependencias Instaladas**
- `googleapis@171.4.0` - Cliente de Google APIs
- `google-auth-library` - Autenticación para Google

---

## 🚀 Cómo Usar

### Paso 1: Configurar Google Calendar

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto y habilita Google Calendar API
3. Crea una Service Account y descarga el JSON con credenciales
4. Configura las variables de entorno en `.env` (ver `.env.example`)

### Paso 2: Probar Automáticamente

Envía un mensaje al chatbot solicitando una visita técnica:

```json
POST /chat
{
  "userId": "cliente-123",
  "message": "Hola, necesito una visita técnica de instalación para mañana a las 10 AM. Soy Juan García, mi número es 5551234567 y vivo en Calle Principal 123"
}
```

El chatbot:
1. Detectará que es una solicitud de visita técnica
2. Extraerá automáticamente los datos
3. Creará un evento en Google Calendar
4. Confirmará al cliente con el link del evento

### Paso 3: Gestionar Reservaciones Manualmente

```bash
# Ver disponibilidad
GET /reservations/available?date=2024-01-20&duration=60

# Crear reservación manual
POST /reservations/book

# Ver reservaciones del usuario
GET /reservations/user?userId=cliente-123

# Cancelar reservación
DELETE /reservations/abc123xyz

# Ver estadísticas
GET /reservations/stats
```

---

## 📊 Flujo de Detección de Reservación

```
Usuario envía mensaje
    ↓
IA analiza el mensaje
    ↓
¿Es solicitud de servicio? → NO → Respuesta normal
    ↓ SÍ
detectAndExtractReservationData()
    ↓
¿Tiene datos suficientes? → NO → Pide datos faltantes
    ↓ SÍ
createReservation()
    ↓
Evento creado en Google Calendar
    ↓
Confirmación enviada al cliente
```

---

## 🔧 Estructura de Datos

### Reservación (almacenada en Redis y Google Calendar)

```javascript
{
  eventId: "abc123xyz",              // ID de Google Calendar
  userId: "5491234567890",           // ID del cliente (WhatsApp)
  clientName: "Juan García",         // Nombre del cliente
  clientPhone: "5551234567",         // Teléfono
  clientEmail: "juan@email.com",     // Email (opcional)
  serviceType: "instalación",        // Tipo de servicio
  dateTime: "2024-01-20T10:00:00",   // Fecha y hora
  duration: 60,                      // Duración en minutos
  address: "Calle Principal 123",    // Dirección
  notes: "Cliente urgente",          // Notas adicionales
  createdAt: "2024-01-19T15:30:00",  // Cuándo se creó
  status: "confirmado"               // Estado
}
```

---

## 📝 Archivos Nuevos Creados

```
src/
├── config/
│   └── google-calendar.config.js     ← Configuración de Google Calendar
├── services/
│   └── reservation.service.js         ← Servicio de reservaciones
├── controllers/
│   └── reservation.controller.js      ← Controlador de reservaciones
└── routes/
    └── reservation.routes.js          ← Rutas de reservaciones

Root/
├── CALENDAR_SETUP.md                  ← Guía detallada de configuración
└── .env.example                       ← Ejemplo de variables de entorno
```

---

## 🔐 Variables de Entorno Requeridas

```env
# Google Calendar
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_CALENDAR_ID=primary
TIMEZONE=America/Mexico_City
```

---

## ✅ Características

- ✅ Detección automática de solicitudes de visita técnica
- ✅ Extracción inteligente de datos del cliente
- ✅ Creación de eventos en Google Calendar
- ✅ Envío de confirmaciones con link del evento
- ✅ Gestión de disponibilidad de horarios
- ✅ Cancelación de reservaciones
- ✅ Estadísticas de reservaciones
- ✅ Almacenamiento en Redis con expiración automática
- ✅ Integración con WhatsApp
- ✅ API REST para gestionar reservaciones manualmente

---

## 📖 Ver Documentación Completa

Para más detalles y ejemplos, consulta: [CALENDAR_SETUP.md](./CALENDAR_SETUP.md)

---

## 🎓 Ejemplo de Interacción

**Cliente (WhatsApp)**: "Hola, necesito una reparación del sistema de aire acondicionado. Puedo mañana a las 3 de la tarde. Soy María López, vivo en Av. Reforma 500 y mi número es 5552223333"

**Bot**: "Perfecto María, entiendo que necesitas reparación del aire acondicionado. He reservado una visita técnica para mañana a las 3:00 PM en Av. Reforma 500 ✅

📅 Fecha: 20/01/2024
⏰ Hora: 15:00
📍 Ubicación: Av. Reforma 500
🔗 Link del evento: https://calendar.google.com/event?eid=...

¿Hay algo más que debas saber?"

---

## 🆘 Soporte

Si tienes problemas con la configuración:

1. Revisa [CALENDAR_SETUP.md](./CALENDAR_SETUP.md) - Sección "Solución de Problemas"
2. Verifica que Google Calendar API está habilitada
3. Comprueba que las credenciales están correctamente configuradas en `.env`
4. Revisa los logs para mensajes de error específicos

¡Tu chatbot ahora puede gestionar reservaciones automáticamente! 🚀
