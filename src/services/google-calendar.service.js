// src/services/google-calendar.service.js
// Mock básico para evitar error de importación y permitir pruebas del flujo.
// Reemplaza este mock por la integración real con Google Calendar cuando lo requieras.

/**
 * Crea un evento en Google Calendar (mock).
 * @param {Object} reservationData - Datos de la reservación.
 * @returns {Promise<{success: boolean, message: string, event?: any}>}
 */
export async function createGoogleCalendarEvent(reservationData) {
  // Validar datos requeridos
  if (!reservationData.preferredDate || !reservationData.preferredTime) {
    return {
      success: false,
      message: 'Faltan datos de fecha y hora para crear el evento en Google Calendar.'
    };
  }

  // Simula éxito siempre
  const [hourStr] = reservationData.preferredTime.split(':');
  const endHour = (parseInt(hourStr, 10) + 1).toString().padStart(2, '0');
  return {
    success: true,
    message: 'Evento creado en Google Calendar (mock).',
    event: {
      summary: reservationData.serviceType,
      description: reservationData.notes || '',
      location: reservationData.address,
      start: reservationData.preferredDate + 'T' + reservationData.preferredTime + ':00',
      end: reservationData.preferredDate + 'T' + endHour + ':00:00',
      clientName: reservationData.clientName,
      clientEmail: reservationData.clientEmail,
      clientPhone: reservationData.clientPhone
    }
  };
}
