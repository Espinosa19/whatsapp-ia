import { Router } from 'express';
import { 
  getConversationStats,
  getAllConversationKeys,
  cleanupExpiredConversations
} from '../services/conversation.service.js';

const router = Router();

/**
 * GET /admin/stats - Obtiene estadísticas de todas las conversaciones
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getConversationStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /admin/conversations - Lista todas las conversaciones activas
 */
router.get('/conversations', async (req, res) => {
  try {
    const keys = await getAllConversationKeys();
    const conversationIds = keys.map(key => key.replace('conversation:', ''));
    res.json({
      total: conversationIds.length,
      conversations: conversationIds,
    });
  } catch (error) {
    console.error('❌ Error listando conversaciones:', error);
    res.status(500).json({ error: 'Error al listar conversaciones' });
  }
});

/**
 * POST /admin/cleanup - Limpia conversaciones expiradas
 */
router.post('/cleanup', async (req, res) => {
  try {
    const cleaned = await cleanupExpiredConversations();
    res.json({
      message: 'Limpieza completada',
      cleanedCount: cleaned,
    });
  } catch (error) {
    console.error('❌ Error limpiando conversaciones:', error);
    res.status(500).json({ error: 'Error al limpiar conversaciones' });
  }
});

export default router;
