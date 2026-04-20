import { Router } from 'express';
import {
  bookReservation,
  getUserReservationsController,
  cancelReservationController,
  getAvailableSlotsController,
  getReservationStatsController,
} from '../controllers/reservation.controller.js';

const router = Router();

/**
 * POST /reservations/book
 * Crear una nueva reservación de visita técnica
 */
router.post('/book', bookReservation);

/**
 * GET /reservations/user?userId=xxx
 * Obtener todas las reservaciones de un usuario
 */
router.get('/user', getUserReservationsController);

/**
 * DELETE /reservations/:eventId
 * Cancelar una reservación
 */
router.delete('/:eventId', cancelReservationController);

/**
 * GET /reservations/available?date=2024-01-15&duration=60
 * Obtener horarios disponibles
 */
router.get('/available', getAvailableSlotsController);

/**
 * GET /reservations/stats
 * Obtener estadísticas de reservaciones
 */
router.get('/stats', getReservationStatsController);

export default router;
