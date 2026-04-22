import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import chatRoutes from './routes/chat.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import adminRoutes from './routes/admin.routes.js';
import reservationRoutes from './routes/reservation.routes.js';
import databaseRoutes from './routes/database.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import logsRoutes from './routes/logs.routes.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 🔹 Ruta de prueba / desarrollo (IA directa)
app.use('/chat', chatRoutes);

// 🔹 Ruta oficial WhatsApp (webhook)
app.use('/webhook', webhookRoutes);

// 🔹 Rutas de administración
app.use('/admin', adminRoutes);

// 🔹 Rutas de reservaciones
app.use('/reservations', reservationRoutes);

// 🔹 Rutas de base de datos (SQLite)
app.use('/db', databaseRoutes);

// 🔹 Rutas de leads
app.use('/leads', leadsRoutes);

// 🔹 Rutas de logs
app.use('/logs', logsRoutes);

// 🔹 Health check
app.get('/', (req, res) => {
  res.send('WhatsApp AI Bot running ✅');
});

export default app;
