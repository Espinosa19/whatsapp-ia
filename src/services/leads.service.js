import { getDatabase } from '../config/database.config.js';

/**
 * Guarda un nuevo lead en la base de datos
 */
export function saveLead({
  userId,
  clientName,
  clientPhone,
  clientEmail,
  serviceType,
  address,
  city,
  status = 'nuevo',
  notes = '',
  preferredDate = null,
  preferredTime = null,
  eventId = null,
  calendarLink = null,
}) {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO leads (
        user_id,
        client_name,
        client_phone,
        client_email,
        service_type,
        address,
        city,
        status,
        notes,
        preferred_date,
        preferred_time,
        event_id,
        calendar_link,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM leads WHERE user_id = ? AND client_phone = ?), CURRENT_TIMESTAMP),
        CURRENT_TIMESTAMP
      )
    `);

    stmt.run(
      userId,
      clientName,
      clientPhone,
      clientEmail,
      serviceType,
      address,
      city,
      status,
      notes,
      preferredDate,
      preferredTime,
      eventId,
      calendarLink,
      userId,
      clientPhone
    );

    console.log(`✅ Lead guardado: ${clientName} (${clientPhone})`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error guardando lead:', error);
    throw error;
  }
}

/**
 * Obtiene todos los leads
 */
export function getAllLeads(status = null) {
  try {
    const db = getDatabase();

    let query = `
      SELECT * FROM leads
    `;

    if (status) {
      query += ` WHERE status = ?`;
      const stmt = db.prepare(query + ` ORDER BY created_at DESC`);
      return stmt.all(status);
    }

    const stmt = db.prepare(query + ` ORDER BY created_at DESC`);
    return stmt.all();
  } catch (error) {
    console.error('❌ Error obteniendo leads:', error);
    throw error;
  }
}

/**
 * Obtiene leads por estado
 */
export function getLeadsByStatus(status) {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT * FROM leads
      WHERE status = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(status);
  } catch (error) {
    console.error('❌ Error obteniendo leads por estado:', error);
    throw error;
  }
}

/**
 * Obtiene un lead específico
 */
export function getLead(leadId) {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT * FROM leads WHERE id = ?
    `);

    return stmt.get(leadId);
  } catch (error) {
    console.error('❌ Error obteniendo lead:', error);
    throw error;
  }
}

/**
 * Obtiene leads de un usuario
 */
export function getUserLeads(userId) {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT * FROM leads
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(userId);
  } catch (error) {
    console.error('❌ Error obteniendo leads del usuario:', error);
    throw error;
  }
}

/**
 * Actualiza el estado de un lead
 */
export function updateLeadStatus(leadId, status) {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      UPDATE leads
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(status, leadId);
    console.log(`✅ Lead ${leadId} actualizado a estado: ${status}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error actualizando estado del lead:', error);
    throw error;
  }
}

/**
 * Actualiza un lead completo
 */
export function updateLead(leadId, updateData) {
  try {
    const db = getDatabase();

    const allowedFields = [
      'client_name',
      'client_email',
      'service_type',
      'address',
      'city',
      'status',
      'notes',
      'preferred_date',
      'preferred_time',
      'event_id',
      'calendar_link',
    ];

    const updates = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .map(key => `${key} = ?`);

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    const values = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .map(key => updateData[key]);

    const query = `
      UPDATE leads
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const stmt = db.prepare(query);
    stmt.run(...values, leadId);

    console.log(`✅ Lead ${leadId} actualizado`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error actualizando lead:', error);
    throw error;
  }
}

/**
 * Elimina un lead
 */
export function deleteLead(leadId) {
  try {
    const db = getDatabase();

    const stmt = db.prepare('DELETE FROM leads WHERE id = ?');
    stmt.run(leadId);

    console.log(`🗑️ Lead ${leadId} eliminado`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error eliminando lead:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de leads
 */
export function getLeadsStats() {
  try {
    const db = getDatabase();

    const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get()?.count || 0;
    const newLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'nuevo'").get()?.count || 0;
    const contactedLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'contactado'").get()?.count || 0;
    const convertedLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'convertido'").get()?.count || 0;
    const cancelledLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'cancelado'").get()?.count || 0;

    // Top servicios solicitados
    const topServices = db.prepare(`
      SELECT service_type, COUNT(*) as count
      FROM leads
      GROUP BY service_type
      ORDER BY count DESC
      LIMIT 5
    `).all();

    // Top ciudades
    const topCities = db.prepare(`
      SELECT city, COUNT(*) as count
      FROM leads
      GROUP BY city
      ORDER BY count DESC
      LIMIT 5
    `).all();

    // Leads en últimos 7 días
    const recentLeads = db.prepare(`
      SELECT COUNT(*) as count
      FROM leads
      WHERE created_at >= datetime('now', '-7 days')
    `).get()?.count || 0;

    return {
      totalLeads,
      byStatus: {
        nuevo: newLeads,
        contactado: contactedLeads,
        convertido: convertedLeads,
        cancelado: cancelledLeads,
      },
      topServices,
      topCities,
      recentLeads,
      conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0,
    };
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de leads:', error);
    throw error;
  }
}

/**
 * Búsqueda de leads por criterios
 */
export function searchLeads(criteria) {
  try {
    const db = getDatabase();

    let query = 'SELECT * FROM leads WHERE 1=1';
    const values = [];

    if (criteria.clientName) {
      query += ` AND client_name LIKE ?`;
      values.push(`%${criteria.clientName}%`);
    }

    if (criteria.clientPhone) {
      query += ` AND client_phone LIKE ?`;
      values.push(`%${criteria.clientPhone}%`);
    }

    if (criteria.serviceType) {
      query += ` AND service_type LIKE ?`;
      values.push(`%${criteria.serviceType}%`);
    }

    if (criteria.city) {
      query += ` AND city LIKE ?`;
      values.push(`%${criteria.city}%`);
    }

    if (criteria.status) {
      query += ` AND status = ?`;
      values.push(criteria.status);
    }

    if (criteria.startDate) {
      query += ` AND created_at >= ?`;
      values.push(criteria.startDate);
    }

    if (criteria.endDate) {
      query += ` AND created_at <= ?`;
      values.push(criteria.endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT 500`;

    const stmt = db.prepare(query);
    return stmt.all(...values);
  } catch (error) {
    console.error('❌ Error buscando leads:', error);
    throw error;
  }
}

export default {
  saveLead,
  getAllLeads,
  getLeadsByStatus,
  getLead,
  getUserLeads,
  updateLeadStatus,
  updateLead,
  deleteLead,
  getLeadsStats,
  searchLeads,
};
