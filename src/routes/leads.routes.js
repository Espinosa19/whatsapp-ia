import { Router } from 'express';
import {
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
} from '../controllers/leads.controller.js';

const router = Router();

/**
 * GET /leads
 * Obtener todos los leads (con filtro opcional por estado)
 */
router.get('/', getLeadsController);

/**
 * GET /leads/stats
 * Obtener estadísticas de leads
 */
router.get('/stats', getLeadsStatsController);
router.put('/:id/mode',updateConversationModeController);
/**
 * GET /leads/search
 * Buscar leads por criterios
 */
router.get('/search', searchLeadsController);

/**
 * GET /leads/user/:userId
 * Obtener leads de un usuario específico
 */
router.get('/user/:userId', getUserLeadsController);

/**
 * GET /leads/:leadId
 * Obtener detalles de un lead específico
 */
router.get('/:leadId', getLeadDetailController);

/**
 * POST /leads
 * Crear un nuevo lead
 */
router.post('/', createLeadController);

/**
 * PUT /leads/:leadId
 * Actualizar un lead
 */
router.put('/:leadId', updateLeadController);

/**
 * PUT /leads/:leadId/status
 * Cambiar estado de un lead
 */
router.put('/:leadId/status', updateLeadStatusController);

/**
 * DELETE /leads/:leadId
 * Eliminar un lead
 */
router.delete('/:leadId', deleteLeadController);

export default router;
