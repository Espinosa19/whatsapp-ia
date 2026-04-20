# 📅 Guía de Configuración: Google Calendar Integration

Tu chatbot ahora puede gestionar automáticamente las reservaciones de visitas técnicas usando Google Calendar.

## ✨ Características Implementadas

1. **Detección Automática de Solicitudes**: El chatbot detecta cuando un cliente quiere agendar una visita técnica
2. **Extracción de Datos**: Extrae automáticamente: nombre, teléfono, email, dirección, tipo de servicio, fecha y hora
3. **Creación de Eventos**: Crea eventos en Google Calendar automáticamente
4. **Confirmación al Cliente**: Envía confirmación con el link del evento al cliente por WhatsApp
5. **Gestión de Disponibilidad**: Consulta horarios disponibles en el calendario
6. **API de Reservaciones**: Endpoints para gestionar reservaciones manualmente

---

## 🔐 Paso 1: Crear una Cuenta de Servicio en Google Cloud

### 1.1 Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto (o usa uno existente)
3. Nombre: "WhatsApp Chatbot" (o el que prefieras)

### 1.2 Habilitar Google Calendar API

1. En el menú, ve a **APIs y Servicios** → **Biblioteca**
2. Busca "Google Calendar API"
3. Haz clic en ella y selecciona **Habilitar**

### 1.3 Crear una Cuenta de Servicio

1. Ve a **APIs y Servicios** → **Credenciales**
2. Haz clic en **+ Crear credenciales** → **Cuenta de servicio**
3. Completa los detalles:
   - **Nombre de la cuenta de servicio**: `whatsapp-chatbot`
   - **ID de la cuenta de servicio**: Se genera automáticamente
4. Haz clic en **Crear y continuar**
5. Salta los pasos opcionales y haz clic en **Crear**

### 1.4 Generar una Clave Privada

1. En la lista de cuentas de servicio, haz clic en la que acabas de crear
2. Ve a la pestaña **Claves**
3. Haz clic en **Agregar clave** → **Crear clave nueva**
4. Selecciona **JSON** y haz clic en **Crear**
5. Se descargará automáticamente un archivo JSON con tus credenciales

---

## 🛠️ Paso 2: Configurar Variables de Entorno

### Opción A: Usar variables de entorno (Recomendado)

Abre tu archivo `.env` y agrega:

```env
# Google Calendar Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=whatsapp-chatbot@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE...\n-----END PRIVATE KEY-----"
GOOGLE_CALENDAR_ID=primary
TIMEZONE=America/Mexico_City
```

**Donde:**
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: El email del archivo JSON descargado
- `GOOGLE_PRIVATE_KEY`: La clave privada del archivo JSON (incluyendo saltos de línea como `\n`)
- `GOOGLE_CALENDAR_ID`: ID del calendario (por defecto "primary" = tu calendario principal)
- `TIMEZONE`: Tu zona horaria

### Opción B: Usar archivo de credenciales JSON

```env
GOOGLE_CREDENTIALS_PATH=./credentials.json
GOOGLE_CALENDAR_ID=primary
TIMEZONE=America/Mexico_City
```

Coloca el archivo `credentials.json` en la raíz del proyecto.

---

## 📱 Paso 3: Pruebas de Integración

### Test 1: Solicitar una reservación por chat

**POST** `http://localhost:3000/chat`

```json
{
  "userId": "whatsapp-123",
  "message": "Hola, necesito una visita técnica de instalación para mañana a las 10 de la mañana. Soy Juan García, mi número es 5551234567 y la dirección es Calle Principal 123, Apartamento 5"
}
```

**Respuesta esperada:**
```json
{
  "reply": "Perfecto Juan, he agendado tu visita técnica de instalación para mañana a las 10:00 AM en Calle Principal 123, Apartamento 5...",
  "reservation": {
    "success": true,
    "eventId": "abc123xyz",
    "eventLink": "https://calendar.google.com/event?eid=..."
  }
}
```

### Test 2: Ver disponibilidad

**GET** `http://localhost:3000/reservations/available?date=2024-01-20&duration=60`

**Respuesta:**
```json
{
  "date": "2024-01-20",
  "duration": 60,
  "availableSlots": [
    {
      "start": "2024-01-20T09:00:00.000Z",
      "end": "2024-01-20T10:00:00.000Z"
    },
    {
      "start": "2024-01-20T11:00:00.000Z",
      "end": "2024-01-20T12:00:00.000Z"
    }
  ],
  "totalSlots": 2
}
```

### Test 3: Crear reservación manual

**POST** `http://localhost:3000/reservations/book`

```json
{
  "userId": "whatsapp-123",
  "clientName": "Juan García",
  "clientPhone": "5551234567",
  "clientEmail": "juan@email.com",
  "serviceType": "instalación",
  "dateTime": "2024-01-20T10:00:00",
  "duration": 60,
  "address": "Calle Principal 123, Apartamento 5",
  "notes": "Cliente necesita instalación urgente. Disponible solo mañana"
}
```

---

## 📋 API Endpoints de Reservaciones

### Crear Reservación
- **POST** `/reservations/book`
- Requiere: `clientName`, `clientPhone`, `serviceType`, `dateTime`, `address`
- Retorna: ID del evento y link de Google Calendar

### Obtener Reservaciones de Usuario
- **GET** `/reservations/user?userId=xxx`
- Retorna: Lista de todas las reservaciones del usuario

### Cancelar Reservación
- **DELETE** `/reservations/:eventId`
- Requiere: `userId` en el body
- Retorna: Confirmación de cancelación

### Ver Disponibilidad
- **GET** `/reservations/available?date=2024-01-20&duration=60`
- Retorna: Lista de slots disponibles

### Estadísticas
- **GET** `/reservations/stats`
- Retorna: Total de reservaciones, tipos de servicios, etc.

---

## 🤖 Cómo Funciona la Detección Automática

El chatbot detecta automáticamente cuando un cliente quiere agendar una visita técnica si:

1. El tipo de servicio identificado es "servicio" (instalación, reparación, diagnóstico)
2. El mensaje contiene palabras clave como: "visita", "reservar", "agendar", "mañana", "esta semana", etc.
3. Se extraen automáticamente:
   - Nombre del cliente
   - Teléfono de contacto
   - Email (si está disponible)
   - Dirección donde se realizará la visita
   - Fecha y hora preferida
   - Tipo de servicio solicitado

### Ejemplo de Conversación Natural:

**Cliente**: "Hola, necesito una visita técnica porque mi equipo no funciona"

**Bot**: "Entiendo que tienes un problema. ¿Cuál es exactamente el problema y cuándo podrías recibir una visita técnica?"

**Cliente**: "El equipo no enciende, y quiero una visita mañana a las 2 de la tarde. Soy Pedro López, vivo en Avenida Reforma 500"

**Bot**: "Perfecto Pedro, he agendado tu visita técnica de diagnóstico para mañana a las 14:00 en Avenida Reforma 500 ✅"

---

## 🔧 Configuración Avanzada

### Personalizar Horarios de Trabajo

Edita [src/services/reservation.service.js](../services/reservation.service.js) en la función `getAvailableSlots()`:

```javascript
const startOfDay = new Date(date);
startOfDay.setHours(9, 0, 0, 0); // Cambia a tu hora de inicio

const endOfDay = new Date(date);
endOfDay.setHours(18, 0, 0, 0); // Cambia a tu hora de cierre
```

### Personalizar Duración de Visitas

En `validateAndFormatReservationData()`:
```javascript
duration: 60, // Cambiar a 90 o 120 minutos
```

### Personalizar Reminders

En `createReservation()`:
```javascript
reminders: {
  useDefault: false,
  overrides: [
    { method: 'email', minutes: 24 * 60 }, // 24 horas antes
    { method: 'notification', minutes: 30 }, // 30 minutos antes
  ],
},
```

---

## ❌ Solución de Problemas

### Problema: "Google Calendar no está configurado"

**Solución**: Verifica que `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY` estén correctamente configurados en el archivo `.env`

### Problema: Error "Invalid private key"

**Solución**: Asegúrate de que la clave privada está correctamente escapada con `\n` en lugar de saltos de línea reales.

### Problema: No se crean eventos en Google Calendar

**Solución**: 
1. Verifica que la API de Google Calendar está habilitada en Google Cloud Console
2. Verifica que la zona horaria en `.env` es correcta
3. Revisa los logs para ver mensajes de error específicos

---

## 📊 Estadísticas de Reservaciones

La API proporciona estadísticas en tiempo real:

**GET** `/reservations/stats`

```json
{
  "totalReservations": 42,
  "upcomingReservations": 15,
  "pastReservations": 27,
  "reservationsByType": {
    "instalación": 20,
    "reparación": 18,
    "diagnóstico": 4
  }
}
```

---

## 🎯 Casos de Uso

1. **Cliente pide visita técnica en WhatsApp**: Se crea automáticamente evento en Google Calendar
2. **Admin consulta disponibilidad**: Usa GET `/reservations/available` para ver horarios libres
3. **Cliente quiere cancelar**: Usa DELETE `/reservations/{eventId}`
4. **Reportes**: Usa GET `/reservations/stats` para ver estadísticas

---

## 📝 Notas Importantes

- Las reservaciones se guardan tanto en Google Calendar como en Redis (con expiración de 30 días)
- Si el cliente proporciona email, recibirá automáticamente invitación en Google Calendar
- Los horarios disponibles se calculan dinámicamente basados en eventos ya programados
- Todos los eventos incluyen link de Google Calendar en la confirmación

¡Tu chatbot ya está listo para gestionar visitas técnicas automáticamente! 🚀
