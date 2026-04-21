import { Router } from 'express';
import { saveMessage, getHistory, clearHistory, getStats } from '../controllers/database.controller.js';

const router = Router();

// Guardar un mensaje en la BD
router.post('/messages', saveMessage);

// Obtener historial de un usuario
router.get('/messages', getHistory);

// Limpiar historial de un usuario
router.delete('/messages', clearHistory);

// Obtener estadísticas
router.get('/stats', getStats);

export default router;
