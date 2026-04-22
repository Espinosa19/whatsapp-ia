# 👥 Sistema de Gestión de Leads

## 🚀 ¿Qué es?

Un sistema completo para capturar, almacenar y gestionar **leads** (clientes potenciales) desde el chatbot de IA. Los leads se guardan automáticamente en la base de datos SQLite cuando se completa una reservación.

## 📊 Características Principales

### ✅ Captura Automática de Leads
- Se capturan datos del cliente cuando solicita una visita técnica
- Se validan automáticamente (nombre, teléfono, dirección, ciudad)
- Se guardan en la BD con estado "convertido"
- Se vinculan con evento de Google Calendar

### 📋 Interfaz de Gestión de Leads
- **Vista de lista** - Todos los leads con filtros
- **Panel de detalles** - Información completa del cliente
- **Edición inline** - Modificar datos en cualquier momento
- **Cambio de estado** - Nuevo → Contactado → Convertido → Cancelado

### 📊 Dashboard de Estadísticas
- Total de leads capturados
- Desglose por estado
- Tasa de conversión
- Servicios más solicitados
- Ciudades con más leads
- Métricas de últimos 7 días

## 🔄 Estados de un Lead

```
🆕 NUEVO (Naranja)
   ↓ (Se establece contacto)
📞 CONTACTADO (Azul)
   ↓ (Se completa el servicio)
✅ CONVERTIDO (Verde)
   X (Se descarta)
❌ CANCELADO (Rojo)
```

## 📱 Cómo Usar

### 1. Ir a la Interfaz de Leads

```bash
# Terminal 1 - Backend
npm run dev
# http://localhost:3000

# Terminal 2 - Frontend
cd client && npm run dev
# http://localhost:3001

# Clickear en botón "👥 Leads" en el navbar
```

### 2. Filtrar Leads

```
- Por estado: Nuevo, Contactado, Convertido, Cancelado
- Por búsqueda: Nombre, teléfono, tipo de servicio
- Por orden: Más recientes, nombre, teléfono
```

### 3. Ver Detalles de un Lead

```
Clickear en el lead de la lista izquierda
Se muestra:
  - Contacto (teléfono, email)
  - Servicio (tipo, dirección, ciudad)
  - Cita (fecha, hora, link Google Calendar)
  - Notas
  - Información de creación/actualización
```

### 4. Cambiar Estado

```
En el panel derecho, botones:
  🆕 Nuevo → 📞 Contactado → ✅ Convertido → ❌ Cancelado
```

### 5. Editar Lead

```
Botón "✏️ Editar"
Se abre formulario para modificar:
  - Nombre
  - Teléfono
  - Email
  - Servicio
  - Dirección
  - Notas
Guardar con "✅ Guardar"
```

### 6. Eliminar Lead

```
Botón "🗑️ Eliminar"
Confirmar eliminación
Lead se remove de la BD
```

## 📊 Dashboard

### Tarjetas Principales
- **👥 Total de Leads** - Todos los que has capturado
- **🆕 Nuevos** - Sin contactar aún
- **📞 Contactados** - Ya hablaste con ellos
- **✅ Convertidos** - Completaste la venta
- **❌ Cancelados** - Que no van a convertir
- **📈 Tasa de Conversión** - % de convertidos vs total

### Gráficos
- **🔧 Servicios** - Qué servicios piden más
- **🏙️ Ciudades** - De dónde son tus clientes
- **📊 Distribución** - Porcentaje de cada estado

### Métricas
- **📅 Últimos 7 días** - Leads recientes
- **💬 Total Mensajes** - Del chatbot
- **👥 Usuarios Activos** - Que interactuaron

## 💾 Base de Datos

La tabla `leads` almacena:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | ID único |
| user_id | TEXT | Quién capturó el lead |
| client_name | TEXT | Nombre del cliente |
| client_phone | TEXT | Teléfono contacto |
| client_email | TEXT | Email (opcional) |
| service_type | TEXT | ¿Qué tipo de servicio? |
| address | TEXT | Dirección completa |
| city | TEXT | Ciudad |
| status | TEXT | Estado (nuevo/contactado/etc) |
| notes | TEXT | Notas adicionales |
| preferred_date | TEXT | Fecha de cita |
| preferred_time | TEXT | Hora de cita |
| event_id | TEXT | ID Google Calendar |
| calendar_link | TEXT | Link del evento |
| created_at | DATETIME | Cuándo se capturó |
| updated_at | DATETIME | Última edición |

## 🔗 API Endpoints

### Obtener Leads
```bash
GET http://localhost:3000/leads
GET http://localhost:3000/leads?status=nuevo
GET http://localhost:3000/leads/stats
GET http://localhost:3000/leads/user/:userId
```

### Buscar
```bash
GET http://localhost:3000/leads/search?clientName=Juan&city=CDMX
```

### Crear/Actualizar
```bash
POST http://localhost:3000/leads
{
  "userId": "5214551234567",
  "clientName": "Juan Pérez",
  "clientPhone": "5214551234567",
  "clientEmail": "juan@email.com",
  "serviceType": "Instalación",
  "address": "Calle 123, Apto 4, Alcaldía Benito Juárez",
  "city": "Ciudad de México",
  "status": "nuevo",
  "notes": "Cliente VIP"
}

PUT http://localhost:3000/leads/1
{ /* actualizar cualquier campo */ }

PUT http://localhost:3000/leads/1/status
{ "status": "contactado" }
```

### Eliminar
```bash
DELETE http://localhost:3000/leads/1
```

## 🔥 Flujo Automático

```
Usuario: "Quiero una visita técnica"
         ↓
IA: "Dame tu nombre, teléfono, dirección..."
         ↓
Usuario: "Juan Pérez, 5214551234567, Avenida Paseo de la Reforma 505"
         ↓
Sistema: ✅ Valida datos
         ↓
Sistema: 📅 Crea evento en Google Calendar
         ↓
Sistema: 💾 GUARDA LEAD EN BD (con estado "convertido")
         ↓
Usuario: ✅ "¡Cita confirmada para el 25/04 a las 14:00!"
         ↓
Admin: 👀 Ve el lead en interfaz → puede cambiar estado si necesario
```

## 🎯 Casos de Uso

### Lead Nuevo
```
1. Capturado del chat
2. Estado: "nuevo"
3. En interfaz: Pendiente contactar
```

### Dar Seguimiento
```
1. Ver lead en lista
2. Clickear para ver detalles
3. Cambiar a "contactado" cuando llames/escribas
4. Dejar notas: "Cliente interesado, espera cotización"
```

### Convertir a Cliente
```
1. Lead en estado "contactado"
2. Cliente confirma el servicio
3. Cambiar a "convertido"
4. El cliente aparece en tasa de conversión
```

### Lead Frio
```
1. Lead no responde
2. Cambiar a "cancelado"
3. No afecta tasa de conversión
```

## 📈 Interpretando Estadísticas

### Tasa de Conversión
```
Convertidos / Total × 100

Ejemplo:
  - 100 leads capturados
  - 30 convertidos
  - Tasa = 30%

Bueno: 20-30%
Muy bueno: 30%+
```

### Top Servicios
```
Instalación: 45 leads
Reparación: 30 leads
Diagnóstico: 15 leads

Enfocarse en lo que más demandan
```

### Leads por Ciudad
```
CDMX: 80 leads
Área Metropolitana: 15 leads
Otras: 5 leads

Priorizar donde hay más demanda
```

## 🔒 Datos Importantes

- ⚠️ No se puede duplicar (user_id + phone)
- ✅ Se sincroniza con Google Calendar
- 📅 Timestamps de creación/actualización automáticos
- 🗑️ Si eliminas, se borra de la BD

## 🚀 Próximas Mejoras

- [ ] Exportar a Excel/CSV
- [ ] Integración con CRM (Hubspot, Pipedrive)
- [ ] Pipeline visual (Kanban)
- [ ] Emails automáticos
- [ ] Tareas y recordatorios
- [ ] Clasificación Hot/Warm/Cold
- [ ] Análisis de tendencias

## ❓ FAQ

**P: ¿Se crean leads automáticamente?**
R: Sí, cuando se completa una reservación en el chat.

**P: ¿Puedo editar un lead?**
R: Sí, botón "✏️ Editar" en la interfaz.

**P: ¿Puedo buscar leads específicos?**
R: Sí, por nombre, teléfono, servicio, estado, fecha.

**P: ¿Se sincroniza con Google Calendar?**
R: Sí, cada lead tiene un evento de calendario.

**P: ¿Qué pasa si elimino un lead?**
R: Se borra de la BD y no se puede recuperar.

**P: ¿Cómo mejoro mi tasa de conversión?**
R: Haz seguimiento a "contactados", responde rápido, personaliza ofertas.

---

**Para soporte:** Revisa los logs de la terminal del backend
