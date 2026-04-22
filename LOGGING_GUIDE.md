# 📝 Sistema de Logging

## ¿Qué es?

Un sistema completo para registrar todos los eventos, errores y conversaciones de tu chatbot en archivos `.log`. Además, cuando ocurra un error, el bot le pide al usuario que repita el mensaje.

## 🗂️ Estructura

```
logs/
├── 2026-04-22.log   (Log del día actual)
├── 2026-04-21.log   (Log del día anterior)
└── ...
```

Cada archivo contiene:
- ✅ **Éxitos** - Operaciones completadas exitosamente
- ❌ **Errores** - Problemas que ocurrieron
- ⚠️ **Advertencias** - Eventos inusuales
- ℹ️ **Información** - Eventos generales
- 💬 **Conversaciones** - Mensajes de usuarios y IA
- 📅 **Reservaciones** - Citas creadas
- 👥 **Leads** - Clientes capturados

## 📊 Tipos de Logs

### 1. **Conversaciones**
```log
[2026-04-22T10:30:45.123Z] 💬 CHAT [ENTRADA] User: 5214551234567 | Role: user | Msg: Quiero una visita técnica...
[2026-04-22T10:30:50.456Z] 💬 CHAT [SALIDA] User: 5214551234567 | Role: assistant | Msg: ¡Claro! Cuéntame más...
```

### 2. **Errores**
```log
[2026-04-22T10:31:12.789Z]
❌ ERROR [chatWithAI]
Mensaje: Connection timeout
Stack: Error: Connection timeout at...
---
```

### 3. **Reservaciones**
```log
[2026-04-22T10:35:20.000Z] 📅 RESERVACIÓN [success] User: 5214551234567 | Cliente: Juan Pérez | Servicio: Instalación
```

### 4. **Leads**
```log
[2026-04-22T10:35:20.500Z] 👥 LEAD [convertido] Cliente: Juan Pérez | Teléfono: 5214551234567
```

## 🔧 Funciones Disponibles

### En el Código

```javascript
import { 
  logError, 
  logSuccess, 
  logInfo, 
  logWarning,
  logConversation,
  logReservation,
  logLead,
  getRecentLogs,
  readLogFile,
  getLogFiles,
  cleanOldLogs
} from './services/logger.service.js';

// Ejemplos de uso
logError(error, 'nombreFuncion');
logSuccess('Operación completada', 'nombreFuncion');
logInfo('Información del sistema', 'nombreFuncion');
logConversation(userId, 'user', message, 'ENTRADA');
```

### API REST

#### **GET /logs/recent**
Obtiene los últimos 50 logs
```bash
curl http://localhost:3000/logs/recent
# Query opcional: ?lines=100 (obtener más líneas)
```

Respuesta:
```json
{
  "total": 50,
  "logs": [
    "[2026-04-22T10:30:45.123Z] ℹ️ INFO [chatWithAI] Generando respuesta...",
    "[2026-04-22T10:30:46.456Z] ✅ SUCCESS [chatWithAI] Respuesta generada exitosamente",
    ...
  ]
}
```

#### **GET /logs/files**
Obtiene lista de archivos de log disponibles
```bash
curl http://localhost:3000/logs/files
```

Respuesta:
```json
{
  "total": 5,
  "files": [
    "2026-04-22.log",
    "2026-04-21.log",
    "2026-04-20.log",
    "2026-04-19.log",
    "2026-04-18.log"
  ]
}
```

#### **GET /logs/:fileName**
Obtiene contenido completo de un archivo de log
```bash
curl http://localhost:3000/logs/2026-04-22.log
```

Respuesta:
```json
{
  "fileName": "2026-04-22.log",
  "lines": 245,
  "content": "[2026-04-22T10:00:00.000Z] ℹ️ INFO [startup] Sistema iniciado..."
}
```

#### **POST /logs/cleanup**
Limpia logs antiguos (más de N días)
```bash
curl -X POST http://localhost:3000/logs/cleanup \
  -H "Content-Type: application/json" \
  -d '{"daysToKeep": 7}'
```

Respuesta:
```json
{
  "message": "Logs anteriores a 7 días eliminados",
  "daysToKeep": 7
}
```

## 🤖 Manejo de Errores en Chat

### Antes
```
Usuario: "Quiero una visita"
[ERROR en consola, no se guarda]
Usuario: ??? (sin respuesta)
```

### Ahora
```
Usuario: "Quiero una visita"
[ERROR se registra en logs/2026-04-22.log]
Bot: "❌ Hubo un problema procesando tu mensaje: [detalles del error]

¿Podrías repetir lo que dijiste? Eso nos ayudará a resolver el problema."

Usuario: "Intento de nuevo..."
```

## 📁 Ubicación de Logs

```
whatsapp-ai-bot/
├── logs/
│   ├── 2026-04-22.log    ← Los errores se guardan aquí
│   ├── 2026-04-21.log
│   └── ...
├── src/
├── client/
└── ...
```

## 🔍 Casos de Uso

### 1. **Debugging Rápido**
```bash
# Ver últimos errores
curl http://localhost:3000/logs/recent?lines=20 | grep ERROR
```

### 2. **Revisar Conversación Específica**
```bash
curl http://localhost:3000/logs/2026-04-22.log | grep "5214551234567"
```

### 3. **Analizar Tasa de Errores**
```bash
curl http://localhost:3000/logs/2026-04-22.log | grep "❌ ERROR" | wc -l
```

### 4. **Exportar Log del Día**
```bash
curl http://localhost:3000/logs/2026-04-22.log > backup-2026-04-22.log
```

## ⚙️ Configuración

### Rotación de Logs
Los logs se rotan automáticamente por día. Cada día crea un nuevo archivo `YYYY-MM-DD.log`.

### Limpieza Automática
Para limpiar logs más de 7 días antiguos:
```bash
curl -X POST http://localhost:3000/logs/cleanup \
  -H "Content-Type: application/json" \
  -d '{"daysToKeep": 7}'
```

### En .gitignore
```
logs/        ← Los archivos de log se ignoran en git
```

## 📊 Estadísticas de Logs

Ver cantidad de logs de cada tipo:
```bash
# Contar errores
curl http://localhost:3000/logs/recent?lines=500 | grep "❌ ERROR" | wc -l

# Contar conversaciones
curl http://localhost:3000/logs/recent?lines=500 | grep "💬 CHAT" | wc -l

# Contar leads
curl http://localhost:3000/logs/recent?lines=500 | grep "👥 LEAD" | wc -l
```

## 🎯 Flujo de Error Mejorado

```
1. Usuario envía mensaje
   ↓
2. Bot procesa y ocurre error
   ↓
3. ERROR SE REGISTRA en logs/YYYY-MM-DD.log
   ↓
4. Usuario recibe:
   "❌ Hubo un problema..."
   + Descripción del error
   + Solicitud de repetir mensaje
   ↓
5. Admin puede revisar logs para debugging
   ↓
6. Se arregla el problema
```

## 🚀 Ventajas

✅ **Debugging fácil** - Todos los errores registrados
✅ **Historial completo** - Auditoría de conversaciones
✅ **Recuperación de errores** - Bot pide repetir mensaje
✅ **Análisis** - Puedes analizar patrones de errores
✅ **Cumplimiento normativo** - Registro de todas las transacciones
✅ **Performance** - Archivos diarios evitan archivos gigantes

## 📝 Ejemplo de Archivo de Log

```
[2026-04-22T08:00:00.000Z] ℹ️ INFO [startup] Sistema iniciado
[2026-04-22T08:05:15.123Z] 💬 CHAT [ENTRADA] User: user123 | Role: user | Msg: Hola, necesito ayuda...
[2026-04-22T08:05:15.456Z] ℹ️ INFO [chatWithAI] Generando respuesta para user123
[2026-04-22T08:05:16.789Z] 💬 CHAT [SALIDA] User: user123 | Role: assistant | Msg: Hola! ¿En qué puedo ayudarte?
[2026-04-22T08:10:30.000Z] 💬 CHAT [ENTRADA] User: user123 | Role: user | Msg: Quiero una visita técnica
[2026-04-22T08:10:30.111Z] ℹ️ INFO [chatWithAI] Solicitud de reservación detectada
[2026-04-22T08:10:31.222Z] ℹ️ INFO [chatWithAI] Validando datos de reservación
[2026-04-22T08:10:32.333Z] ✅ SUCCESS [chatWithAI] Datos validados, creando reservación
[2026-04-22T08:10:33.444Z] ✅ SUCCESS [chatWithAI] Reservación creada para Juan Pérez
[2026-04-22T08:10:33.555Z] ✅ SUCCESS [saveLead] Lead guardado: Juan Pérez
[2026-04-22T08:10:34.666Z] 📅 RESERVACIÓN [success] User: user123 | Cliente: Juan Pérez | Servicio: Instalación
[2026-04-22T08:10:34.777Z] 👥 LEAD [convertido] Cliente: Juan Pérez | Teléfono: 5214551234567
[2026-04-22T08:10:35.888Z] 💬 CHAT [SALIDA] User: user123 | Role: assistant | Msg: ✅ ¡Cita confirmada!
```

## ❓ FAQ

**P: ¿Dónde se guardan los logs?**
R: En la carpeta `logs/` con formato `YYYY-MM-DD.log`

**P: ¿Se pueden eliminar los logs?**
R: Sí, automáticamente con `POST /logs/cleanup` o manualmente borrando archivos.

**P: ¿Qué pasa si hay un error?**
R: Se registra en el archivo de log Y el bot pide al usuario repetir el mensaje.

**P: ¿Puedo ver los logs en tiempo real?**
R: Sí, accesible vía API `GET /logs/recent`

**P: ¿Los logs se suben a git?**
R: No, están en `.gitignore` por seguridad.

---

¡Ahora todos tus errores quedarán registrados para debugging! 🎯
