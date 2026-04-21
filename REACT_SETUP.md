# 🚀 Configuración de React - WhatsApp AI Bot

## ✅ Lo que se implementó

Se ha creado una **interfaz React completa** con los siguientes componentes:

### 📁 Estructura del Proyecto

```
whatsapp-ai-bot/
├── 🔴 Backend (Node.js + Express)
│   ├── src/
│   ├── server.js
│   ├── package.json
│   └── ...
│
├── 🔵 Frontend (React)
│   ├── client/
│   │   ├── public/
│   │   │   ├── index.html        ← Archivo principal
│   │   │   ├── app.js            ← Componentes React
│   │   │   ├── style.css         ← Estilos
│   │   │   └── favicon.ico
│   │   ├── server.js             ← Servidor Node.js
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── (src/ opcional para desarrollo futuro)
│
└── package.json (raíz)
```

---

## 🏃 Cómo ejecutar

### Opción 1: Ejecutar ambos (Recomendado)

```bash
npm run dev:all
```

Esto abre:
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:3001`

### Opción 2: Backend solo

```bash
npm run dev
```

Backend en `http://localhost:3000`

### Opción 3: Frontend solo

```bash
npm run dev:client
```

Frontend en `http://localhost:3001`

---

## 🎨 Características de la Interfaz

La aplicación React incluye:

### ✨ Componentes principales

1. **Sidebar de Usuarios (Izquierda)**
   - Lista de todos los usuarios con mensajes
   - Muestra cantidad de mensajes por usuario
   - Fecha del último mensaje
   - Botón de actualizar (🔄)
   - Selección con efecto activo

2. **Panel de Mensajes (Derecha)**
   - Visualiza el historial completo
   - Distingue entre mensajes del usuario y del bot
   - Timestamps con formato legible
   - Botón para eliminar historial
   - Animaciones suaves

3. **Estilos**
   - Tema morado/azul moderno
   - Interfaz responsive (mobile + desktop)
   - Scrollbars personalizados
   - Animaciones de entrada

---

## 📱 Interfaz Responsive

La aplicación se adapta automáticamente:

- **Desktop** (>768px)
  - Sidebar a la izquierda
  - Panel de mensajes a la derecha
  - Layout horizontal

- **Mobile** (<768px)
  - Sidebar arriba (lista horizontal)
  - Mensajes abajo
  - Layout vertical

---

## 🔧 Cómo se conecta al Backend

El cliente React se conecta a través de estas APIs:

```javascript
API_BASE_URL = 'http://localhost:3000'

// Obtener estadísticas y usuarios
GET /db/stats
→ Response: { totalMessages, totalUsers, topUsers: [...] }

// Obtener mensajes de un usuario
GET /db/messages?userId=123456
→ Response: { userId, messages: [...] }

// Eliminar historial
DELETE /db/messages
Body: { userId: '123456' }
→ Response: { deletedCount: 5 }
```

---

## 📊 Base de Datos

El backend usa **SQLite** con dos tablas:

### Tabla `messages`
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,           -- 'user' o 'assistant'
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Tabla `conversation_stats`
```sql
CREATE TABLE conversation_stats (
  id INTEGER PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  message_count INTEGER DEFAULT 0,
  last_message DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

Los datos se guardan en: `data/whatsapp-bot.db`

---

## 🛠️ Configuración Personalizada

### Cambiar el puerto del Frontend

En `client/server.js`:
```javascript
const PORT = process.env.PORT || 3001;  // Cambiar 3001 por tu puerto
```

### Cambiar la URL del Backend

En `client/public/app.js`:
```javascript
const API_BASE_URL = 'http://localhost:3000';  // Cambiar esta URL
```

### Cambiar colores del tema

En `client/public/style.css`:
```css
/* Busca y reemplaza estos gradientes */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

---

## 🚀 Despliegue en Hostinger

Cuando estés listo para producción:

### 1. Build del Frontend

```bash
cd client
npm run build  # (cuando implementemos bundler)
```

Por ahora, los archivos están listos en `client/public/`

### 2. Servir desde Express

En el servidor principal (`server.js`):

```javascript
import express from 'express';
import path from 'path';

const app = express();

// Servir archivos estáticos de React
app.use(express.static(path.join(__dirname, 'client/public')));

// API routes
app.use('/db', databaseRoutes);
// ... otras rutas

// Fallback para React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/public/index.html'));
});
```

### 3. Variables de Entorno para Producción

En `.env`:
```
NODE_ENV=production
PORT=80
CORS_ORIGIN=https://tu-dominio.com
DB_PROVIDER=mysql  # O la BD que uses en Hostinger
```

---

## 📖 Tecnologías Utilizadas

| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| React | 18 | Framework UI |
| Axios | 1.4 | Cliente HTTP |
| Express | 5.2 | Servidor (backend) |
| SQLite | - | Base de datos local |
| CSS3 | - | Estilos |

---

## ⚠️ Troubleshooting

### Error: "Cannot GET /"
- Verifica que el servidor del cliente está corriendo
- Puerto 3001 debe estar disponible

### Error de conexión a API
- Verifica que el backend corre en puerto 3000
- Comprueba que CORS está habilitado

### Mensajes no cargan
- Abre DevTools (F12) → Consola
- Verifica que hay datos en la BD: `GET /db/stats`

### Los botones no responden
- Recarga la página (Ctrl+F5)
- Revisa la consola para errores JavaScript

---

## 🔄 Próximos Pasos

1. ✅ Integrar historial en tiempo real con WebSockets
2. ✅ Agregar búsqueda de mensajes
3. ✅ Exportar conversaciones a PDF
4. ✅ Agregar filtros por fecha
5. ✅ Dashboard con gráficos

---

## 📝 Notas Importantes

- **SQLite es temporal**: Cuando implementes Hostinger con MySQL, solo cambia las credenciales
- **Datos en transición**: En desarrollo los datos se guardan localmente
- **CORS habilitado**: Ya está configurado en `src/app.js`
- **API RESTful**: Todas las rutas siguen estándares REST

---

¡Listo! Tu interfaz React está completa y funcional 🎉

Para más ayuda, abre `client/README.md`
