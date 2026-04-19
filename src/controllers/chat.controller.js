import { generateAIResponse } from '../services/ai.service.js';
import {
  getConversationHistory,
  saveMessageToHistory,
  formatHistoryForOpenAI,
  clearConversationHistory
} from '../services/conversation.service.js';

export const chatWithAI = async (req, res) => {
  const { message, history, userId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }

  // Usar userId del body o generar uno por defecto para Postman
  const userIdentifier = userId || 'postman-user-default';

  try {
    // 💾 Guardar mensaje del usuario
    await saveMessageToHistory(userIdentifier, 'user', message);

    // 📚 Obtener historial (si no se envía, recuperar del archivo)
    let conversationHistory;
    if (history) {
      // Si se envía historial manualmente
      conversationHistory = history;
    } else {
      // Recuperar del archivo guardado
      const savedHistory = await getConversationHistory(userIdentifier);
      conversationHistory = formatHistoryForOpenAI(savedHistory);
    }

    // 🤖 Generar respuesta
    const response = await generateAIResponse({
      userMessage: message,
      conversationHistory: conversationHistory,
    });

    // 💾 Guardar respuesta de la IA
    await saveMessageToHistory(userIdentifier, 'assistant', response);

    res.json({
      reply: response,
      userId: userIdentifier,
      historySize: conversationHistory.length,
    });
  } catch (error) {
    console.error('❌ Error en Chat Controller:', error);
    res.status(500).json({
      error: 'Error al procesar el mensaje',
      details: error.message,
    });
  }
};

// Endpoint para obtener historial
export const getHistory = async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId requerido' });
  }

  try {
    const history = await getConversationHistory(userId);
    res.json({
      userId,
      messages: history,
      totalMessages: history.length,
    });
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    res.status(500).json({
      error: 'Error al obtener el historial',
      details: error.message,
    });
  }
};

// Endpoint para limpiar historial
export const clearHistory = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId requerido' });
  }

  try {
    await clearConversationHistory(userId);
    res.json({
      message: 'Historial limpiado correctamente',
      userId,
    });
  } catch (error) {
    console.error('❌ Error limpiando historial:', error);
    res.status(500).json({
      error: 'Error al limpiar el historial',
      details: error.message,
    });
  }
};
