import { saveMessageToDB, getUserHistory, clearUserHistory, getGlobalStats } from '../services/database.service.js';

/**
 * Guarda un mensaje en la BD
 */
export async function saveMessage(req, res) {
  try {
    const { userId, role, content } = req.body;

    if (!userId || !role || !content) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const result = saveMessageToDB(userId, role, content);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Obtiene el historial de un usuario
 */
export async function getHistory(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const history = getUserHistory(userId);
    res.json({ userId, messages: history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Limpia el historial de un usuario
 */
export async function clearHistory(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const result = clearUserHistory(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Obtiene estadísticas globales
 */
export async function getStats(req, res) {
  try {
    const stats = getGlobalStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export default {
  saveMessage,
  getHistory,
  clearHistory,
  getStats,
};
