import { Router } from 'express';
import { chatWithAI, getHistory, clearHistory } from '../controllers/chat.controller.js';

const router = Router();

// API interna para pruebas
router.post('/', chatWithAI);

// Obtener historial de conversación
router.get('/history', getHistory);

// Limpiar historial de conversación
router.delete('/history', clearHistory);

export default router;
