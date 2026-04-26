import { getGoogleCalendarInstance, getCalendarId, isGoogleCalendarConfigured } from '../config/google-calendar.config.js';
import { getRedisClient } from '../config/redis.config.js';

/**
 * Crea una reservación de visita técnica en Google Calendar
 * Parámetros:
 * - userId: ID del usuario (número de WhatsApp o similar)
 * - clientName: Nombre del cliente
 * - clientPhone: Teléfono del cliente
 * - clientEmail: Email del cliente (opcional)
 * - serviceType: Tipo de servicio (instalación, reparación, etc)
 * - dateTime: Fecha y hora de la visita (ISO string o Date)
 * - duration: Duración de la visita en minutos (default: 60)
 * - address: Dirección donde se hará la visita
 * - notes: Notas adicionales
 */
export async function createReservation({
  userId,
  clientName,
  clientPhone,
  clientEmail,
  serviceType,
  dateTime,
  duration = 60,
  address,
  notes,
}) {
  try {
    if (!isGoogleCalendarConfigured()) {
      console.warn('⚠️ Google Calendar no está configurado');
      return {
        success: false,
        error: 'Google Calendar no está configurado',
      };
    }

    const calendar = await getGoogleCalendarInstance();
    if (!calendar) {
      throw new Error('No se pudo inicializar Google Calendar');
    }

    // Validar entrada
    if (!clientName || !dateTime || !serviceType) {
      throw new Error('Datos requeridos: clientName, dateTime, serviceType');
    }

    // Parsear fecha
    const startTime = new Date(dateTime);
    const endTime = new Date(startTime.getTime() + duration * 60000);
    const timezone = process.env.TIMEZONE || 'America/Mexico_City';

    // Convertir a formato de hora local para Google Calendar (sin Z)
    // Google Calendar espera: "2026-04-21T15:00:00" (sin Z) cuando usas timeZone
    function formatDateTimeForGoogle(date, tz) {
      const formatter = new Intl.DateTimeFormat('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: tz,
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      const values = {};
      parts.forEach(({ type, value }) => {
        values[type] = value;
      });

      return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
    }

    const startTimeFormatted = formatDateTimeForGoogle(startTime, timezone);
    const endTimeFormatted = formatDateTimeForGoogle(endTime, timezone);

    console.log('📅 Fechas convertidas:');
    console.log('   - Start (UTC):', startTime.toISOString());
    console.log('   - Start (Local):', startTimeFormatted);
    console.log('   - End (Local):', endTimeFormatted);

    // Crear descripción del evento
    const eventDescription = `
Visita Técnica - ${serviceType}

👤 Cliente: ${clientName}
📞 Teléfono: ${clientPhone}
${clientEmail ? `📧 Email: ${clientEmail}` : ''}
📍 Dirección: ${address || 'No especificada'}

📝 Notas:
${notes || 'Sin notas adicionales'}

ID Usuario: ${userId}
`;

    // Crear evento en Google Calendar
    const event = {
      summary: `Visita Técnica: ${serviceType} - ${clientName}`,
      description: eventDescription,
      start: {
        dateTime: startTimeFormatted,
        timeZone: timezone,
      },
      end: {
        dateTime: endTimeFormatted,
        timeZone: timezone,
      },
      location: address,
      // Reminders simplificados - apenas notificación
      reminders: {
        useDefault: true,  // Usar configuración por defecto de Google Calendar
      },
    };

    // Insertar evento en Google Calendar
    const calendarId = getCalendarId();
    console.log('📅 Intentando crear evento con:');
    console.log('   - Calendar ID:', calendarId);
    console.log('   - Evento completo:');
    console.log(JSON.stringify(event, null, 2));
    
    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event,
      sendUpdates: 'none',  // Nunca enviar actualizaciones (el Service Account no tiene permiso)
    });

    const eventId = response.data.id;

    // Guardar reservación en Redis
    const reservationData = {
      eventId,
      userId,
      clientName,
      clientPhone,
      clientEmail,
      serviceType,
      dateTime: startTime.toISOString(),
      duration,
      address,
      notes,
      createdAt: new Date().toISOString(),
      status: 'confirmado',
    };

    const redis = await getRedisClient();
    const reservationKey = `reservation:${userId}:${eventId}`;
    await redis.setEx(reservationKey, 30 * 24 * 60 * 60, JSON.stringify(reservationData)); // 30 días

    // Guardar también una lista de reservaciones del usuario
    const userReservationsKey = `user-reservations:${userId}`;
    let userReservations = [];
    const existingReservations = await redis.get(userReservationsKey);
    if (existingReservations) {
      userReservations = JSON.parse(existingReservations);
    }
    userReservations.push(eventId);
    await redis.setEx(userReservationsKey, 30 * 24 * 60 * 60, JSON.stringify(userReservations));

    console.log(`✅ Reservación creada: ${eventId} para ${clientName}`);

    return {
      success: true,
      eventId,
      eventLink: response.data.htmlLink,
      reservation: reservationData,
    };
  } catch (error) {
    console.error('❌ Error creando reservación:', error.message);
    console.error('Stack:', error.stack);
    
    // Mostrar toda la información disponible del error
    if (error.response) {
      console.error('📌 Respuesta de error completa:');
      console.error(JSON.stringify(error.response, null, 2));
    }
    
    if (error.errors && error.errors.length > 0) {
      console.error('📌 Detalles del error de Google:');
      error.errors.forEach((err, index) => {
        console.error(`   Error ${index + 1}:`, err.message);
        console.error(`   Razón:`, err.reason);
      });
    }
    
    // Intentar obtener más detalles si está disponible
    if (error.cause) {
      console.error('📌 Causa del error:', error.cause);
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Obtiene las reservaciones de un usuario
 */
export async function getUserReservations(userId) {
  try {
    const redis = await getRedisClient();
    const userReservationsKey = `user-reservations:${userId}`;

    const eventIds = await redis.get(userReservationsKey);
    if (!eventIds) {
      return [];
    }

    const eventIdList = JSON.parse(eventIds);
    const reservations = [];

    for (const eventId of eventIdList) {
      const reservationKey = `reservation:${userId}:${eventId}`;
      const reservationData = await redis.get(reservationKey);
      if (reservationData) {
        reservations.push(JSON.parse(reservationData));
      }
    }

    return reservations.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  } catch (error) {
    console.error('❌ Error obteniendo reservaciones del usuario:', error);
    return [];
  }
}

/**
 * Cancela una reservación
 */
export async function cancelReservation(userId, eventId) {
  try {
    if (!isGoogleCalendarConfigured()) {
      return {
        success: false,
        error: 'Google Calendar no está configurado',
      };
    }

    const calendar = await getGoogleCalendarInstance();
    if (!calendar) {
      throw new Error('No se pudo inicializar Google Calendar');
    }

    // Eliminar evento de Google Calendar
    await calendar.events.delete({
      calendarId: getCalendarId(),
      eventId: eventId,
    });

    // Eliminar de Redis
    const redis = await getRedisClient();
    const reservationKey = `reservation:${userId}:${eventId}`;
    await redis.del(reservationKey);

    // Actualizar lista de reservaciones del usuario
    const userReservationsKey = `user-reservations:${userId}`;
    const eventIds = await redis.get(userReservationsKey);
    if (eventIds) {
      const eventIdList = JSON.parse(eventIds);
      const updatedList = eventIdList.filter((id) => id !== eventId);
      if (updatedList.length > 0) {
        await redis.setEx(userReservationsKey, 30 * 24 * 60 * 60, JSON.stringify(updatedList));
      } else {
        await redis.del(userReservationsKey);
      }
    }

    console.log(`✅ Reservación cancelada: ${eventId}`);

    return {
      success: true,
      eventId,
    };
  } catch (error) {
    console.error('❌ Error cancelando reservación:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Obtiene los horarios disponibles en Google Calendar para una fecha
 */
export async function getAvailableSlots(date, duration = 60) {
  try {
    if (!isGoogleCalendarConfigured()) {
      return [];
    }

    const calendar = await getGoogleCalendarInstance();
    if (!calendar) {
      throw new Error('No se pudo inicializar Google Calendar');
    }

    const now = new Date();
    const requestedDate = new Date(date);
    const isToday =
      requestedDate.getFullYear() === now.getFullYear() &&
      requestedDate.getMonth() === now.getMonth() &&
      requestedDate.getDate() === now.getDate();

    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(9, 0, 0, 0); // Abre a las 9 AM

    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(18, 0, 0, 0); // Cierra a las 6 PM

    // Obtener eventos del día
    const response = await calendar.events.list({
      calendarId: getCalendarId(),
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Calcular slots disponibles
    const availableSlots = [];
    let currentTime = new Date(startOfDay);

    while (currentTime < endOfDay) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60000);

      // Si la fecha es hoy, solo mostrar horarios futuros
      if (isToday && slotEnd <= now) {
        currentTime = new Date(currentTime.getTime() + 30 * 60000);
        continue;
      }

      // Verificar si este slot se superpone con algún evento
      const isAvailable = !events.some((event) => {
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        return currentTime < eventEnd && slotEnd > eventStart;
      });

      if (isAvailable) {
        availableSlots.push({
          start: currentTime.toISOString(),
          end: slotEnd.toISOString(),
        });
      }

      currentTime = new Date(currentTime.getTime() + 30 * 60000); // Incrementar por 30 minutos
    }

    // Si no hay horarios disponibles para hoy y la fecha es hoy, sugerir el siguiente día disponible
    if (isToday && availableSlots.length === 0) {
      // Buscar el siguiente día con horarios disponibles (máximo 7 días adelante)
      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date(now);
        nextDate.setDate(now.getDate() + i);
        const nextSlots = await getAvailableSlots(nextDate, duration);
        if (nextSlots.length > 0) {
          return { availableSlots: [], nextAvailable: { date: nextDate.toISOString().split('T')[0], slots: nextSlots } };
        }
      }
      // Si no hay horarios en los próximos 7 días
      return { availableSlots: [], nextAvailable: null };
    }

    return { availableSlots, nextAvailable: null };
  } catch (error) {
    console.error('❌ Error obteniendo slots disponibles:', error);
    return { availableSlots: [], nextAvailable: null };
  }
}

/**
 * Obtiene estadísticas de reservaciones
 */
export async function getReservationStats() {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys('reservation:*');

    let totalReservations = keys.length;
    let reservationsByType = {};
    let upcomingReservations = 0;
    let pastReservations = 0;
    const now = new Date();

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const reservation = JSON.parse(data);
        
        // Contar por tipo de servicio
        reservationsByType[reservation.serviceType] = (reservationsByType[reservation.serviceType] || 0) + 1;

        // Contar próximas y pasadas
        if (new Date(reservation.dateTime) > now) {
          upcomingReservations++;
        } else {
          pastReservations++;
        }
      }
    }

    return {
      totalReservations,
      upcomingReservations,
      pastReservations,
      reservationsByType,
    };
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    return null;
  }
}
