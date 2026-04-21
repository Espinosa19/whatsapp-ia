import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Servir archivos estáticos de React
app.use(express.static(path.join(__dirname, 'public')));

// Fallback para todas las rutas
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 React Client running on http://localhost:${PORT}\n`);
});
