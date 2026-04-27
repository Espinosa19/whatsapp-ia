import {
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
  updateConversationMode
} from '../services/leads.service.js';

/**
 * GET /leads
 * Obtiene todos los leads (con filtro opcional por estado)
 */
export async function getLeadsController(req, res) {
  try {
    const { status } = req.query;

    const leads = getAllLeads(status || null);
    console.log(`📊 Leads obtenidos${status ? ` con estado: ${status}` : ''}: ${leads.length}`);
    res.json({
      success: true,
      total: leads.length,
      leads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener leads',
      details: error.message,
    });
  }
}


/**
 * GET /leads/search
 * Busca leads por criterios
 */
export async function searchLeadsController(req, res) {
  try {
    const { clientName, clientPhone, serviceType, city, status, startDate, endDate } = req.query;

    const criteria = {};
    if (clientName) criteria.clientName = clientName;
    if (clientPhone) criteria.clientPhone = clientPhone;
    if (serviceType) criteria.serviceType = serviceType;
    if (city) criteria.city = city;
    if (status) criteria.status = status;
    if (startDate) criteria.startDate = startDate;
    if (endDate) criteria.endDate = endDate;

    const leads = searchLeads(criteria);

    res.json({
      total: leads.length,
      leads,
    });
  } catch (error) {
    console.error('❌ Error buscando leads:', error);
    res.status(500).json({
      error: 'Error al buscar leads',
      details: error.message,
    });
  }
}

/**
 * GET /leads/stats
 * Obtiene estadísticas de leads
 */
export async function getLeadsStatsController(req, res) {
  try {
    const stats = getLeadsStats();

    res.json(stats);
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de leads:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas',
      details: error.message,
    });
  }
}
export async function updateConversationModeController(req, res) {
  try {
    const { id } = req.params;
    const { mode } = req.body;

    // ✅ Validación
    if (!['bot', 'human'].includes(mode)) {
      return res.status(400).json({
        error: 'Modo inválido. Valores permitidos: bot, human'
      });
    }

    const result = updateConversationMode(id, mode);

    // 🔥 Validar si realmente se actualizó
    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Lead no encontrado'
      });
    }

    res.json({
      success: true,
      message: `Modo actualizado a: ${mode}`,
      leadId: id,
      mode
    });

  } catch (error) {
    console.error('❌ Error actualizando modo:', error);

    res.status(500).json({
      error: 'Error al actualizar modo de conversación',
      details: error.message
    });
  }
}
/**
 * GET /leads/:leadId
 * Obtiene un lead específico
 */
export async function getLeadDetailController(req, res) {
  try {
    const { leadId } = req.params;

    const lead = getLead(leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    res.json(lead);
  } catch (error) {
    console.error('❌ Error obteniendo detalles del lead:', error);
    res.status(500).json({
      error: 'Error al obtener lead',
      details: error.message,
    });
  }
}

/**
 * GET /leads/user/:userId
 * Obtiene leads de un usuario
 */
export async function getUserLeadsController(req, res) {
  try {
    const { userId } = req.params;

    const leads = getUserLeads(userId);

    res.json({
      userId,
      total: leads.length,
      leads,
    });
  } catch (error) {
    console.error('❌ Error obteniendo leads del usuario:', error);
    res.status(500).json({
      error: 'Error al obtener leads del usuario',
      details: error.message,
    });
  }
}

/**
 * POST /leads
 * Crear un nuevo lead
 */
export async function createLeadController(req, res) {
  try {
    const {
      userId,
      clientName,
      clientPhone,
      clientEmail,
      serviceType,
      address,
      city,
      status = 'nuevo',
      notes,
      preferredDate,
      preferredTime,
      eventId,
      calendarLink,
    } = req.body;

    // Validar campos requeridos
    if (!clientName || !clientPhone) {
      return res.status(400).json({
        error: 'Campos requeridos: clientName, clientPhone',
      });
    }

    const userIdentifier = userId || `visitor-${Date.now()}`;

    saveLead({
      userId: userIdentifier,
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
    });

    res.json({
      message: '✅ Lead guardado correctamente',
      clientName,
      clientPhone,
    });
  } catch (error) {
    console.error('❌ Error creando lead:', error);
    res.status(500).json({
      error: 'Error al guardar lead',
      details: error.message,
    });
  }
}

/**
 * PUT /leads/:leadId/status
 * Actualizar el estado de un lead
 */
export async function updateLeadStatusController(req, res) {
  try {
    const { leadId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status es requerido' });
    }

    const validStatuses = ['nuevo', 'contactado', 'convertido', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Status inválido. Valores válidos: ${validStatuses.join(', ')}`,
      });
    }

    updateLeadStatus(leadId, status);

    res.json({
      message: `✅ Lead actualizado a estado: ${status}`,
      leadId,
      status,
    });
  } catch (error) {
    console.error('❌ Error actualizando estado del lead:', error);
    res.status(500).json({
      error: 'Error al actualizar lead',
      details: error.message,
    });
  }
}

/**
 * PUT /leads/:leadId
 * Actualizar un lead completo
 */
export async function updateLeadController(req, res) {
  try {
    const { leadId } = req.params;
    const updateData = req.body;

    updateLead(leadId, updateData);

    res.json({
      message: '✅ Lead actualizado correctamente',
      leadId,
    });
  } catch (error) {
    console.error('❌ Error actualizando lead:', error);
    res.status(500).json({
      error: 'Error al actualizar lead',
      details: error.message,
    });
  }
}

/**
 * DELETE /leads/:leadId
 * Eliminar un lead
 */
export async function deleteLeadController(req, res) {
  try {
    const { leadId } = req.params;

    deleteLead(leadId);

    res.json({
      message: '✅ Lead eliminado correctamente',
      leadId,
    });
  } catch (error) {
    console.error('❌ Error eliminando lead:', error);
    res.status(500).json({
      error: 'Error al eliminar lead',
      details: error.message,
    });
  }
}

export default {
  getLeadsController,
  searchLeadsController,
  getLeadsStatsController,
  getLeadDetailController,
  getUserLeadsController,
  createLeadController,
  updateLeadStatusController,
  updateLeadController,
  deleteLeadController,
  updateConversationModeController
};
