import { getRedisClient } from '../config/redis.config.js';

/**
 * Guarda un mensaje en el historial de conversación del usuario en Redis
 * Clave: conversation:{userId}
 * Valor: Array JSON de mensajes
 */
export async function saveMessageToHistory(userId, role, content) {
  try {
    const redis = await getRedisClient();
    
    // Crear objeto del mensaje con timestamp
    const message = {
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    // Obtener historial actual
    const key = `conversation:${userId}`;
    let history = [];
    
    const existingData = await redis.get(key);
    if (existingData) {
      history = JSON.parse(existingData);
    }

    // Agregar nuevo mensaje
    history.push(message);

    // Guardar en Redis (expiración de 7 días = 604800 segundos)
    await redis.setEx(key, 604800, JSON.stringify(history));
    
    console.log(`💾 Mensaje guardado para ${userId}`);
  } catch (error) {
    console.error('❌ Error guardando mensaje:', error);
    throw error;
  }
}

/**
 * Obtiene el historial de conversación completo de un usuario desde Redis
 */
export async function getConversationHistory(userId) {
  try {
    const redis = await getRedisClient();
    
    const key = `conversation:${userId}`;
    const data = await redis.get(key);

    if (!data) {
      return [];
    }

    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    return [];
  }
}

/**
 * Formatea el historial de conversación para ser compatible con OpenAI
 * Convierte los mensajes al formato esperado por la API de OpenAI
 */
export function formatHistoryForOpenAI(history) {
  try {
    return history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  } catch (error) {
    console.error('❌ Error formateando historial:', error);
    return [];
  }
}

/**
 * Limpia completamente el historial de un usuario de Redis
 */
export async function clearConversationHistory(userId) {
  try {
    const redis = await getRedisClient();
    
    const key = `conversation:${userId}`;
    await redis.del(key);

    console.log(`🗑️ Historial limpiado para ${userId}`);
  } catch (error) {
    console.error('❌ Error limpiando historial:', error);
    throw error;
  }
}

/**
 * Obtiene todas las claves de conversación activas (para administración)
 */
export async function getAllConversationKeys() {
  try {
    const redis = await getRedisClient();
    
    const keys = await redis.keys('conversation:*');
    return keys;
  } catch (error) {
    console.error('❌ Error obteniendo claves:', error);
    return [];
  }
}

/**
 * Obtiene estadísticas de todas las conversaciones
 */
export async function getConversationStats() {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys('conversation:*');
    
    let totalUsers = keys.length;
    let totalMessages = 0;

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const history = JSON.parse(data);
        totalMessages += history.length;
      }
    }

    return {
      totalUsers,
      totalMessages,
      averageMessagesPerUser: totalUsers > 0 ? (totalMessages / totalUsers).toFixed(2) : 0,
    };
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    return null;
  }
}

/**
 * Elimina conversaciones expiradas manualmente (normalmente Redis lo hace automáticamente)
 */
export async function cleanupExpiredConversations() {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys('conversation:*');

    let cleaned = 0;
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -2) {
        cleaned++;
      }
    }

    console.log(`🧹 ${cleaned} conversaciones expiradas limpiadas`);
    return cleaned;
  } catch (error) {
    console.error('❌ Error limpiando conversaciones expiradas:', error);
    return 0;
  }
}
