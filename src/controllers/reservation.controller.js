import {
  createReservation,
  getUserReservations,
  cancelReservation,
  getAvailableSlots,
  getReservationStats,
} from '../services/reservation.service.js';

/**
 * POST /reservations/book
 * Crea una nueva reservación de visita técnica
 */
export const bookReservation = async (req, res) => {
  const {
    userId,
    clientName,
    clientPhone,
    clientEmail,
    serviceType,
    dateTime,
    duration,
    address,
    notes,
  } = req.body;

  // Validar campos requeridos
  if (!clientName || !clientPhone || !serviceType || !dateTime || !address) {
    return res.status(400).json({
      error: 'Campos requeridos: clientName, clientPhone, serviceType, dateTime, address',
    });
  }

  const userIdentifier = userId || `visitor-${Date.now()}`;

  try {
    const result = await createReservation({
      userId: userIdentifier,
      clientName,
      clientPhone,
      clientEmail,
      serviceType,
      dateTime,
      duration: duration || 60,
      address,
      notes,
    });

    if (result.success) {
      res.json({
        message: '✅ Visita técnica reservada correctamente',
        reservation: result.reservation,
        eventLink: result.eventLink,
      });
    } else {
      res.status(500).json({
        error: 'Error al crear la reservación',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('❌ Error en bookReservation:', error);
    res.status(500).json({
      error: 'Error al procesar la reservación',
      details: error.message,
    });
  }
};

/**
 * GET /reservations/user?userId=xxx
 * Obtiene todas las reservaciones de un usuario
 */
export const getUserReservationsController = async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId requerido' });
  }

  try {
    const reservations = await getUserReservations(userId);

    res.json({
      userId,
      totalReservations: reservations.length,
      reservations,
    });
  } catch (error) {
    console.error('❌ Error obteniendo reservaciones:', error);
    res.status(500).json({
      error: 'Error al obtener reservaciones',
      details: error.message,
    });
  }
};

/**
 * DELETE /reservations/:eventId
 * Cancela una reservación
 */
export const cancelReservationController = async (req, res) => {
  const { eventId } = req.params;
  const { userId } = req.body;

  if (!eventId || !userId) {
    return res.status(400).json({ error: 'eventId y userId requeridos' });
  }

  try {
    const result = await cancelReservation(userId, eventId);

    if (result.success) {
      res.json({
        message: '✅ Reservación cancelada',
        eventId,
      });
    } else {
      res.status(500).json({
        error: 'Error al cancelar la reservación',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('❌ Error cancelando reservación:', error);
    res.status(500).json({
      error: 'Error al cancelar la reservación',
      details: error.message,
    });
  }
};

/**
 * GET /reservations/available?date=2024-01-15&duration=60
 * Obtiene los horarios disponibles para una fecha
 */
export const getAvailableSlotsController = async (req, res) => {
  const { date, duration } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'date requerida (formato: YYYY-MM-DD)' });
  }

  try {
    const slots = await getAvailableSlots(new Date(date), parseInt(duration) || 60);

    res.json({
      date,
      duration: parseInt(duration) || 60,
      availableSlots: slots,
      totalSlots: slots.length,
    });
  } catch (error) {
    console.error('❌ Error obteniendo slots:', error);
    res.status(500).json({
      error: 'Error al obtener horarios disponibles',
      details: error.message,
    });
  }
};

/**
 * GET /reservations/stats
 * Obtiene estadísticas de reservaciones
 */
export const getReservationStatsController = async (req, res) => {
  try {
    const stats = await getReservationStats();

    res.json(stats);
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas',
      details: error.message,
    });
  }
};
