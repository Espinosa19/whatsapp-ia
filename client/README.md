# WhatsApp AI Bot - Cliente React

Interfaz web para visualizar el historial de conversaciones del WhatsApp AI Bot.

## 📋 Requisitos

- Node.js v18+
- Backend ejecutándose en `http://localhost:3000`

## 🚀 Instalación

```bash
cd client
npm install
```

## 💻 Desarrollo

```bash
npm run dev
# La aplicación se abrirá en http://localhost:3001
```

## 🌐 Características

- ✅ Visualizar lista de usuarios
- ✅ Ver historial de conversaciones por usuario
- ✅ Filtrar y buscar mensajes
- ✅ Eliminar historial de usuario
- ✅ Estadísticas en tiempo real
- ✅ Interfaz responsive

## 📁 Estructura

```
client/
├── public/
│   ├── index.html      # HTML principal
│   ├── app.js          # Componentes React
│   ├── style.css       # Estilos
│   └── favicon.ico
├── src/                # (Opcional para desarrollo futuro)
├── package.json
└── server.js           # Servidor Node.js
```

## 🔧 Configuración

Por defecto, la aplicación se conecta a:
- **Backend**: `http://localhost:3000`

Para cambiar, edita el `API_BASE_URL` en `public/app.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000';
```

## 📱 APIs Utilizadas

El cliente consume estas APIs del backend:

- `GET /db/stats` - Obtener estadísticas y lista de usuarios
- `GET /db/messages?userId=XXX` - Obtener mensajes de un usuario
- `DELETE /db/messages` - Eliminar historial de un usuario

## 🎨 Temas

La aplicación usa un tema morado/azul. Puedes cambiar los colores en `public/style.css`:

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

## 📝 Notas

- Los datos se guardan en SQLite en el backend
- La interfaz se actualiza en tiempo real
- Todos los estilos son responsive

## 🛠️ Troubleshooting

### Error "Cannot GET /"
- Verifica que el puerto 3001 no esté en uso
- Asegúrate de estar en la carpeta `client` antes de ejecutar `npm run dev`

### Error de conexión a API
- Verifica que el backend está corriendo en puerto 3000
- Comprueba que CORS está habilitado en el backend

### Los mensajes no cargan
- Abre la consola del navegador (F12)
- Verifica los errores en la pestaña "Network"
- Asegúrate de que el usuario tiene mensajes guardados
