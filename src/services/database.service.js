import { getDatabase } from '../config/database.config.js';

/**
 * Guarda un mensaje en SQLite
 */
export function saveMessageToDB(userId, role, content) {
  try {
    if (!userId || !role || !content) {
      throw new RangeError(`Too few parameter values were provided: userId='${userId}', role='${role}', content='${content}'`);
    }
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO messages (user_id, role, content)
      VALUES (?, ?, ?)
    `);
    stmt.run(userId, role, content);
    updateUserStats(userId);
    console.log(`💾 Mensaje guardado en SQLite para ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error guardando en SQLite:', error);
    throw error;
  }
}

/**
 * Obtiene el historial de un usuario desde SQLite
 */
export function getUserHistory(userId) {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT id, role, content, created_at
      FROM messages
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const messages = stmt.all(userId);
    console.log(`📖 Recuperados ${messages.length} mensajes para ${userId}`);

    return messages;
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    throw error;
  }
}

/**
 * Limpia el historial de un usuario
 */
export function clearUserHistory(userId) {
  try {
    const db = getDatabase();

    const stmt = db.prepare('DELETE FROM messages WHERE user_id = ?');
    const result = stmt.run(userId);

    console.log(`🗑️ Borrados ${result.changes} mensajes para ${userId}`);
    return { deletedCount: result.changes };
  } catch (error) {
    console.error('❌ Error limpiando historial:', error);
    throw error;
  }
}

/**
 * Actualiza estadísticas del usuario (opcional - ya no necesaria)
 */
function updateUserStats(userId) {
  try {
    // Las estadísticas se calculan directamente desde la tabla messages
    // Esta función es opcional ahora
    console.log(`📊 Stats actualizadas para ${userId}`);
  } catch (error) {
    console.error('❌ Error actualizando stats:', error);
  }
}

/**
 * Obtiene estadísticas globales
 */
export function getGlobalStats() {
  try {
    const db = getDatabase();

    // Contar mensajes totales
    const totalMessagesResult = db.prepare('SELECT COUNT(*) as count FROM messages').get();
    const totalMessages = totalMessagesResult?.count || 0;

    // Contar usuarios únicos
    const totalUsersResult = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM messages').get();
    const totalUsers = totalUsersResult?.count || 0;

    // Obtener top usuarios (si existen)
    const topUsers = db.prepare(`
      SELECT 
        user_id, 
        COUNT(*) as message_count,
        MAX(created_at) as last_message
      FROM messages
      GROUP BY user_id
      ORDER BY message_count DESC
      LIMIT 10
    `).all();

    return {
      totalMessages,
      totalUsers,
      topUsers: topUsers || [],
    };
  } catch (error) {
    console.error('❌ Error obteniendo stats:', error);
    throw error;
  }
}

export default {
  saveMessageToDB,
  getUserHistory,
  clearUserHistory,
  getGlobalStats,
};
